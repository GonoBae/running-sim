const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),cases=[],errors=[];let measurements;
 const test=async(name,fn)=>{console.log(name);try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:String(e.stack)});throw e;}};
 const loaded=()=>page.waitForFunction(()=>document.body.dataset.referenceLoaded==='true');
 const state=()=>page.evaluate(()=>{const a=window.referenceLegPreview;return {state:a.motion.state,frame:a.motion.frame,quats:a.bones.map(b=>b.quaternion.toArray()),camera:a.camera.position.toArray()};});
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/gait-compare');await loaded();
  await test('Reference samples map to measured left leg, including interpolation and loop seam',async()=>{
   measurements=await page.evaluate(async()=>{
    const a=window.referenceLegPreview,{sampleReferenceLeg,referenceLegData,referenceClosure}=await import('/src/reference-leg-motion.ts');
    const m=a.motion,point=n=>a.bones.find(b=>b.name===n).getWorldPosition(a.camera.position.clone());
    const original=a.bones.map(b=>({name:b.name,q:b.quaternion.toArray(),p:b.position.toArray(),s:b.scale.toArray()}));
    const root=JSON.stringify({p:a.model.position.toArray(),q:a.model.quaternion.toArray(),s:a.model.scale.toArray()}),values=JSON.stringify(a.pose.values);
    const lengths=[point('thigh_l').distanceTo(point('calf_l')),point('calf_l').distanceTo(point('foot_l'))];
    let maxAngleError=0,maxLengthError=0;
    for(let i=0;i<=298;i++){
     const phase=i/298;m.seek(phase);const target=sampleReferenceLeg(phase),got=m.measure();
     maxAngleError=Math.max(maxAngleError,Math.abs(target.thigh-got.thigh),Math.abs(target.knee-got.knee));
     maxLengthError=Math.max(maxLengthError,Math.abs(point('thigh_l').distanceTo(point('calf_l'))-lengths[0]),Math.abs(point('calf_l').distanceTo(point('foot_l'))-lengths[1]));
     for(const [j,b] of a.bones.entries()){
      if(b.name!=='thigh_l'&&b.name!=='calf_l'&&JSON.stringify(b.quaternion.toArray())!==JSON.stringify(original[j].q))throw Error('Another local joint moved: '+b.name);
      if(JSON.stringify(b.position.toArray())!==JSON.stringify(original[j].p)||JSON.stringify(b.scale.toArray())!==JSON.stringify(original[j].s))throw Error('Bone translated or scaled');
     }
     if(root!==JSON.stringify({p:a.model.position.toArray(),q:a.model.quaternion.toArray(),s:a.model.scale.toArray()})||values!==JSON.stringify(a.pose.values))throw Error('Body or editing values changed');
    }
    m.seek(1-.01/referenceLegData.periodMs);const before=point('foot_l');m.seek(.01/referenceLegData.periodMs);const seamDistance=before.distanceTo(point('foot_l'));
    m.stop();const restored=a.bones.every((b,i)=>JSON.stringify(b.quaternion.toArray())===JSON.stringify(original[i].q));
    return {frames:299,maxAngleError,maxLengthError,seamDistance,restored,closure:referenceClosure};
   });
   assert(measurements.maxAngleError<.0001);assert(measurements.maxLengthError<1e-6);assert(measurements.seamDistance<.001);assert(measurements.restored);
   assert(measurements.closure.thigh<.023408&&measurements.closure.knee<.005246);
  });
  await test('Play, pause, resume, scrub and stop restore baseline',async()=>{
   const original=await state();await page.click('#reference-play');await page.waitForTimeout(100);assert.equal((await state()).state,'playing');
   await page.click('#reference-play');const paused=await state();assert.equal(paused.state,'paused');await page.waitForTimeout(80);assert.deepEqual((await state()).quats,paused.quats);
   await page.click('#reference-play');await page.waitForTimeout(80);await page.click('#reference-play');assert.notDeepEqual((await state()).quats,paused.quats);
   await page.locator('#reference-phase').evaluate(el=>{el.value='50';el.dispatchEvent(new Event('input',{bubbles:true}));});
   assert.equal((await state()).frame.phase,.5);assert.equal(await page.locator('#phase-output').textContent(),'50.0%');
   const readings=await page.locator('.readings').innerText();assert(readings.includes('모델'));
   await page.click('#reference-stop');assert.equal((await state()).state,'idle');assert.deepEqual((await state()).quats,original.quats);assert(await page.locator('#reference-stop').isDisabled());
  });
  await test('Hidden tab pauses without auto resume; viewing does not interrupt playback',async()=>{
   await page.click('#reference-play');await page.click('[data-reference-view=front]');assert.equal((await state()).state,'playing');
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal((await state()).state,'paused');
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert.equal((await state()).state,'paused');await page.click('#reference-stop');
  });
  await test('Invalid phase, missing bones and frame failure do not retain a partial pose',async()=>{
   const result=await page.evaluate(async()=>{
    const a=window.referenceLegPreview,{createReferenceLegMotion,sampleReferenceLeg}=await import('/src/reference-leg-motion.ts');
    const serialize=()=>JSON.stringify(a.bones.map(b=>b.quaternion.toArray()));const before=serialize();let invalid=0;
    for(const phase of [-1,1.1,NaN,Infinity])try{a.motion.seek(phase);}catch{invalid++;}
    try{createReferenceLegMotion(a.model,[]);}catch{invalid++;}
    const foot=a.bones.find(b=>b.name==='foot_l'),saved=foot.position.clone();foot.position.set(0,0,0);a.model.updateMatrixWorld(true);
    try{a.motion.seek(.5);}catch{invalid++;}finally{foot.position.copy(saved);a.model.updateMatrixWorld(true);}
    return {invalid,restored:before===serialize(),state:a.motion.state};
   });assert.equal(result.invalid,6);assert(result.restored);assert.equal(result.state,'idle');
  });
  await test('390px layout, keyboard phase adjustment and unselectable page text',async()=>{
   await page.setViewportSize({width:390,height:844});await page.locator('#reference-phase').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.equal((await state()).state,'paused');assert((await state()).frame.phase>0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>getComputedStyle(document.body).userSelect),'none');
   await page.locator('#reference-phase').evaluate(el=>{el.value='72';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});await page.waitForTimeout(200);
   assert(await page.evaluate(()=>{const box=s=>document.querySelector(s).getBoundingClientRect(),h=box('.model-heading'),v=box('#reference-viewport'),b=box('.reference-views');return v.height>200&&v.width<=innerWidth&&b.width<=innerWidth&&h.bottom<=v.top&&v.bottom<=b.top;}));
   fs.mkdirSync('outputs/reference-leg',{recursive:true});await page.screenshot({path:'outputs/reference-leg/narrow.png',fullPage:true});await page.click('#reference-stop');await page.setViewportSize({width:1440,height:1000});await page.click('[data-reference-view=side]');
   await page.locator('#reference-phase').evaluate(el=>{el.value='72';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.screenshot({path:'outputs/reference-leg/desktop.png'});await page.click('#reference-stop');
  });
  await test('Model load failure and hash mismatch block playback',async()=>{
   await page.route('**/models/runner-male.glb',route=>route.fulfill({status:404,body:'missing'}));await page.reload();await page.waitForFunction(()=>document.body.dataset.referenceLoaded==='error');assert(await page.locator('#reference-play').isDisabled());
   await page.unroute('**/models/runner-male.glb');await page.route('**/models/runner-male.glb',route=>route.fulfill({status:200,body:'different file'}));await page.reload();await page.waitForFunction(()=>document.body.dataset.referenceLoaded==='error');assert(await page.locator('#reference-phase').isDisabled());
   await page.unroute('**/models/runner-male.glb');
  });
  await test('Separate tab preserves main pose, snapshot, model and local usage records',async()=>{
   await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>document.body.dataset.loaded==='true');await page.click('#next-pose');
   await page.locator('#pose-number').fill('22');await page.locator('#pose-number').dispatchEvent('change');await page.click('#save-pose');
   const before=await page.evaluate(()=>({values:{...window.modelPreview.runningPose.values},entries:JSON.stringify({...localStorage}),quats:window.modelPreview.bones.map(b=>b.quaternion.toArray())}));
   const popupPromise=page.waitForEvent('popup');await page.locator('#reference-link a').click();const comparison=await popupPromise;await comparison.waitForFunction(()=>document.body.dataset.referenceLoaded==='true');await comparison.click('#reference-play');await comparison.waitForTimeout(100);await comparison.click('#reference-stop');await comparison.close();
   const after=await page.evaluate(()=>({values:{...window.modelPreview.runningPose.values},entries:JSON.stringify({...localStorage}),quats:window.modelPreview.bones.map(b=>b.quaternion.toArray())}));assert.deepEqual(after,before);assert(!(await page.locator('#load-pose').isDisabled()));
  });
  assert.deepEqual(errors,[]);
 }finally{
  const report={testedAt:new Date().toISOString(),scope:'M13 fixed male GLB, two left-leg angles only; no ground contact or full-body biomechanics validation',measurements,cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};
  fs.writeFileSync('docs/05-validation/reports/reference-leg.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
