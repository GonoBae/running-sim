import {selectSoleRegions} from './landing-sole-alignment.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import clips from './data/cmu.json';
import {createCycle} from './cyclic-motion.js';
import {alignFootFrame} from './foot-frame.js';
import {footSurfaceReader,createContactPlan,relativeAnkleSupportWindows} from './ground-contact.js';
import {separateArms} from './arm-spacing.js';
import {retargetAnkle} from './ankle-relative.js';
import {createAnkleWeights} from './ankle-weights.js';
import {createStancePlan,readStance,applyStance} from './stance-width.js';
import {createTravelComparison} from './travel-comparison.js';
import {neutralFootAxes} from './left-ankle-direction.js';
import {createLandingComparison} from './landing-width-comparison.js';
const compareMode=new URLSearchParams(location.search).get('compare');
const toeSlipPathMode=compareMode==='toe-slip-path';
const lateToeTrialMode=compareMode==='late-toe-slip-trial';
const lateStanceSoleMode=toeSlipPathMode||lateToeTrialMode||compareMode==='late-stance-sole';
const landingSoleAlignmentMode=lateStanceSoleMode||compareMode==='landing-sole-alignment';
const pelvisReferenceRestoreMode=landingSoleAlignmentMode||compareMode==='pelvis-reference-restore';
const leftAnkleDirectionMode=pelvisReferenceRestoreMode||compareMode==='left-ankle-direction';
const swingApproachMode=leftAnkleDirectionMode||compareMode==='swing-approach',stanceContactMode=swingApproachMode||compareMode==='stance-contact',foreAftReleaseMode=stanceContactMode||compareMode==='fore-aft-release',releaseRefinementMode=foreAftReleaseMode||compareMode==='release-refinement',pivotReleaseMode=releaseRefinementMode||compareMode==='pivot-release',footPlantMode=pivotReleaseMode||compareMode==='foot-plant',hipReferenceMode=footPlantMode||compareMode==='hip-reference',pelvisSwayMode=compareMode==='pelvis-sway',chainBilateralMode=hipReferenceMode||pelvisSwayMode||compareMode==='stance-chain-bilateral',chainMotionMode=chainBilateralMode||compareMode==='stance-chain-motion',chainPoseMode=compareMode==='stance-chain',hipTargetMode=chainMotionMode||chainPoseMode||compareMode==='hip-landing',bilateralMode=hipTargetMode||compareMode==='bilateral',landingMode=bilateralMode||compareMode==='landing',slipMode=compareMode==='slip',travelMode=landingMode||slipMode||compareMode==='travel';
const $=id=>document.getElementById(id),v=a=>new T.Vector3(...a),q=a=>new T.Quaternion(...a);
const scene=new T.Scene();scene.background=new T.Color('#f6f5f1');
scene.add(new T.HemisphereLight(0xffffff,0x7a8477,2.5));const light=new T.DirectionalLight(0xfff5e8,3);light.position.set(2,4,5);scene.add(light);
const camera=travelMode?new T.OrthographicCamera(-4,4,2,-2,.01,50):new T.PerspectiveCamera(34,1,.01,50);camera.aspect=1;
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(1000,600);$('view').append(renderer.domElement);
const sourceGroup=new T.Group(),modelGroup=new T.Group();scene.add(sourceGroup,modelGroup);
const lines=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#26846a'}));sourceGroup.add(lines);
const dots=Array.from({length:31},()=>{const m=new T.Mesh(new T.SphereGeometry(.018,10,8),new T.MeshStandardMaterial({color:'#26846a'}));sourceGroup.add(m);return m;});
for(const group of [sourceGroup,modelGroup]){const grid=new T.GridHelper(2.2,11,0xc5cfc4,0xe0e5dd);grid.position.y=-.005;group.add(grid);}
let model,bones=[],base=[],mapping=[],playing=true,elapsed=0,last=performance.now(),clip=clips[+$('clip').value],heading=new T.Quaternion(),scale=1,ground=0,sourceGround=0,side=!stanceContactMode,ready=false;
let cycle=createCycle(clip),sampledFrame=clip.frames[0];
let readFeet,contactPlan=null,contact=null;
let armSpacing=null;
let ankles=[];
let leftFootAxes,soleRegions;
let ankleWeights;
let comparison;
let stancePlan=null,stanceHalfHipWidth=0;
const looping=()=>$('mode').value==='loop';
const durationFrames=()=>looping()?cycle.period:clip.frames.length;
const pairs=[['spine_01','spine_02','lowerback'],['spine_02','spine_03','upperback'],['spine_03','neck_01','thorax'],['neck_01','head','upperneck'],['clavicle_l','upperarm_l','lclavicle'],['clavicle_r','upperarm_r','rclavicle']];
for(const s of ['l','r'])pairs.push([`thigh_${s}`,`calf_${s}`,`${s}femur`],[`calf_${s}`,`foot_${s}`,`${s}tibia`],[`foot_${s}`,`ball_${s}`,`${s}foot`],[`upperarm_${s}`,`lowerarm_${s}`,`${s}humerus`],[`lowerarm_${s}`,`hand_${s}`,`${s}radius`],[`hand_${s}`,`middle_01_${s}`,`${s}hand`]);
const by=n=>bones.find(b=>b.name===n),pos=b=>b.getWorldPosition(new T.Vector3());
function world(b,rotation){b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));model.updateMatrixWorld(true);}
function configure(){
 if(!model)return;
 ready=false;contactPlan=null;stancePlan=null;
 base.forEach((r,i)=>bones[i].quaternion.copy(r));model.position.set(0,0,0);model.updateMatrixWorld(true);
 const first=clip.frames[0].p[0],end=clip.frames.at(-1).p[0];heading.setFromAxisAngle(new T.Vector3(0,1,0),-Math.atan2(end[0]-first[0],end[2]-first[2]));
 const sourceLength=clip.bones.filter(b=>['lfemur','ltibia'].includes(b.name)).reduce((s,b)=>s+b.length,0);
 stanceHalfHipWidth=pos(by('thigh_l')).distanceTo(pos(by('thigh_r')))/2;
 scale=(pos(by('thigh_l')).distanceTo(pos(by('calf_l')))+pos(by('calf_l')).distanceTo(pos(by('foot_l'))))/sourceLength;
 mapping=pairs.map(([bone,child,name])=>{const source=clip.bones.find(b=>b.name===name),b=by(bone),c=by(child);if(!b||!c||!source)throw Error('Missing mapping '+bone);
  const targetDirection=pos(c).sub(pos(b)).normalize(),sourceDirection=v(source.direction).normalize();
  const align=bone.startsWith('foot_')
   ?alignFootFrame(targetDirection,sourceDirection,v(clip.bones.find(item=>item.name===name.replace('foot','toes')).direction).normalize())
   :new T.Quaternion().setFromUnitVectors(targetDirection,sourceDirection);
  // ASF clavicles encode the source subject's shoulder slope. Preserve our rig's
  // neutral slope and transfer only the motion relative to the source chest.
  const relative=bone.startsWith('clavicle_'),index=clip.names.indexOf(name);
  return {bone:b,child:c,name,index,relative,sourceParentIndex:clip.parents[index],rest:relative?b.quaternion.clone():align.multiply(b.getWorldQuaternion(new T.Quaternion()))};
 });
 leftFootAxes=neutralFootAxes(by('foot_l'),by('ball_l'));
 if(landingSoleAlignmentMode)soleRegions=selectSoleRegions(model);
 ankles=['l','r'].map(side=>({foot:by('foot_'+side),neutral:by('foot_'+side).quaternion.clone(),calf:mapping.find(m=>m.name===side+'tibia'),source:clip.names.indexOf(side+'foot')}));
 // Preserve the target pelvis frame. This probe checks transfer, not production IK.
 const pelvis=by('pelvis');mapping.unshift({bone:pelvis,name:'root',index:0,rest:pelvis.getWorldQuaternion(new T.Quaternion())});
 const head=by('head'),headSource=clip.bones.find(b=>b.name==='head');mapping.push({bone:head,name:'head',index:clip.names.indexOf('head'),rest:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v(headSource.direction).normalize()).multiply(head.getWorldQuaternion(new T.Quaternion()))});
 sourceGround=Math.min(...clip.frames.flatMap(f=>['lfoot','ltoes','rfoot','rtoes'].map(n=>f.p[clip.names.indexOf(n)][1])));
 cycle=createCycle(clip);ground=0;elapsed=0;ankleWeights.setEnabled(false);apply(0,true);
 // Preserve M20 constant grounding for raw mode and the correction-off comparison.
 model.updateMatrixWorld(true);ground=-new T.Box3().setFromObject(model,true).min.y;
 ankleWeights.setEnabled(looping()&&$('ankle-weights').checked);
 readFeet=footSurfaceReader(model);
 rebuildStancePlan();
 $('stance-width').disabled=!looping();
 rebuildContactPlan();
 $('grounding').disabled=!looping();$('arm-spacing').disabled=!looping();$('ankle-relative').disabled=!looping();$('ankle-weights').disabled=!looping();apply(0);
 $('source').href=clip.source;
 $('status').textContent=looping()?`연결한 한 주기 · ${cycle.seconds.toFixed(2)}초`:`원본 ${clip.frames.length}프레임 · ${(clip.frames.length/120).toFixed(2)}초`;
 $('source-label').textContent=looping()?'가공 · CMU 한 주기 연결':'기준 · CMU 원본의 전신 뼈대';
 if(!travelMode)$('mode-note').textContent=looping()?'같은 동작 위상의 구간을 골라 연결한 반복 동작입니다. 원본 실측 그대로가 아닌 가공 결과입니다.':'원본 전체 구간입니다. 끝에서 처음으로 돌아갈 때 자세 차이가 있습니다.';
 // Comparison sampling uses apply()'s ready guard. Rebuild is synchronous;
 // controls stay inert until load() has also presented the completed result.
 ready=true;
 if(comparison){$('status').textContent=chainPoseMode?'정지 자세 · 39프레임':`${cycle.seconds.toFixed(2)}초 · 끝에서 정지`;comparison.rebuild();$('source-label').textContent=landingMode?'현재 · 이동 복원':slipMode?'복원 동작 · 보정 전':'현재 · 몸 이동 고정';$('target-label').textContent=landingMode?((chainPoseMode||chainMotionMode)?'골반·무릎·발 연동':hipTargetMode?'양발 · 고관절 수직선':bilateralMode?'양발 · 최대 2cm':'오른발 · 최대 2cm'):slipMode?'복원 동작 · 오른발 보정 후':'비교 · 원본 수평 이동 복원';if(pelvisSwayMode){$('source-label').textContent='기존 양발 연동';$('target-label').textContent='골반 추가 좌우 이동 50%';}if(hipReferenceMode){$('source-label').textContent='기존 · 골반 이동 50%';$('target-label').textContent='오른발 · 고관절 기준';}if(footPlantMode){$('source-label').textContent='기존 M40';$('target-label').textContent='오른발 · 짧은 지면 고정';}if(pivotReleaseMode){$('source-label').textContent='기존 M42';$('target-label').textContent='오른발 · 지지점 연동';}if(releaseRefinementMode){$('source-label').textContent='기존 M44';$('target-label').textContent='오른발 · 좌우·발끝 보정';}if(foreAftReleaseMode){$('source-label').textContent='기존 M45';$('target-label').textContent='오른발 · 앞뒤 밀림 보정';}if(stanceContactMode){$('source-label').textContent='기존 M46 · 착지 후 이동';$('target-label').textContent='수정 · 착지 전 정렬 / 좌우 고정';}if(swingApproachMode){$('source-label').textContent='기존 · 안쪽으로 갔다가 복귀';$('target-label').textContent='수정 · 양발 착지 접근 경로';}if(leftAnkleDirectionMode){$('source-label').textContent='기존 M48 · 양발';$('target-label').textContent='왼발 방향 교정 · 오른발 유지';}if(pelvisReferenceRestoreMode){$('source-label').textContent='기존 M50 · 추가 몸 이동';$('target-label').textContent='추가 몸 이동 제거 · 착지점 유지';}if(landingSoleAlignmentMode){$('source-label').textContent='기존 M52 · 골반 이동 복원';$('target-label').textContent='양발 착지 초기 · 발바닥 기울기 교정';}if(lateStanceSoleMode){$('source-label').textContent='기존 M53 · 착지 초기 교정';$('target-label').textContent='양발 지지 후반 · 기울기·밀어내기 연결';}if(lateToeTrialMode){$('source-label').textContent='유지 · M54';$('target-label').textContent='미채택 시험 · 발끝 이동 25% 완화 / 착지 기준점 이동';}if(toeSlipPathMode){$('source-label').textContent='기존 M54';$('target-label').textContent='M56 · 양발 후반 궤적 완화';}}
}
function rebuildStancePlan(){
 stancePlan=null;
 if(looping()&&clip.id==='35_17')stancePlan=createStancePlan(cycle.period,frame=>{apply(frame,false,false);return readStance(bones);},relativeAnkleSupportWindows[clip.id],stanceHalfHipWidth);
}
function rebuildContactPlan(){
 contactPlan=null;
 if(looping())contactPlan=createContactPlan(clip.id,cycle.period,frame=>{apply(frame,false,false);return readFeet();},$('ankle-relative').checked?relativeAnkleSupportWindows[clip.id]:undefined);
}
function apply(frameIndex,raw=false,correct=true){
 if(chainPoseMode&&correct&&!raw)frameIndex=39;
 const frame=looping()&&!raw?cycle.sample(frameIndex):clip.frames[Math.min(clip.frames.length-1,Math.max(0,Math.floor(frameIndex)))];if(!model)return;
 sampledFrame=frame;
 const root=v(frame.p[0]),points=frame.p.map(a=>v(a).sub(new T.Vector3(root.x,sourceGround,root.z)).applyQuaternion(heading));
 const vertices=[];clip.parents.forEach((p,i)=>{dots[i].position.copy(points[i]);if(p>=0)vertices.push(...points[p].toArray(),...points[i].toArray());});
 lines.geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));lines.geometry.computeBoundingSphere();
 base.forEach((r,i)=>bones[i].quaternion.copy(r));model.position.set(0,0,0);model.updateMatrixWorld(true);
 for(const item of mapping){
  const sourceWorld=heading.clone().multiply(q(frame.q[item.index]));
  if(item.relative){
   const sourceParentWorld=heading.clone().multiply(q(frame.q[item.sourceParentIndex]));
   const motionDelta=sourceWorld.multiply(sourceParentWorld.invert());
   const targetNeutral=item.bone.parent.getWorldQuaternion(new T.Quaternion()).multiply(item.rest);
   world(item.bone,motionDelta.multiply(targetNeutral));
  }else world(item.bone,sourceWorld.multiply(item.rest));
 }
 if(!raw&&looping()&&$('ankle-relative').checked){
  for(const {foot,neutral,calf,source} of ankles)foot.quaternion.copy(retargetAnkle(q(frame.q[calf.index]),q(frame.q[source]),calf.rest,neutral));
  model.updateMatrixWorld(true);
 }
 if(!raw&&looping()&&stancePlan&&$('stance-width').checked)applyStance(model,bones,stancePlan);
 armSpacing=!raw&&looping()&&$('arm-spacing').checked?separateArms(model,bones):null;
 // Translate pelvis to the scaled capture root; retain original bone lengths.
 const targetRoot=points[0].clone().multiplyScalar(scale);model.position.add(targetRoot.sub(pos(by('pelvis')).sub(modelGroup.position)));model.position.y+=ground;model.updateMatrixWorld(true);
 contact=null;
 if(correct&&!raw&&looping()&&$('grounding').checked&&contactPlan){
  contact=contactPlan.solve(frameIndex,readFeet());model.position.y+=contact.offset;model.updateMatrixWorld(true);
 }
 // Calibration/contact-plan sampling must stay in the original coordinates.
 // Model calibration must not apply contact plans belonging to the previous rig.
 if(comparison&&correct&&!raw&&ready)comparison.update(frameIndex);
 if(!landingMode)$('contact-status').textContent=contact?(contact.support?(contact.support==='l'?'왼발':'오른발')+' 지지 · 추정':'공중 전환 · 추정'):'높이 보정 꺼짐';
 $('phase').value=String(frameIndex/(looping()?cycle.period:clip.frames.length-1));
}
function view(){
 if(comparison){comparison.view(side);return;}
 // Both subjects share the same camera and are separated along its screen horizontal axis.
 sourceGroup.position.set(side?0:-1,0,side?1:0);modelGroup.position.set(side?0:1,0,side?-1:0);
 camera.position.set(side?5.2:0,1.55,side?0:5.2);camera.lookAt(0,.95,0);
}
function loading(message){
 ready=false;$('loading-state').hidden=false;$('loading-message').textContent=message;$('loading-retry').hidden=true;
 $('status').textContent=message;document.querySelector('.bar').inert=true;$('phase').disabled=true;
}
async function load(){
 loading('모델을 불러오는 중…');performance.mark('mocap-load-start');
 const g=await new GLTFLoader().loadAsync(`/models/runner-${$('model').value}.glb`);
 if(model){modelGroup.remove(model);model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});}
 model=g.scene;modelGroup.add(model);bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});base=bones.map(b=>b.quaternion.clone());
 // Paint the imported model BEFORE the synchronous comparison calculations.
 // Hide stale comparison clones when changing model; this is a loading preview.
 for(const lane of comparison?.lanes||[])if(lane.group!==modelGroup)lane.group.visible=false;
 sourceGroup.visible=false;modelGroup.visible=true;modelGroup.position.set(0,0,0);
 const bounds=new T.Box3().setFromObject(model,true),center=bounds.getCenter(new T.Vector3()),height=bounds.getSize(new T.Vector3()).y;
 if(camera.isOrthographicCamera){const half=Math.max(height*.62,height*.4/camera.aspect);camera.left=-half*camera.aspect;camera.right=half*camera.aspect;camera.top=half;camera.bottom=-half;}
 camera.position.copy(center).add(new T.Vector3(0,0,height*2.3));camera.lookAt(center);camera.updateProjectionMatrix();
 loading('모델 표시 완료 · 달리기 비교를 준비하고 있습니다…');renderer.render(scene,camera);
 performance.mark('mocap-model-preview');
 // Allow the browser to present the canvas and loading message before computing.
 await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,50)));
 ankleWeights=createAnkleWeights(model);configure();view();sourceGroup.visible=!landingMode;
 renderer.render(scene,camera);performance.mark('mocap-load-ready');
 $('loading-state').hidden=true;document.querySelector('.bar').inert=false;$('phase').disabled=false;last=performance.now();
}
$('clip').onchange=()=>{clip=clips[+$('clip').value];configure();};$('model').onchange=()=>load().catch(fail);
$('mode').onchange=()=>configure();
$('stance-width').onchange=()=>{rebuildContactPlan();if(comparison)comparison.rebuild();else apply(elapsed*clip.fps);};
$('sole-slip').onchange=()=>comparison?.rebuild();
$('grounding').onchange=()=>{if(slipMode)$('sole-slip').disabled=!$('grounding').checked;if(comparison)comparison.rebuild();else apply(elapsed*clip.fps);};
$('arm-spacing').onchange=()=>{if(comparison)comparison.rebuild();else apply(elapsed*clip.fps);};
$('ankle-relative').onchange=()=>{rebuildStancePlan();rebuildContactPlan();if(comparison)comparison.rebuild();else apply(elapsed*clip.fps);};
$('ankle-weights').onchange=()=>{ankleWeights.setEnabled(looping()&&$('ankle-weights').checked);readFeet=footSurfaceReader(model);rebuildContactPlan();if(comparison)comparison.rebuild();else apply(elapsed*clip.fps);};
$('play').onclick=()=>{if(travelMode&&elapsed>=cycle.seconds){elapsed=0;playing=false;}playing=!playing;last=performance.now();$('play').textContent=playing?'일시정지':'재생';};$('phase').oninput=()=>{playing=false;$('play').textContent='재생';elapsed=+$('phase').value*(looping()?cycle.period:clip.frames.length-1)/clip.fps;apply(elapsed*clip.fps);};
$('side').onclick=()=>{side=true;view();};$('front').onclick=()=>{side=false;view();};
new ResizeObserver(()=>{const r=$('view').getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height);if(comparison)comparison.view(side);}).observe($('view'));
function fail(e){loading('모델 준비에 실패했습니다. 다시 불러와 주세요.');$('loading-retry').hidden=false;console.error(e);}
$('loading-retry').onclick=()=>load().catch(fail);
if(travelMode&&!landingMode){
 playing=false;$('play').textContent='재생';
 $('mode').value='loop';$('mode').disabled=true;$('mode').selectedOptions[0].textContent='한 주기 비교';
 document.querySelector('h1').textContent='몸 이동 · 같은 자세 비교';
 $('intro').textContent='왼쪽 제자리 / 오른쪽 원본 수평 이동 · 한 주기 끝에서 정지합니다.';
 $('review-note').textContent='자세와 높이 보정은 양쪽 동일합니다. 원본에서 복원하는 것은 시작점 기준 수평 이동뿐입니다. 선은 한 주기 전체 궤적, 큰 발 점은 추정 지지발입니다. 골반 점은 몸 안의 위치를 보여주는 투시 표식입니다. 발 점은 발바닥 접촉점이 아닌 앞발 관절 기준점이며, 발 고정이나 물리 시뮬레이션이 아닙니다.';
 $('travel-legend').hidden=false;
 $('compare-link').href='./mocap.html';$('compare-link').textContent='기존 원본 뼈대 비교로';
 comparison=createTravelComparison({sourceGroup,modelGroup,lines,dots,camera,
  state:()=>({model,bones,clip,cycle,heading,scale,contact,frame:elapsed*clip.fps,side}),apply,slipMode});
}
if(landingMode){
 playing=false;side=false;$('play').textContent='재생';$('mode').value='loop';$('mode').disabled=true;$('mode').selectedOptions[0].textContent='한 주기 비교';$('speed').value='0.5';
 document.querySelector('h1').textContent=bilateralMode?'양발 착지 · 안쪽 디딤 비교':'오른발 착지 · 안쪽 디딤 비교';
 $('intro').textContent='현재 / 바깥으로 최대 2cm / 최대 4cm · 같은 순간을 정면·측면에서 비교합니다.';
 document.querySelector('.labels').style.gridTemplateColumns=hipTargetMode?'repeat(2,1fr)':'repeat(3,1fr)';
 const third=document.createElement('span');third.textContent=bilateralMode?'양발 · 최대 4cm':'오른발 · 최대 4cm';if(!hipTargetMode)document.querySelector('.labels').append(third);
 for(const id of ['grounding','arm-spacing','ankle-relative','ankle-weights','stance-width','sole-slip'])$(id).closest('label').hidden=true;
 $('stance-width').checked=false;
 $('review-note').textContent='35_17의 오른발 지지 추정 구간(28~58%)에만 적용합니다. 양 끝에서 부드럽게 0으로 돌아오며 회수 구간은 원래 동작입니다. 세 모델의 몸 이동·골반·왼다리·상체는 같습니다. 2cm·4cm는 검토용 실험값이며 정상 착지 기준이 아닙니다. 한 주기 끝에서 정지합니다.';
 if(bilateralMode)$('review-note').textContent='35_17 양발의 지지 추정 구간에만 적용합니다. 오른발 28~58%, 왼발 75~100%와 다음 주기 0~9%입니다. 각 다리의 회수 동작과 골반·몸 이동·상체는 유지합니다. 2cm·4cm는 비교용 실험값이며, 한 주기 끝에서 정지합니다.';
 if(hipTargetMode){document.querySelector('h1').textContent='양발 착지 · 고관절 수직선 비교';$('intro').textContent='왼쪽 현재 / 오른쪽 고관절 수직선 목표 · 정면 좌우 위치만 정렬 · 회수 동작 유지';$('review-note').textContent='점선: 같은 쪽 고관절의 정면 수직선 · 점: 발바닥의 낮은 표면 기준점(주황 오른발 / 파랑 왼발). 착지 구간의 가운데에서 선에 맞추고 시작·끝은 부드럽게 연결합니다. 발의 전후 위치·높이·방향과 회수 동작은 유지합니다. 자연스러움 검토용이며 한 주기 끝에서 정지합니다.';}
 if(chainPoseMode){document.querySelector('h1').textContent='오른발 착지 · 골반–무릎–발 연동';$('intro').textContent='왼쪽 현재 / 오른쪽 연동 자세 · 35_17 약 43% 한 장면만 비교';$('review-note').textContent='주황선은 고관절–무릎–발목의 검사용 투시 연결선입니다. 골반의 좌우 기울기·위치·높이와 무릎 굽힘 방향을 함께 조절합니다. 무릎 굽힘 크기와 발 방향을 유지하며 왼다리는 골반을 따라 이동합니다. 정지 자세 검토용이며 전체 달리기에는 적용하지 않았습니다.';for(const id of ['play','phase','mode'])$(id).hidden=true;$('speed').closest('label').hidden=true;}
 if(chainMotionMode){document.querySelector('h1').textContent='오른발 착지 구간 · 골반–무릎–발 연동';$('intro').textContent='왼쪽 현재 / 오른쪽 연동 재생 · 착지 구간에서만 적용하고 회수 동작으로 복귀';$('review-note').textContent='주황선은 고관절–무릎–발목의 검사용 투시 연결선입니다. 오른발 지지 추정 구간(28~58%)에서 골반·무릎·발을 함께 조절하며 양 끝 12%p에서 부드럽게 연결합니다. 구간 밖은 원래 동작입니다. 왼다리 관절 각도는 유지하지만 골반을 따라 이동합니다. 한 주기 끝에서 정지합니다.';}
 if(chainBilateralMode){document.querySelector('h1').textContent='양발 착지 구간 · 골반–무릎–발 연동';$('intro').textContent='왼쪽 현재 / 오른쪽 양발 연동 · 정면·측면 같은 순간 비교';$('review-note').textContent='검사용 투시선: 주황 오른다리 / 파랑 왼다리. 각 발의 지지 추정 구간에서 골반·무릎·발을 함께 조절하고 양 끝 12%p에 걸쳐 연결합니다. 회수 다리의 관절 각도는 유지하며 공간상 위치는 골반을 따릅니다. 한 주기 끝에서 정지합니다. 자연스러움·물리 균형은 검토 전입니다.';}
 if(pelvisSwayMode){document.querySelector('h1').textContent='골반 좌우 흔들림 · 착지 유지 비교';$('intro').textContent='왼쪽 기존 양발 연동 / 오른쪽 골반 추가 좌우 이동 50% · 같은 시점 비교';$('review-note').textContent='기존 착지 위치를 유지하면서 추가 골반 좌우 이동만 절반으로 줄인 실험입니다. 무릎 굽힘·뼈 길이를 유지하도록 지지 다리와 골반 높이를 다시 계산합니다. 회수 다리의 관절 각도는 유지하며 위치는 골반을 따릅니다. 주황/파랑 선은 오른다리/왼다리 검사용 투시선입니다. 자연스러움 검토 전 · 한 주기 끝에서 정지합니다.';}
 if(hipReferenceMode){document.querySelector('h1').textContent='오른발 착지 · 골반 기준 유지';$('intro').textContent='왼쪽 기존 M39 / 오른쪽 고관절 기준 착지 · 오른발 구간만 변경';$('review-note').textContent='오른발 지지 추정 구간에서 골반 기준 이동·회전을 유지하고 같은 쪽 고관절을 기준으로 착지 목표를 잡습니다. 고관절·무릎·발을 함께 조절하며 무릎 굽힘 크기는 달라집니다. 회수 구간과 왼발 지지 구간은 기존 M39 그대로입니다. 주황/파랑은 오른다리/왼다리 검사용 투시선 · 자연스러움 검토 전입니다.';}
 if(footPlantMode){document.querySelector('h1').textContent='오른발 지면 고정 · 짧은 구간 비교';$('intro').textContent='왼쪽 기존 M40 / 오른쪽 지면 고정 · 골반 기준 이동 유지';$('review-note').textContent='주기 40~46%의 짧은 구간에 발 위치·방향을 유지합니다. 32~40%에서 연결하고 46~58%에서 해제합니다. 고관절·무릎으로 연결하며 골반·왼다리·상체는 기존 동작입니다. 주황/파랑은 오른다리/왼다리 검사용 투시선 · 고정 밖 미끄러짐과 자연스러움은 검토가 필요합니다.';}
 if(pivotReleaseMode){document.querySelector('h1').textContent='오른발 해제 · 지지점 연동 비교';$('intro').textContent='왼쪽 기존 M42 / 오른쪽 지지점 연동 · 골반·회수 유지';$('review-note').textContent='46~58% 해제 구간만 발바닥의 같은 지점을 기준으로 발 회전과 발목 위치를 연결합니다. 골반·왼다리·구간 밖 회수는 기존 M42입니다. 지지점은 고정이 아니라 양끝을 잇는 경로이며 자연스러움·남은 밀림은 검토 전입니다.';}
 if(releaseRefinementMode){document.querySelector('h1').textContent='오른발 해제 · 좌우 밀림과 발끝 비교';$('intro').textContent='왼쪽 기존 M44 / 오른쪽 좌우·발끝 보정 · 골반·회수 유지';$('review-note').textContent='46~58% 해제 구간만 좌우 경로를 최대 8mm 조절하고 발끝 추가 회전을 8도 이내로 제한합니다. 양끝에서 보정을 풀어 골반·회수 동작을 유지합니다. 완전 접지와 자연스러움은 검토 전입니다.';}
 if(foreAftReleaseMode){document.querySelector('h1').textContent='오른발 해제 · 앞뒤 밀림 재보정';$('intro').textContent='왼쪽 기존 M45 / 오른쪽 앞뒤 보정 · 좌우·발끝·골반·회수 유지';$('review-note').textContent='46~58% 해제 구간의 앞뒤 위치만 최대 3mm 추가 조절합니다. 기존 좌우 경로·발끝 각도와 구간 밖 회수는 유지합니다. 기하학적 접지 근사이며 자연스러움은 검토 전입니다.';}
 if(stanceContactMode){document.querySelector('h1').textContent='양발 · 착지 전 정렬과 지지 중 좌우 고정';$('intro').textContent='왼쪽 기존 M46 / 오른쪽 양발 착지 경로 수정';$('review-note').textContent='착지 전에 같은 쪽 고관절 아래로 정렬하고, 지지 중에는 그 지면 위치를 유지합니다. 지지 중 발의 좌우 기울기·비틀림을 제한하고 앞뒤 회전은 살립니다. 골반 궤적 유지 · 발을 뗀 뒤 회수 연결 · 앞뒤 완전 접지와 자연스러움은 미검증.';}
 if(swingApproachMode){document.querySelector('h1').textContent='양발 · 안쪽으로 돌아드는 착지 접근 경로 수정';$('intro').textContent='왼쪽 M47 / 오른쪽 회수 후반부터 착지까지 연결';$('review-note').textContent='양발 각각 바깥쪽 회수 지점부터 착지점까지 경로를 정합니다. 골반·지지 중 고정은 유지합니다. 기본 남녀·35_17 실험이며 자연스러움은 사용자 검토 전입니다.';}
 if(leftAnkleDirectionMode){document.querySelector('h1').textContent='왼발 발목 · 착지 방향 교정';$('intro').textContent='왼쪽 기존 M48 / 오른쪽 왼발 방향 교정 · 양발 정면·측면 비교';$('review-note').textContent='왼발 자체의 기본 축으로 착지 방향을 재구성합니다. 앞뒤 굽힘과 같은 피부 지점의 지면 위치·골반 궤적을 유지합니다. 착지 전 63~75% 연결, 지지 75~다음 9%, 해제 9~21% 연결; 나머지 회수와 오른발은 기존 동작입니다. 실험 목표이며 의학적 정상 자세 판정이 아닙니다.';}
 if(pelvisReferenceRestoreMode){document.querySelector('h1').textContent='왼발 지지 · 추가 몸 이동 제거';$('intro').textContent='왼쪽 기존 M50 / 오른쪽 추가 몸 이동 제거 · 정면·측면 비교';$('review-note').textContent='원본 수평 이동과 기존 접지 높이를 기준으로 골반 위치를 복원합니다. 왼발 착지점과 발 방향은 다리를 다시 계산해 유지합니다. 공중 다리는 몸을 따라 움직이며 몸 기준 자세를 유지합니다. 골반 회전과 좌우 발 들림 차이는 이번 수정 범위가 아닙니다.';}
 if(landingSoleAlignmentMode){document.querySelector('h1').textContent='양발 착지 초기 · 발목 기울기 비교';$('intro').textContent='왼쪽 기존 M52 / 오른쪽 착지 초기 교정 · 정면·측면 비교';$('review-note').textContent='양발의 착지 초기 발바닥 기울기를 같은 기준으로 맞춥니다. 골반 이동과 기존 착지점을 유지하고, 지지 중간까지 원래 발 동작으로 연결합니다. 밀어내기·회수와 접지 시점은 기존 그대로입니다.';}
 if(lateStanceSoleMode){document.querySelector('h1').textContent='양발 지지 후반 · 발목 기울기 비교';$('intro').textContent='왼쪽 기존 M53 / 오른쪽 지지 후반 교정 · 정면·측면 비교';$('review-note').textContent='양발의 기존 밀어내기 곡선을 같은 지지 진행률로 비교해 발 회전 기준을 맞춥니다. 골반과 착지 지면 위치는 유지하고, 회수 시작 전에 원래 자세로 연결합니다. 지지 종료 순간의 기존 좌우 차이는 남습니다.';}
 if(lateToeTrialMode){document.querySelector('h1').textContent='발끝 미끄러짐 · 보존 조건 충돌 확인';$('intro').textContent='왼쪽 M54 / 오른쪽 미채택 시험 · 정면·측면 · 기본 동작 미변경';$('review-note').textContent='오른쪽은 발끝 이동을 잠시 25% 줄여 본 진단용 후보입니다. 발 기울기·발 들림·골반과 회수는 유지하려 하지만, 기존 착지 기준점이 이동하고 해제 때 미끄러짐을 뒤로 미룰 수 있어 채택하지 않았습니다.';}
 if(toeSlipPathMode){document.querySelector('h1').textContent='양발 발끝 미끄러짐 · 후반 경로 비교';$('intro').textContent='왼쪽 M54 / 오른쪽 M56 · 착지 순간 위치 유지 · 이후 이동 교정';$('review-note').textContent='발끝 경로의 급한 방향·속도 변화를 작게 줄입니다. 발 기울기·들림·골반과 회수 동작을 유지하며, 발을 잠시 고정했다가 급하게 놓는 방식을 사용하지 않습니다. 지면 고정 완성이나 실제 마찰 시뮬레이션은 아닙니다.';}
 comparison=createLandingComparison({toeSlipPath:toeSlipPathMode,lateToeTrial:lateToeTrialMode,lateStanceSole:lateStanceSoleMode,landingSoleAlignment:landingSoleAlignmentMode,pelvisReferenceRestore:pelvisReferenceRestoreMode,leftAnkleDirection:leftAnkleDirectionMode,swingApproach:swingApproachMode,stanceContact:stanceContactMode,foreAftRelease:foreAftReleaseMode,releaseRefinement:releaseRefinementMode,pivotRelease:pivotReleaseMode,footPlant:footPlantMode,hipReference:hipReferenceMode,pelvisSway:pelvisSwayMode,chainBilateral:chainBilateralMode,chainMotion:chainMotionMode,chainPose:chainPoseMode,hipTarget:hipTargetMode,bilateral:bilateralMode,sourceGroup,modelGroup,lines,dots,scene,camera,state:()=>({model,bones,clip,cycle,heading,scale,leftFootAxes,soleRegions,frame:elapsed*clip.fps,side}),apply});
}
if(slipMode){
 document.querySelector('h1').textContent='오른발 착지 · 미끄러짐 비교';
 $('intro').textContent='양쪽 원본 수평 이동 복원 · 오른발 한 구간만 보정 · 한 주기 끝에서 정지';
 $('sole-slip-control').hidden=false;
 $('slip-link').href='?compare=travel';$('slip-link').textContent='몸 이동 복원 비교로';
 $('review-note').textContent='지면 4mm 이내의 오른발 피부 점 이동을 줄이도록 몸의 수평 위치만 최대 5cm 조절합니다. 관절 회전과 높이는 동일하며, 왼발은 이번 보정 대상이 아닙니다. 보정 구간 밖에서는 누적 위치 차이를 유지합니다. 색 선은 골반/앞발 관절 궤적, 큰 발 점은 추정 지지발입니다. 실제 접촉을 측정한 물리 해석이 아닌 한 주기 실험입니다.';
}
view();load().catch(fail);renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.1);last=now;if(ready&&playing){if(travelMode){elapsed=Math.min(elapsed+dt*+$('speed').value,cycle.seconds);if(elapsed>=cycle.seconds){playing=false;$('play').textContent='처음부터 재생';}}
else elapsed=(elapsed+dt*+$('speed').value)%(durationFrames()/clip.fps);apply(elapsed*clip.fps);}renderer.render(scene,camera);});
window.mocapReview={get stancePlan(){return stancePlan;},get comparison(){return comparison;},get heading(){return heading;},get ready(){return ready;},get clip(){return clip;},get cycle(){return cycle;},get contact(){return contact;},get armSpacing(){return armSpacing;},get sampledFrame(){return sampledFrame;},get model(){return model;},get bones(){return bones;},get mapping(){return mapping;},get scale(){return scale;},get ankleWeights(){return ankleWeights;},seek(frame){playing=false;elapsed=frame/clip.fps;$('play').textContent='재생';apply(frame);renderer.render(scene,camera);},get points(){return dots.map(d=>d.position.toArray());},renderer,scene,camera};
