import {Quaternion,Vector3,MathUtils} from 'three';

// M71 visual preset, relative to the exported neutral hand; not measured
// running joint angles. No limb position, skin weight or parent bone is edited.
export const RELAXED_HAND={
 index:[35,45,20],middle:[35,45,20],ring:[35,45,20],pinky:[35,45,20],
 thumb:[15,20,15],
};
const q=a=>new Quaternion(...a).normalize();

export function createHandPose(baseline,reference){
 const definitions=new Map(reference.bones.map(b=>[b.name,b]));
 const targets=new Map();
 for(const side of ['r','l']){
  const hand=definitions.get('hand_'+side),handWorld=q(hand.worldQ);
  const middle=new Vector3(...definitions.get('middle_01_'+side).p).normalize();
  const across=new Vector3(...definitions.get('index_01_'+side).p).sub(new Vector3(...definitions.get('pinky_01_'+side).p)).normalize();
  // On these rigs cross(wrist->middle,index-pinky) points dorsally on the
  // right hand. Reflect the palm direction, not raw Euler rotations.
  const palm=middle.clone().cross(across).normalize().multiplyScalar(side==='r'?-1:1);
  targets.set(hand.name,q(hand.localQ));
  for(const [finger,angles] of Object.entries(RELAXED_HAND))for(let i=0;i<3;i++){
   const name=`${finger}_0${i+1}_${side}`,bone=definitions.get(name),boneWorld=q(bone.worldQ);
   const direction=new Vector3(0,1,0).applyQuaternion(boneWorld).applyQuaternion(handWorld.clone().invert());
   const axis=direction.clone().cross(palm).normalize().applyQuaternion(handWorld).applyQuaternion(boneWorld.clone().invert()).normalize();
   if(axis.lengthSq()<.99)throw Error('Cannot determine finger bend plane: '+name);
   targets.set(name,q(bone.localQ).multiply(new Quaternion().setFromAxisAngle(axis,MathUtils.degToRad(angles[i]))).normalize());
  }
 }
 function apply(lane,probe,phase){
  const prior=baseline.apply(lane,probe,phase);
  for(const [name,rotation] of targets)lane.model.getObjectByName(name).quaternion.copy(rotation);
  lane.model.updateMatrixWorld(true);
  return {...prior,relaxedHands:true};
 }
 return {apply,names:[...targets.keys()]};
}
