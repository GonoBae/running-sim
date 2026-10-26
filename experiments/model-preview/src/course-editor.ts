import {COURSE_ID,COURSE_REVISION,COURSE_URL,createCourse,totalDistanceM,goalLabel,validGoalDistance,migrateCourseDraft,validPace,paceLabel,durationLabel,type Course,type CourseDraft,type Point} from './course';
import './course.css';
type Options={root:HTMLElement;getDraft:()=>CourseDraft|null;change:(d:CourseDraft)=>void;validity:()=>void;initialIssue?:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function createCourseEditor(o:Options){
 let course:Course|null=null,loading=false,loadError='',inputError='',paceError='',notice=o.initialIssue||'',request=0;
 let sx=1,ox=0,oy=0,compare=true;
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>o.root.querySelector<T>(s)!;
 o.root.classList.add('course-panel');
 o.root.innerHTML=`<div class="course-heading"><div><span class="eyebrow">YOUR COURSE</span><h2>김해 롯데가든파크</h2></div><span class="course-badge">확인한 코스</span></div>
 <p class="course-hint">굵은 길을 눌러 출발점을 정하세요.</p>
 <div class="course-map-wrap"><svg id="course-map" viewBox="0 0 1000 590" role="img" aria-label="롯데가든파크 코스 지도. 출발 위치는 아래 목록으로도 선택할 수 있습니다."></svg><div class="course-map-status" role="status"></div></div>
 <div class="course-credit">지도 데이터 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors · ODbL</a></div>
 <div class="course-source"><strong>경로 좌표로 자동 계산</strong><p id="course-source-summary"></p><small>출발점·방향·목표 거리를 바꾸면 도착점도 함께 계산합니다.</small></div>
 <div class="course-correction" hidden><button id="course-compare" type="button" aria-pressed="true">수정 전 경로·도착점 비교</button><small id="course-correction-summary"></small></div>
 <div class="course-metrics"><div><small>한 바퀴 · 지도 기준</small><strong id="lap-length">—</strong></div><div><small>목표 거리</small><strong id="course-total">—</strong></div><div><small>예상 소요 · 설정 페이스</small><strong id="course-duration">—</strong></div></div>
 <div class="course-controls"><label for="course-start">출발 위치<select id="course-start"><option value="">지도에서 선택하거나 위치 고르기</option></select></label>
 <div><span class="control-label" id="direction-label">진행 방향</span><div class="course-directions" role="group" aria-labelledby="direction-label"><button type="button" id="course-forward" aria-pressed="true">시계 방향 ↻</button><button type="button" id="course-reverse" aria-pressed="false">반시계 방향 ↺</button></div></div>
 <div class="course-goal"><span class="control-label" id="goal-label">목표 설정</span><div class="course-directions" role="group" aria-labelledby="goal-label"><button id="goal-laps" type="button" aria-pressed="true">바퀴 수</button><button id="goal-distance" type="button" aria-pressed="false">거리 (km)</button></div>
 <label id="lap-field" for="course-laps"><span class="goal-input-label">목표 바퀴 수</span><div class="course-lap-input"><button type="button" id="lap-minus" aria-label="한 바퀴 줄이기">−</button><input id="course-laps" type="number" min="1" max="100" step="1" inputmode="numeric" value="1"><span>바퀴</span><button type="button" id="lap-plus" aria-label="한 바퀴 늘리기">+</button></div></label>
 <label id="distance-field" for="course-km" hidden><span class="goal-input-label">목표 거리</span><div class="course-lap-input"><input id="course-km" type="number" min="0.01" max="100" step="0.01" inputmode="decimal" value="1"><span>km</span></div></label></div>
 <div class="course-pace"><span class="control-label" id="pace-label">주행 페이스</span><div class="course-directions" role="group" aria-labelledby="pace-label"><button id="pace-original" type="button" aria-pressed="true">기존 동작 속도</button><button id="pace-target" type="button" aria-pressed="false">목표 페이스</button></div>
 <div id="pace-fields" hidden><div class="course-pace-input"><label for="pace-minutes" class="sr-only">페이스 분</label><input id="pace-minutes" type="number" min="1" max="30" step="1" inputmode="numeric" value="6"><span>:</span><label for="pace-seconds" class="sr-only">페이스 초</label><input id="pace-seconds" type="number" min="0" max="59" step="1" inputmode="numeric" value="00"><span>분/km</span></div></div></div></div>
 <p id="course-feedback" role="status" aria-live="polite"></p><button type="button" id="course-retry" hidden>코스 다시 불러오기</button><small class="course-limit">지도 경로로 계산한 거리입니다. 실제 달리는 선과의 차이는 아직 검증되지 않았습니다.</small>`;
 const validGoal=()=>!!course&&!loading&&!loadError&&!inputError&&!course.issue(o.getDraft());
 const valid=()=>validGoal()&&!paceError;
 const toSVG=(p:Point):Point=>[ox+p[0]*sx,oy-p[1]*sx];
 const polygon=(points:Point[])=>points.map(p=>toSVG(p).map(n=>n.toFixed(2)).join(',')).join(' ');
 function drawMap(){
  if(!course)return;
  const xs=course.local.map(p=>p[0]),ys=course.local.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  sx=Math.min(880/(maxX-minX),460/(maxY-minY));ox=500-(minX+maxX)/2*sx;oy=295+(minY+maxY)/2*sx;
  let html='<rect width="1000" height="590" fill="#edf1e9"/>';
  const context=course.asset.context||[];
  for(const f of context){
   if(!Array.isArray(f.coordinates)||f.coordinates.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))continue;
   const points=polygon(f.coordinates.map(course.project)),closed=['park','building','area'].includes(f.kind);
   const fill={park:'#dfebd7',building:'#dbe2d5',area:'#dce4d5'}[f.kind as 'park'|'building'|'area']||'none';
   html+=`<${closed?'polygon':'polyline'} points="${points}" fill="${fill}" stroke="${f.kind==='path'?'#bdcbb8':'#c9d3c2'}" stroke-width="${f.kind==='road'?3:1.5}"/>`;
  }
  html+=`<polyline points="${polygon(course.local)}" fill="none" stroke="white" stroke-width="13" stroke-linejoin="round"/><polyline id="course-route" points="${polygon(course.local)}" fill="none" stroke="#3e7560" stroke-width="7" stroke-linejoin="round"/>`;
  const d=o.getDraft();
  const correction=course.asset.source.correction,previous=course.asset.previous;
  if(compare&&correction&&previous){
   html+=`<polyline id="course-old-detour" points="${polygon([correction.from,correction.removedCoordinate,correction.to].map(course.project))}" fill="none" stroke="#b86844" stroke-width="4" stroke-dasharray="7 4"><title>수정 전: 광장 안쪽 우회</title></polyline>`;
   if(d&&!course.issue(d)){
    const old=createCourse({...course.asset,...previous}),start=old.nearest(course.pointAt(d.startDistanceM));
    // Compare only when both routes can share the same physical start.
    if(start.distance<.01){
     const oldDraft={...d,revision:previous.revision,startDistanceM:start.startDistanceM};
     const [x,y]=toSVG(old.atTravel(oldDraft,totalDistanceM(old,oldDraft)));
     html+=`<circle id="course-old-finish" cx="${x}" cy="${y}" r="17" fill="none" stroke="#b86844" stroke-width="3" stroke-dasharray="5 3"><title>같은 출발점의 수정 전 도착</title></circle>`;
    }
   }
  }
  if(d&&!course.issue(d)){
   for(const fraction of [.08,.33,.58,.83]){
    const distance=course.lengthM*fraction,p=toSVG(course.atTravel(d,distance)),q=toSVG(course.atTravel(d,distance+4));
    const angle=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI;
    html+=`<path class="direction-arrow" d="M-9,-7 L1,0 L-9,7" transform="translate(${p}) rotate(${angle})" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>`;
   }
   const start=course.pointAt(d.startDistanceM),finish=course.atTravel(d,totalDistanceM(course,d)),[x,y]=toSVG(start),[fx,fy]=toSVG(finish);
   const same=Math.hypot(start[0]-finish[0],start[1]-finish[1])<.01;
   const label=(px:number,py:number,text:string,color:string,below=false)=>`<g transform="translate(${Math.min(884,Math.max(8,px-51))},${below?Math.min(555,py+19):Math.max(8,py-46)})"><rect width="102" height="27" rx="13" fill="${color}"/><text x="51" y="19" text-anchor="middle" fill="white" font-size="15">${text}</text></g>`;
   html+=`<circle id="course-start-marker" cx="${x}" cy="${y}" r="12" fill="#d45c39" stroke="white" stroke-width="4"/>`+label(x,y,same&&!inputError?'출발 · 도착':'출발','#294632');
   if(!inputError)html+=`<circle id="course-finish-marker" cx="${fx}" cy="${fy}" r="${same?17:12}" fill="${same?'none':'#5454a8'}" stroke="${same?'#5454a8':'white'}" stroke-width="${same?3:4}"><title>도착 지점</title></circle>`+(same?'':label(fx,fy,'도착','#5454a8',Math.hypot(x-fx,y-fy)<120));
  }
  html+='<text x="950" y="33" font-size="18" fill="#294632">N</text><path d="M956 43 l-5 13 h10 Z" fill="#294632"/>';
  html+=`<path d="M30 560 h${100*sx}" stroke="#294632" stroke-width="3"/><text x="30" y="548" font-size="14" fill="#294632">지도 100 m</text>`;
  $('#course-map').innerHTML=html;
 }
 function update(){
  const d=o.getDraft(),issue=course?.issue(d)||'',ready=!!course&&!loading&&!loadError;
  $('.course-map-status').textContent=loading?'코스를 불러오는 중…':loadError;
  $('.course-map-status').hidden=!loading&&!loadError;
  $('#course-retry').hidden=!loadError;
  $('#lap-length').textContent=ready?`${(course!.lengthM/1000).toFixed(2)} km`:'—';
  const source=course?.asset.source.verification;
  const correction=course?.asset.source.correction;
  $('#course-source-summary').textContent=ready?(correction?`항공사진 대조 · 남동쪽 광장 연결 수정 · ${(course!.lengthM/1000).toFixed(3)} km`:source?`원본 경로 ${source.segments}구간 연결 확인 · ${(course!.lengthM/1000).toFixed(3)} km · 자료 확인 ${source.fetchedAtUTC.slice(0,10)}`:'공개 지도 좌표 기준 · 원본 연결 검증 정보 없음'):'';
  $('.course-correction').hidden=!correction;$('#course-compare').setAttribute('aria-pressed',String(compare));
  $('#course-correction-summary').textContent=correction?`한 바퀴 ${correction.beforeLengthM.toFixed(1)} → ${correction.afterLengthM.toFixed(1)} m · 주황 점선: 수정 전 / 보라색: 현재 도착`:'';
  $('#course-total').textContent=validGoal()?`${(totalDistanceM(course!,d!)/1000).toFixed(2)} km`:'—';
  $('#course-duration').textContent=valid()&&d?.paceSecondsPerKm?durationLabel(totalDistanceM(course!,d)*d.paceSecondsPerKm/1000):'—';
  $('#course-feedback').textContent=inputError||paceError||loadError||issue||notice||(d?`${goalLabel(d)} · ${d.direction==='forward'?'시계':'반시계'} 방향${d.paceSecondsPerKm?` · ${paceLabel(d.paceSecondsPerKm)}`:''} · 보라색 표시가 도착점입니다.`:'');
  $('#course-feedback').classList.toggle('invalid',!!(inputError||paceError||loadError||notice||(d&&issue)));
  const start=$<HTMLSelectElement>('#course-start');start.disabled=!ready;
  for(const id of ['course-forward','course-reverse','course-laps','lap-minus','lap-plus','goal-laps','goal-distance','course-km','pace-original','pace-target','pace-minutes','pace-seconds'])$<HTMLButtonElement>('#'+id).disabled=!ready||!!issue;
  const target=d?.paceSecondsPerKm!==undefined;
  $('#pace-original').setAttribute('aria-pressed',String(!target));$('#pace-target').setAttribute('aria-pressed',String(target));$('#pace-fields').hidden=!target;
  if(target&&!paceError){
   if(document.activeElement!==$('#pace-minutes'))$<HTMLInputElement>('#pace-minutes').value=String(Math.floor(d!.paceSecondsPerKm!/60));
   if(document.activeElement!==$('#pace-seconds'))$<HTMLInputElement>('#pace-seconds').value=String(d!.paceSecondsPerKm!%60).padStart(2,'0');
  }
  for(const id of ['pace-minutes','pace-seconds'])$('#'+id).setAttribute('aria-invalid',String(!!paceError));
  const distanceMode=!!d?.goal;
  $('#goal-laps').setAttribute('aria-pressed',String(!distanceMode));$('#goal-distance').setAttribute('aria-pressed',String(distanceMode));
  $('#lap-field').hidden=distanceMode;$('#distance-field').hidden=!distanceMode;
  if(ready&&d&&!issue){
   $('#course-forward').setAttribute('aria-pressed',String(d.direction==='forward'));$('#course-reverse').setAttribute('aria-pressed',String(d.direction==='reverse'));
   if(!inputError)$<HTMLInputElement>('#course-laps').value=String(d.laps);
   if(!inputError&&d.goal)$<HTMLInputElement>('#course-km').value=String(d.goal.distanceM/1000);
   $<HTMLButtonElement>('#lap-minus').disabled=d.laps<=1;$<HTMLButtonElement>('#lap-plus').disabled=d.laps>=100;
   const match=course!.asset.landmarks.findIndex(l=>Math.abs(course!.nearest(course!.project(l.coordinate)).startDistanceM-d.startDistanceM)<.01);
   start.value=match>=0?String(match):'custom';
  }else start.value='';
  $<HTMLInputElement>('#course-laps').setAttribute('aria-invalid',String(!!inputError));
  $<HTMLInputElement>('#course-km').setAttribute('aria-invalid',String(!!inputError));
  drawMap();o.validity();
 }
 function choose(s:number){if(!course)return;const previous=o.getDraft();inputError='';notice='';o.change({id:course.asset.id,revision:course.asset.revision,startDistanceM:s,direction:previous?.direction==='reverse'?'reverse':'forward',laps:previous?.laps&&previous.laps>=1&&previous.laps<=100?previous.laps:1,...(previous?.goal?{goal:{...previous.goal}}:{}),...(previous?.paceSecondsPerKm!==undefined?{paceSecondsPerKm:previous.paceSecondsPerKm}:{})});update();}
 function setLaps(raw:string){
  const n=raw.trim()===''?NaN:Number(raw),d=o.getDraft();
  if(!Number.isInteger(n)||n<1||n>100){inputError='바퀴 수는 1~100 사이의 정수로 입력해주세요.';update();return;}
  inputError='';notice='';if(d&&course&&!course.issue(d))o.change({...d,laps:n});update();
 }
 $<HTMLInputElement>('#course-laps').addEventListener('input',e=>setLaps((e.target as HTMLInputElement).value));
 $<HTMLInputElement>('#course-km').addEventListener('input',e=>{
  const raw=(e.target as HTMLInputElement).value,n=raw.trim()===''?NaN:Number(raw)*1000,m=Math.round(n),d=o.getDraft();
  if(!validGoalDistance(m)||Math.abs(n-m)>1e-6){inputError='거리는 0.01~100 km 사이에서 0.01 km 단위로 입력해주세요.';update();return;}
  inputError='';notice='';if(d&&course&&!course.issue(d))o.change({...d,goal:{type:'distance',distanceM:m}});update();
 });
 for(const mode of ['laps','distance'])$('#goal-'+mode).onclick=()=>{
  const d=o.getDraft();if(!d||!course||course.issue(d))return;
  const {goal,...rest}=d;inputError='';notice='';
  o.change(mode==='distance'?{...rest,goal:goal||{type:'distance',distanceM:1000}}:rest);update();
 };
 $('#lap-minus').onclick=()=>setLaps(String((o.getDraft()?.laps||1)-1));$('#lap-plus').onclick=()=>setLaps(String((o.getDraft()?.laps||1)+1));
 for(const mode of ['original','target'])$('#pace-'+mode).onclick=()=>{
  const d=o.getDraft();if(!d||!course||course.issue(d))return;
  const {paceSecondsPerKm,...rest}=d;paceError='';notice='';o.change(mode==='target'?{...rest,paceSecondsPerKm:paceSecondsPerKm??360}:rest);update();
 };
 function setPace(){
  const minute=$<HTMLInputElement>('#pace-minutes').value,second=$<HTMLInputElement>('#pace-seconds').value,m=Number(minute),s=Number(second),pace=m*60+s,d=o.getDraft();
  if(!minute.trim()||!second.trim()||!Number.isInteger(m)||!Number.isInteger(s)||m<1||s<0||s>59||!validPace(pace)){paceError='페이스는 1:00~30:00 분/km로 입력해주세요. 초는 0~59입니다.';update();return;}
  paceError='';notice='';if(d&&course&&!course.issue(d))o.change({...d,paceSecondsPerKm:pace});update();
 }
 for(const id of ['pace-minutes','pace-seconds']){$('#'+id).oninput=setPace;$('#'+id).onblur=()=>update();}
 for(const direction of ['forward','reverse'] as const)$('#course-'+direction).onclick=()=>{const d=o.getDraft();if(!d||!course||course.issue(d))return;o.change({...d,direction});notice='';update();};
 $<HTMLSelectElement>('#course-start').onchange=e=>{const value=(e.target as HTMLSelectElement).value;if(course&&value!==''&&value!=='custom'){const l=course.asset.landmarks[Number(value)];if(l)choose(course.nearest(course.project(l.coordinate)).startDistanceM);}};
 $('#course-map').addEventListener('click',e=>{
  if(!course||loading||loadError)return;
  const svg=e.currentTarget as unknown as SVGSVGElement,matrix=svg.getScreenCTM();if(!matrix)return;
  const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  const hit=course.nearest([(q.x-ox)/sx,(oy-q.y)/sx]);
  const pixelsPerUnit=Math.hypot(matrix.a,matrix.b);
  if(hit.distance*sx*pixelsPerUnit>24){notice='굵은 코스 선을 눌러주세요.';update();return;}
  choose(hit.startDistanceM);
 });
 async function load(){
  const token=++request;loading=true;loadError='';update();
  try{
   const response=await fetch(COURSE_URL);if(!response.ok)throw Error('코스 자료를 불러오지 못했습니다.');
   const asset=await response.json();if(token!==request)return;
   if(asset.id!==COURSE_ID||asset.revision!==COURSE_REVISION)throw Error('코스 자료 버전이 일치하지 않습니다.');
   course=createCourse(asset);
   const saved=o.getDraft(),migrated=migrateCourseDraft(course,saved);
   if(migrated){
    let old=course.asset.previous;while(old&&old.revision!==saved!.revision)old=old.previous;
    const before=old?createCourse({...course.asset,...old}).pointAt(saved!.startDistanceM):null,after=course.pointAt(migrated.startDistanceM);
    const moved=before&&Math.hypot(before[0]-after[0],before[1]-after[1])>.01;
    o.change(migrated);notice=moved?'광장 안쪽에 있던 출발점을 수정한 트랙 위 가장 가까운 위치로 옮겼습니다. 나머지 설정은 유지했습니다.':'항공사진에서 확인한 경로로 갱신했습니다. 출발 위치와 기존 설정을 유지했습니다.';
   }
   $<HTMLSelectElement>('#course-start').innerHTML='<option value="">지도에서 선택하거나 위치 고르기</option>'+course.asset.landmarks.map((l,i)=>`<option value="${i}">${escape(l.label)}</option>`).join('')+'<option value="custom" disabled>지도에서 선택한 위치</option>';
  }catch(e){if(token!==request)return;course=null;loadError=e instanceof Error?e.message:'코스를 불러오지 못했습니다.';}
  if(token===request){loading=false;update();}
 }
 $('#course-retry').onclick=()=>void load();
 $('#course-compare').onclick=()=>{compare=!compare;update();};
 return {load,refresh:update,get valid(){return valid();},get course(){return course;},get loading(){return loading;},
  announce:(s:string)=>{notice=s;update();},summary:()=>valid()?`롯데가든파크 · ${o.getDraft()!.direction==='forward'?'시계':'반시계'} 방향 · ${goalLabel(o.getDraft()!)}${o.getDraft()!.goal?'':` · ${(totalDistanceM(course!,o.getDraft()!)/1000).toFixed(2)} km`}${o.getDraft()!.paceSecondsPerKm?` · ${paceLabel(o.getDraft()!.paceSecondsPerKm!)}`:''}`:'코스 설정을 확인해주세요.'};
}
