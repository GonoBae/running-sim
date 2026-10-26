import {captureFootPatches,createMidfoot} from './midfoot.js';
import {createUpperLean} from './upper-lean.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createAnkleWeights} from '../review/ankle-weights.js';
import {createLandingSurface} from '../review/hip-landing.js';
import {createSharedGait} from '../review/shared-gait.js';
import {createBodyHeight} from '../review/body-height.js';
import {createUpperCenter} from '../review/upper-center.js';
import {createBilateralPose} from '../review/bilateral-pose.js';
import {createBilateralSkin} from '../review/bilateral-skin.js';
import {createSharedApproach} from '../review/shared-approach.js';
import {createSharedSupport,SUPPORT_WINDOW} from '../review/shared-support.js';
import {createSharedRelease} from '../review/shared-release.js';
import {createKneeLateral} from '../review/knee-lateral.js';
import {createArmSwing} from '../review/arm-swing.js';
import {createHandPose} from '../review/hand-pose.js';
import {createEarlySupport} from '../review/early-support.js';
import {createSupportJoin} from '../review/support-join.js';
import {createUnifiedStance} from '../review/unified-stance.js';
import {createLegHeight} from '../review/leg-height.js';
import {createElbowBend} from '../review/elbow-bend.js';
import {disposeBodyModels} from './body-runtime.js';

export async function loadModel(type){
 const [bytes,reference]=await Promise.all([fetch('/models/runner-'+type+'.glb').then(r=>{if(!r.ok)throw Error('모델 파일을 불러오지 못했습니다.');return r.arrayBuffer();}),fetch('/review-data/shared-gait-reference.json').then(r=>{if(!r.ok)throw Error('동작 자료를 불러오지 못했습니다.');return r.json();})]);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(reference.schema!==1||reference.models[type]?.modelHash!==hash)throw Error('모델과 기준 동작의 버전이 다릅니다.');
 const asset=await new GLTFLoader().parseAsync(bytes,'/models/');return {model:asset.scene,reference};
}
export function laneOf(model){const group=new T.Group();group.add(model);group.updateMatrixWorld(true);return {model,group,readSurface:createLandingSurface(model)};}
export function createRunningRuntime(model,reference,type){
 createAnkleWeights(model).setEnabled(true);createBilateralSkin(model).setEnabled(true);
 const footPatches=captureFootPatches(model);
 const lane=laneOf(model),probe=laneOf(clone(model)),ref=reference.models[type];
 const plan=createSharedGait(ref);
 const height=createBodyHeight(plan,lane,probe);
 const upper=createUpperCenter(height,ref);
 const bilateral=createBilateralPose(upper,ref);
 const approach=createSharedApproach(bilateral,lane,probe);
 const right=createSharedSupport(approach,lane,probe,plan.pelvisTravel);
 const both=createSharedSupport(right,lane,probe,plan.pelvisTravel,{...SUPPORT_WINDOW,side:'l'});
 const release=createSharedRelease(both,lane,probe,plan.pelvisTravel);
 const knee=createKneeLateral(release,lane,probe);
 const arm=createArmSwing(knee,ref),hand=createHandPose(arm,ref);
 const early=createEarlySupport(hand,lane,probe,plan.pelvisTravel);
 const join=createSupportJoin(early,lane,probe,plan.pelvisTravel);
 const unified=createUnifiedStance(join,lane,probe,plan.pelvisTravel,{r:early.right.vertex,l:early.left.vertex});
 const leg=createLegHeight(unified),elbow=createElbowBend(leg),lean=createUpperLean(elbow),midfoot=createMidfoot(lean,model,footPatches);
 return {lane,probe,footPatches,readFoot:midfoot.read,seconds:reference.seconds,apply(phase,legCm,elbowDeg,leanDeg=0,midfootAmount=0,strikePitchDeg=0){return midfoot.apply(lane,probe,phase,legCm,elbowDeg,leanDeg,midfootAmount,strikePitchDeg);},dispose(){disposeBodyModels(lane.model,probe.model);lane.group.removeFromParent();}};
}

