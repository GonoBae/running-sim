import {localLab,readSettings,saveSettings,categoryDefaults,builtInModels,storeModel,storedModels,modelBuffer,type Category,type ModelType,type Settings,type StoredModel} from './settings';
import {events,activeVisitors,ranked} from './analytics';
import './admin.css';
import {lengthFields} from './body-dimensions';

const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function mountAdmin(){
  if(!localLab){document.body.innerHTML='<main class="restricted"><h1>관리자 연결 준비 중</h1><p>로그인·서버 권한 연결 전에는 관리자 기능을 제공하지 않습니다.</p><a href="/">사용자 화면으로</a></main>';return;}
  let settings:Settings;
  try{settings=readSettings();}catch(e){document.body.innerHTML=`<main class="restricted"><h1>설정을 읽을 수 없습니다</h1><p>${esc(e instanceof Error?e.message:e)}</p><p>저장된 설정을 덮어쓰지 않았습니다.</p></main>`;return;}
  document.body.innerHTML=`<div class="admin-shell"><nav class="admin-nav"><a class="brand" href="/">running sim</a><span>관리자 작업실</span><a href="#overview">이용 통계</a><a href="#policy">자세·카테고리</a><a href="#models">모델 관리</a><a href="#model-test">모델 테스트</a><a class="user-link" href="/" target="_blank" rel="noopener">사용자 화면 ↗</a></nav><main class="admin-main">
  <header class="admin-heading"><div><p class="eyebrow">LOCAL ADMIN LAB</p><h1>운영을 한눈에.</h1><p>모델과 허용 동작을 관리하고, 실제 사용 기록을 확인합니다.</p></div><span id="revision" class="badge"></span></header>
  <div class="scope-note"><strong>이 브라우저의 로컬 시험 데이터</strong><span>전체 사이트 통계·관리자 로그인은 Supabase 연결 후 제공됩니다. 이 관리자 화면은 로컬 개발에서만 열립니다.</span></div>
  <section id="overview"><div class="section-title"><h2>이용 통계</h2><div><select id="period" aria-label="통계 기간"><option value="1">최근 24시간</option><option value="7" selected>최근 7일</option><option value="30">최근 30일</option></select><button id="refresh-stats">새로고침</button><button id="export-events">CSV 다운로드</button></div></div><div class="metric-grid" id="metrics"></div><div class="rank-grid"><article class="card"><h3>많이 사용된 자세</h3><p>‘이 설정 적용’으로 확정한 자세 · 같은 모델·설정 버전끼리 집계</p><div id="pose-rank"></div></article><article class="card"><h3>많이 사용된 체형</h3><p>모델·설정 버전 + 높이 5cm·각 부위 길이 1cm 구간</p><div id="body-rank"></div></article></div></section>
  <form id="settings-form"><section id="policy"><div class="section-title"><div><h2>자세·카테고리 제한</h2><p>노출을 끄면 해당 부위는 기본 각도로 고정됩니다. 좌우에 같은 제한을 적용합니다.</p></div></div><div class="card table-wrap"><table><thead><tr><th>사용자 노출</th><th>뒤 / 최소 °</th><th>앞 / 최대 °</th><th>기본 °</th><th>현재 검증한 범위</th></tr></thead><tbody>${(Object.keys(categoryDefaults) as Category[]).map(k=>{const c=settings.categories[k],cap=categoryDefaults[k];return `<tr><td><label><input id="${k}-enabled" type="checkbox" ${c.enabled?'checked':''}> ${cap.label}</label></td>${(['min','max','initial'] as const).map(field=>`<td><input id="${k}-${field}" aria-label="${cap.label} ${field==='min'?'최소':field==='max'?'최대':'기본'} 각도" type="number" step="1" min="${cap.min}" max="${cap.max}" value="${c[field]}" required></td>`).join('')}<td>${cap.min}° ~ ${cap.max}°</td></tr>`;}).join('')}</tbody></table><label class="height-setting"><input type="checkbox" id="height-enabled" ${settings.heightEnabled?'checked':''}> 사용자에게 모델 높이 조절 제공</label><fieldset><legend>부위 길이 노출 · 기본 길이 ±15%</legend>${lengthFields.map(f=>`<label class="height-setting"><input type="checkbox" id="length-${f.id}" ${settings.lengths[f.id]?'checked':''}> ${f.label}</label>`).join('')}</fieldset><p>검증 범위는 좁힐 수 있습니다. 범위를 넓히거나 새 관절을 추가하려면 별도 모델 검증이 필요합니다.</p></div></section>
  <section id="models"><div class="section-title"><div><h2>모델 관리</h2><p>사용자에게 제공할 남성형·여성형을 선택합니다. 변경은 아래 적용 버튼으로 확정합니다.</p></div><label class="upload">GLB 등록<input id="upload-model" type="file" accept=".glb" hidden></label></div><div class="model-grid">${(['male','female'] as ModelType[]).map(k=>`<article class="card"><span class="model-symbol">${k==='male'?'M':'F'}</span><h3>${builtInModels[k].label}</h3><label><input id="${k}-enabled" type="checkbox" ${settings.models[k].enabled?'checked':''}> 사용자 선택 허용</label><label class="select-label" for="${k}-source">사용할 모델</label><select id="${k}-source"></select><button type="button" class="preview-model" data-type="${k}">선택 모델 테스트</button><p>MakeHuman 원본 → 체형 적용 → 뼈대 재맞춤</p></article>`).join('')}</div><div class="card asset-list"><h3>등록 파일</h3><p>GLB는 이 브라우저에 보관됩니다. 미검증 파일은 시험 표시만 가능하며 사용자 모델로 적용할 수 없습니다.</p><div id="assets"></div></div></section>
  <div class="save-bar"><p id="settings-message" role="status">변경은 새로 연 사용자 화면부터 적용됩니다.</p><button type="submit" class="primary">로컬 설정 적용</button></div></form>
  <section id="model-test"><div class="section-title"><div><h2>모델 테스트</h2><p>아래 시험 조작은 방문·사용 통계에 포함되지 않습니다. 자세 제한은 마지막 적용 설정을 사용합니다.</p></div><p id="test-status" role="status">미리보기를 준비하는 중입니다.</p></div><iframe id="test-frame" title="관리자 모델 시험" src="/?admin-preview=1"></iframe></section>
  </main></div>`;
  const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
  const message=(text:string)=>{el('settings-message').textContent=text;};
  const revision=()=>{el('revision').textContent=`적용 설정 v${settings.revision}`;};revision();
  let assets:StoredModel[]=[],ready=false,testId=0;
  const frame=el<HTMLIFrameElement>('test-frame');
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='preview-ready'){ready=true;el('test-status').textContent='모델을 선택해 테스트하세요.';}
    if(event.data?.type==='preview-result'&&event.data.id===testId){el('test-status').textContent=event.data.ok?`표시 완료 · 뼈 ${event.data.bones}개 · ${event.data.poseAvailable?'확인된 관절 설정 사용 가능':'관절 방향 미검증: 자세 조절 잠금'}`:`불러오기 실패: ${event.data.error}`;}
  });
  async function preview(buffer:ArrayBuffer,name:string){
    if(!ready)throw Error('미리보기 준비 후 다시 시도하세요.');
    testId++;el('test-status').textContent='모델을 검사하는 중입니다.';
    frame.contentWindow!.postMessage({type:'admin-load',id:testId,buffer,name},location.origin,[buffer]);
    el('model-test').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function refreshAssets(){
    assets=await storedModels();
    for(const k of ['male','female'] as ModelType[]){
      const select=el<HTMLSelectElement>(`${k}-source`),selected=select.value||settings.models[k].source;
      select.innerHTML='<option value="builtin">기본 '+builtInModels[k].label+' 모델</option>'+assets.filter(a=>a.hash===builtInModels[k].hash).map(a=>`<option value="${a.hash}">${esc(a.name)}</option>`).join('');
      select.value=selected;
      if(!select.value){select.innerHTML+=`<option value="${esc(selected)}">저장 파일 없음 — 다시 선택 필요</option>`;select.value=selected;}
    }
    el('assets').innerHTML=assets.length?assets.map(a=>`<div class="asset-row"><div><strong>${esc(a.name)}</strong><small>${(a.bytes/1024/1024).toFixed(2)} MB · ${Object.values(builtInModels).some(m=>m.hash===a.hash)?'확인된 모델':'미검증 · 시험 전용'}</small></div><button type="button" data-hash="${a.hash}">표시 테스트</button></div>`).join(''):'<p class="empty">등록한 파일이 없습니다. 기본 두 모델은 바로 사용할 수 있습니다.</p>';
    el('assets').querySelectorAll<HTMLButtonElement>('[data-hash]').forEach(b=>b.onclick=async()=>{try{const a=assets.find(a=>a.hash===b.dataset.hash)!;await preview(await a.blob.arrayBuffer(),a.name);}catch(e){message(String(e));}});
  }
  await refreshAssets();
  el<HTMLInputElement>('upload-model').onchange=async event=>{const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{await storeModel(file);await refreshAssets();message('파일을 등록했습니다. 표시 테스트 후 확인된 모델만 사용자에게 적용할 수 있습니다.');}catch(e){message(String(e));}finally{input.value='';}};
  document.querySelectorAll<HTMLButtonElement>('.preview-model').forEach(button=>button.onclick=async()=>{try{const type=button.dataset.type as ModelType,draft=structuredClone(settings);draft.models[type].source=el<HTMLSelectElement>(`${type}-source`).value;const result=await modelBuffer(type,draft);await preview(result.buffer,result.name);}catch(e){message(String(e));}});
  el<HTMLFormElement>('settings-form').onsubmit=async event=>{
    event.preventDefault();
    try{
      const draft=structuredClone(settings);
      for(const key of Object.keys(categoryDefaults) as Category[]){const c=draft.categories[key];c.enabled=el<HTMLInputElement>(`${key}-enabled`).checked;for(const field of ['min','max','initial'] as const)c[field]=el<HTMLInputElement>(`${key}-${field}`).valueAsNumber;}
      draft.heightEnabled=el<HTMLInputElement>('height-enabled').checked;
      for(const f of lengthFields)draft.lengths[f.id]=el<HTMLInputElement>(`length-${f.id}`).checked;
      for(const k of ['male','female'] as ModelType[]){draft.models[k]={enabled:el<HTMLInputElement>(`${k}-enabled`).checked,source:el<HTMLSelectElement>(`${k}-source`).value};if(draft.models[k].source!=='builtin'&&!assets.some(a=>a.hash===draft.models[k].source&&a.hash===builtInModels[k].hash))throw Error('이 모델은 해당 유형으로 검증되지 않았습니다.');}
      settings=saveSettings(draft);revision();message(`v${settings.revision} 적용 완료. 사용자 화면을 새로 열거나 새로고침하세요.`);
      ready=false;frame.src='/?admin-preview=1';
    }catch(e){message(e instanceof Error?e.message:String(e));}
  };
  function renderStats(){
    const since=Date.now()-Number(el<HTMLSelectElement>('period').value)*86400000,items=events().filter(e=>e.at>=since);
    const visits=items.filter(e=>e.kind==='visit'),applied=items.filter(e=>e.kind==='configuration_applied');
    const metrics=[['현재 접속',activeVisitors(),'최근 90초 · 고유 브라우저'],['방문 브라우저',new Set(visits.map(e=>e.visitor)).size,'선택 기간 · 익명 브라우저 ID'],['방문 횟수',visits.length,'사용자 화면을 연 횟수'],['설정 적용',applied.length,'확정 버튼을 누른 횟수']];
    el('metrics').innerHTML=metrics.map(([label,value,detail])=>`<article class="card metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
    for(const [kind,target] of [['pose','pose-rank'],['body','body-rank']] as const){const rows=ranked(items,kind),max=rows[0]?.count??1;el(target).innerHTML=rows.length?rows.map((r,i)=>`<div class="rank-row"><div><span>${i+1}</span><details><summary>${(kind==='pose'?'자세':'체형')+' 조합 '+(i+1)}</summary>${esc(r.label)}</details><strong>${r.count}회</strong></div><div class="bar"><i style="width:${r.count/max*100}%"></i></div></div>`).join(''):'<p class="empty">아직 적용한 설정이 없습니다.<br>사용자 화면에서 ‘이 설정 적용’을 누르면 집계됩니다.</p>';}
  }
  el('refresh-stats').onclick=renderStats;el<HTMLSelectElement>('period').onchange=renderStats;
  addEventListener('storage',renderStats);setInterval(renderStats,30000);renderStats();
  el('export-events').onclick=()=>{
    const since=Date.now()-Number(el<HTMLSelectElement>('period').value)*86400000;
    const quote=(s:unknown)=>'"'+String(s??'').replaceAll('"','""')+'"';
    const rows=[['event_id','time','event','revision','model','model_hash','height_cm','pose','body_recipe','lengths_cm'],...events().filter(e=>e.at>=since).map(e=>[e.id,new Date(e.at).toISOString(),e.kind,e.revision,e.model,e.hash,e.heightCm,JSON.stringify(e.pose??{}),e.bodyRecipe,JSON.stringify(e.lengthsCm??{})])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='running-sim-local-usage.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
}
