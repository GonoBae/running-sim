import {captureFootPatches,createMidfoot} from './midfoot.js';
import {createUpperLean} from './upper-lean.js';
import {Vector3} from 'three';
import {laneOf} from './running-runtime.js';
import {createBodyModel,applyBodySettings,disposeBodyModels,bodyKey} from './body-runtime.js';
import {createLegHeight} from '../review/leg-height.js';
import {createElbowBend} from '../review/elbow-bend.js';

const point=(model,name)=>model.getObjectByName(name).getWorldPosition(new Vector3());
const legSpan=model=>['r','l'].reduce((sum,side)=>sum+point(model,'thigh_'+side).distanceTo(point(model,'calf_'+side))+point(model,'calf_'+side).distanceTo(point(model,'foot_'+side)),0)/2;
const sole=lane=>Math.min(lane.readSurface('r').min,lane.readSurface('l').min);

/** Retarget the accepted final joint rotations, not the old intermediate IK
 * targets which are tied to the original limb lengths. Scale root travel with
 * leg length; retain the accepted floor-clearance curve on the rebuilt skin.
 * Pose inputs are applied afterwards, in actual world cm/degrees. */
export function createBodyRunning(source,base,settings){
 const body=createBodyModel(source),bounds=applyBodySettings(body,settings),lane=laneOf(body.model);
 const footPatches=captureFootPatches(body.model);
 const model=body.model,original=base.lane.model,pairs=[];
 model.traverse(b=>{if(b.isBone){const from=original.getObjectByName(b.name);if(!from?.isBone)throw Error('달리기 뼈대가 일치하지 않습니다.');pairs.push([b,from]);}});
 const travelScale=legSpan(model)/legSpan(original);
 const baseline={apply(target,_probe,phase){
  base.apply(phase,0,0);
  for(const [to,from] of pairs)to.quaternion.copy(from.quaternion);
  model.position.copy(original.position).multiplyScalar(travelScale);model.updateMatrixWorld(true);
  const targetPelvis=point(original,'pelvis').multiplyScalar(travelScale);
  model.position.add(targetPelvis.sub(point(model,'pelvis')));model.updateMatrixWorld(true);
  const clearance=Math.max(0,sole(base.lane))*travelScale;
  const heightShift=clearance-sole(target);
  model.position.y+=heightShift;model.updateMatrixWorld(true);
  return {bodyRetarget:true,travelScale,clearance,heightShift};
 }};
 const leg=createLegHeight(baseline),elbow=createElbowBend(leg),lean=createUpperLean(elbow),midfoot=createMidfoot(lean,model,footPatches);
 return {lane,body,bounds,footPatches,readFoot:midfoot.read,key:bodyKey(settings),seconds:base.seconds,travelScale,
  apply(phase,legCm,elbowDeg,leanDeg=0,midfootAmount=0,strikePitchDeg=0){return midfoot.apply(lane,null,phase,legCm,elbowDeg,leanDeg,midfootAmount,strikePitchDeg);},
  dispose(){disposeBodyModels(model);lane.group.removeFromParent();}};
}

