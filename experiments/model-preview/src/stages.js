import {FOOT_STRIKES,createFootStrikeTransition} from './foot-strike.js';
import {createLeanTransition} from './upper-lean.js';
import * as T from 'three';
import {lengthFields} from './body-dimensions';
import {createBodyModel,applyBodySettings,cloneBodySource,bodyKey} from './body-runtime.js';
import {createBodyRunning} from './body-running.js';
import {createBodyEditor} from './body-editor';
import {createPoseEditor,poseDragSettings} from './pose-editor';
import {stages,route,stateKey,normalizeState,hasCustomBody} from './stage-state';
import {createCourseEditor} from './course-editor';
import {createCoursePlayback,cycleDuration} from './course-playback';
import {createCourseRunView} from './course-run-view.js';
import {loadModel,createRunningRuntime} from './running-runtime.js';
import {createHeightTransition,LEG_HEIGHT} from '../review/leg-height.js';
import {createElbowTransition} from '../review/elbow-bend.js';
import './stages.css';
import './body-editor.css';
import './pose-editor.css';

const $=id=>document.getElementById(id),names=['신체 세팅','자세 세팅','코스 세팅','백테스팅'];
let state=normalizeState(null),invalidCourseDraft=false;
try{const saved=JSON.parse(sessionStorage.getItem(stateKey)||'null');state=normalizeState(saved);invalidCourseDraft=!!saved?.course&&!state.course;}catch{/* A corrupt/blocked draft must not prevent opening the page. */}
let step=route(location.pathname),active=null,phase=0,playing=false,side=false,busy=false,error='',loadToken=0,last=performance.now(),diagnostic=null;
const cache=new Map(),height=createHeightTransition(),elbow=createElbowTransition(),lean=createLeanTransition(),strikeBlend=createFootStrikeTransition();
const save=()=>{try{sessionStorage.setItem(stateKey,JSON.stringify(state));$('draft').textContent='이 탭에 임시 보관';}catch{$('draft').textContent='이 브라우저에서 임시 보관 불가';}};
const canRun=()=>!!active?.runtime&&!busy&&!error;
const usesRunning=()=>step==='pose'||step==='course'||step==='backtest';
const isPreview=()=>step==='body'||usesRunning();
let coursePlayback=null,runKey='';
document.querySelector('#app').innerHTML=`
 <header><a class="brand" href="/body" data-step="body">running sim<span style="color:#8da279">.</span></a><span class="tag">BUILD YOUR RUN</span></header>
 <nav class="steps" aria-label="설정 단계">${stages.map((s,i)=>`<a href="/${s}" data-step="${s}"><b>0${i+1}</b><span>${names[i]}</span></a>`).join('')}</nav>
 <main><div class="heading"><p class="eyebrow" id="eyebrow"></p><h1 id="title" tabindex="-1"></h1><p class="lead" id="lead"></p></div>
 <div class="workspace" id="workspace"><section class="preview" aria-label="러너 미리보기"><div class="body-toolbar" id="body-toolbar"><label for="model" class="sr-only">모델</label><select id="model"><option value="male">남성형</option><option value="female">여성형</option></select><button id="reset-body" class="reset">기본 신체로</button></div><div class="view-tools"><button id="front" aria-pressed="true">정면</button><button id="side" aria-pressed="false">측면</button></div><label class="strike-tools" id="strike-tools" for="strike">착지 방식<select id="strike"><option value="original">기본 동작</option><option value="heel">뒤꿈치</option><option value="midfoot">미드풋</option><option value="forefoot">앞꿈치</option></select></label><span class="view-label" id="view-label">YOUR RUNNER</span><div id="viewport"></div><div class="load-status" id="loading" role="status"><span id="load-message"></span><button id="retry" hidden>다시 불러오기</button></div><div class="playback" id="playback"><button id="play">재생</button><input id="phase" aria-label="달리기 재생 위치" type="range" min="0" max="1" step=".001" value="0"><small id="time">0%</small></div></section>
 <details class="panel body-precision" id="body-panel"><summary>숫자로 미세 조절</summary>
 <div class="field"><label for="scale">전체 크기 <output id="scale-value"></output></label><input id="scale" type="range" min="90" max="110" step="1"><small>신체 비율을 유지하는 전체 배율</small></div>
 <div class="field"><label for="part">부위 길이</label><select id="part">${lengthFields.map(f=>`<option value="${f.id}">${f.label}</option>`).join('')}</select><label for="length" style="margin-top:15px"><small id="length-reference"></small><output id="length-value"></output></label><input id="length" type="range" step=".1"><small>양쪽에 함께 적용 · 기본 길이의 ±15%</small></div>
 <small>신체에서 바꾼 값은 다음 단계의 달리기에도 반영됩니다.</small></details>
 <aside class="panel" id="pose-panel"><h2>달리기 자세</h2><div class="field"><label for="leg">다리 들림 <output id="leg-value"></output></label><input id="leg" type="range" min="0" max="10" step="1"><small>기본보다 무릎을 더 높이 드는 높이 · 양발 적용</small><button id="reset-leg" class="reset">다리 기본값</button></div>
 <div class="field"><label for="elbow">팔꿈치 굽힘 <output id="elbow-value"></output></label><input id="elbow" type="range" min="-20" max="20" step="1"><small>기본 굽힘에 더하거나 빼는 각도 · 양팔 적용</small><p id="actual" class="actual"></p><button id="reset-elbow" class="reset">팔 기본값</button></div>
 <div class="field"><label for="lean">상체 기울기 <output id="lean-value"></output></label><input id="lean" type="range" min="-10" max="15" step="1"><small>기본 대비 추가 각도 · + 앞으로 / − 뒤로</small><button id="reset-lean" class="reset">상체 기본값</button></div>
 <div id="body-applied" class="notice"></div><div class="notice" id="pose-note">현재 기본 달리기에 설정값을 반영합니다. 실제 기록이나 신체 부담을 예측하지 않습니다.</div></aside></div>
 <section id="pending" class="empty" hidden><span class="badge">준비 중</span><div class="number" id="pending-number"></div><h2 id="pending-title"></h2><p id="pending-description"></p><div class="summary" id="summary"></div><small>설정 흐름만 연결되어 있습니다.</small></section>
 <footer class="pager"><button id="previous">이전</button><small id="draft">이 탭에 임시 보관</small><button id="next" class="primary">다음</button></footer></main>`;
$('workspace').insertAdjacentHTML('afterbegin','<section id="course-panel" hidden aria-label="코스 설정"></section>');
$('workspace').insertAdjacentHTML('afterbegin','<section id="run-panel" hidden aria-label="실제 코스 주행"></section>');
$('workspace').insertAdjacentHTML('beforeend','<aside id="runner-summary" hidden aria-label="이어받은 러너 설정"></aside>');
$('summary').insertAdjacentHTML('afterend','<p id="backtest-course" class="course-backtest-summary"></p>');

const scene=new T.Scene();scene.background=new T.Color('#eff2ec');
scene.add(new T.HemisphereLight(0xffffff,0x7a8477,2.5));
const light=new T.DirectionalLight(0xfff5e8,3);light.position.set(2,4,5);scene.add(light);
const grid=new T.GridHelper(12,60,0xc5cfc4,0xe0e5dd);grid.position.y=-.005;scene.add(grid);
const camera=new T.OrthographicCamera(-1,1,1,-1,.01,50);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('viewport').append(renderer.domElement);
const bodyEditor=createBodyEditor({viewport:$('viewport'),canvas:renderer.domElement,camera,
 getContext:()=>step==='body'&&active&&!busy&&!error?{model:active.body,bounds:active.bodyBounds,baseline:active.dimensions.baseline,state}:undefined,
 change:(id,value)=>{if(id==='scale')state.scale=value;else state.ratios[id]=value;applyBody();inputs();draw();save();},
 select:id=>{$('part').value=id;inputs();},redraw:()=>draw()});
const poseEditor=createPoseEditor({viewport:$('viewport'),canvas:renderer.domElement,camera,
 getContext:()=>step==='pose'&&canRun()?{model:active.runtime.lane.model,playing,phase,leg:state.leg,elbow:state.elbow,lean:state.lean}:undefined,
 begin:part=>{playing=false;height.set(state.leg,true);elbow.set(state.elbow,true);lean.set(state.lean,true);strikeBlend.set(state.strike,true);if(part.id==='leg')phase=(LEG_HEIGHT.peak+(part.side==='l'?.5:0))%1;inputs();draw();},
 change:updatePose,restore:(id,value,savedPhase)=>{playing=false;phase=savedPhase;updatePose(id,value);},redraw:()=>draw()});
for(const id of ['leg','elbow','lean']){const spec=poseDragSettings[id];Object.assign($(id),{min:String(spec.min),max:String(spec.max),step:String(spec.step)});}
const courseEditor=createCourseEditor({root:$('course-panel'),getDraft:()=>state.course,
 initialIssue:invalidCourseDraft?'저장된 코스 설정이 올바르지 않습니다. 출발점을 다시 선택해주세요.':'',
 change:course=>{state.course=course;save();renderRunnerSummary();},validity:()=>syncCourseStatus()});
const runView=createCourseRunView($('run-panel'),{
 play:()=>{if(!coursePlayback||!canRun())return;coursePlayback.frame().playing?coursePlayback.pause():coursePlayback.play();last=performance.now();draw();},
 reset:()=>{coursePlayback?.reset();draw();},seek:fraction=>{if(coursePlayback){coursePlayback.seek(fraction*coursePlayback.frame().duration);draw();}},
 rate:value=>{coursePlayback?.setRate(value);draw();}});
function setupRun(){
 if(step!=='backtest'||!courseEditor.valid||!canRun())return;
 const key=JSON.stringify(state);if(key===runKey&&coursePlayback)return;
 const frames=active.reference.models[state.model].frames,scale=active.runtime.travelScale||1;
 const origin=new T.Vector3(...frames[0].pelvis).multiplyScalar(scale);
 const travel=new T.Vector3(...frames.at(-1).pelvis).multiplyScalar(scale).sub(origin);
 coursePlayback=createCoursePlayback(courseEditor.course,state.course,{seconds:active.runtime.seconds,distanceM:travel.z});runKey=key;
 runView.bind(active.runtime.lane.model,courseEditor.course,state.course,origin,travel);runView.ready(true);
}
function runnerLabels(){return [state.model==='male'?'남성형':'여성형',`전체 ${Math.round(state.scale*100)}%`,hasCustomBody(state)?'신체 비율 변경':'기본 신체',`다리 +${state.leg} cm`,`팔 ${state.elbow>0?'+':''}${state.elbow}°`,`상체 ${state.lean>0?'+':''}${state.lean}°`,FOOT_STRIKES[state.strike].label+' 착지'];}
function renderRunnerSummary(){
 const rows=[['신체',`${state.model==='male'?'남성형':'여성형'} · 전체 ${Math.round(state.scale*100)}%`],...lengthFields.map(f=>[f.label,`${Math.round(state.ratios[f.id]*100)}%`]),['다리 들림',`+${state.leg} cm`],['팔꿈치 / 상체',`${state.elbow>0?'+':''}${state.elbow}° / ${state.lean>0?'+':''}${state.lean}°`],['착지',FOOT_STRIKES[state.strike].label]];
 $('runner-summary').innerHTML='<h2>이어받은 러너</h2><dl>'+rows.map(([label,value])=>`<dt>${label}</dt><dd>${value}</dd>`).join('')+'</dl><a href="/pose" id="edit-runner">자세 세팅으로 돌아가기 →</a>';
 $('edit-runner').onclick=e=>{e.preventDefault();navigate('pose');};
 $('summary').innerHTML=runnerLabels().map(s=>`<span>${s}</span>`).join('');
}
function syncCourseStatus(){
 $('next').disabled=step==='course'&&!courseEditor.valid;
 document.querySelector('nav [data-step=backtest]').setAttribute('aria-disabled',String(!courseEditor.valid));
 $('backtest-course').textContent=courseEditor.summary();
}

function inputs(){
 $('model').value=state.model;$('scale').value=String(Math.round(state.scale*100));$('scale-value').textContent=Math.round(state.scale*100)+'%';
 const field=lengthFields.find(f=>f.id===$('part').value);$('length-reference').textContent=field.reference;
 if(active){const base=active.dimensions.baseline[field.id]*state.scale;$('length').min=(Math.ceil(base*.85*10)/10).toFixed(1);$('length').max=(Math.floor(base*1.15*10)/10).toFixed(1);$('length').value=(base*state.ratios[field.id]).toFixed(1);$('length-value').textContent=(base*state.ratios[field.id]).toFixed(1)+' cm';}
 $('strike').value=state.strike;
 $('leg').value=String(state.leg);$('leg-value').textContent=(state.leg?'+':'')+state.leg+' cm';
 $('lean').value=String(state.lean);$('lean-value').textContent=(state.lean>0?'+':'')+state.lean+'°';
 $('elbow').value=String(state.elbow);$('elbow-value').textContent=(state.elbow>0?'+':'')+state.elbow+'°';
 for(const id of ['scale','part','length','reset-body'])$(id).disabled=!active||busy||!!error;
 for(const id of ['play','phase','strike','leg','elbow','lean','reset-leg','reset-elbow','reset-lean'])$(id).disabled=!canRun();
 $('body-applied').textContent=`${state.model==='male'?'남성형':'여성형'} · 전체 크기 ${Math.round(state.scale*100)}% · ${hasCustomBody(state)?'변경한 신체 반영':'기본 신체'}`;
 $('actual').textContent=canRun()&&diagnostic?diagnostic.elbowBend.map(a=>`${a.side==='r'?'오른팔':'왼팔'} ${a.actualDeg.toFixed(1)}°`).join(' · '):'';
 $('play').textContent=playing?'일시정지':'재생';
 $('loading').hidden=!busy&&!error;$('load-message').textContent=error||(active?'달리기 동작을 준비하는 중…':'러너를 불러오는 중…');$('retry').hidden=!error;
 if(busy||error||step!=='body')bodyEditor.refresh();
 if(busy||error||step!=='pose')poseEditor.refresh();
}
function applyBody(){
 if(!active)return;
 active.bodyBounds=applyBodySettings(active.bodyData,state);
}
function display(){
 for(const value of cache.values()){value.body.visible=false;if(value.baseRuntime)value.baseRuntime.lane.group.visible=false;if(value.runtime)value.runtime.lane.group.visible=false;}
 if(active&&isPreview()){
  const running=usesRunning()&&canRun();active.body.visible=!running;
  if(active.runtime)active.runtime.lane.group.visible=running;
 }
}
function draw(){
 if(!isPreview()||!active)return;
 if(step==='backtest'&&coursePlayback)phase=coursePlayback.frame().phase;
 const running=usesRunning()&&canRun(),model=running?active.runtime.lane.model:active.body;
 if(running)diagnostic=active.runtime.apply(phase,height.value,elbow.value,lean.value,strikeBlend.value,strikeBlend.pitchDeg);
 const center=running?model.getObjectByName('pelvis').getWorldPosition(new T.Vector3()):active.bodyFrame.getCenter(new T.Vector3());
 if(!running)center.y=active.bodyFrame.min.y+active.bodyFrame.getSize(new T.Vector3()).y*.62;
 if(running)center.y=Math.max(.98,active.bodyBounds.getSize(new T.Vector3()).y*.5);
 const rect=$('viewport').getBoundingClientRect();if(!rect.width||!rect.height)return;
 // Keep a neutral-body frame during editing so resizing remains visible after release.
 const aspect=rect.width/rect.height,half=running?Math.max(1.08,.78/aspect,active.bodyBounds.getSize(new T.Vector3()).y*.56):Math.max(1.08,.78/aspect,active.bodyFrame.getSize(new T.Vector3()).y*.66);
 if(!bodyEditor.dragging&&!poseEditor.dragging){Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});camera.position.copy(center).add(new T.Vector3(side?10:0,0,side?0:10));camera.lookAt(center);camera.updateProjectionMatrix();}
 renderer.setSize(rect.width,rect.height,false);renderer.render(scene,camera);
 if(step==='backtest'&&coursePlayback&&running)runView.render(coursePlayback.frame());
 bodyEditor.refresh();
 poseEditor.refresh();
 $('phase').value=String(phase);$('time').textContent=Math.round(phase*100)+'%';
 if(running)$('actual').textContent=diagnostic.elbowBend.map(a=>`${a.side==='r'?'오른팔':'왼팔'} ${a.actualDeg.toFixed(1)}°`).join(' · ');
}
async function prepare(){
 bodyEditor.cancel();poseEditor.cancel();
 const token=++loadToken,type=state.model;busy=true;error='';playing=false;inputs();display();
 try{
  let value=cache.get(type);
  if(!value){
   const loaded=await loadModel(type);if(token!==loadToken)return;
   const bodyData=createBodyModel(loaded.model),body=bodyData.model;
   value={...loaded,body,bodyData,bodyFrame:new T.Box3().setFromObject(body,true),dimensions:bodyData.dimensions,runtime:null,baseRuntime:null,runtimeKey:null};cache.set(type,value);scene.add(body);
  }
  if(token!==loadToken)return;active=value;applyBody();inputs();display();draw();
  if(usesRunning()){
   const key=bodyKey(state);
   if(!value.baseRuntime||value.runtimeKey!==key){
    // Paint the new body before preparation; keep immutable assets for retries.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(token!==loadToken)return;
    if(!value.baseRuntime){value.baseRuntime=createRunningRuntime(cloneBodySource(value.model),value.reference,type);scene.add(value.baseRuntime.lane.group);}
    const next=hasCustomBody(state)?createBodyRunning(value.model,value.baseRuntime,state):value.baseRuntime;
    if(value.runtime&&value.runtime!==value.baseRuntime)value.runtime.dispose();
    value.runtime=next;value.runtimeKey=key;scene.add(next.lane.group);
   }
  }
  if(token!==loadToken)return;busy=false;phase=0;height.set(state.leg,true);elbow.set(state.elbow,true);lean.set(state.lean,true);strikeBlend.set(state.strike,true);
  playing=step!=='backtest'&&usesRunning()&&canRun()&&!matchMedia('(prefers-reduced-motion: reduce)').matches;last=performance.now();setupRun();
  display();inputs();draw();
 }catch(e){if(token!==loadToken)return;busy=false;error=e.message;if(step==='backtest')runView.ready(false,'러너 자료를 불러오지 못했습니다. 오른쪽에서 다시 불러오기를 눌러주세요.');inputs();display();draw();}
}
function renderPage(focus=false){
 const index=stages.indexOf(step);document.title='running sim · '+names[index];document.body.dataset.step=step;
 document.querySelectorAll('nav [data-step]').forEach(a=>{if(a.dataset.step===step)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});
 $('eyebrow').textContent=`STEP 0${index+1} / 04`;$('title').textContent=names[index];
 $('lead').textContent=['몸 위의 부위를 잡아 길이를 조절하세요. 양쪽에 함께 반영됩니다.','몸통·다리·아래팔을 잡아 위아래로 조절한 뒤 재생해 보세요.','달릴 경로를 정하는 단계입니다.','선택한 출발점·방향·목표 거리로 코스를 달립니다. 기록 계산은 준비 중입니다.'][index];
 if(step==='backtest'){$('title').textContent='코스 주행';coursePlayback=null;runKey='';runView.ready(false);}
 $('workspace').hidden=!isPreview();$('pending').hidden=isPreview();$('body-panel').hidden=step!=='body';$('pose-panel').hidden=step!=='pose';$('playback').hidden=!usesRunning();
 $('course-panel').hidden=step!=='course';$('runner-summary').hidden=step!=='course'&&step!=='backtest';$('run-panel').hidden=step!=='backtest';
 if(step==='backtest')$('playback').hidden=true;
 $('body-toolbar').hidden=step!=='body';$('strike-tools').hidden=step!=='pose';$('view-label').hidden=step==='pose';
 renderer.domElement.tabIndex=isPreview()?0:-1;renderer.domElement.setAttribute('aria-label',step==='body'?'신체 부위를 잡아 길이 조절':step==='course'||step==='backtest'?'현재 신체와 자세를 유지한 달리기 미리보기':'몸통과 다리, 아래팔을 잡아 달리기 자세 조절');
 $('previous').hidden=index===0;$('previous').textContent=index?'← '+names[index-1]:'';$('next').hidden=index===3;$('next').textContent=index<3?names[index+1]+' →':'';
 $('pending-number').textContent='0'+(index+1);$('pending-title').textContent=step==='course'?'코스 설정을 준비하고 있습니다.':'백테스팅을 준비하고 있습니다.';
 $('pending-description').textContent='신체·자세·코스 설정을 이어받았습니다. 코스 위 주행과 백테스팅 계산은 준비 중이며, 현재는 기록 예측이나 비교 결과를 생성하지 않습니다.';
 renderRunnerSummary();courseEditor.refresh();
 if(focus)$('title').focus({preventScroll:true});
 inputs();display();if(isPreview())prepare();else{++loadToken;busy=false;playing=false;}
}
function navigate(next,push=true){
 coursePlayback?.pause();
 if(next==='backtest'&&!courseEditor.valid){next='course';courseEditor.announce('출발점·방향·목표 거리를 확인한 뒤 다음 단계로 이동해주세요.');if(!push)history.replaceState(null,'','/course');}
 bodyEditor.cancel();poseEditor.cancel();step=next;playing=false;if(push)history.pushState(null,'','/'+step);renderPage(true);window.scrollTo(0,0);
}
document.querySelectorAll('[data-step]').forEach(a=>a.onclick=e=>{if(e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(a.dataset.step);});
window.addEventListener('popstate',()=>navigate(route(location.pathname),false));
if(location.pathname!=='/'+step||location.search)history.replaceState(null,'','/'+step);
$('next').onclick=()=>navigate(stages[stages.indexOf(step)+1]);$('previous').onclick=()=>navigate(stages[stages.indexOf(step)-1]);
$('model').onchange=()=>{bodyEditor.cancel();state.model=$('model').value;active=null;save();prepare();};
$('part').onchange=()=>inputs();
$('scale').oninput=()=>{state.scale=+$('scale').value/100;applyBody();inputs();draw();save();};
$('length').oninput=()=>{const id=$('part').value;state.ratios[id]=Math.max(.85,Math.min(1.15,+$('length').value/(active.dimensions.baseline[id]*state.scale)));applyBody();inputs();draw();save();};
function resetBody(){bodyEditor.cancel();state.scale=1;for(const f of lengthFields)state.ratios[f.id]=1;save();prepare();}
$('reset-body').onclick=resetBody;$('retry').onclick=()=>prepare();
function updatePose(id,value){state[id]=value;const controller=id==='leg'?height:id==='elbow'?elbow:lean;controller.set(value,!playing);inputs();draw();save();}
$('leg').oninput=()=>{const value=+$('leg').value;poseEditor.cancel();updatePose('leg',value);};$('elbow').oninput=()=>{const value=+$('elbow').value;poseEditor.cancel();updatePose('elbow',value);};
$('reset-leg').onclick=()=>{poseEditor.cancel();updatePose('leg',0);};$('reset-elbow').onclick=()=>{poseEditor.cancel();updatePose('elbow',0);};
$('lean').oninput=()=>{const value=+$('lean').value;poseEditor.cancel();updatePose('lean',value);};
$('reset-lean').onclick=()=>{poseEditor.cancel();updatePose('lean',0);};
$('strike').onchange=()=>{const value=$('strike').value;poseEditor.cancel();state.strike=value;strikeBlend.set(value,!playing);inputs();draw();save();};
$('play').onclick=()=>{poseEditor.cancel();playing=!playing;last=performance.now();if(!playing){height.set(state.leg,true);elbow.set(state.elbow,true);lean.set(state.lean,true);strikeBlend.set(state.strike,true);}inputs();draw();};
function seek(value){poseEditor.cancel();playing=false;phase=Math.max(0,Math.min(1,value));height.set(state.leg,true);elbow.set(state.elbow,true);lean.set(state.lean,true);strikeBlend.set(state.strike,true);inputs();draw();}
$('phase').oninput=()=>seek(+$('phase').value);
function view(value){bodyEditor.cancel();poseEditor.cancel();side=value;$('front').setAttribute('aria-pressed',String(!side));$('side').setAttribute('aria-pressed',String(side));draw();}
$('front').onclick=()=>view(false);$('side').onclick=()=>view(true);
new ResizeObserver(draw).observe($('viewport'));
renderer.setAnimationLoop(now=>{const elapsed=Math.max(0,(now-last)/1000),dt=Math.min(elapsed,.1);last=now;
 if(step==='backtest'){if(coursePlayback?.frame().playing&&canRun()){coursePlayback.tick(elapsed);draw();}}
 else if(playing&&usesRunning()&&canRun()){
  height.tick(dt);elbow.tick(dt);lean.tick(dt);strikeBlend.tick(dt);
  const frames=active.reference.models[state.model].frames,distanceM=(frames.at(-1).pelvis[2]-frames[0].pelvis[2])*(active.runtime.travelScale||1);
  const seconds=cycleDuration({seconds:active.runtime.seconds,distanceM},step==='course'?state.course?.paceSecondsPerKm:undefined);
  phase=(phase+dt/seconds)%1;draw();}});
window.addEventListener('pagehide',()=>{playing=false;coursePlayback?.pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){coursePlayback?.pause();if(step==='backtest')draw();}last=performance.now();});
// Read-only diagnostics plus deterministic seek for regression and capture scripts.
window.stagePreview={get state(){return structuredClone(state);},get step(){return step;},get ready(){return !!active&&!busy&&!error;},get runtime(){return active?.runtime;},get dimensions(){return active?.dimensions;},get body(){return active?.body;},get diagnostic(){return diagnostic;},get phase(){return phase;},get playing(){return playing;},get applied(){return {leg:height.value,elbow:elbow.value,lean:lean.value,midfoot:strikeBlend.value,strikePitchDeg:strikeBlend.pitchDeg};},seek,view};
window.courseRunPreview={get ready(){return step==='backtest'&&!!coursePlayback&&canRun();},get frame(){return coursePlayback?.frame();},get model(){return runView.model;},get group(){return runView.group;},get offset(){return runView.offset;},get camera(){return runView.camera;}};
renderPage();
courseEditor.load().then(()=>{if(step==='backtest'){if(!courseEditor.valid)navigate('backtest',false);else{setupRun();draw();}}});

