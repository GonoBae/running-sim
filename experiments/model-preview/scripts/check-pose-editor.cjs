const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173',out='outputs/pose-editor';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,checks:[],profiles:[],errors:[]};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:1030}});p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state),grip=key=>p.locator(`[data-pose-part="${key}"]`);
 const snapshot=()=>p.evaluate(()=>({state:window.stagePreview.state,phase:window.stagePreview.phase,playing:window.stagePreview.playing}));
 const seek=t=>p.evaluate(t=>window.stagePreview.seek(t),t),input=(id,v)=>p.locator('#'+id).fill(String(v));
 const point=async key=>{await grip(key).scrollIntoViewIfNeeded();return grip(key).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});};
 async function reveal(key){if(await grip(key).isVisible())return;for(const phase of [.24,.54,.74,.04])for(const view of ['front','side']){await p.click('#'+view);await seek(phase);if(await grip(key).isVisible())return;}throw Error('No visible angle for '+key);}
 async function drag(key,dy,cancel=false){const c=await point(key);await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x,c.y+dy,{steps:4});await p.evaluate(()=>new Promise(requestAnimationFrame));if(cancel)await p.keyboard.press('Escape');await p.mouse.up();}
 const body=s=>({model:s.model,scale:s.scale,ratios:s.ratios});
 await p.goto(base+'/body');await ready();
 for(const model of ['male','female'])for(const custom of [false,true]){
  console.log('Checking',model,custom?'changed body':'default body');
  if(new URL(p.url()).pathname!='/body'){await p.click('nav [data-step=body]');await ready();}
  await p.selectOption('#model',model);await ready();await p.click('#reset-body');await ready();
  if(custom){for(const key of ['thigh-r','forearm-r','scale']){await p.locator(`[data-body-part="${key}"]`).focus();await p.keyboard.press(key==='forearm-r'?'Home':'End');}}
  const bodyBefore=body(await state());await p.click('#next');await ready();await p.click('#front');
  const row={model,custom,handles:[],skin:[],bilateral:[]};
  for(const key of ['leg-r','leg-l','elbow-r','elbow-l']){
   const id=key.split('-')[0];await p.click('#front');await input('leg',0);await input('elbow',0);await seek(.24);const before=await snapshot();
   await drag(key,id==='leg'?-40:-30);const after=await snapshot();assert.equal(after.state[id],id==='leg'?5:10);assert.equal(after.state[id==='leg'?'elbow':'leg'],0);assert.deepEqual(body(after.state),bodyBefore);assert(!after.playing);
   assert(Math.abs(after.phase-(id==='leg'?(key.endsWith('-r')?.04:.54):before.phase))<1e-12);
   row.handles.push({key,value:after.state[id],phase:after.phase});
   const saved=await snapshot();await drag(key,15,true);assert.deepEqual(await snapshot(),saved);
   await drag(key,-240);assert.equal((await state())[id],id==='leg'?10:20);await reveal(key);await drag(key,300);assert.equal((await state())[id],id==='leg'?0:-20);
   await reveal(key);await grip(key).focus();await p.keyboard.press('End');await reveal(key);await grip(key).focus();await p.keyboard.press('ArrowDown');assert.equal((await state())[id],id==='leg'?9:19);
  }
  await p.click('#front');await input('leg',0);await input('elbow',0);await seek(.04);
  for(const key of ['leg-r','elbow-l']){
   const id=key.split('-')[0];let found=false;
   // A front-facing forearm can be shorter on screen than its handle. In
   // that case use the visible side surface instead of clicking empty space.
   for(const view of ['front','side']){await p.click('#'+view);await seek(.04);if(!await grip(key).isVisible())continue;const c=await point(key);
   for(const [dx,dy]of [[0,20],[0,-20],[20,0],[-20,0],[18,0],[-18,0],[24,10],[-24,-10],[10,24],[-10,-24]]){
    await seek(.04);const x=c.x+dx,y=c.y+dy;
    if(!await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName==='CANVAS',{x,y}))continue;
    await p.mouse.move(x,y);await p.mouse.down();const matched=await p.locator('.pose-editor').evaluate((el,key)=>el.classList.contains('is-dragging')&&el.querySelector(`[data-pose-part="${key}"]`).classList.contains('selected'),key);
    if(!matched){await p.keyboard.press('Escape');await p.mouse.up();continue;}
    const before=await state();await p.mouse.move(x,y-24,{steps:3});await p.mouse.up();assert((await state())[id]>before[id]);found=true;row.skin.push(key);break;
   }if(found)break;}assert(found,`skin ${model}/${custom}/${key}`);
  }
  await input('leg',5);await input('elbow',10);
  for(const [side,phase]of [['r',.04],['l',.54]]){await seek(phase);const d=await p.evaluate(()=>window.stagePreview.diagnostic);
   const leg=d.legHeight.find(x=>x.side===side);assert(Math.abs(leg.riseCm-5)<1e-7);for(const a of d.elbowBend)assert(Math.abs(a.actualDeg-a.baseDeg-10)<.001);row.bilateral.push({side,kneeRiseCm:leg.riseCm,elbows:d.elbowBend.map(a=>a.actualDeg-a.baseDeg)});
  }
  for(const view of ['front','side']){await p.click('#'+view);await seek(.04);await p.screenshot({path:`${out}/${model}-${custom?'custom':'base'}-${view}.png`,fullPage:true});}
  if(model==='male'&&!custom){assert(await grip('elbow-r').isHidden(),'known occluded far forearm hidden at side/.04');}
  await p.click('#front');await seek(.04);const center=await point('leg-r');await p.click('#play');await p.mouse.move(center.x,center.y);await p.mouse.down();assert(!await p.evaluate(()=>window.stagePreview.playing),'grabbing running skin pauses');assert(await p.locator('.pose-editor').evaluate(e=>e.classList.contains('is-dragging')));await p.mouse.move(center.x,center.y-16);await p.mouse.up();assert((await state()).leg>=5);
  const saved=await state();await p.click('#play');const start=await p.evaluate(()=>window.stagePreview.phase);await p.waitForFunction(v=>Math.abs(window.stagePreview.phase-v)>.1,start);await p.click('#play');
  await p.click('#next');assert(new URL(p.url()).pathname==='/course');await p.click('#previous');await ready();assert.deepEqual(await state(),saved);
  await p.reload();await ready();assert.deepEqual(await state(),saved);assert.deepEqual(body(await state()),bodyBefore);
  report.profiles.push(row);
 }
 report.checks.push('16 handle edits, 8 direct skin drags: both sexes / base and changed body / left and right sources','Leg peak inspection frame and elbow current-frame pause; shared settings affect both sides with +5cm / +10° measured','Drag range clamps, keyboard fine changes, Escape restores original input and phase; body settings untouched','Moving skin can be grabbed to pause; restart plays modified run; step round-trip and reload preserve state','Known occluded male far forearm hidden at side/.04; model-specific visible skin determines other handles');
 await p.click('#front');await seek(.04);await input('leg',0);await input('elbow',0);await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));
 const touch=await p.context().newCDPSession(p);for(const key of ['leg-r','elbow-l']){
  await seek(.04);const c=await point(key),id=key.split('-')[0],before=await snapshot(),scroll=await p.evaluate(()=>scrollY);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[c]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x,y:c.y-24}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert((await state())[id]>before.state[id]);assert.equal(await p.evaluate(()=>scrollY),scroll);
 }
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png'});report.checks.push('390px touch: leg and forearm edits with no canvas scroll or horizontal overflow');
 const saved=await snapshot(),c=await point('leg-r');await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[c]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x,y:c.y-24}]});await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await snapshot(),saved);report.checks.push('Browser touchCancel restores starting value/phase');
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync(`docs/05-validation/reports/pose-editor${base.includes('4173')?'-production':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
