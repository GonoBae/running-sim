import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {builtInModels,localLab} from './settings';
import {createRunningPose} from './running-pose';
import {createReferenceLegMotion,referenceLegData,sampleReferenceLeg} from './reference-leg-motion';
import './reference-leg.css';

export async function mountReferenceLeg(){
  document.title='실측 왼다리 비교 · running sim';
  if(!localLab){document.body.innerHTML='<main><h1>로컬 비교 실험</h1><p>이 비교 화면은 로컬 개발 환경에서 확인할 수 있습니다.</p><a href="/">설정 화면으로</a></main>';return;}
  document.body.innerHTML=`<header><a href="/">running sim</a><span>실측 왼다리 비교</span><a class="back" href="/">설정 화면 ↗</a></header>
  <main class="comparison">
    <section class="reference-panel" aria-labelledby="reference-title"><p class="eyebrow">REFERENCE · LEFT LEG</p><h1 id="reference-title">한 주기를 맞춰 보기.</h1><p class="intro">자료의 각도와 모델의 움직임을 함께 확인합니다.</p>
      <div class="source-note"><strong>AB01 · 왼발 35주기 평균</strong><span>평지 달리기 · 한 주기 0.78초</span></div>
      <svg id="reference-diagram" viewBox="0 0 340 240" role="img" aria-label="목표 허벅지와 무릎 방향 도식"><line x1="170" y1="30" x2="170" y2="215" stroke="#d9dfd7" stroke-dasharray="4 6"/><path id="reference-limb" fill="none" stroke="#287d69" stroke-width="7" stroke-linecap="round"/><circle id="reference-hip" cx="170" cy="35" r="6" fill="#287d69"/><circle id="reference-knee" r="6" fill="#287d69"/><circle id="reference-ankle" r="5" fill="#287d69"/></svg>
      <p class="caption">관절 방향 도식 · 실제 촬영 영상이 아닙니다.</p>
      <div class="readings"><div><span>허벅지 앞뒤</span><strong id="thigh-target">—</strong><small>모델 <output id="thigh-measured">—</output></small></div><div><span>무릎 굽힘</span><strong id="knee-target">—</strong><small>모델 <output id="knee-measured">—</output></small></div></div>
      <svg id="angle-chart" viewBox="0 0 340 130" role="img" aria-label="왼다리 한 주기의 목표 각도 곡선"><path d="M12 8V112H328" fill="none" stroke="#d5ddd3"/><path id="thigh-curve" fill="none" stroke="#287d69" stroke-width="2"/><path id="knee-curve" fill="none" stroke="#c76a41" stroke-width="2"/><line id="phase-cursor" y1="8" y2="112" stroke="#36483b" stroke-dasharray="3 4"/></svg>
      <p class="legend"><span>● 허벅지</span><span>● 무릎</span><span>0 → 100%</span></p>
      <label class="phase-label" for="reference-phase">진행률 <output id="phase-output">0%</output></label><input id="reference-phase" type="range" min="0" max="100" step="0.1" value="0" disabled>
      <div class="actions"><button id="reference-play" disabled>재생</button><button id="reference-stop" disabled>정지·복원</button></div>
      <p id="reference-status" role="status" aria-live="polite">모델을 불러오는 중입니다.</p>
      <a class="source-link" href="${referenceLegData.source}" target="_blank" rel="noopener">사용한 공개 자료 ↗</a>
    </section>
    <section class="model-panel" aria-labelledby="model-title"><div class="model-heading"><p class="eyebrow">MODEL · FIXED BODY</p><h2 id="model-title">모델에 적용한 왼다리</h2><p>허벅지·무릎만 재생합니다. 발목·접지·전신 동작은 확인 전입니다.</p></div><div id="reference-viewport" aria-label="3D 왼다리 비교"></div><nav class="reference-views" aria-label="비교 시점"><button data-reference-view="side">측면</button><button data-reference-view="front">정면</button></nav><p class="model-caption">기본 남성형 모델 · 표본의 체형을 복제한 모델이 아닙니다.<br>드래그로 회전 · 휠로 확대</p></section>
  </main>`;
  const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
  const play=el<HTMLButtonElement>('reference-play'),stop=el<HTMLButtonElement>('reference-stop'),slider=el<HTMLInputElement>('reference-phase'),status=el('reference-status');
  const svgEl=(id:string)=>document.getElementById(id)!;
  const setPoint=(id:string,x:number,y:number)=>{svgEl(id).setAttribute('cx',String(x));svgEl(id).setAttribute('cy',String(y));};
  for(const [id,key] of [['thigh-curve','thigh'],['knee-curve','knee']] as const){
    const points=Array.from({length:150},(_,i)=>{const f=sampleReferenceLeg(i/149);return `${i?'L':'M'}${12+i/149*316},${96-f[key]}`;});
    svgEl(id).setAttribute('d',points.join(' '));
  }
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f6f5f1');
  const camera=new THREE.PerspectiveCamera(32,1,.01,100);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const viewport=el('reference-viewport');viewport.append(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  scene.add(new THREE.HemisphereLight(0xffffff,0x8d9284,2.5));
  const light=new THREE.DirectionalLight(0xfff2df,3);light.position.set(3,5,5);scene.add(light);
  const fill=new THREE.DirectionalLight(0xffffff,1.5);fill.position.set(-3,3,-4);scene.add(fill);
  let motion:ReturnType<typeof createReferenceLegMotion>|undefined;
  let target=new THREE.Vector3(0,.9,0),distance=4;
  function setView(view:string){
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
    camera.position.copy(target).add(new THREE.Vector3(...(view==='front'?[0,.05,1]:[1,.05,0]) as [number,number,number]).normalize().multiplyScalar(distance));
    controls.target.copy(target);controls.update();
  }
  const resize=()=>{const {width,height}=viewport.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);};
  new ResizeObserver(resize).observe(viewport);
  function refresh(notice?:string){
    const f=motion?.frame,measured=motion?.measure(),phase=f?.phase??0;
    document.body.dataset.referenceState=motion?.state??'loading';
    play.textContent=motion?.state==='playing'?'일시정지':motion?.state==='paused'?'이어 재생':'재생';stop.disabled=!f;
    slider.value=String(phase*100);el('phase-output').textContent=`${(phase*100).toFixed(1)}%`;
    const targetFrame=f??sampleReferenceLeg(0),a=THREE.MathUtils.degToRad(targetFrame.thigh),b=THREE.MathUtils.degToRad(targetFrame.thigh-targetFrame.knee);
    const knee={x:170-Math.sin(a)*80,y:35+Math.cos(a)*80},ankle={x:knee.x-Math.sin(b)*80,y:knee.y+Math.cos(b)*80};
    svgEl('reference-limb').setAttribute('d',`M170 35L${knee.x} ${knee.y}L${ankle.x} ${ankle.y}`);setPoint('reference-knee',knee.x,knee.y);setPoint('reference-ankle',ankle.x,ankle.y);
    svgEl('reference-diagram').setAttribute('opacity',f?'1':'.3');svgEl('phase-cursor').setAttribute('x1',String(12+phase*316));svgEl('phase-cursor').setAttribute('x2',String(12+phase*316));
    for(const key of ['thigh','knee'] as const){el(key+'-target').textContent=f?`${f[key].toFixed(1)}°`:'—';el(key+'-measured').textContent=f&&measured?`${measured[key].toFixed(1)}°`:'—';}
    if(notice!==undefined)status.textContent=notice;
  }
  const fail=(error:unknown)=>{motion?.stop();refresh('재생을 적용하지 못해 기준 자세로 복원했습니다.');console.error(error);};
  play.onclick=()=>{if(!motion)return;try{if(motion.state==='playing'){motion.pause(performance.now());refresh('일시정지 · 진행률을 움직여 자세를 확인하세요.');}else{motion.start(performance.now());refresh('왼쪽 허벅지와 무릎을 재생하고 있습니다.');}}catch(e){fail(e);}};
  stop.onclick=()=>{motion?.stop();refresh('정지 · 재생 전 기준 자세로 돌아왔습니다.');};
  slider.oninput=()=>{if(!motion)return;try{motion.seek(Number(slider.value)/100);refresh('선택한 순간 · 이어 재생할 수 있습니다.');}catch(e){fail(e);}};
  document.querySelectorAll<HTMLButtonElement>('[data-reference-view]').forEach(b=>b.onclick=()=>setView(b.dataset.referenceView!));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&motion?.state==='playing'){motion.pause(performance.now());refresh('화면이 숨겨져 일시정지했습니다.');}});
  addEventListener('pagehide',()=>{motion?.stop();});
  refresh();resize();
  try{
    const response=await fetch(builtInModels.male.url);if(!response.ok)throw Error('기본 남성형 GLB를 찾을 수 없습니다.');
    const buffer=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==builtInModels.male.hash)throw Error('확인된 기본 모델과 파일이 다릅니다.');
    const gltf=await new GLTFLoader().parseAsync(buffer,''),model=gltf.scene,bones:THREE.Bone[]=[];
    model.traverse(n=>{if(n instanceof THREE.Bone)bones.push(n);});
    const pose=createRunningPose(model,bones);if(!pose)throw Error('필요한 관절을 찾을 수 없습니다.');pose.reset();
    motion=createReferenceLegMotion(model,bones);scene.add(model);
    const bounds=new THREE.Box3().setFromObject(model,true);bounds.getCenter(target);distance=bounds.getSize(new THREE.Vector3()).y*2.1;
    setView('side');play.disabled=false;slider.disabled=false;document.body.dataset.referenceLoaded='true';
    refresh('재생하거나 진행률을 움직여 왼다리를 확인하세요.');
    Object.assign(window,{referenceLegPreview:{model,bones,pose,motion,camera,renderer}});
  }catch(error){document.body.dataset.referenceLoaded='error';status.textContent=`모델을 불러오지 못했습니다. ${error instanceof Error?error.message:''}`;play.disabled=true;slider.disabled=true;stop.disabled=true;}
  renderer.setAnimationLoop(now=>{try{if(motion?.state==='playing'){motion.tick(now);refresh();}}catch(e){fail(e);}controls.update();renderer.render(scene,camera);});
}
