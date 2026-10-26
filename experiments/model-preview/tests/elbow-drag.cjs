const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const nearView=process.env.ELBOW_SIDE==='r'?'right':'side';
const side=process.env.ELBOW_SIDE==='r'?'r':'l',jointId='lowerarm_'+side,handleId=side==='l'?'elbow-handle':'right-elbow-handle';
const output=side==='l'?'outputs/elbow-drag':'outputs/right-elbow-drag';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage();
 const cases=[],errors=[],measurements=[];
 page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.body.dataset.loaded==='true');
 const poseStep=async()=>{if(await page.locator('#next-pose').isVisible())await page.click('#next-pose');};
 const bodyStep=async()=>{if(await page.locator('#previous-body').isVisible())await page.click('#previous-body');};
 const test=async(name,fn)=>{console.log(name);try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:String(e.stack)});throw e;}};
 const state=()=>page.evaluate(side=>{
  const a=window.modelPreview,p=n=>a.bones.find(b=>b.name===n).getWorldPosition(a.camera.position.clone());
  const arm=p('lowerarm_'+side).sub(p('upperarm_'+side)).normalize(),fore=p('hand_'+side).sub(p('lowerarm_'+side)).normalize();
  const joint=p('lowerarm_'+side).project(a.camera),rect=document.getElementById('viewport').getBoundingClientRect();
  return {values:{...a.runningPose.values},angle:arm.angleTo(fore)*180/Math.PI,lengths:a.bodyDimensions.measure(),shoulder:p('upperarm_'+side).toArray(),elbow:p('lowerarm_'+side).toArray(),hand:p('hand_'+side).toArray(),camera:a.camera.position.toArray(),projected:[rect.left+(joint.x+1)*rect.width/2,rect.top+(1-joint.y)*rect.height/2],playing:a.legLiftControls.playing};
 },side);
 const sync=async angle=>page.waitForFunction(([v,id])=>document.getElementById(id).getAttribute('aria-valuenow')===String(v),[angle,handleId]);
 const number=async angle=>{await page.selectOption('#bone',side==='l'?'1':'5');await page.locator('#pose-number').fill(String(angle));await page.locator('#pose-number').dispatchEvent('change');await sync(angle);};
 const begin=async()=>{await page.locator('#'+handleId).waitFor({state:'visible'});const box=await page.locator('#'+handleId).boundingBox();assert(box);const x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();return {x,y};};
 const drag=async dy=>{const p=await begin();await page.mouse.move(p.x,p.y+dy,{steps:8});await page.mouse.up();};
 const maxDiff=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 try{
  await page.goto('http://127.0.0.1:5173');await ready();
  await test('body hides handle; pose shows a joint-anchored handle',async()=>{
   assert(!(await page.locator('#'+handleId).isVisible()));await poseStep();await page.click('[data-view='+nearView+']');await page.locator('#'+handleId).waitFor({state:'visible'});
   const s=await state(),b=await page.locator('#'+handleId).boundingBox();assert(Math.abs(b.x+b.width/2-s.projected[0])<1);assert(Math.abs(b.y+b.height/2-s.projected[1])<1);
  });
  for(const model of ['male','female']){
   await bodyStep();await page.click(`[data-model-type=${model}]`);await ready();await poseStep();
   for(const view of ['front','side','back'])await test(`${model}/${view}: visible-side drag -> physical angle, UI sync, camera/shoulder/length invariants`,async()=>{
    await page.click(`[data-view=${view}]`);await number(80);if(view==='front'||view==='side')await page.click('[data-view='+nearView+']');const before=await state();
    await drag(-40);await sync(100);const after=await state();
    assert.equal(after.values[jointId],100);assert(Math.abs(after.angle-100)<.0001);
    assert.equal(await page.locator('#pose-number').inputValue(),'100');assert.equal(await page.locator('#pose-angle').inputValue(),'100');
    for(const k in before.values)if(k!==jointId)assert.equal(after.values[k],before.values[k]);
    for(const k in before.lengths)assert(Math.abs(after.lengths[k]-before.lengths[k])<.0001);
    assert(maxDiff(before.camera,after.camera)<1e-9);assert(maxDiff(before.shoulder,after.shoulder)<1e-6);assert(maxDiff(before.elbow,after.elbow)<1e-6);assert(maxDiff(before.hand,after.hand)>.01);
    measurements.push({model,view,target:100,measured:after.angle,error:Math.abs(after.angle-100)});
    await drag(80);await sync(60);assert(Math.abs((await state()).angle-60)<.0001);
   });
  }
  await test('numeric edits and min/max drag stay synchronized',async()=>{
   await number(80);await drag(-200);await sync(120);assert.equal((await state()).values[jointId],120);
   await drag(250);await sync(45);assert.equal((await state()).values[jointId],45);await number(90);await sync(90);
  });
  await test('Escape and pointer cancellation restore start; mouse capture releases cleanly',async()=>{
   for(const cancel of ['escape','pointercancel','lostcapture','blur']){
    await number(80);const p=await begin();await page.mouse.move(p.x,p.y-40);await sync(100);
    if(cancel==='escape')await page.keyboard.press('Escape');
    else if(cancel==='blur')await page.evaluate(()=>dispatchEvent(new Event('blur')));
    else await page.locator('#'+handleId).evaluate((el,cancel)=>el.dispatchEvent(new PointerEvent(cancel==='pointercancel'?'pointercancel':'lostpointercapture',{bubbles:true})),cancel);
    await page.mouse.up();await sync(80);assert.equal((await state()).values[jointId],80);
    assert(!(await page.locator('#'+handleId).evaluate(el=>el.classList.contains('is-dragging'))));
   }
  });
  await test('keyboard arrows and endpoints adjust the same joint',async()=>{
   await page.locator('#'+handleId).focus();await page.keyboard.press('ArrowUp');await sync(81);await page.keyboard.press('ArrowDown');await sync(80);
   await page.keyboard.press('Home');await sync(45);await page.keyboard.press('End');await sync(120);
  });
  await test('playback stops on grab; saved pose stays independent; no extra usage event',async()=>{
   await number(80);await page.click('#save-pose');const count=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).length);
   await page.click('#play-lift');const p=await begin();assert(!(await state()).playing);await page.mouse.move(p.x,p.y-40);await page.mouse.up();await sync(100);
   await page.click('#load-pose');await sync(80);assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).length),count);
  });
  await test('empty canvas still orbits after releasing handle',async()=>{
   const before=(await state()).camera,box=await page.locator('#viewport').boundingBox();
   await page.mouse.move(box.x+120,box.y+350);await page.mouse.down();await page.mouse.move(box.x+210,box.y+380,{steps:10});await page.mouse.up();
   assert(maxDiff(before,(await state()).camera)>.01);await page.click('[data-view='+nearView+']');
  });
  await test('returning to body during drag cancels, hides handle and keeps pose',async()=>{
   await number(80);const p=await begin();await page.mouse.move(p.x,p.y-40);await sync(100);
   await page.locator('#previous-body').evaluate(el=>el.click());await page.mouse.up();assert(!(await page.locator('#'+handleId).isVisible()));
   assert.equal((await state()).values[jointId],80);await poseStep();await sync(80);
  });
  await test('body size changes preserve anchor and angle during drag',async()=>{
   await bodyStep();await page.selectOption('#body-part','1');const cm=Number(await page.locator('#part-number').inputValue());
   await page.locator('#part-number').fill((cm*1.05).toFixed(1));await page.locator('#part-number').dispatchEvent('change');
   await page.locator('#body-height').evaluate(el=>{el.value=String(Number(el.value)*1.03);el.dispatchEvent(new Event('input',{bubbles:true}));});
   await poseStep();await number(80);const before=await state();await drag(-30);await sync(95);const after=await state();assert(Math.abs(after.angle-95)<.0001);
   for(const k in before.lengths)assert(Math.abs(after.lengths[k]-before.lengths[k])<.0001);
  });
  await page.click('[data-view='+nearView+']');await number(80);const capture=await begin();await page.mouse.move(capture.x,capture.y-40);await sync(100);
  await page.screenshot({path:output+'/elbow-drag-desktop.png'});await page.mouse.up();
  await test('390px handle drag remains usable with no horizontal page overflow',async()=>{
   await page.setViewportSize({width:390,height:844});await page.locator('#viewport').scrollIntoViewIfNeeded();await number(80);await page.locator('#'+handleId).scrollIntoViewIfNeeded();
   await drag(-30);await sync(95);assert(Math.abs((await state()).angle-95)<.0001);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:output+'/elbow-drag-narrow.png'});await page.setViewportSize({width:1440,height:1050});
  });
  await test('policy change while dragging cancels and blocks further input',async()=>{
   await number(80);const p=await begin();await page.mouse.move(p.x,p.y-30);await sync(95);
   await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.lowerarm.max=95;s.saveSettings(v);});
   await page.waitForFunction(id=>document.getElementById(id).hidden,handleId);await page.mouse.up();assert.equal((await state()).values[jointId],80);
  });
  await test('narrowed policy clamps handle, hidden category suppresses it',async()=>{
   await page.reload();await ready();await poseStep();await page.click('[data-view='+nearView+']');await drag(-100);await sync(95);assert.equal((await state()).values[jointId],95);
   await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.lowerarm.enabled=false;s.saveSettings(v);});
   await page.reload();await ready();await poseStep();assert(!(await page.locator('#'+handleId).isVisible()));
  });
  await test('unsupported asset and loading hide the handle in admin preview',async()=>{
   await page.evaluate(()=>localStorage.removeItem('running-sim.lab.settings.v1'));await page.goto('http://127.0.0.1:5173/?admin-preview=1');assert(!(await page.locator('#'+handleId).isVisible()));
   const original=fs.readFileSync('experiments/model-preview/public/models/runner-male.glb'),length=original.readUInt32LE(12);
   const data=JSON.parse(original.subarray(20,20+length));data.asset.extras={unverifiedDragTest:true};
   const json=Buffer.from(JSON.stringify(data)),body=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(body);
   const tail=original.subarray(20+length),glb=Buffer.alloc(20+body.length+tail.length);original.copy(glb,0,0,20);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(body.length,12);body.copy(glb,20);tail.copy(glb,20+body.length);
   await page.locator('#file').setInputFiles({name:'unverified.glb',mimeType:'model/gltf-binary',buffer:glb});await ready();assert(!(await page.locator('#'+handleId).isVisible()));
  });
  assert.deepEqual(errors,[]);
 }finally{
  const report={testedAt:new Date().toISOString(),browser:await browser.version(),scope:`${side==='l'?'M08 left regression':'M09 right elbow'}, M11 occlusion-aware regression (front/side cases rotate to near side before dragging), real male/female GLB, mouse and keyboard; cancellation events partly injected; 390px desktop viewport not physical touch device`,measurements,cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};
  fs.writeFileSync(side==='l'?'docs/05-validation/reports/elbow-drag.json':'docs/05-validation/reports/right-elbow-drag.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
