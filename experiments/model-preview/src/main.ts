import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import {createRunningPose} from './running-pose';
import {localLab,readSettings,modelBuffer,builtInModels,supportedHashes,type ModelType} from './settings';
import {startVisit,record} from './analytics';
import {createBodyDimensions,lengthFields,bodyRecipe} from './body-dimensions';

const settings=readSettings();
const adminPreview=localLab&&new URLSearchParams(location.search).get('admin-preview')==='1';
let selectedType:ModelType|'custom'='custom';
let modelHash='';
let selectionId=0;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = el('status');
const viewport = el('viewport');
const boneSelect = el<HTMLSelectElement>('bone');
const heightInput = el<HTMLInputElement>('body-height');
const lengthSelect=el<HTMLSelectElement>('body-part');
const lengthSlider=el<HTMLInputElement>('part-length');
const lengthNumber=el<HTMLInputElement>('part-number');
const availableLengths=lengthFields.filter(f=>settings.lengths[f.id]);
const poseSlider = el<HTMLInputElement>('pose-angle');
const poseNumber = el<HTMLInputElement>('pose-number');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f6f5f1');
const camera = new THREE.PerspectiveCamera(32, 1, .01, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8d9284, 2.5));
const keyLight = new THREE.DirectionalLight(0xfff2df, 3);
keyLight.position.set(3, 5, 5); scene.add(keyLight);
const fill = new THREE.DirectionalLight(0xffffff, 1.5);
fill.position.set(-3, 3, -4); scene.add(fill);
const floor = new THREE.GridHelper(6, 30, 0xd1d1c7, 0xe5e5dd);
scene.add(floor);
let model: THREE.Group | undefined;
let helper: THREE.SkeletonHelper | undefined;
let bones: THREE.Bone[] = [];
let runningPose: ReturnType<typeof createRunningPose>;
let bodyDimensions:ReturnType<typeof createBodyDimensions>;
let bodyScale=1;
let morphs: {mesh: THREE.Mesh; index: number; original: number; name: string}[] = [];
let loadId = 0;
let target = new THREE.Vector3(0, .9, 0);
let distance = 4;
let baseHeight = 0;
let baseFloor = 0;
const baseScale = new THREE.Vector3();
const basePosition = new THREE.Vector3();

function options(select: HTMLSelectElement, labels: string[]) {
  select.replaceChildren();
  labels.forEach((label, i) => {const o = document.createElement('option'); o.value=String(i);o.textContent=label; select.append(o);});
  select.disabled = !labels.length;
}
function dispose(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach(t => {t.dispose(); if (t.image instanceof ImageBitmap) t.image.close();});
}
function setView(view = 'front') {
  const vector = view === 'side' ? new THREE.Vector3(1, .08, 0) : view === 'back' ? new THREE.Vector3(0,.08,-1) : new THREE.Vector3(0,.08,1);
  camera.position.copy(target).addScaledVector(vector.normalize(),distance);
  controls.target.copy(target); controls.update();
}
function frame() {
  if (!model) return;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  box.getCenter(target);
  const halfFov = THREE.MathUtils.degToRad(camera.fov/2);
  distance = Math.max(size.y, size.x/camera.aspect, .1)/2/Math.tan(halfFov)*1.5;
  camera.near = Math.max(distance / 1000,.001); camera.far = distance*100;camera.updateProjectionMatrix();
  controls.minDistance = distance*.15;controls.maxDistance=distance*5;
  floor.position.y=box.min.y-.005;
  floor.scale.setScalar(Math.max(size.y, .1)/2);
  setView();
}
function showAngles() {
  const joint = runningPose?.definitions[Number(boneSelect.value)];
  for (const input of [poseSlider,poseNumber]) {
    input.disabled = !joint;
    if(joint && runningPose) {
      input.min=String(joint.min);input.max=String(joint.max);
      input.value=String(runningPose.values[joint.id]);
    }
  }
  el('pose-action').textContent=joint?joint.action:'자세 조절 없음';
  el('pose-range').textContent=joint?joint.range:runningPose?'관리자가 조절 항목을 숨겼습니다.':'관절 방향을 확인한 모델에서만 사용할 수 있습니다.';
  el('pose-reference').textContent=joint?joint.reference:runningPose?'기본 자세로 표시합니다.':'다른 GLB의 뼈 이름만으로 회전 방향을 추측하지 않습니다.';
}
function showHeight(value: number) {
  heightInput.value = value.toFixed(1);
  el('height-out').textContent = `${value.toFixed(1)} cm`;
}
function showLengths(){
  const field=availableLengths[Number(lengthSelect.value)];
  for(const input of [lengthSlider,lengthNumber]){
    input.disabled=!bodyDimensions||!field;
    if(bodyDimensions&&field){
      const base=bodyDimensions.baseline[field.id]*bodyScale;
      input.min=(base*.85).toFixed(1);input.max=(base*1.15).toFixed(1);
      input.value=(base*bodyDimensions.ratios[field.id]).toFixed(1);
    }
  }
  el('length-reference').textContent=field?field.reference:'';
  el('length-measured').textContent=bodyDimensions&&field?`현재 관절 길이 ${bodyDimensions.measure()[field.id].toFixed(1)} cm`:'이 모델의 부위 길이 조절은 확인 전입니다.';
}
function updateHeightRange(){
  heightInput.min=(baseHeight*100*.9).toFixed(1);heightInput.max=(baseHeight*100*1.1).toFixed(1);
  el('saved-height').textContent=`현재 비율의 기준 높이 ${(baseHeight*100).toFixed(1)} cm`;
}
function restoreShape(){
  if(!bodyDimensions)return;
  baseHeight=bodyDimensions.referenceHeight;basePosition.copy(bodyDimensions.anchorPosition);
  updateHeightRange();runningPose?.apply();showAngles();resizeBody(baseHeight*100*bodyScale);
}
function editLength(input:HTMLInputElement){
  const field=availableLengths[Number(lengthSelect.value)];
  if(!field||!bodyDimensions)return;
  const value=input.valueAsNumber,base=bodyDimensions.baseline[field.id]*bodyScale;
  if(!bodyDimensions.set(field.id,value,bodyScale)){el('length-feedback').textContent='숫자를 입력해 주세요.';showLengths();return;}
  el('length-feedback').textContent=value<base*.85||value>base*1.15?'기본 길이의 ±15% 범위로 조정했습니다.':'';
  restoreShape();
}
function resizeBody(heightCm: number) {
  if (!model || baseHeight <= 0 || !Number.isFinite(heightCm)) return;
  // Scale the complete hierarchy, keeping its saved foot level fixed.
  // Body proportions and their rebuilt bind skeleton keep the same global scale.
  const factor = heightCm / (baseHeight * 100);
  bodyScale=factor;
  model.scale.copy(baseScale).multiplyScalar(factor);
  model.position.copy(basePosition);
  model.position.y += (1 - factor) * (baseFloor - basePosition.y);
  model.updateMatrixWorld(true);
  showHeight(heightCm);
  showLengths();
}
async function load(buffer: ArrayBuffer, name: string) {
  const currentId = ++loadId;
  el<HTMLButtonElement>('apply-settings').disabled=true;
  el('apply-message').textContent='';
  document.body.dataset.loaded='loading';
  status.textContent='모델을 불러오는 중입니다.';
  try {
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    const digest = await crypto.subtle.digest('SHA-256',buffer);
    const hash = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if (currentId !== loadId) {dispose(gltf.scene);return;}
    if (model) {scene.remove(model);dispose(model);}
    if (helper) {scene.remove(helper);helper.dispose();}
    model=gltf.scene;scene.add(model);
    bones=[];morphs=[];let skinned=0;
    model.traverse(object=>{
      if ((object as THREE.Bone).isBone) bones.push(object as THREE.Bone);
      const mesh=object as THREE.Mesh;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {skinned++; mesh.frustumCulled=false;}
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [key,index] of Object.entries(mesh.morphTargetDictionary)) {
          morphs.push({mesh,index,original:mesh.morphTargetInfluences[index],name:key});
        }
      }
    });
    modelHash=hash;
    bodyScale=1;
    bodyDimensions=supportedHashes.has(hash)?createBodyDimensions(model,bones,settings.lengths):undefined;
    runningPose=supportedHashes.has(hash)?createRunningPose(model,bones,settings):undefined;
    options(lengthSelect,bodyDimensions?availableLengths.map(f=>f.label):[]);
    el('length-section').hidden=availableLengths.length===0;
    el<HTMLButtonElement>('reset-lengths').disabled=!bodyDimensions;
    el('length-feedback').textContent='';
    el('pose-feedback').textContent='';
    options(boneSelect,runningPose?runningPose.definitions.map(j=>j.label):[]);
    const bounds = new THREE.Box3().setFromObject(model, true);
    baseHeight = bounds.max.y - bounds.min.y;
    baseFloor = bounds.min.y;
    baseScale.copy(model.scale);
    basePosition.copy(model.position);
    const heightAvailable = Number.isFinite(baseHeight) && baseHeight > 0;
    heightInput.disabled = !heightAvailable||!settings.heightEnabled;
    if (heightAvailable) {
      // This is a limited scale test, not a validated anatomical input range.
      heightInput.min = (baseHeight * 100 * .9).toFixed(1);
      heightInput.max = (baseHeight * 100 * 1.1).toFixed(1);
      showHeight(baseHeight * 100);
      el('saved-height').textContent = `저장된 모델 높이 ${ (baseHeight * 100).toFixed(1) } cm`;
    } else {
      el('height-out').textContent = '—';
      el('saved-height').textContent = '이 모델의 높이를 측정할 수 없습니다.';
    }
    helper=new THREE.SkeletonHelper(model);
    const helperMaterial = helper.material as THREE.LineBasicMaterial;
    helperMaterial.depthTest=false;helperMaterial.transparent=true;helperMaterial.opacity=.8;
    helper.renderOrder=10;helper.visible=el<HTMLInputElement>('skeleton').checked;scene.add(helper);
    el('filename').textContent=name;
    el('bones-count').textContent=String(bones.length);el('clips-count').textContent=String(gltf.animations.length);
    el<HTMLButtonElement>('reset-pose').disabled=!runningPose;el<HTMLButtonElement>('reset-height').disabled=!heightAvailable||!settings.heightEnabled;
    showAngles();frame();
    runningPose?.reset();
    showLengths();
    el<HTMLButtonElement>('apply-settings').disabled=!runningPose;
    status.textContent=runningPose?'부위별 길이와 러닝 자세를 조절할 수 있습니다.':skinned?'모델을 불러왔습니다. 이 파일의 러닝 관절 설정은 아직 확인 전입니다.':'외형을 불러왔습니다. 몸체에 연결된 뼈대는 없습니다.';
    document.body.dataset.loaded='true';
    // Read-only inspection hook for the local verification script.
    Object.assign(window,{modelPreview:{model,bones,morphs,renderer,scene,camera,runningPose,bodyDimensions}});
    return {ok:true,hash,bones:bones.length,poseAvailable:!!runningPose};
  } catch (error) {
    if(currentId!==loadId)return;
    status.textContent=`모델을 불러오지 못했습니다. 단일 GLB 파일을 선택해 주세요. ${error instanceof Error ? error.message : ''}`;
    document.body.dataset.loaded='error';
    return {ok:false,error:error instanceof Error?error.message:String(error)};
  }
}
boneSelect.addEventListener('change',()=>{el('pose-feedback').textContent='';showAngles();});
function editPose(input: HTMLInputElement) {
  const joint=runningPose?.definitions[Number(boneSelect.value)];
  if(!joint || !runningPose)return;
  const value=input.valueAsNumber;
  const accepted=runningPose.set(joint.id,value);
  el('pose-feedback').textContent=!accepted?'숫자를 입력해 주세요.':value<joint.min||value>joint.max?`${joint.min}° ~ ${joint.max}° 범위로 조정했습니다.`:'';
  showAngles();
}
poseSlider.addEventListener('input',()=>editPose(poseSlider));
poseNumber.addEventListener('change',()=>editPose(poseNumber));
el('reset-pose').addEventListener('click',()=>{runningPose?.reset();el('pose-feedback').textContent='';showAngles();});
heightInput.addEventListener('input',()=>resizeBody(Number(heightInput.value)));
lengthSelect.addEventListener('change',()=>{el('length-feedback').textContent='';showLengths();});
lengthSlider.addEventListener('input',()=>editLength(lengthSlider));
lengthNumber.addEventListener('change',()=>editLength(lengthNumber));
el('reset-lengths').addEventListener('click',()=>{bodyDimensions?.reset();restoreShape();el('length-feedback').textContent='';});
el('reset-height').addEventListener('click',()=>resizeBody(baseHeight * 100));
el('skeleton').addEventListener('change',()=>{if(helper)helper.visible=el<HTMLInputElement>('skeleton').checked;});
el('fit').addEventListener('click',frame);
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
el<HTMLInputElement>('file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(file){selectionId++;selectedType='custom';await load(await file.arrayBuffer(),file.name);input.value='';}});
new ResizeObserver(()=>{const {width,height}=viewport.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);}).observe(viewport);
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
async function selectModel(type:ModelType){
  const id=++selectionId;loadId++;
  document.body.dataset.loaded='loading';el<HTMLButtonElement>('apply-settings').disabled=true;
  status.textContent=`${builtInModels[type].label} 모델을 불러오는 중입니다.`;
  try{
    const item=await modelBuffer(type,settings);if(id!==selectionId)return;
    const result=await load(item.buffer,item.name);if(!result?.ok||id!==selectionId)return;
    selectedType=type;
    document.querySelectorAll<HTMLButtonElement>('[data-model-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.modelType===type)));
  }catch(error){if(id!==selectionId)return;document.body.dataset.loaded='error';status.textContent=String(error);}
}
document.querySelectorAll<HTMLButtonElement>('[data-model-type]').forEach(button=>{
  const type=button.dataset.modelType as ModelType;button.disabled=!settings.models[type].enabled;
  button.onclick=()=>selectModel(type);
});
el('file-label').hidden=!adminPreview;
el('admin-link').hidden=!localLab||adminPreview;
el('apply-section').hidden=adminPreview;
el('model-stats').hidden=!adminPreview;
el('height-section').hidden=!settings.heightEnabled;
el('usage-note').textContent=localLab?'로컬 시험: 적용한 모델·높이·부위 길이·자세를 이 브라우저에 기록합니다.':'';
el('apply-settings').onclick=()=>{
  if(!runningPose||document.body.dataset.loaded!=='true')return;
  try{
    record({kind:'configuration_applied',revision:settings.revision,model:selectedType==='custom'?'별도 모델':builtInModels[selectedType].label,hash:modelHash,heightCm:Number(heightInput.value),pose:{...runningPose.values},bodyRecipe,lengthsCm:bodyDimensions?.measure()});
    el('apply-message').textContent=localLab?'이 설정을 적용했습니다. 로컬 사용 통계에 반영되었습니다.':'이 설정을 적용했습니다.';
  }catch{el('apply-message').textContent='설정은 유지했습니다. 브라우저 저장 공간 문제로 통계를 기록하지 못했습니다.';}
};
if(adminPreview){
  status.textContent='관리자 화면에서 테스트할 모델을 선택하세요.';
  addEventListener('message',async event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='admin-load'||!(event.data.buffer instanceof ArrayBuffer))return;
    selectedType='custom';selectionId++;
    const result=await load(event.data.buffer,String(event.data.name));
    parent.postMessage({type:'preview-result',id:event.data.id,...result},location.origin);
  });
  parent.postMessage({type:'preview-ready'},location.origin);
}else{
  try{startVisit(settings.revision);}catch{el('usage-note').textContent='브라우저 저장 공간을 사용할 수 없어 통계 수집이 꺼졌습니다.';}
  selectModel(settings.models.male.enabled?'male':'female');
}
