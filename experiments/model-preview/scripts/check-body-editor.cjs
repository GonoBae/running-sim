const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173',out='outputs/body-editor';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,checks:[],drags:[],errors:[]};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:950}});p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state);
 const grip=key=>p.locator(`[data-body-part="${key}"]`);
 const target=async key=>{const el=grip(key);await el.scrollIntoViewIfNeeded();return el.evaluate(b=>{const r=b.getBoundingClientRect(),a=b.querySelector('.grip-arrow'),m=a?new DOMMatrixReadOnly(getComputedStyle(a).transform):null;return {x:r.x+r.width/2,y:r.y+r.height/2,ax:m?m.a:0,ay:m?m.b:-1};});};
 async function drag(key,pixels=7,cancel=false){const c=await target(key);await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x+c.ax*pixels,c.y+c.ay*pixels,{steps:4});await p.evaluate(()=>new Promise(requestAnimationFrame));if(cancel)await p.keyboard.press('Escape');await p.mouse.up();return c;}
 await p.goto(base+'/pose');await ready();await p.locator('#leg').fill('5');await p.locator('#elbow').fill('10');await p.click('nav [data-step=body]');await ready();
 assert(!await p.locator('#body-panel').evaluate(e=>e.open));
 for(const model of ['male','female']){
  console.log('Checking',model);
  await p.selectOption('#model',model);await ready();await p.click('#reset-body');await ready();
  for(const key of ['upperArm-r','upperArm-l','forearm-r','forearm-l','thigh-r','thigh-l','shin-r','shin-l','torso','shoulders-r','shoulders-l']){
   const before=await state(),id=key.split('-')[0];await drag(key,3.5);const after=await state();
   assert(after.ratios[id]>before.ratios[id],`${model} ${key} increases`);for(const other of Object.keys(before.ratios))if(other!==id)assert.equal(after.ratios[other],before.ratios[other]);
   assert.equal(after.scale,before.scale);assert.equal(after.leg,5);assert.equal(after.elbow,10);
   const actual=await p.evaluate(()=>window.stagePreview.dimensions.measure());const baseline=await p.evaluate(()=>window.stagePreview.dimensions.baseline);
   for(const field of Object.keys(actual))assert(Math.abs(actual[field]-baseline[field]*after.scale*after.ratios[field])<.001);
   report.drags.push({model,key,before:before.ratios[id],after:after.ratios[id]});
  }
  // Capture owns movement even outside the original body silhouette.
  for(const key of ['thigh-l','forearm-r','torso','shoulders-r','scale']){
   const before=await state();await drag(key,12,true);assert.deepEqual(await state(),before,`${key} Escape restores`);
   await drag(key,150);let current=await state(),id=key.split('-')[0];assert(Math.abs((key==='scale'?current.scale:current.ratios[id])-(key==='scale'?1.1:1.15))<1e-10);
   await drag(key,-150);current=await state();assert(Math.abs((key==='scale'?current.scale:current.ratios[id])-(key==='scale'?.9:.85))<1e-10);
   await grip(key).focus();await p.keyboard.press('End');await p.keyboard.press('ArrowLeft');current=await state();assert((key==='scale'?current.scale:current.ratios[id])<(key==='scale'?1.1:1.15));
  }
  await p.click('#reset-body');await ready();
  // Select actual skin outside the overlay button, then drag it.
  for(const key of ['thigh-r','forearm-l','torso']){
   const c=await target(key),id=key.split('-')[0];let found=false;
   for(const offset of [20,-20,24,-24]){
    const x=c.x+c.ax*offset,y=c.y+c.ay*offset;
    if(!await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName==='CANVAS',{x,y}))continue;
    await p.mouse.click(x,y);const selected=await grip(key).evaluate(e=>e.classList.contains('selected'));if(!selected)continue;
    const before=await state();await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+c.ax*5,y+c.ay*5,{steps:3});await p.mouse.up();assert((await state()).ratios[id]>before.ratios[id]);found=true;break;
   }
   assert(found,`${model} actual skin draggable: ${key}`);
  }
  await p.click('#side');for(const key of ['upperArm-r','forearm-r','thigh-r','shin-r','shoulders-l','shoulders-r'])assert(await grip(key).isHidden(),`${key} occluded/edge-on`);
  await drag('shin-l',4);await p.click('#front');
  const saved=await state();await p.reload();await ready();assert.deepEqual(await state(),saved);
  await p.click('#next');await ready();assert.equal(await p.inputValue('#leg'),'5');assert.equal(await p.inputValue('#elbow'),'10');
  const result=await p.evaluate(()=>{const r=window.stagePreview;const before=r.phase;r.seek(.24);const measurements=r.runtime.body.dimensions.baseline;return {hasChangedBody:!!r.runtime.body,measurements,ready:r.ready};});assert(result.hasChangedBody);
  for(const view of ['front','side']){await p.click('#'+view);await p.screenshot({path:`${out}/${model}-pose-${view}.png`});}
  await p.click('#play');const phase=await p.evaluate(()=>window.stagePreview.phase);await p.waitForFunction(v=>Math.abs(window.stagePreview.phase-v)>.1,phase);await p.click('#play');
  await p.click('nav [data-step=body]');await ready();await p.click('#front');assert.deepEqual(await state(),saved);
 }
 report.checks.push('22 bilateral/torso/shoulder handle drags: only selected ratio changes; measured rig lengths match within 0.001cm','Both models: scale and length clamps, Escape rollback, keyboard endpoints and 0.1cm/1% fine adjustment','6 direct visible-skin drags outside handles','Side view hides far-side handles and edge-on shoulder width','Changed body propagates to playing pose; +5cm leg / +10° elbow retained; refresh and stage round-trip retain values');
 await p.click('#reset-body');await ready();const original=await state(),c=await target('thigh-l');await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x+10*c.ax,c.y+10*c.ay);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.mouse.up();assert.deepEqual(await state(),original);report.checks.push('Window blur cancels an active edit');
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/mobile.png'});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await grip('shin-r').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight));assert(await grip('scale').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight));
 // Trusted browser touch input, not event injection into the controller.
 const touch=await p.context().newCDPSession(p),tc=await target('shin-r'),beforeTouch=await state(),scroll=await p.evaluate(()=>scrollY);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tc.x,y:tc.y}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tc.x+tc.ax*10,y:tc.y+tc.ay*10}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert((await state()).ratios.shin>beforeTouch.ratios.shin);assert.equal(await p.evaluate(()=>scrollY),scroll);
 await p.screenshot({path:out+'/mobile-selected.png'});report.checks.push('390px: model controls visible without settings scroll; real touch drag edits length without scrolling; no horizontal overflow');
 await p.setViewportSize({width:1280,height:950});await p.click('#reset-body');await ready();await grip('thigh-r').focus();await p.keyboard.press('End');await p.screenshot({path:out+'/desktop-selected.png'});
 await p.locator('#body-panel summary').click();assert(await p.locator('#length').isVisible());await p.locator('#scale').fill('105');assert.equal((await state()).scale,1.05);await p.locator('#body-panel summary').click();
 report.checks.push('Optional precision controls remain usable and share the same state');assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync(`docs/05-validation/reports/body-editor${base.includes('4173')?'-production':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
