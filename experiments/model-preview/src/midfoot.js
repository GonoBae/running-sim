import {Quaternion,Vector3} from 'three';
import {createSkinPointBatch} from '../review/skin-point-batch.js';
import {solveSupportLeg} from '../review/shared-support.js';
import {createHeightTransition} from '../review/leg-height.js';

// Authored 35_17 preview phases, not measured force-platform contact events.
export const MIDFOOT=Object.freeze({start:.16,land:.26,hold:.34,end:.42});
const smooth=x=>{x=Math.max(0,Math.min(1,x));return Math.max(0,Math.min(1,x*x*x*(10+x*(-15+6*x))));};
export function midfootWeight(phase,side){
 const t=((phase-(side==='l'?.5:0))%1+1)%1;
 if(t<=MIDFOOT.start||t>=MIDFOOT.end)return 0;
 return smooth((t-MIDFOOT.start)/(MIDFOOT.land-MIDFOOT.start))*(1-smooth((t-MIDFOOT.hold)/(MIDFOOT.end-MIDFOOT.hold)));
}
const position=b=>b.getWorldPosition(new Vector3());

/** Capture anatomical patches once in the NEUTRAL, resized body. Never select
 * new vertex IDs from the running pose. Forefoot excludes the toe tips. */
export function captureFootPatches(model){
 const result={};
 for(const side of ['r','l']){
  const vertices=[];
  model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const a=mesh.geometry.attributes,ids=[];
   for(let i=0;i<a.skinIndex.count;i++){let w=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[a.skinIndex.getComponent(i,j)].name))w+=a.skinWeight.getComponent(i,j);if(w>.99)ids.push(i);}
   createSkinPointBatch(mesh)(ids).forEach((p,j)=>vertices.push({mesh:mesh.name,id:ids[j],p}));
  });
  const min=Math.min(...vertices.map(v=>v.p.z)),max=Math.max(...vertices.map(v=>v.p.z)),length=max-min;
  const region=(lo,hi)=>vertices.filter(v=>v.p.z>=min+length*lo&&v.p.z<=min+length*hi).map(({mesh,id})=>({mesh,id}));
  const heel=region(0,.25),forefoot=region(.55,.8);
  if(heel.length<3||forefoot.length<3)throw Error('Foot contact patches are missing.');
  result[side]={heel,forefoot};
 }
 return result;
}

export function bindFootPatches(model,spec){
 const groups={};
 for(const side of ['r','l'])groups[side]=Object.fromEntries(Object.entries(spec[side]).map(([region,ids])=>{
  const byMesh=new Map();for(const v of ids){if(!byMesh.has(v.mesh))byMesh.set(v.mesh,[]);byMesh.get(v.mesh).push(v.id);}
  return [region,[...byMesh].map(([name,indices])=>({indices,batch:createSkinPointBatch(model.getObjectByName(name))}))];
 }));
 return side=>{
  const regions=Object.fromEntries(Object.entries(groups[side]).map(([name,sets])=>{
   const points=sets.flatMap(s=>s.batch(s.indices)),min=Math.min(...points.map(p=>p.y)),low=new Vector3(),center=new Vector3();let sum=0;
   // Smooth low patch avoids snapping between neighbouring lowest vertices.
   for(const p of points){const w=Math.exp(-(p.y-min)/.0005);low.addScaledVector(p,w);sum+=w;center.add(p);}
   return [name,{min,low:low.divideScalar(sum),center:center.divideScalar(points.length)}];
  }));
  return {...regions,anchor:regions.heel.center.clone().add(regions.forefoot.center).multiplyScalar(.5)};
 };
}

/** Add a bounded landing-only change after the existing pose parameters.
 * Rotate the foot subtree, then solve hip/knee to retain sole height and the
 * same material anchor X/Z. Never move the pelvis or change bone lengths. */
export function createMidfoot(baseline,model,patches){
 const read=bindFootPatches(model,patches);
 return {patches,read,apply(lane,probe,phase,legCm=0,elbowDeg=0,leanDeg=0,amount=0,pitchDeg=0){
  if(!Number.isFinite(amount)||amount<0||amount>1)throw new RangeError('Midfoot blend must be between zero and one.');
  if(!Number.isFinite(pitchDeg)||Math.abs(pitchDeg)>10)throw new RangeError('Foot-strike pitch must be between -10 and 10 degrees.');
  const prior=baseline.apply(lane,probe,phase,legCm,elbowDeg,leanDeg),changes=[];
  if(amount===0)return {...prior,midfoot:changes};
  for(const side of ['r','l']){
   const weight=midfootWeight(phase,side)*amount;if(weight<1e-12)continue;
   const hip=model.getObjectByName('thigh_'+side),knee=model.getObjectByName('calf_'+side),foot=model.getObjectByName('foot_'+side);
   const before=read(side),floor=lane.readSurface(side).min,anchor=before.anchor;
   const heading=before.forefoot.center.clone().sub(before.heel.center);heading.y=0;heading.normalize();
   const axis=new Vector3(heading.z,0,-heading.x),low=before.forefoot.low.clone().sub(before.heel.low);
   const angle=(Math.atan2(low.y,low.dot(heading))-pitchDeg*Math.PI/180)*weight;
   const turn=new Quaternion().setFromAxisAngle(axis,angle),parent=foot.parent.getWorldQuaternion(new Quaternion()).normalize();
   foot.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent)).normalize();model.updateMatrixWorld(true);
   // Forefoot contact flexes at the ball as the heel rises. Without this,
   // rotating the rigid foot would place all support on the toe tips.
   if(pitchDeg<0){
    const ball=model.getObjectByName('ball_'+side),toeParent=ball.parent.getWorldQuaternion(new Quaternion()).normalize();
    const toeTurn=new Quaternion().setFromAxisAngle(axis,pitchDeg*Math.PI/180*weight);
    ball.quaternion.premultiply(toeParent.clone().invert().multiply(toeTurn).multiply(toeParent)).normalize();model.updateMatrixWorld(true);
   }
   // Preserve the existing knee bend plane instead of reconstructing a new
   // left/right Euler convention. Iteration also handles blended ankle skin.
   let iterations=0,residual=Infinity;
   for(let i=0;i<6;i++){
    const current=read(side),delta=new Vector3(anchor.x-current.anchor.x,floor-lane.readSurface(side).min,anchor.z-current.anchor.z);
    residual=delta.length();if(residual<1e-7)break;
    solveSupportLeg(model,hip,knee,foot,position(foot).add(delta));iterations++;
   }
   const after=read(side);
   changes.push({side,weight,pitchDeg,rotationDeg:angle*180/Math.PI,beforeGapMm:(before.forefoot.min-before.heel.min)*1000,
    gapMm:(after.forefoot.min-after.heel.min)*1000,heelMm:after.heel.min*1000,forefootMm:after.forefoot.min*1000,
    floorMm:lane.readSurface(side).min*1000,anchorDeltaMm:Math.hypot(after.anchor.x-anchor.x,after.anchor.z-anchor.z)*1000,residualMm:residual*1000,iterations});
  }
  return {...prior,midfoot:changes};
 }};
}

export function createMidfootTransition(){
 const state=createHeightTransition();
 return {get value(){return state.value/10;},set(value,immediate=false){state.set(value*10,immediate);},tick(dt){return state.tick(dt)/10;}};
}
