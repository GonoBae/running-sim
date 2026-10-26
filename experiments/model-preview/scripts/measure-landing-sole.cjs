// Browser-side observer: reuse the material vertex IDs recorded by M51.
// These regions are independent of the M53 runtime's selection/calculation.
module.exports = async function measure({samples,specs}) {
 const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
 a.renderer.setAnimationLoop(null);
 return samples.map(phase=>{
  a.seek(phase*a.cycle.period);
  return {phase,lanes:a.comparison.lanes.map(lane=>{
   const bones=Object.fromEntries(lane.bones.map(b=>[b.name,{p:lane.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).normalize().toArray()}]));
   const feet={};
   for(const side of ['r','l']){
    const mean=ids=>{const p=new T.Vector3();for(const v of ids){const m=lane.model.getObjectByName(v.mesh);m.skeleton.update();p.add(m.getVertexPosition(v.id,new T.Vector3()).applyMatrix4(m.matrixWorld));}return lane.group.worldToLocal(p.divideScalar(ids.length));};
    const regions=Object.fromEntries(['heel','toe','negativeX','positiveX'].map(n=>[n,mean(specs[side][n])]));
    const f=regions.toe.clone().sub(regions.heel),x=regions.positiveX.clone().sub(regions.negativeX);
    const forward=f.clone().normalize(),right=x.clone().addScaledVector(forward,-x.dot(forward)).normalize();
    const yaw=Math.atan2(f.x,f.z),horizontalRight=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),upright=forward.clone().cross(horizontalRight);
    const bank=Math.atan2(right.dot(upright),right.dot(horizontalRight))*180/Math.PI;
    const footQ=new T.Quaternion(...bones['foot_'+side].q),calfQ=new T.Quaternion(...bones['calf_'+side].q);
    const patch=lane.contactPlans.find(p=>p.window.side===side).patch;
    feet[side]={regions:Object.fromEntries(Object.entries(regions).map(([k,v])=>[k,v.toArray()])),bank,yaw:yaw*180/Math.PI,pitch:Math.atan2(f.y,Math.hypot(f.x,f.z))*180/Math.PI,tilt:Math.atan2(x.y,Math.hypot(x.x,x.z))*180/Math.PI,toeHeelMm:(regions.toe.y-regions.heel.y)*1000,sideGapMm:(regions.positiveX.y-regions.negativeX.y)*1000,patch:lane.group.worldToLocal(patch.read()).toArray(),floor:lane.readSurface(side).min,relativeQ:calfQ.invert().multiply(footQ).normalize().toArray()};
   }
   return {bones,feet};
  }),diagnostics:structuredClone(a.comparison.diagnostics)};
 });
};
