// Browser loading, failure feedback, and unchanged M56 pose regression.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),measure=require('./measure-landing-sole.cjs');
const out='outputs/cmu-toe-slip-path/loading';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:940}}),errors=[],results=[],frames=[];
 p.on('pageerror',e=>errors.push(e.message));
 p.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text());});
 await p.addInitScript(()=>{new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.name==='mocap-model-preview')requestAnimationFrame(()=>requestAnimationFrame(()=>performance.mark('mocap-preview-painted')));}).observe({entryTypes:['mark']});});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Page.enable');
 cdp.on('Page.screencastFrame',e=>{if(frames.length<20){const path=`${out}/frame-${frames.length}.png`;fs.writeFileSync(path,Buffer.from(e.data,'base64'));frames.push({path,timestamp:e.metadata.timestamp});}void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'png',maxWidth:1280,maxHeight:940,everyNthFrame:1});
 await p.goto('http://127.0.0.1:5173/review/mocap.html?compare=toe-slip-path');
 for(const model of ['male','female']){
  if(model==='female')await p.selectOption('#model','female');
  await p.waitForFunction(()=>window.mocapReview?.ready&&!document.querySelector('.bar').inert||!document.querySelector('#loading-retry').hidden,null,{timeout:120000});
  assert(await p.locator('#loading-retry').isHidden(),'unexpected preparation failure');
  const loading=await p.evaluate(()=>{const at=n=>performance.getEntriesByName(n).at(-1)?.startTime;return {timeOrigin:performance.timeOrigin,start:at('mocap-load-start'),preview:at('mocap-model-preview'),painted:at('mocap-preview-painted'),ready:at('mocap-load-ready'),hidden:document.querySelector('#loading-state').hidden};});
  console.log(model,'loading',loading);assert(loading.preview<loading.painted&&loading.painted<loading.ready);assert(loading.hidden);
  const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-toe-slip-path.json')).results.find(r=>r.model===model);
  const specs=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model).patchDefinition;
  const indices=[0,3,26,58,84,102,147,171,184,206,211,230,259,273,299,330,353,364];
  const rows=await p.evaluate(measure,{samples:indices.map(i=>old.rows[i].phase),specs});let positionMm=0,rotationDeg=0,soleMm=0;
  for(let j=0;j<rows.length;j++)for(let lane=0;lane<2;lane++){
   const before=old.rows[indices[j]].lanes[lane],after=rows[j].lanes[lane];
   for(const [name,bone]of Object.entries(before.bones)){const next=after.bones[name];positionMm=Math.max(positionMm,Math.hypot(...bone.p.map((v,k)=>v-next.p[k]))*1000);rotationDeg=Math.max(rotationDeg,2*Math.acos(Math.min(1,Math.abs(bone.q.reduce((sum,v,k)=>sum+v*next.q[k],0))))*180/Math.PI);}
   for(const side of ['l','r'])for(const region of ['toe','heel'])soleMm=Math.max(soleMm,Math.hypot(...before.feet[side].regions[region].map((v,k)=>v-after.feet[side].regions[region][k]))*1000);
  }
  assert(positionMm<.01&&rotationDeg<.001&&soleMm<.01);console.log(model,'pose regression',{positionMm,rotationDeg,soleMm});
  await p.evaluate(()=>window.mocapReview.seek(.505*window.mocapReview.cycle.period));await p.screenshot({path:`${out}/${model}-ready.png`});
  // The measurement helper pauses the animation loop; render the changed camera explicitly.
  await p.click('#side');await p.evaluate(()=>{const a=window.mocapReview;a.renderer.render(a.scene,a.camera);});await p.screenshot({path:`${out}/${model}-side.png`});await p.click('#front');
  results.push({model,loading,poseSamples:indices.length,positionMm,rotationDeg,soleMm});
 }
 await cdp.send('Page.stopScreencast');assert.deepEqual(errors,[]);
 // A missing model must produce a visible retry action, not a silent canvas.
 await p.route('**/models/runner-male.glb',route=>route.fulfill({status:503,body:'test unavailable'}));
 await p.reload();await p.waitForFunction(()=>!document.querySelector('#loading-retry').hidden);
 const failure=await p.locator('#loading-state').innerText();assert(failure.includes('失敗')||failure.includes('실패'));await p.screenshot({path:`${out}/failure.png`});
 await p.unroute('**/models/runner-male.glb');await p.click('#loading-retry');await p.waitForFunction(()=>window.mocapReview?.ready&&!document.querySelector('.bar').inert,null,{timeout:120000});
 const report={testedAt:new Date().toISOString(),beforeObserved:{readyMs:33664,errors:[],modelResponses:200,source:'Fresh browser load captured in initial diagnostic tool output'},results,frames,errors,failureVisible:true,retryPassed:true};
 fs.writeFileSync('docs/05-validation/reports/cmu-mocap-loading.json',JSON.stringify(report,null,2));console.log('PASS loading preview, two models, unchanged poses, visible failure and retry');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
