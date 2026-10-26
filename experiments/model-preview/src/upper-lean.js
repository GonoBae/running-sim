import {Quaternion, Vector3} from 'three';
import {createHeightTransition} from '../review/leg-height.js';

// Preview offset from the accepted moving torso, not an anatomical limit.
export const UPPER_LEAN=Object.freeze({min:-10,max:15,step:1,default:0});
const degrees=180/Math.PI;

export function createUpperLean(baseline){
 return {apply(lane,probe,phase,legCm=0,elbowDeg=0,offsetDeg=0){
  if(!Number.isFinite(offsetDeg)||offsetDeg<UPPER_LEAN.min||offsetDeg>UPPER_LEAN.max)
   throw new RangeError('Upper-body lean offset must be between -10 and +15 degrees.');
  const prior=baseline.apply(lane,probe,phase,legCm,elbowDeg);
  // An exact zero bypass preserves the accepted transforms, including rounding.
  if(offsetDeg!==0){
   const spine=lane.model.getObjectByName('spine_01');
   if(!spine?.isBone)throw new Error('Upper-body pivot is missing.');
   // Lane +Z is forward. Turning its +Y around +X leans forward.
   // Conjugation converts the world turn into the spine parent's local frame.
   // Only this subtree rotates: pelvis, root and both legs remain untouched.
   const axis=new Vector3(1,0,0).transformDirection(lane.group.matrixWorld);
   const turn=new Quaternion().setFromAxisAngle(axis,offsetDeg/degrees);
   const parent=spine.parent.getWorldQuaternion(new Quaternion()).normalize();
   spine.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent)).normalize();
   lane.model.updateMatrixWorld(true);
  }
  return {...prior,upperLean:{offsetDeg,pivot:'spine_01'}};
 }};
}

export function createLeanTransition(){
 const state=createHeightTransition(4);
 return {get value(){return state.value*2.5-10;},
  set(value,immediate=false){state.set((value+10)/2.5,immediate);},
  tick(dt){return state.tick(dt)*2.5-10;}};
}
