import {Quaternion} from 'three';
import {mirrorRotation,rotationCurve} from './shared-gait.js';

const q=a=>new Quaternion(...a).normalize();
const isUpperRight=name=>name.endsWith('_r')&&!/^(thigh|calf|foot|ball)_/.test(name);

export function createBilateralPose(upperPlan,reference){
 const definitions=new Map(reference.bones.map(b=>[b.name,b]));
 const right=reference.bones.filter(b=>isUpperRight(b.name));
 const curves=new Map(right.map(b=>[b.name,rotationCurve(reference.frames.slice(0,-1).map(f=>f.q[reference.bones.indexOf(b)]))]));
 const spineRest=q(definitions.get('spine_03').worldQ);
 // Rest-space world rotations account for different left/right local bone axes,
 // including the wrist and fingers. Copying local Euler angles would not.
 function canonical(phase){
  const memo=new Map([['spine_03',spineRest]]);
  const read=name=>{
   if(memo.has(name))return memo.get(name);
   const b=definitions.get(name),value=read(b.parent).clone().multiply(curves.get(name)(phase)).normalize();
   memo.set(name,value);return value;
  };
  return right.map(b=>read(b.name).clone().multiply(q(b.worldQ).invert()).normalize());
 }
 function apply(lane,probe,phase){
  const baseline=upperPlan.apply(lane,probe,phase);
  const frame=lane.model.getObjectByName('spine_03').getWorldQuaternion(new Quaternion()).normalize().multiply(spineRest.clone().invert());
  const deltas=canonical(phase+.5);
  // Reference bones are stored parent-first. Preserve the complete right arm;
  // the left arm and hand use that same motion half a cycle later.
  right.forEach((b,i)=>{
   const name=b.name.slice(0,-2)+'_l',bone=lane.model.getObjectByName(name);
   const world=frame.clone().multiply(mirrorRotation(deltas[i])).multiply(q(definitions.get(name).worldQ)).normalize();
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).normalize().invert().multiply(world).normalize());
   lane.model.updateMatrixWorld(true);
  });
  return {...baseline,bilateralUpperShared:true};
 }
 return {apply,rightNames:right.map(b=>b.name)};
}
