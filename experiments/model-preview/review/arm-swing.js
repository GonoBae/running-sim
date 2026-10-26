import {Quaternion,Vector3} from 'three';
import {rotationCurve} from './shared-gait.js';

const q=a=>new Quaternion(...a).normalize();
const difference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

// M70: use both captured arm swings, phase-aligned, without changing the
// torso or the elbow/wrist articulation. Angles are in the resting chest frame.
export function createArmSwing(baseline,reference){
 const definitions=new Map(reference.bones.map(b=>[b.name,b]));
 const chestRest=q(definitions.get('spine_03').worldQ);
 const curves=new Map(reference.bones.filter(b=>/^(clavicle|upperarm)_[rl]$/.test(b.name)).map(b=>[
  b.name,rotationCurve(reference.frames.slice(0,-1).map(f=>f.q[reference.bones.indexOf(b)])),
 ]));
 function sourceSwing(side,phase){
  const rotation=chestRest.clone().multiply(curves.get('clavicle_'+side)(phase)).multiply(curves.get('upperarm_'+side)(phase));
  const direction=new Vector3(...definitions.get('lowerarm_'+side).p).applyQuaternion(rotation);
  return Math.atan2(direction.z,-direction.y);
 }
 function correction(phase){
  return difference(sourceSwing('l',phase+.5),sourceSwing('r',phase))/2;
 }
 function apply(lane,probe,phase){
  const prior=baseline.apply(lane,probe,phase),model=lane.model;
  const chest=model.getObjectByName('spine_03').getWorldQuaternion(new Quaternion()).normalize().multiply(chestRest.clone().invert());
  const axis=new Vector3(1,0,0).applyQuaternion(chest);
  const adjustments={};
  for(const side of ['r','l']){
   const angle=correction(phase+(side==='l'?.5:0));
   const upper=model.getObjectByName('upperarm_'+side);
   const world=new Quaternion().setFromAxisAngle(axis,-angle).multiply(upper.getWorldQuaternion(new Quaternion()).normalize());
   upper.quaternion.copy(upper.parent.getWorldQuaternion(new Quaternion()).normalize().invert().multiply(world).normalize());
   model.updateMatrixWorld(true);
   adjustments[side]=angle;
  }
  return {...prior,armSwing:adjustments};
 }
 return {apply,sourceSwing,correction};
}
