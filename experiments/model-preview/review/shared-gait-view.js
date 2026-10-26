import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createAnkleWeights} from './ankle-weights.js';
import {createLandingSurface} from './hip-landing.js';
import {createSharedGait} from './shared-gait.js';
import {createBodyHeight} from './body-height.js';
import {createUpperCenter} from './upper-center.js';
import {createBilateralPose} from './bilateral-pose.js';
import {createBilateralSkin} from './bilateral-skin.js';
import {createSharedApproach} from './shared-approach.js';
import {createSharedSupport,SUPPORT_WINDOW} from './shared-support.js';
import {createSharedRelease} from './shared-release.js';
import {createKneeLateral} from './knee-lateral.js';
import {createArmSwing} from './arm-swing.js';
import {createHandPose} from './hand-pose.js';
import {createEarlySupport} from './early-support.js';
import {createSupportJoin} from './support-join.js';
import {createUnifiedStance} from './unified-stance.js';
import {createLegHeight,createHeightTransition} from './leg-height.js';
import {createElbowBend,createElbowTransition} from './elbow-bend.js';

const $=id=>document.getElementById(id);
const comparison=new URLSearchParams(location.search).get('compare');
const heightComparison=comparison==='body-height',upperComparison=comparison==='upper-center',bilateralComparison=comparison==='bilateral-pose';
const elbowBendComparison=comparison==='elbow-bend';
const legHeightComparison=comparison==='leg-height'||elbowBendComparison;
const unifiedStanceComparison=comparison==='unified-stance'||legHeightComparison;
const supportJoinComparison=comparison==='support-join'||unifiedStanceComparison;
const earlySupportComparison=comparison==='early-support'||supportJoinComparison;
const handPoseComparison=comparison==='hand-pose'||earlySupportComparison;
const armSwingComparison=comparison==='arm-swing'||handPoseComparison;
const kneeLateralComparison=comparison==='knee-lateral'||armSwingComparison;
const releaseComparison=comparison==='shared-release'||kneeLateralComparison;
const supportBilateralComparison=comparison==='shared-support-bilateral'||releaseComparison;
const supportComparison=comparison==='shared-support'||supportBilateralComparison;
const approachComparison=comparison==='shared-approach',fullPose=bilateralComparison||approachComparison||supportComparison;
if(supportComparison){
 document.title='오른발 지지 후반 비교';
 document.querySelector('h1').textContent='오른발 지지 후반의 발끝 이동 줄이기';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 골반 이동·몸 높이·발이 향하는 방향 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 양발 공통 동작</span><span>수정 · 오른발 지지 연결</span>';
 document.querySelector('.note').textContent='오른발 지지 후반만 시험합니다. 무릎과 발 위치를 함께 조절하고 60%부터 기존 회수 동작으로 돌아갑니다. 왼발은 이번 비교에서 그대로이며, 종아리 대비 발목 각도는 무릎 변경에 따라 달라집니다.';
}
if(supportBilateralComparison){
 document.title='양발 지지 후반 비교';
 document.querySelector('h1').textContent='왼발에도 같은 지지 연결 적용';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 골반 이동·몸 높이·양발이 향하는 방향 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 오른발만 적용</span><span>수정 · 양발 적용</span>';
 document.querySelector('.note').textContent='왼발도 반 주기 뒤 같은 순서로 연결·유지·해제합니다. 오른발의 이전 결과는 유지하고, 왼발은 반복 경계를 지나 다음 10%에서 기존 회수 동작으로 돌아갑니다. 주황은 오른다리, 파랑은 왼다리입니다.';
}
if(releaseComparison){
 document.title='양발 해제 떨림 비교';
 document.querySelector('h1').textContent='발을 뗄 때 무릎의 짧은 왕복 줄이기';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 골반 이동·몸 높이·발 방향·지지 중 고정 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 짧은 해제 연결</span><span>수정 · 회수까지 연결</span>';
 document.querySelector('.note').textContent='발 고정이 끝난 뒤 무릎이 다시 펴지는 왕복을 줄입니다. 오른발 55~68%, 왼발은 반 주기 뒤에 적용하고 이후 원래 회수로 합류합니다. 주황은 오른다리, 파랑은 왼다리입니다.';
}
if(kneeLateralComparison){
 document.title='무릎 좌우 흔들림 비교';
 document.querySelector('h1').textContent='발을 뗄 때 무릎의 옆 우회 줄이기';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 무릎 굽힘·골반 이동·몸 높이·발 위치와 방향 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 굽힘 연결</span><span>수정 · 무릎 옆 경로 연결</span>';
 document.querySelector('.note').textContent='무릎이 안으로 갔다 나오는 우회를 줄입니다. 오른발 53~68%, 왼발은 반 주기 뒤에 적용하며 발목 위치와 무릎 굽힘은 그대로입니다. 주황은 오른다리, 파랑은 왼다리입니다.';
}
if(armSwingComparison){
 document.title='팔 앞뒤 움직임 비교';
 document.querySelector('h1').textContent='몸통을 따라 팔 앞뒤 움직임 연결';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 다리 동작·발 방향·골반 이동·몸 높이 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 오른팔 기준 흔들림</span><span>수정 · 원본 양팔을 함께 반영</span>';
 document.querySelector('.note').textContent='같은 35_17 원본의 양팔 앞뒤 움직임을 반 주기 맞춰 평균했습니다. 어깨 높이와 팔꿈치·손목의 상대각은 유지합니다. 손 모양은 기존 그대로이며 전체 자연스러움은 검토 중입니다.';
}
if(handPoseComparison){
 document.title='손목·손 모양 비교';
 document.querySelector('h1').textContent='손목 꺾임을 줄이고 손가락 모으기';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 팔 흔들림·다리 동작·발 방향·몸 높이 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 펼쳐진 손과 손목</span><span>수정 · 기본 손목 연결과 모은 손</span>';
 document.querySelector('.note').textContent='손목은 모델의 기본 연결 각도로 되돌리고 손가락만 가볍게 모았습니다. 손 모양은 시각 비교용이며 실측 손가락 동작은 아닙니다. 어깨·팔꿈치·손목 위치와 기존 팔 흔들림은 그대로입니다.';
}
if(earlySupportComparison){
 document.title='착지 초반 지면 이동 비교';
 document.querySelector('h1').textContent='착지 초반의 발 미끄러짐 줄이기';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 골반 이동·몸 높이·발 방향·회수 동작 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 착지 초반 이동</span><span>수정 · 초기 지지 연결</span>';
 document.querySelector('.note').textContent='양발 착지 초반에 같은 발바닥 점을 기준으로 고관절·무릎·발을 함께 조절합니다. 첫 착지 위치를 유지하고 기존 지지에 부드럽게 합류합니다. 발 방향은 유지하지만 종아리 대비 발목 상대각은 달라질 수 있습니다.';
}
if(supportJoinComparison){
 document.title='왼발 지지 합류 비교';
 document.querySelector('h1').textContent='왼발이 기존 지지로 합류하는 경로 비교';
 document.querySelector('main > p').textContent='작은 우회만 축소 · 착지 초반·골반 이동·몸 높이·발 방향·회수 동작 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 착지 초반 보정</span><span>수정 · 합류 후반 연결</span>';
}
if(approachComparison){
 document.title='양발 착지 접근 경로 비교';
 document.querySelector('h1').textContent='착지 전 좌우 왕복 줄이기';
 document.querySelector('main > p').textContent='같은 시각의 수정 전후 · 좌우 대칭·발목 방향·몸 높이 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 전신 좌우 대응</span><span>수정 · 착지 접근 연결</span>';
 document.querySelector('.note').textContent='공중에서 안쪽으로 들어갔다 나오는 우회를 줄입니다. 착지점과 지지 동작은 유지합니다. 주황은 오른다리, 파랑은 왼다리입니다.';
}
if(heightComparison){
 document.title='몸 높이 연결 비교';
 document.querySelector('h1').textContent='몸 높이를 부드럽게 연결';
 document.querySelector('main > p').textContent='발목 회전과 양발 공통 동작 유지 · 공중 구간의 높이만 연결';
 document.querySelector('.labels').innerHTML='<span>기존 · 양발 공통 동작</span><span>수정 · 몸 높이 연결</span>';
 document.querySelector('.note').textContent='주기 10~24%, 60~74%의 몸 높이만 연결합니다. 착지·지지 구간과 관절 회전은 유지합니다. 주황은 오른다리, 파랑은 왼다리입니다.';
}
if(upperComparison){
 document.title='상체 중심 좌우 대응 비교';
 document.querySelector('h1').textContent='상체 중심도 같은 박자로';
 document.querySelector('main > p').textContent='상체 중심의 좌우 대응 · 발목·양발 동작·몸 높이 유지';
 document.querySelector('.labels').innerHTML='<span>기존 · 몸 높이 연결</span><span>수정 · 상체 중심 대응</span>';
 document.querySelector('.note').textContent='몸통·목·머리 중심의 회전만 반 주기로 맞춥니다. 팔의 굽힘은 유지하고 몸통을 따라갑니다. 양발의 안쪽 접근 경로는 이번 수정에 포함하지 않습니다.';
}
if(bilateralComparison){
 document.title='전신 좌우 자세 확인';
 document.querySelector('h1').textContent='양쪽 자세를 같은 단계로 확인';
 document.querySelector('main > p').textContent='수정된 같은 모델 · 오른쪽 칸은 반 주기 뒤 자세를 좌우 반전';
 document.querySelector('.labels').innerHTML='<span>현재 단계</span><span>반 주기 뒤 · 좌우 반전</span>';
 document.querySelector('.note').textContent='두 칸 모두 수정된 동작입니다. 골반을 맞춰 전신 자세를 비교합니다. 정면·측면에서 팔·손·다리까지 확인하세요. 지면 위 이동 경로를 겹친 화면은 아닙니다.';
 const toggle=document.createElement('label');
 toggle.innerHTML='<input id="poseBaseline" type="checkbox"> 수정 전 차이 보기';
 document.querySelector('.bar').append(toggle);
}
const scene=new T.Scene();scene.background=new T.Color('#f6f5f1');
scene.add(new T.HemisphereLight(0xffffff,0x7a8477,2.5));
const light=new T.DirectionalLight(0xfff5e8,3);light.position.set(2,4,5);scene.add(light);
const camera=new T.OrthographicCamera(-3,3,2,-2,.01,50);camera.aspect=1;
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('view').append(renderer.domElement);
let data,lanes=[],probe,plan,heightPlan,upperPlan,bilateralPlan,approachPlan,supportPlan,supportBilateralPlan,releasePlan,kneeLateralPlan,armSwingPlan,handPosePlan,earlySupportPlan,supportJoinPlan,unifiedStancePlan,legHeightPlan,elbowBendPlan,poseSkin,ready=false,playing=false,phase=0,side=false,last=performance.now(),diagnostic;
const heightTransition=createHeightTransition();
let requestedHeight=0,requestedElbow=0;
const elbowTransition=createElbowTransition();
function laneOf(model,visible=true){
 const group=new T.Group();group.add(model);group.updateMatrixWorld(true);
 const lines=['r','l'].map((s,i)=>{const line=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:i?0x1687ad:0xb96540,depthTest:false}));line.renderOrder=3;group.add(line);return line;});
 if(visible){const grid=new T.GridHelper(12,60,0xc5cfc4,0xe0e5dd);grid.position.y=-.005;group.add(grid);scene.add(group);}
 return {model,group,lines,readSurface:createLandingSurface(model)};
}
function dispose(){
 const geometries=new Set(),materials=new Set();
 for(const lane of [...lanes,probe].filter(Boolean)){
  lane.group.removeFromParent();lane.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [o.material].flat())materials.add(m);});
 }
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();lanes=[];probe=null;
}
function view(value=side){
 side=value;lanes.forEach((lane,i)=>{lane.group.scale.set(1,1,1);lane.group.position.set(0,0,0);lane.group.position[side?'z':'x']=(i-.5)*1.8*(side?-1:1);lane.group.updateMatrixWorld(true);});
 if(ready)draw();
}
function draw(){
 if(bilateralComparison){
  // Always evaluate in the original rig frame. Reflection belongs only to the
  // display group, after animation; it must never alter retargeted rotations.
  lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
  const active=$('poseBaseline').checked?upperPlan:bilateralPlan;
  poseSkin.setEnabled(!$('poseBaseline').checked);
  document.querySelector('main > p').textContent=($('poseBaseline').checked?'수정 전 동작':'수정된 동작')+' · 같은 모델의 현재 단계와 반 주기 뒤 좌우 반전';
  active.apply(lanes[0],probe,phase);diagnostic=active.apply(lanes[1],probe,phase+.5);
  const center=lanes[0].model.getObjectByName('pelvis').getWorldPosition(new T.Vector3());
  lanes.forEach((lane,i)=>{
   const pelvis=lane.model.getObjectByName('pelvis').getWorldPosition(new T.Vector3()),scale=i?-1:1;
   lane.group.scale.x=scale;
   lane.group.position.set(center.x-scale*pelvis.x,center.y-pelvis.y,center.z-pelvis.z);
   lane.group.position[side?'z':'x']+=(i-.5)*1.8*(side?-1:1);lane.group.updateMatrixWorld(true);
  });
 }
 else if(elbowBendComparison){
  legHeightPlan.apply(lanes[0],probe,phase,heightTransition.value);
  diagnostic=elbowBendPlan.apply(lanes[1],probe,phase,heightTransition.value,elbowTransition.value);
  $('actualElbows').textContent=diagnostic.elbowBend.map(v=>`${v.side==='r'?'오른팔':'왼팔'} ${v.actualDeg.toFixed(1)}°`).join(' · ');
 }
 else if(legHeightComparison){unifiedStancePlan.apply(lanes[0],probe,phase);diagnostic=legHeightPlan.apply(lanes[1],probe,phase,heightTransition.value);}
 else if(unifiedStanceComparison){supportJoinPlan.apply(lanes[0],probe,phase);diagnostic=unifiedStancePlan.apply(lanes[1],probe,phase);}
 else if(supportJoinComparison){earlySupportPlan.apply(lanes[0],probe,phase);diagnostic=supportJoinPlan.apply(lanes[1],probe,phase);}
 else if(earlySupportComparison){handPosePlan.apply(lanes[0],probe,phase);diagnostic=earlySupportPlan.apply(lanes[1],probe,phase);}
 else if(handPoseComparison){armSwingPlan.apply(lanes[0],probe,phase);diagnostic=handPosePlan.apply(lanes[1],probe,phase);}
 else if(armSwingComparison){kneeLateralPlan.apply(lanes[0],probe,phase);diagnostic=armSwingPlan.apply(lanes[1],probe,phase);}
 else if(kneeLateralComparison){releasePlan.apply(lanes[0],probe,phase);diagnostic=kneeLateralPlan.apply(lanes[1],probe,phase);}
 else if(releaseComparison){supportBilateralPlan.apply(lanes[0],probe,phase);diagnostic=releasePlan.apply(lanes[1],probe,phase);}
 else if(supportBilateralComparison){supportPlan.apply(lanes[0],probe,phase);diagnostic=supportBilateralPlan.apply(lanes[1],probe,phase);}
 else if(supportComparison){approachPlan.apply(lanes[0],probe,phase);diagnostic=supportPlan.apply(lanes[1],probe,phase);}
 else if(approachComparison){bilateralPlan.apply(lanes[0],probe,phase);diagnostic=approachPlan.apply(lanes[1],probe,phase);}
 else if(upperComparison){heightPlan.apply(lanes[0],probe,phase);diagnostic=upperPlan.apply(lanes[1],probe,phase);}
 else if(heightComparison){plan.apply(lanes[0],probe,phase);diagnostic=heightPlan.apply(lanes[1],probe,phase);}
 else{plan.original(lanes[0],phase);diagnostic=plan.apply(lanes[1],probe,phase);}
 for(const lane of lanes)for(let i=0;i<2;i++){
  lane.lines[i].visible=$('bones').checked;
  lane.lines[i].geometry.setFromPoints(['thigh','calf','foot','ball'].map(n=>lane.group.worldToLocal(lane.model.getObjectByName(n+'_'+(i?'l':'r')).getWorldPosition(new T.Vector3()))));
  lane.lines[i].geometry.computeBoundingSphere();
 }
 const center=lanes[0].group.worldToLocal(lanes[0].model.getObjectByName('pelvis').getWorldPosition(new T.Vector3()));center.y=.95;
 const height=Math.max(1.15,2.7/camera.aspect);
 Object.assign(camera,{left:-height*camera.aspect,right:height*camera.aspect,top:height,bottom:-height});
 camera.position.copy(center).add(new T.Vector3(side?10:0,0,side?0:10));camera.lookAt(center);camera.updateProjectionMatrix();
 $('phase').value=String(phase);$('status').textContent=`한 주기 ${data.seconds.toFixed(2)}초 · 양발 간격 50%`;
 renderer.render(scene,camera);
}
function controls(enabled){
 for(const id of ['play','front','side','phase','model',...(legHeightComparison?['legHeight','resetHeight']:[]),...(elbowBendComparison?['elbowBend','resetElbow']:[])])$(id).disabled=!enabled;
}
async function load(){
 ready=false;playing=false;controls(false);$('play').textContent='재생';$('loading').hidden=false;$('retry').hidden=true;
 $('loading').textContent='모델과 동작을 불러오는 중…';$('status').textContent='준비 중';
 const start=performance.now(),selected=$('model').value;
 const [bytes,reference]=await Promise.all([fetch('/models/runner-'+selected+'.glb').then(r=>{if(!r.ok)throw Error('모델을 불러오지 못했습니다.');return r.arrayBuffer();}),data||fetch('/review-data/shared-gait-reference.json').then(r=>{if(!r.ok)throw Error('동작 자료를 불러오지 못했습니다.');return r.json();})]);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(reference.schema!==1||reference.models[selected]?.modelHash!==hash)throw Error('모델과 기준 동작의 버전이 다릅니다. 기준 동작을 다시 만들어야 합니다.');
 const asset=await new GLTFLoader().parseAsync(bytes,'/models/');
 data=reference;dispose();
 createAnkleWeights(asset.scene).setEnabled(true);
 poseSkin=fullPose?createBilateralSkin(asset.scene):null;
 lanes=[laneOf(asset.scene),laneOf(clone(asset.scene))];probe=laneOf(clone(asset.scene),false);
 plan=createSharedGait(data.models[selected]);heightPlan=(heightComparison||upperComparison||fullPose)?createBodyHeight(plan,lanes[1],probe):null;
 upperPlan=(upperComparison||fullPose)?createUpperCenter(heightPlan,data.models[selected]):null;
 bilateralPlan=fullPose?createBilateralPose(upperPlan,data.models[selected]):null;
 if(approachComparison||supportComparison)poseSkin.setEnabled(true);
 approachPlan=(approachComparison||supportComparison)?createSharedApproach(bilateralPlan,lanes[1],probe):null;
 supportPlan=supportComparison?createSharedSupport(approachPlan,lanes[1],probe,plan.pelvisTravel):null;
 supportBilateralPlan=supportBilateralComparison?createSharedSupport(supportPlan,lanes[1],probe,plan.pelvisTravel,{...SUPPORT_WINDOW,side:'l'}):null;
 releasePlan=releaseComparison?createSharedRelease(supportBilateralPlan,lanes[1],probe,plan.pelvisTravel):null;
 kneeLateralPlan=kneeLateralComparison?createKneeLateral(releasePlan,lanes[1],probe):null;
 armSwingPlan=armSwingComparison?createArmSwing(kneeLateralPlan,data.models[selected]):null;
 handPosePlan=handPoseComparison?createHandPose(armSwingPlan,data.models[selected]):null;
 earlySupportPlan=earlySupportComparison?createEarlySupport(handPosePlan,lanes[1],probe,plan.pelvisTravel):null;
 supportJoinPlan=supportJoinComparison?createSupportJoin(earlySupportPlan,lanes[1],probe,plan.pelvisTravel):null;
 unifiedStancePlan=unifiedStanceComparison?createUnifiedStance(supportJoinPlan,lanes[1],probe,plan.pelvisTravel,{r:earlySupportPlan.right.vertex,l:earlySupportPlan.left.vertex}):null;
 legHeightPlan=legHeightComparison?createLegHeight(unifiedStancePlan):null;
 elbowBendPlan=elbowBendComparison?createElbowBend(legHeightPlan):null;
 if(legHeightComparison){
  document.title='기본 달리기 · 다리 들림 높이';
  document.querySelector('h1').textContent='다리 들림 높이를 바꾸며 달려보기';
  document.querySelector('main > p').textContent='왼쪽은 현재 기본 동작 · 오른쪽은 설정한 높이를 양쪽 다리에 적용';
  document.querySelector('.labels').innerHTML='<span>기본 · 0cm</span><span id=heightLabel>설정 · 기본값</span>';
  document.querySelector('.note').textContent='무릎을 앞으로 들 때 기본보다 더 높일 최대 높이입니다. 0cm는 현재 달리기 그대로입니다. 양발에 반 주기 차로 적용하며 착지·지지, 몸 높이와 발 방향은 유지합니다. 이번 시험은 0~10cm 추가만 지원합니다.';
  $('heightControls').hidden=false;updateHeight(requestedHeight,true);
  if(elbowBendComparison){
   document.title='달리기 자세 · 팔꿈치 굽힘';
   document.querySelector('h1').textContent='다리 들림과 팔꿈치 굽힘을 함께 조절';
   document.querySelector('main > p').textContent='양쪽 칸의 다리 설정은 동일 · 오른쪽에만 팔꿈치 조절값 적용';
   document.querySelector('.note').textContent='팔을 편 상태가 굽힘 0°입니다. 조절값은 기본 달리기의 굽힘에 더하거나 빼는 각도이며, 실제 각도는 위에 표시됩니다. 어깨 흔들림·손 모양·다리 설정은 유지합니다.';
   $('elbowControls').hidden=false;updateElbow(requestedElbow,true);
  }
 }else if(unifiedStanceComparison){
  document.title="양발 착지·지지·발 떼기 통합";
  document.querySelector("h1").textContent="양발 접촉 구간을 하나의 경로로 연결";
  document.querySelector("main > p").textContent="골반·몸 높이·발 방향·회수 동작 유지 / 정면·측면 비교";
  document.querySelector(".labels").innerHTML="<span>기존 · 구간별 연결</span><span>수정 · 통합 접촉 경로</span>";
  document.querySelector(".note").textContent="양발에 같은 접촉 경로 계산을 반 주기 차로 적용합니다. 지지 중 별도 위치로 돌아가는 연결을 없애고, 발을 뗀 뒤 기존 회수에 연결합니다. 기하 기능 시험이며 실제 접촉력 검증은 아닙니다.";
 }else if(supportJoinComparison){
  document.querySelector('.labels').lastElementChild.textContent=supportJoinPlan.enabled?'수정 · 합류 후반 연결':'유지 · 이미 직선에 가까운 경로';
  document.querySelector('.note').textContent=supportJoinPlan.enabled?'왼발 88–93%의 작은 우회만 줄였습니다. 합류 시작·끝 위치를 유지하므로 감소량은 작고 이동이 남습니다. 좌우 자세 차이는 별도로 검사했습니다.':'이 모델의 합류 경로는 이미 직선에 가까워 이번 보정을 적용하지 않습니다. 두 칸 모두 기존 동작입니다.';
 }
 phase=0;view();ready=true;draw();controls(true);$('loading').hidden=true;last=performance.now();
 performance.measure('shared-gait-ready',{start,end:performance.now()});
}
function fail(e){ready=false;controls(false);$('model').disabled=false;$('loading').hidden=false;$('loading').textContent='준비하지 못했습니다. 다시 불러와 주세요.';$('retry').hidden=false;$('status').textContent='불러오기 실패';console.error(e);}
function seek(value){if(elbowBendComparison)elbowTransition.set(requestedElbow,true);if(legHeightComparison)heightTransition.set(requestedHeight,true);playing=false;$('play').textContent='재생';phase=Math.max(0,Math.min(1,value));if(ready)draw();}
$('model').onchange=()=>load().catch(fail);$('retry').onclick=()=>load().catch(fail);
$('play').onclick=()=>{if(phase>=1)phase=0;playing=!playing;last=performance.now();$('play').textContent=playing?'일시정지':'재생';if(!playing&&legHeightComparison){heightTransition.set(requestedHeight,true);if(elbowBendComparison)elbowTransition.set(requestedElbow,true);draw();}};
$('phase').oninput=()=>seek(+$('phase').value);$('front').onclick=()=>view(false);$('side').onclick=()=>view(true);$('bones').onchange=()=>ready&&draw();
function updateHeight(value,immediate=!playing){
 requestedHeight=Math.max(0,Math.min(10,Number.isFinite(value)?value:0));
 heightTransition.set(requestedHeight,immediate);
 $('legHeight').value=String(requestedHeight);
 $('legHeightValue').textContent=requestedHeight===0?'0cm · 기본':`+${requestedHeight}cm`;
 if(elbowBendComparison)updatePoseLabels();
 else $('heightLabel').textContent=requestedHeight===0?'설정 · 기본값':`설정 · 무릎 +${requestedHeight}cm`;
 if(ready)draw();
}
function updatePoseLabels(){
 const leg=requestedHeight===0?'다리 기본':`다리 +${requestedHeight}cm`;
 document.querySelector('.labels').firstElementChild.textContent=`기본 팔 · ${leg}`;
 $('heightLabel').textContent=`팔 ${requestedElbow>0?'+':''}${requestedElbow}° · ${leg}`;
}
function updateElbow(value,immediate=!playing){
 requestedElbow=Math.max(-20,Math.min(20,Number.isFinite(value)?value:0));
 elbowTransition.set(requestedElbow,immediate);
 $('elbowBend').value=String(requestedElbow);
 $('elbowBendValue').textContent=requestedElbow===0?'0° · 기본':`${requestedElbow>0?'+':''}${requestedElbow}° · ${requestedElbow>0?'더 굽힘':'덜 굽힘'}`;
 updatePoseLabels();if(ready)draw();
}
if(elbowBendComparison){
 $('elbowBend').oninput=()=>updateElbow(+$('elbowBend').value);
 $('resetElbow').onclick=()=>updateElbow(0);
}
if(legHeightComparison){
 $('legHeight').oninput=()=>updateHeight(+$('legHeight').value);
 $('resetHeight').onclick=()=>updateHeight(0);
 $('speed').value='1';
}
if(bilateralComparison)$('poseBaseline').onchange=()=>ready&&draw();
new ResizeObserver(()=>{const r=$('view').getBoundingClientRect();camera.aspect=r.width/r.height;renderer.setSize(r.width,r.height);if(ready)draw();}).observe($('view'));
renderer.setAnimationLoop(now=>{
 const dt=Math.min((now-last)/1000,.1);last=now;
 if(ready&&playing){if(legHeightComparison)heightTransition.tick(dt);if(elbowBendComparison)elbowTransition.tick(dt);phase+=dt*+$('speed').value/data.seconds;if(phase>=1){if($('repeat').checked)phase%=1;else{phase=1;playing=false;$('play').textContent='처음부터 재생';if(legHeightComparison)heightTransition.set(requestedHeight,true);if(elbowBendComparison)elbowTransition.set(requestedElbow,true);}}draw();}
});
window.sharedGaitReview={get ready(){return ready;},get lanes(){return lanes;},get probe(){return probe;},get plan(){return plan;},get heightPlan(){return heightPlan;},get upperPlan(){return upperPlan;},get bilateralPlan(){return bilateralPlan;},get approachPlan(){return approachPlan;},get supportPlan(){return supportPlan;},get supportBilateralPlan(){return supportBilateralPlan;},get releasePlan(){return releasePlan;},get kneeLateralPlan(){return kneeLateralPlan;},get armSwingPlan(){return armSwingPlan;},get handPosePlan(){return handPosePlan;},get earlySupportPlan(){return earlySupportPlan;},get supportJoinPlan(){return supportJoinPlan;},get unifiedStancePlan(){return unifiedStancePlan;},get legHeightPlan(){return legHeightPlan;},get elbowBendPlan(){return elbowBendPlan;},get requestedElbow(){return requestedElbow;},get appliedElbow(){return elbowTransition.value;},get requestedHeight(){return requestedHeight;},get appliedHeight(){return heightTransition.value;},get poseSkin(){return poseSkin;},get data(){return data;},get phase(){return phase;},get diagnostic(){return diagnostic;},seek,view,renderer,scene,camera};
load().catch(fail);

