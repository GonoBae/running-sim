const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out='outputs/body-picking';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),cases=[],errors=[],measurements=[];
 page.on('pageerror',e=>errors.push(e.message));
 const test=async(name,fn)=>{console.log(name);try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:String(e.stack)});throw e;}};
 const ready=()=>page.waitForFunction(()=>document.body.dataset.loaded==='true');
 const view=async side=>{await page.click(`[data-view=${side}]`);await page.waitForTimeout(80);};
 const angle=async value=>{await page.selectOption('#bone','5');await page.locator('#pose-number').fill(String(value));await page.locator('#pose-number').dispatchEvent('change');};
 const state=()=>page.evaluate(()=>{const a=window.modelPreview,p=n=>a.bones.find(b=>b.name===n).getWorldPosition(a.camera.position.clone());const u=p('lowerarm_r').sub(p('upperarm_r')),v=p('hand_r').sub(p('lowerarm_r'));return {values:{...a.runningPose.values},camera:a.camera.position.toArray(),lengths:a.bodyDimensions.measure(),angle:u.angleTo(v)*180/Math.PI,hidden:[document.getElementById('elbow-handle').hidden,document.getElementById('right-elbow-handle').hidden]};});
 const point=async(t=.55,side='r')=>page.evaluate(({t,side})=>{const a=window.modelPreview,p=n=>a.bones.find(b=>b.name===n).getWorldPosition(a.camera.position.clone()),v=p('lowerarm_'+side).lerp(p('hand_'+side),t).project(a.camera),r=document.querySelector('canvas').getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};},{t,side});
 const begin=async(kind='surface')=>{const r=kind==='surface'?await point():await page.locator('#right-elbow-handle').boundingBox();const p=kind==='surface'?r:{x:r.x+r.width/2,y:r.y+r.height/2};await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
 const drag=async(dy,kind='surface')=>{const p=await begin(kind);await page.mouse.move(p.x,p.y+dy,{steps:8});await page.mouse.up();};
 try{
  await page.goto('http://127.0.0.1:5173');await ready();
  for(const sex of ['male','female']){
   if(await page.locator('#previous-body').isVisible())await page.click('#previous-body');await page.click(`[data-model-type=${sex}]`);await ready();await page.click('#next-pose');
   await test(`${sex}: opposite elbow hidden, near elbow visible at actual joint without separation`,async()=>{
    await view('side');assert.deepEqual((await state()).hidden,[false,true]);await page.screenshot({path:`${out}/${sex}-left-view.png`});
    await view('right');assert.deepEqual((await state()).hidden,[true,false]);assert.equal(await page.locator('.separated-handle').count(),0);
    const p=await point(0),r=await page.locator('#right-elbow-handle').boundingBox();assert(Math.hypot(p.x-r.x-r.width/2,p.y-r.y-r.height/2)<1);
    await page.screenshot({path:`${out}/${sex}-right-view.png`});
   });
   await test(`${sex}: surface click selects and highlights only visible right forearm`,async()=>{
    const before=await state(),p=await point();await page.mouse.move(p.x,p.y);await page.waitForFunction(()=>document.getElementById('viewport').dataset.hoverPart==='right-forearm');await page.mouse.click(p.x,p.y);
    assert.equal(await page.locator('#bone').inputValue(),'5');await page.waitForFunction(()=>document.getElementById('viewport').dataset.selectedPart==='right-forearm');assert.deepEqual((await state()).values,before.values);
    assert(await page.evaluate(()=>{let yes=false;window.modelPreview.model.traverse(n=>{if(n.userData.selectionOverlay&&n.visible)yes=n.material.depthTest&&!n.material.depthWrite;});return yes;}));
   });
   await test(`${sex}: surface and point drag produce same angle, preserve camera/other values/lengths`,async()=>{
    await angle(80);const before=await state();await drag(-40);const surface=await state();assert.equal(surface.values.lowerarm_r,100);assert(Math.abs(surface.angle-100)<.0001);
    assert.deepEqual(surface.camera,before.camera);for(const id in before.values)if(id!=='lowerarm_r')assert.equal(surface.values[id],before.values[id]);for(const id in before.lengths)assert(Math.abs(surface.lengths[id]-before.lengths[id])<.0001);
    await page.screenshot({path:`${out}/${sex}-surface.png`});await angle(80);await drag(-40,'point');const dot=await state();assert.deepEqual(dot.values,surface.values);assert(Math.abs(dot.angle-surface.angle)<.0001);measurements.push({model:sex,surfaceAngle:surface.angle,dotAngle:dot.angle});
   });
   await test(`${sex}: surface clamps at range endpoints and Escape/cancel restore starting angle`,async()=>{
    await angle(80);await drag(-180);assert.equal((await state()).values.lowerarm_r,120);await drag(240);assert.equal((await state()).values.lowerarm_r,45);
    for(const cancel of ['Escape','pointercancel','blur']){
     await angle(80);const before=await state(),p=await begin();await page.mouse.move(p.x,p.y-40);assert.equal((await state()).values.lowerarm_r,100);
     if(cancel==='Escape')await page.keyboard.press('Escape');else if(cancel==='blur')await page.evaluate(()=>dispatchEvent(new Event('blur')));else await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.deepEqual((await state()).values,before.values);
    }
   });
   await test(`${sex}: torso occlusion rejects through-body forearm selection; nearest non-target surface stays orbitable`,async()=>{
    await page.evaluate(()=>{const p=window.modelPreview.runningPose;p.set('upperarm_r',0);p.set('lowerarm_r',45);});await view('side');assert((await state()).hidden[1]);
    const p=await point(),before=await state();await page.mouse.move(p.x,p.y);await page.waitForTimeout(80);assert.notEqual(await page.locator('#viewport').getAttribute('data-hover-part'),'right-forearm');
    await page.mouse.down();await page.mouse.move(p.x+25,p.y-15,{steps:4});await page.mouse.up();const after=await state();assert.deepEqual(after.values,before.values);assert.notDeepEqual(after.camera,before.camera);
    await page.screenshot({path:`${out}/${sex}-occluded.png`});await page.click('#reset-pose');await view('right');
   });
  }
  await test('snapshot independent, drag cancellation on step navigation, camera released',async()=>{
   await angle(80);await page.click('#save-pose');await drag(-40);await page.click('#load-pose');assert.equal((await state()).values.lowerarm_r,80);
   const p=await begin();await page.mouse.move(p.x,p.y-40);await page.locator('#previous-body').evaluate(el=>el.click());await page.mouse.up();assert.equal((await state()).values.lowerarm_r,80);assert(!(await page.locator('#right-elbow-handle').isVisible()));
   await page.click('#next-pose');await view('right');const before=await state();await page.mouse.move(120,400);await page.mouse.down();await page.mouse.move(210,440,{steps:6});await page.mouse.up();assert.notDeepEqual((await state()).camera,before.camera);
  });
  await test('basic run and pause block picking; edit mode re-enables; legacy playback stops on grab',async()=>{
   await view('right');await page.click('#play-run');assert(!(await page.locator('#right-elbow-handle').isVisible()));await page.click('#play-run');const before=await state(),p=await point();await page.mouse.click(p.x,p.y);assert.deepEqual((await state()).values,before.values);assert.equal(await page.locator('#viewport').getAttribute('data-selected-part'),'');
   await page.click('#edit-run');await view('right');await page.click('#play-lift');const q=await begin();assert(!(await page.evaluate(()=>window.modelPreview.legLiftControls.playing)));await page.mouse.up();await page.mouse.move(q.x+100,q.y+100);
  });
  await test('changed shape updates surface and occlusion bounds without changing bone length on drag',async()=>{
   await page.click('#previous-body');await page.selectOption('#body-part','1');const cm=Number(await page.locator('#part-number').inputValue());await page.locator('#part-number').fill((cm*1.1).toFixed(1));await page.locator('#part-number').dispatchEvent('change');await page.click('#next-pose');await view('right');await angle(80);const before=await state();await drag(-30);assert.equal((await state()).values.lowerarm_r,95);for(const id in before.lengths)assert(Math.abs((await state()).lengths[id]-before.lengths[id])<.0001);
  });
  await test('390px surface drag, view buttons and numeric fallback fit viewport',async()=>{
   await page.setViewportSize({width:390,height:844});await view('right');await angle(80);await page.locator('canvas').scrollIntoViewIfNeeded();await drag(-30);assert.equal((await state()).values.lowerarm_r,95);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const nav=await page.locator('.views').boundingBox();assert(nav.x>=0&&nav.x+nav.width<=390);await page.screenshot({path:out+'/narrow.png',fullPage:true});await page.setViewportSize({width:1440,height:1050});
  });
  await test('policy change cancels captured surface drag and hides/blocks interaction',async()=>{
   await view('right');await angle(80);const p=await begin();await page.mouse.move(p.x,p.y-40);
   await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.lowerarm.max=95;s.saveSettings(v);});await page.waitForFunction(()=>document.getElementById('right-elbow-handle').hidden);await page.mouse.up();assert.equal((await state()).values.lowerarm_r,80);
   await page.reload();await ready();await page.click('#next-pose');await view('right');await drag(-100);assert.equal((await state()).values.lowerarm_r,95);
   await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.lowerarm.enabled=false;s.saveSettings(v);});await page.reload();await ready();await page.click('#next-pose');await view('right');const before=await state(),q=await point();await page.mouse.click(q.x,q.y);assert.deepEqual((await state()).values,before.values);assert(await page.locator('#right-elbow-handle').evaluate(el=>el.hidden));
  });
  assert.deepEqual(errors,[]);
 }finally{
  const report={testedAt:new Date().toISOString(),browser:await browser.version(),scope:'M11 real male/female GLB, right forearm surface vs elbow handle, skinned occlusion; mouse/keyboard, injected cancellation/policy events, 390px desktop not real touch device',measurements,cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};fs.writeFileSync('docs/05-validation/reports/body-picking.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
