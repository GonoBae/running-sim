import {Quaternion,Vector3} from 'three';

// Canonical right-leg phases. Left support uses the same interval + half a
// cycle, including its release across the loop seam; these are not force events.
export const SUPPORT_WINDOW=Object.freeze({start:.38,holdStart:.43,holdEnd:.55,end:.60,selectedAt:.50});
const wrap=t=>((t%1)+1)%1;

// Quintic Hermite segment: position, velocity and acceleration at both ends.
export function supportBridge(A,B,u,length){
 const d=B.p.clone().sub(A.p),v=A.v.clone().multiplyScalar(length),w=B.v.clone().multiplyScalar(length);
 const a=A.a.clone().multiplyScalar(length*length),b=B.a.clone().multiplyScalar(length*length);
 return A.p.clone().addScaledVector(v,u).addScaledVector(a,.5*u*u)
  .addScaledVector(d,10*u**3-15*u**4+6*u**5)
  .addScaledVector(v,-6*u**3+8*u**4-3*u**5).addScaledVector(w,-4*u**3+7*u**4-3*u**5)
  .addScaledVector(a,-1.5*u**3+1.5*u**4-.5*u**5).addScaledVector(b,.5*u**3-u**4+.5*u**5);
}

// Two-link IK using rotation DELTAS in the existing parent frame. Rebuilding
// absolute world quaternions from matrices at the zero-correction endpoints
// creates small offsets that become visible in velocity/loop checks.
export function solveSupportLeg(model,hip,knee,foot,goal,bendDirection=null){
 const pos=b=>b.getWorldPosition(new Vector3());
 const H=pos(hip),K=pos(knee),A=pos(foot),upper=K.clone().sub(H),lower=A.clone().sub(K);
 const a=upper.length(),b=lower.length(),axis=goal.clone().sub(H),distance=axis.length();
 if(distance>=a+b-1e-8||distance<=Math.abs(a-b)+1e-8)throw Error('Support target is outside the leg reach.');
 axis.divideScalar(distance);
 const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 const pole=bendDirection??upper;
 const bend=pole.clone().addScaledVector(axis,-pole.dot(axis));
 if(bend.length()<1e-8)throw Error('Support knee bend direction is undefined.');
 const nextK=H.clone().addScaledVector(axis,along).addScaledVector(bend.normalize(),height);
 const upperTurn=new Quaternion().setFromUnitVectors(upper.normalize(),nextK.clone().sub(H).normalize());
 const lowerTurn=new Quaternion().setFromUnitVectors(lower.normalize(),goal.clone().sub(nextK).normalize());
 const parent=hip.parent.getWorldQuaternion(new Quaternion()).normalize();
 const oldHip=hip.quaternion.clone(),oldKnee=knee.quaternion.clone(),oldFoot=foot.quaternion.clone();
 hip.quaternion.copy(parent.clone().invert().multiply(upperTurn).multiply(parent).multiply(oldHip).normalize());
 knee.quaternion.copy(hip.quaternion.clone().invert().multiply(parent.clone().invert()).multiply(lowerTurn)
  .multiply(parent).multiply(oldHip).multiply(oldKnee).normalize());
 foot.quaternion.copy(knee.quaternion.clone().invert().multiply(hip.quaternion.clone().invert())
  .multiply(oldHip).multiply(oldKnee).multiply(oldFoot).normalize());
 model.updateMatrixWorld(true);
}

export function createSharedSupport(baseline,lane,probe,travel,options=SUPPORT_WINDOW){
 const {start,holdStart,holdEnd,end,selectedAt,anchorAt=holdStart}=options;
 const side=options.side??'r',shift=side==='l'?.5:0;
 if(side!=='r'&&side!=='l')throw Error('Invalid support side.');
 if(!(start<holdStart&&holdStart<holdEnd&&holdEnd<end&&end<1))throw Error('Invalid shared support interval.');
 baseline.apply(lane,probe,selectedAt+shift);
 // Pick a material point once. Following a newly selected minimum each frame
 // can conceal sliding and introduce jumps when skin vertices exchange rank.
 let vertex=null,lowest=Infinity;
 const supportBones=new RegExp(`^(foot|ball)_${side}$`);
 lane.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton.update();
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let id=0;id<skinIndex.count;id++){
   let weight=0;
   for(let j=0;j<4;j++)if(supportBones.test(mesh.skeleton.bones[skinIndex.getComponent(id,j)].name))weight+=skinWeight.getComponent(id,j);
   if(weight<.9)continue;
   const point=mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld);
   if(point.y<lowest){lowest=point.y;vertex={mesh:mesh.name,id};}
  }
 });
 if(!vertex)throw Error('No '+side+' support material point.');
 function read(target){
  const mesh=target.model.getObjectByName(vertex.mesh);mesh.skeleton.update();
  return mesh.getVertexPosition(vertex.id,new Vector3()).applyMatrix4(mesh.matrixWorld);
 }
 const sample=t=>{
  baseline.apply(lane,probe,t+shift);
  return lane.group.worldToLocal(read(lane));
 };
 const boundary=t=>{
  const h=1e-4,p=sample(t),lo=sample(t-h),hi=sample(t+h);
  return {p,v:hi.clone().sub(lo).divideScalar(2*h),a:hi.clone().add(lo).addScaledVector(p,-2).divideScalar(h*h)};
 };
 // The early-support experiment retains the touchdown location while braking.
 // Existing callers still anchor at holdStart and retain their original result.
 const anchor=sample(anchorAt),fixed={p:anchor,v:new Vector3(),a:new Vector3()};
 const entry=boundary(start),exit=boundary(end);
 function path(t){
  if(t<holdStart)return supportBridge(entry,fixed,(t-start)/(holdStart-start),holdStart-start);
  if(t<=holdEnd)return anchor.clone();
  return supportBridge(fixed,exit,(t-holdEnd)/(end-holdEnd),end-holdEnd);
 }
 function apply(target,mirrorProbe,phase){
  const result=baseline.apply(target,mirrorProbe,phase),t=wrap(phase-shift);
  if(t<=start||t>=end)return {...result,support:result.support??{active:false,side}};
  const model=target.model,hip=model.getObjectByName('thigh_'+side),knee=model.getObjectByName('calf_'+side),foot=model.getObjectByName('foot_'+side);
  const pos=b=>b.getWorldPosition(new Vector3());
  // The left anchor was sampled at +1/2 cycle. Its integer travel offset must
  // use that same origin; otherwise the foot jumps a stride at phase zero.
  const before=read(target),goal=path(t).addScaledVector(travel,Math.floor(phase-shift));
  target.group.localToWorld(goal);
  // Keep the existing foot height and WORLD orientation; the calf-relative
  // ankle angle necessarily follows the changed knee. Never freeze both
  // reference frames and silently stretch/translate bones to reach a target.
  goal.y=before.y;
  const ankle=pos(foot);
  const ankleLocal=foot.quaternion.clone(),hipLocal=hip.quaternion.clone(),kneeLocal=knee.quaternion.clone();
  let desired=ankle.clone().add(goal.clone().sub(before));
  try{
   for(let i=0;i<3;i++){
    solveSupportLeg(model,hip,knee,foot,desired);
    const residual=goal.clone().sub(read(target));
    if(residual.length()<1e-8)break;
    desired.add(residual);
   }
  }catch(error){
   hip.quaternion.copy(hipLocal);knee.quaternion.copy(kneeLocal);foot.quaternion.copy(ankleLocal);model.updateMatrixWorld(true);
   throw error;
  }
  const after=read(target);
  return {...result,support:{active:true,side,phase:t,before:before.toArray(),after:after.toArray(),goal:goal.toArray(),
   errorMm:after.distanceTo(goal)*1000,ankleRelativeChangeDeg:ankleLocal.angleTo(foot.quaternion)*180/Math.PI}};
 }
 return {apply,read,vertex,options,side,shift,anchor:anchor.clone(),path,baseline};
}
