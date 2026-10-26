import {Quaternion} from 'three';
import {mirrorRotation,rotationCurve} from './shared-gait.js';

export const CENTER_BONES=Object.freeze(['spine_01','spine_02','spine_03','neck_01','head']);
const q=a=>new Quaternion(...a).normalize();

// Evaluate the original upper-body world rotations exactly as the local
// quaternion curves do. Do not resample/rebuild the accepted lower-body motion.
export function createCenterRotations(reference){
 const bones=new Map(reference.bones.map((b,i)=>[b.name,{...b,curve:rotationCurve(reference.frames.slice(0,-1).map(f=>f.q[i]))}]));
 const rest=new Map(CENTER_BONES.map(n=>[n,q(bones.get(n).worldQ)]));
 function sample(phase){
  const memo=new Map();
  function world(name){
   if(memo.has(name))return memo.get(name);
   const b=bones.get(name);
   // The first bone may have an unlisted scene/rig parent.
   const parent=bones.has(b.parent)?world(b.parent):q(b.worldQ).multiply(q(b.localQ).invert());
   const value=parent.clone().multiply(b.curve(phase)).normalize();memo.set(name,value);return value;
  }
  return CENTER_BONES.map(n=>world(n).clone().multiply(rest.get(n).clone().invert()).normalize());
 }
 return phase=>{
  const current=sample(phase),opposite=sample(phase+.5);
  return CENTER_BONES.map((n,i)=>current[i].slerp(mirrorRotation(opposite[i]),.5).multiply(rest.get(n)).normalize());
 };
}

export function createUpperCenter(heightPlan,reference){
 const rotations=createCenterRotations(reference);
 function apply(lane,probe,phase){
  // M60 is evaluated unchanged, including its contact/height guard. Only then
  // change this upper subtree; no new root translation or foot correction.
  const baseline=heightPlan.apply(lane,probe,phase),targets=rotations(phase);
  CENTER_BONES.forEach((name,i)=>{
   const bone=lane.model.getObjectByName(name);
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).normalize().invert().multiply(targets[i]).normalize());
   lane.model.updateMatrixWorld(true);
  });
  return {...baseline,upperCenterAligned:true};
 }
 return {apply,rotations};
}
