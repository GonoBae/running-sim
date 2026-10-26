const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const output='outputs/setup-steps';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();
 const cases=[],errors=[];let modelRequests=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.glb'))modelRequests++;});
 const test=async(name,fn)=>{console.log(name);try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:String(e.stack)});throw e;}};
 const ready=()=>page.waitForFunction(()=>document.body.dataset.loaded==='true');
 const state=()=>page.evaluate(()=>{const a=window.modelPreview;return {model:a.model.uuid,pose:{...a.runningPose.values},lengths:a.bodyDimensions.measure(),scale:a.model.scale.toArray(),camera:a.camera.position.toArray(),height:document.getElementById('body-height').value,playing:a.legLiftControls.playing};});
 const events=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).length);
 try{
  await page.goto('http://127.0.0.1:5173');await ready();
  await test('initial body step exposes only body controls and indicates course pending',async()=>{
   assert(await page.locator('#body-panel').isVisible());assert(!(await page.locator('#pose-panel').isVisible()));
   assert(await page.locator('#length-section').isVisible());assert(!(await page.locator('#pose-number').isVisible()));
   assert.equal(await page.locator('[aria-current=step]').getAttribute('data-setup-indicator'),'body');
   assert(await page.locator('#next-course').isDisabled());await page.screenshot({path:output+'/body-step.png'});
  });
  for(const type of ['male','female']){
   await page.click(`[data-model-type=${type}]`);await ready();
   await test(`${type}: body -> pose -> body preserves model, body, camera and editing values without reload/events`,async()=>{
    await page.selectOption('#body-part','2');const length=Number(await page.locator('#part-number').inputValue());
    await page.locator('#part-number').fill((length*1.05).toFixed(1));await page.locator('#part-number').dispatchEvent('change');
    await page.locator('#body-height').evaluate(el=>{el.value=String(Number(el.value)*1.02);el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.click('[data-view=side]');const before=await state(),requests=modelRequests,count=await events();
    await page.click('#next-pose');assert(await page.locator('#pose-panel').isVisible());assert(!(await page.locator('#body-panel').isVisible()));
    assert.equal(await page.locator('#lift-angle').inputValue(),await page.locator('#lift-number').inputValue());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'setup-title');
    let after=await state();assert.equal(after.model,before.model);assert.deepEqual(after.pose,before.pose);assert.deepEqual(after.scale,before.scale);assert.equal(after.height,before.height);
    for(const k in before.lengths)assert(Math.abs(after.lengths[k]-before.lengths[k])<.0001);
    assert(Math.max(...before.camera.map((v,i)=>Math.abs(v-after.camera[i])))<1e-9);
    await page.locator('#pose-number').fill('20');await page.locator('#pose-number').dispatchEvent('change');await page.click('#save-pose');
    const saved=(await state()).pose;await page.click('#previous-body');await page.click('#next-pose');
    assert.deepEqual((await state()).pose,saved);await page.locator('#pose-number').fill('10');await page.locator('#pose-number').dispatchEvent('change');await page.click('#load-pose');assert.deepEqual((await state()).pose,saved);
    assert.equal(modelRequests,requests);assert.equal(await events(),count);await page.click('#previous-body');
   });
  }
  await test('back during playback stops and restores pose; re-entry remains stopped',async()=>{
   await page.click('#next-pose');const before=await state();await page.click('#play-lift');await page.waitForFunction(()=>window.modelPreview.legLiftControls.playing);
   await page.click('#previous-body');assert(!(await state()).playing);assert.deepEqual((await state()).pose,before.pose);
   await page.click('#next-pose');assert(!(await state()).playing);assert.equal(await page.locator('#lift-number').inputValue(),'30');
   await page.locator('#setup-title').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/pose-step.png'});
  });
  await test('390px keyboard navigation, focus and panel visibility',async()=>{
   await page.setViewportSize({width:390,height:844});await page.locator('#previous-body').focus();await page.keyboard.press('Enter');
   assert(await page.locator('#body-panel').isVisible());await page.locator('#next-pose').focus();await page.keyboard.press('Enter');
   assert(await page.locator('#pose-panel').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.id),'setup-title');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/pose-step-narrow.png'});
   await page.click('#previous-body');await page.setViewportSize({width:1440,height:1050});
  });
  await test('in-flight load and load error block next; successful recovery enables it',async()=>{
   let release,seen;const gate=new Promise(r=>release=r),started=new Promise(r=>seen=r);
   await page.route('**/models/runner-male.glb',async route=>{seen();await gate;await route.abort();});await page.click('[data-model-type=male]');await started;
   try{assert(await page.locator('#next-pose').isDisabled());}finally{release();}
   await page.waitForFunction(()=>document.body.dataset.loaded==='error');assert(await page.locator('#next-pose').isDisabled());
   await page.unroute('**/models/runner-male.glb');await page.click('[data-model-type=male]');await ready();assert(!(await page.locator('#next-pose').isDisabled()));
  });
  await test('stale or corrupt policy blocks next even without an external event',async()=>{
   const original=await page.evaluate(()=>localStorage.getItem('running-sim.lab.settings.v1'));
   await page.evaluate(async()=>{const s=await import('/src/settings.ts');s.saveSettings(s.readSettings());});
   await page.click('#next-pose');assert(await page.locator('#body-panel').isVisible());assert(await page.locator('#next-pose').isDisabled());
   await page.evaluate(original=>{if(original===null)localStorage.removeItem('running-sim.lab.settings.v1');else localStorage.setItem('running-sim.lab.settings.v1',original);dispatchEvent(new Event('focus'));},original);
   await page.evaluate(()=>localStorage.setItem('running-sim.lab.settings.v1','{'));await page.click('#next-pose');assert(await page.locator('#body-panel').isVisible());
  });
  await test('admin preview retains combined controls and hides user navigation',async()=>{
   const admin=await context.newPage();await admin.goto('http://127.0.0.1:5173/?admin-preview=1');
   // Restore valid settings first: admin uses this same test profile.
   await admin.evaluate(()=>localStorage.removeItem('running-sim.lab.settings.v1'));await admin.reload();await admin.waitForFunction(()=>document.body.dataset.setupStep==='admin');
   await admin.locator('#file').setInputFiles('experiments/model-preview/public/models/runner-male.glb');await admin.waitForFunction(()=>document.body.dataset.loaded==='true');
   assert(await admin.locator('#body-panel').isVisible());assert(await admin.locator('#pose-panel').isVisible());assert(!(await admin.locator('#setup-progress').isVisible()));assert(!(await admin.locator('#next-pose').isVisible()));
   await admin.close();
  });
  await test('admin-hidden height/length controls stay hidden across navigation',async()=>{
   await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.heightEnabled=false;for(const k in v.lengths)v.lengths[k]=false;s.saveSettings(v);});
   await page.reload();await ready();assert(!(await page.locator('#height-section').isVisible()));assert(!(await page.locator('#length-section').isVisible()));
   await page.click('#next-pose');await page.click('#previous-body');assert(!(await page.locator('#height-section').isVisible()));assert(!(await page.locator('#length-section').isVisible()));
  });
  assert.deepEqual(errors,[]);
 }finally{
  const report={testedAt:new Date().toISOString(),browser:await browser.version(),scope:'Two user steps on same page; real male/female GLB; 390px desktop viewport, not mobile device; course not implemented; joint dragging covered in separate M08 suite',cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};
  fs.writeFileSync('docs/05-validation/reports/setup-steps.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
