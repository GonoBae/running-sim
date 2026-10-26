import {createToeSlipPath,applyToeSlipPath} from './toe-slip-path.js';
import {applyLateToeTrial,toeTrialSettings} from './late-toe-slip-trial.js';
import {createLateStanceReference,applyLateStanceSole,soleAngles} from './late-stance-sole.js';
import {bindSoleReader,applyLandingSoleAlignment} from './landing-sole-alignment.js';
import {capturePelvisReference,restorePelvisReference} from './pelvis-reference-restore.js';
import {createLeftAnkleDirection,applyLeftAnkleDirection} from './left-ankle-direction.js';
import {createSwingApproach,applySwingApproach} from './swing-approach.js';
import {stanceContactWindows,selectContactPatch,applyStanceContact} from './stance-contact.js';
import {createForeAftReader,createForeAftCurve,applyForeAftRelease} from './fore-aft-release.js';
import {createRefinedPath,applyReleaseRefinement} from './release-refinement.js';
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {sourceRootTravel} from './root-travel.js';
import {applyLandingWidth,landingWidthSettings} from './landing-width.js';
import {applyHipLanding,createLandingSurface} from './hip-landing.js';
import {applyStanceChain,applyHipReference,chainMotionWeight,applyFootPlant,footPlantWeight,footPlantSettings,createFootPlantPath} from './stance-chain.js';
import {selectReleasePivot,createPivotPath,applyPivotRelease} from './pivot-release.js';

export function createLandingComparison({sourceGroup,modelGroup,lines,dots,scene,camera,state,apply,bilateral=false,hipTarget=false,chainPose=false,chainMotion=false,chainBilateral=false,pelvisSway=false,hipReference=false,footPlant=false,pivotRelease=false,releaseRefinement=false,foreAftRelease=false,stanceContact=false,swingApproach=false,leftAnkleDirection=false,pelvisReferenceRestore=false,landingSoleAlignment=false,lateStanceSole=false,lateToeTrial=false,toeSlipPath=false}){
 let ankleDirectionPlan=null,lateStanceReference=null,toeTrialPlans=null,toeTrialTravel=null,toeSlipPlans=null;
 let lanes=[],side=false,currentFrame=0,lastTravel=new T.Vector3(),diagnostics=[],plantAnchor=null,preparingPlant=false;
 let releasePivot=null,pivotPath=null,preparingPivot=false,refinedPath=null;let foreAftCurve=null,preparingForeAft=false;let contactPlans=[],preparingContact=false,cycleTravelX=0,preparingSwing=false;
 lines.visible=false;dots.forEach(dot=>dot.visible=false);sourceGroup.visible=false;
 const bonesOf=model=>{const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});return bones;};
 function update(frame){
  if(!lanes.length)return;
  const s=state();currentFrame=frame;lastTravel=sourceRootTravel(s.clip,s.cycle,frame,s.heading,s.scale);
  diagnostics=[];
  // Snapshot before translating or correcting any lane. Clones share materials
  // and geometry; only their skeleton poses and model positions differ.
  for(let i=1;i<lanes.length;i++){
   const lane=lanes[i];lane.model.position.copy(s.model.position);
   s.bones.forEach((b,j)=>{lane.bones[j].position.copy(b.position);lane.bones[j].quaternion.copy(b.quaternion);lane.bones[j].scale.copy(b.scale);});
   lane.model.updateMatrixWorld(true);
  }
  for(let i=0;i<lanes.length;i++){
   const lane=lanes[i];lane.model.position.add(lastTravel);lane.model.updateMatrixWorld(true);
   if(chainPose||chainMotion){
    const pelvisReference=pelvisReferenceRestore?capturePelvisReference(lane):null;
    const phase=frame/s.cycle.period,activeSide=chainBilateral&&chainMotionWeight(phase,'l')>0?'l':'r';
    const result=hipReference&&(i>0||footPlant)&&activeSide==='r'?applyHipReference(lane.model,lane.bones,lane.readSurface,chainMotionWeight(phase)):(i>0||pelvisSway||hipReference)?applyStanceChain(lane.model,lane.bones,lane.readSurface,chainMotion?chainMotionWeight(phase,activeSide):1,activeSide,(hipReference||pelvisSway&&i>0)?.5:1):null;
    if(result)result.side=activeSide;
    if(footPlant&&(i>0||pivotRelease)&&plantAnchor&&!preparingPlant){
     result.plant=applyFootPlant(lane.model,lane.bones,{...plantAnchor,position:lane.group.localToWorld(plantAnchor.position.clone()),pathPosition:lane.group.localToWorld(plantAnchor.path(phase))},footPlantWeight(phase),lane.readSurface);
    }
    if(pivotRelease&&(i>0||releaseRefinement)&&pivotPath&&!preparingPivot&&!preparingPlant){
     result.pivot=applyPivotRelease(lane.model,lane.bones,lane.releasePivot||releasePivot,lane.group.localToWorld(pivotPath(phase)),phase,lane.readSurface);
    }
    if(releaseRefinement&&(i>0||foreAftRelease)&&refinedPath&&!preparingPivot&&!preparingPlant){result.refinement=applyReleaseRefinement(lane.model,lane.bones,lane.releasePivot||releasePivot,lane.group.localToWorld(refinedPath(phase)),phase,lane.readSurface);}
    if(foreAftRelease&&(i>0||stanceContact)&&foreAftCurve&&!preparingForeAft&&!preparingPivot&&!preparingPlant){result.foreAft=applyForeAftRelease(lane.model,lane.bones,lane.releasePivot||releasePivot,phase,foreAftCurve,lane.readSurface);}
    if(stanceContact&&(i>0||swingApproach)&&!preparingContact&&contactPlans.length)result.contact=applyStanceContact(lane,phase,lane.contactPlans,cycleTravelX);
    if(swingApproach&&(i>0||leftAnkleDirection)&&!preparingSwing&&!preparingContact&&contactPlans.length)result.swing=applySwingApproach(lane,phase,lane.contactPlans);
    if(leftAnkleDirection&&(i>0||pelvisReferenceRestore)&&ankleDirectionPlan)result.ankleDirection=applyLeftAnkleDirection(lane,phase,ankleDirectionPlan);
    if(pelvisReferenceRestore&&ankleDirectionPlan){
     result.pelvisReference=lane.group.worldToLocal(pelvisReference.clone()).toArray();
     if(i>0||landingSoleAlignment)result.bodyRestore=restorePelvisReference(lane,phase,pelvisReference);
    }
    if(landingSoleAlignment&&(i>0||lateStanceSole)&&ankleDirectionPlan)result.soleAlignment=applyLandingSoleAlignment(lane,phase);
    if(lateStanceSole&&(i>0||lateToeTrial||toeSlipPath)&&lateStanceReference)result.lateSole=applyLateStanceSole(lane,phase,lateStanceReference);
    if(lateToeTrial&&i>0&&toeTrialPlans)result.toeTrial=applyLateToeTrial(lane,phase,toeTrialPlans,toeTrialTravel);
    if(toeSlipPath&&i>0&&toeSlipPlans)result.toePath=applyToeSlipPath(lane,phase,toeSlipPlans);
    diagnostics.push(result);
    const points=['thigh_r','calf_r','foot_r'].map(n=>lane.group.worldToLocal(lane.bones.find(b=>b.name===n).getWorldPosition(new T.Vector3())));
    lane.chain.geometry.setFromPoints(points);lane.chain.geometry.computeBoundingSphere();
    if(lane.leftChain){const leftPoints=['thigh_l','calf_l','foot_l'].map(n=>lane.group.worldToLocal(lane.bones.find(b=>b.name===n).getWorldPosition(new T.Vector3())));lane.leftChain.geometry.setFromPoints(leftPoints);lane.leftChain.geometry.computeBoundingSphere();}
   }else if(hipTarget){
    const result={};for(const foot of ['r','l'])result[foot]=applyHipLanding(lane.model,lane.bones,frame/s.cycle.period,foot,lane.readSurface,i>0);
    diagnostics.push(result);drawGuides(lane,result);
   }else{
    const right=applyLandingWidth(lane.model,lane.bones,frame/s.cycle.period,landingWidthSettings.amounts[i]);
    diagnostics.push(bilateral?{r:right,l:applyLandingWidth(lane.model,lane.bones,frame/s.cycle.period,landingWidthSettings.amounts[i],'l')}:right);
   }
  }
  if(stanceContact&&!preparingContact){document.getElementById('contact-status').textContent=toeSlipPath?'양발 후반 궤적 완화 · 착지 순간·골반·회수 유지':lateToeTrial?'미채택 시험 · 발끝 이동 25% 완화 시 기존 착지 기준점 이동':lateStanceSole?'양발 지지 후반 · 골반·착지 지면 위치·회수 유지':landingSoleAlignment?'양발 착지 초기 · 기울기 교정 / 골반·착지점 유지':pelvisReferenceRestore?'왼발 지지 · 추가 몸 이동 제거 / 착지점 유지':leftAnkleDirection?'왼발 방향 교정 · 지면 위치·골반·오른발 유지':swingApproach?'양발 · 회수 후반부터 착지까지 경로 연결':'양발 · 착지 전 정렬 / 지지 중 좌우 고정';fitCamera();return;}
  if(footPlant){const w=diagnostics[1]?.plant?.weight||0;document.getElementById('contact-status').textContent=foreAftRelease&&diagnostics[1]?.foreAft?.active?'오른발 앞뒤 밀림 보정':releaseRefinement&&diagnostics[1]?.refinement?.active?'오른발 좌우·발끝 보정':pivotRelease&&diagnostics[1]?.pivot?.active?'오른발 지지점 연동':w===1?'오른발 지면 고정':w>0?`고정 연결·해제 · ${Math.round(w*100)}%`:foreAftRelease?'기존 M45 동작':releaseRefinement?'기존 M44 동작':pivotRelease?'기존 M42 동작':'기존 M40 동작';fitCamera();return;}
  if(chainPose||chainMotion){document.getElementById('contact-status').textContent=chainMotion?(diagnostics[1].weight>0?`${diagnostics[1].side==='l'?'왼발':'오른발'} 연동 · ${Math.round(diagnostics[1].weight*100)}%`:'원래 동작 · 연동 보정 0'):'오른발 지지 · 43% 한 장면 · 연동 자세 검토';fitCamera();return;}
  const d=diagnostics.at(-1),active=bilateral?Math.max(d.r.weight,d.l.weight):d.weight;
  const name=bilateral&&d.l.weight>0?'왼발':'오른발';
  document.getElementById('contact-status').textContent=active>0?`${name} 비교 중 · ${Math.round(active*100)}% 적용`:'원래 동작 · 보정 0';
  fitCamera();
 }
 function drawGuides(lane,result){
  for(const foot of ['r','l']){
   const d=result[foot],g=lane.guides[foot],hip=new T.Vector3(...d.hip),point=new T.Vector3(...d.after);
   // Frontal projection only. The side view retains the forward foot placement.
   const top=hip.clone();top.z=point.z;
   const end=new T.Vector3(hip.x,0,point.z);
   g.line.geometry.setFromPoints([lane.group.worldToLocal(top),lane.group.worldToLocal(end)]);
   g.line.computeLineDistances();g.line.visible=!side;
   g.dot.position.copy(lane.group.worldToLocal(point));
  }
 }
 function fitCamera(){
  const aspect=camera.aspect||1,halfHeight=Math.max(1.15,(hipTarget?1.8:2.7)/aspect);
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
  const center=new T.Vector3(lastTravel.x,.95,lastTravel.z);
  camera.position.copy(center).add(new T.Vector3(side?10:0,0,side?0:10));camera.lookAt(center);camera.updateProjectionMatrix();
 }
 function view(nextSide){
  side=nextSide;
  for(let i=0;i<lanes.length;i++){lanes[i].group.position.set(0,0,0);lanes[i].group.position[side?'z':'x']=(i-(lanes.length-1)/2)*1.8*(side?-1:1);lanes[i].group.updateMatrixWorld(true);if(hipTarget&&!chainPose&&!chainMotion)for(const g of Object.values(lanes[i].guides))g.line.visible=!side;}
  fitCamera();
 }
 function rebuild(){
  toeSlipPlans=null;toeTrialPlans=null;lateStanceReference=null;ankleDirectionPlan=null;plantAnchor=null;releasePivot=null;pivotPath=null;refinedPath=null;foreAftCurve=null;contactPlans=[];
  for(const lane of lanes)for(const line of [lane.chain,lane.leftChain])if(line){line.removeFromParent();line.geometry.dispose();line.material.dispose();}
  for(const lane of lanes)if(lane.guides)for(const g of Object.values(lane.guides))for(const o of [g.line,g.dot]){o.removeFromParent();o.geometry.dispose();o.material.dispose();}
  for(const lane of lanes.slice(1)){lane.group.removeFromParent();lane.grid.geometry.dispose();lane.grid.material.dispose();}
  const s=state();modelGroup.visible=true;modelGroup.position.set(0,0,0);s.model.updateMatrixWorld(true);
  lanes=[{model:s.model,bones:s.bones,group:modelGroup}];
  for(let i=1;i<(hipTarget?2:3);i++){
   const model=clone(s.model),group=new T.Group(),grid=new T.GridHelper(12,60,0xc5cfc4,0xe0e5dd);grid.position.y=-.005;
   group.add(model,grid);scene.add(group);lanes.push({model,bones:bonesOf(model),group,grid});
  }
  if(hipTarget)for(const lane of lanes){
   lane.readSurface=createLandingSurface(lane.model);lane.guides={};
   if(landingSoleAlignment)lane.readSole=bindSoleReader(lane.model,s.soleRegions);
   if(chainPose||chainMotion){lane.chain=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xb96540,depthTest:false}));lane.chain.renderOrder=3;lane.group.add(lane.chain);if(chainBilateral){lane.leftChain=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x1687ad,depthTest:false}));lane.leftChain.renderOrder=3;lane.group.add(lane.leftChain);}continue;}
   for(const foot of ['r','l']){
    const color=foot==='r'?0xb96540:0x1687ad;
    const line=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color,dashSize:.025,gapSize:.018,depthTest:true}));
    const dot=new T.Mesh(new T.SphereGeometry(.012,12,8),new T.MeshBasicMaterial({color}));
    lane.group.add(line,dot);lane.guides[foot]={line,dot};
   }
  }
  const grid=modelGroup.children.find(o=>o.isGridHelper);if(grid)grid.scale.setScalar(12/2.2);
  view(side);
  if(footPlant){
   preparingPlant=true;
   try{apply(footPlantSettings.holdStart*s.cycle.period);
    const lane=lanes[1],by=n=>lane.bones.find(b=>b.name===n);
    plantAnchor={position:lane.group.worldToLocal(by('foot_r').getWorldPosition(new T.Vector3())),rotation:by('foot_r').getWorldQuaternion(new T.Quaternion()),toe:by('ball_r').quaternion.clone(),floor:lane.readSurface('r').min};
    plantAnchor.path=createFootPlantPath(phase=>{apply(phase*s.cycle.period);return lane.group.worldToLocal(by('foot_r').getWorldPosition(new T.Vector3()));});
   }finally{preparingPlant=false;}
  }
  if(pivotRelease){
   preparingPivot=true;
   try{
    apply(.58*s.cycle.period);const lane=lanes[1];releasePivot=selectReleasePivot(lane.model);if(releaseRefinement)for(const l of lanes)l.releasePivot=selectReleasePivot(l.model);
    pivotPath=createPivotPath(phase=>{apply(phase*s.cycle.period);return lane.group.worldToLocal(releasePivot.read());});
    if(releaseRefinement)refinedPath=createRefinedPath(pivotPath);
   }finally{preparingPivot=false;}
  }
  if(foreAftRelease){preparingForeAft=true;try{const read=createForeAftReader(lanes[1].model);foreAftCurve=createForeAftCurve(phase=>{apply(phase*s.cycle.period);return read();},s.cycle.seconds);}finally{preparingForeAft=false;}}
  if(stanceContact){preparingContact=true;try{
   const lane=lanes[1];cycleTravelX=sourceRootTravel(s.clip,s.cycle,s.cycle.period,s.heading,s.scale).x;
   const contactLanes=swingApproach?lanes:[lane];for(const l of contactLanes)l.contactPlans=[];
   for(const window of stanceContactWindows){
    apply(window.start*s.cycle.period);
    for(const l of contactLanes){const by=n=>l.bones.find(b=>b.name===n+'_'+window.side);l.contactPlans.push({window,patch:selectContactPatch(l.model,window.side),footQ:by('foot').getWorldQuaternion(new T.Quaternion()),toeQ:by('ball').getWorldQuaternion(new T.Quaternion()),anchorX:l.group.worldToLocal(by('thigh').getWorldPosition(new T.Vector3())).x});}
   }
   contactPlans=lane.contactPlans;
  }finally{preparingContact=false;}}
  if(swingApproach){preparingSwing=true;try{
   const lane=lanes[1];
   for(const plan of contactPlans)plan.swing=createSwingApproach(phase=>{apply(phase*s.cycle.period);const by=n=>lane.bones.find(b=>b.name===n+'_'+plan.window.side);return {x:lane.group.worldToLocal(plan.patch.read()).x,kneeX:lane.group.worldToLocal(by('calf').getWorldPosition(new T.Vector3())).x,upper:by('calf').getWorldPosition(new T.Vector3()).sub(by('thigh').getWorldPosition(new T.Vector3())).toArray()};},plan.window,plan.anchorX,cycleTravelX);
  }finally{preparingSwing=false;}}
  if(leftAnkleDirection){
   for(const plan of lanes[0].contactPlans)plan.swing=contactPlans.find(p=>p.window.side===plan.window.side).swing;
   ankleDirectionPlan=createLeftAnkleDirection(contactPlans.find(p=>p.window.side==='l'),s.leftFootAxes);
  }
  if(lateStanceSole)lateStanceReference=createLateStanceReference((side,phase)=>{apply(phase*s.cycle.period);return soleAngles(lanes[1].readSole(side).frame).pitch;});
  if(lateToeTrial){
   const plans={};
   for(const w of stanceContactWindows){apply(((w.start+toeTrialSettings.hold*(w.end-w.start))%1)*s.cycle.period);plans[w.side]=lanes[0].group.worldToLocal(lanes[0].readSole(w.side).points.toe);}
   toeTrialTravel=sourceRootTravel(s.clip,s.cycle,s.cycle.period,s.heading,s.scale);toeTrialPlans=plans;
  }
  if(toeSlipPath){
   const plans={},travel=sourceRootTravel(s.clip,s.cycle,s.cycle.period,s.heading,s.scale);
   for(const w of stanceContactWindows)plans[w.side]=createToeSlipPath(u=>{
    const unwrapped=w.start+u*(w.end-w.start),turn=Math.floor(unwrapped),phase=unwrapped-turn;
    apply(phase*s.cycle.period);
    return lanes[0].group.worldToLocal(lanes[0].readSole(w.side).points.toe).addScaledVector(travel,turn);
   });
   toeSlipPlans=plans;
  }
  apply(s.frame);
 }
 return {update,rebuild,view,get ankleDirectionPlan(){return ankleDirectionPlan;},get contactPlans(){return contactPlans;},get plantAnchor(){return plantAnchor;},get releasePivot(){return releasePivot;},get foreAftCurve(){return foreAftCurve;},get lanes(){return lanes;},get diagnostics(){return diagnostics;},get frame(){return currentFrame;}};
}
