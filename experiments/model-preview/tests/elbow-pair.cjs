const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),cases=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const test=async(name,fn)=>{try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:String(e.stack)});throw e;}};
 const id=side=>side==='l'?'elbow-handle':'right-elbow-handle';
 const pose=()=>page.evaluate(()=>({...window.modelPreview.runningPose.values}));
 const begin=async side=>{await page.locator('#'+id(side)).waitFor({state:'visible'});const b=await page.locator('#'+id(side)).boundingBox();const p={x:b.x+b.width/2,y:b.y+b.height/2};await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
 const drag=async(side,dy)=>{const p=await begin(side);await page.mouse.move(p.x,p.y+dy,{steps:5});await page.mouse.up();};
 try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.dataset.loaded==='true');await page.click('#next-pose');await page.click('[data-view=back]');
  await test('left and right edits remain independent and snapshot restores both',async()=>{
   await drag('l',30);await drag('r',-40);let p=await pose();assert.equal(p.lowerarm_l,65);assert.equal(p.lowerarm_r,100);
   assert.equal(await page.locator('#bone').inputValue(),'5');assert.equal(await page.locator('#pose-number').inputValue(),'100');await page.click('#save-pose');
   await drag('l',-20);await drag('r',40);await page.click('#load-pose');assert.deepEqual(await pose(),p);
  });
  await test('right cancellation preserves previously committed left angle',async()=>{
   const before=await pose(),p=await begin('r');await page.mouse.move(p.x,p.y+40);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await pose(),before);
  });
  await test('single drag lock rejects competing pointer/keyboard input and releases camera',async()=>{
   const before=await pose(),p=await begin('l');await page.mouse.move(p.x,p.y-20);
   await page.locator('#right-elbow-handle').evaluate(el=>{
    el.dispatchEvent(new PointerEvent('pointerdown',{button:0,pointerId:99,isPrimary:true,bubbles:true}));
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
   });
   assert.equal((await pose()).lowerarm_r,before.lowerarm_r);assert.equal(await page.locator('.is-dragging').count(),1);
   await page.mouse.up();await drag('r',20);assert.equal((await pose()).lowerarm_r,before.lowerarm_r-10);
   const camera=await page.evaluate(()=>window.modelPreview.camera.position.toArray());
   await page.mouse.move(120,400);await page.mouse.down();await page.mouse.move(210,440,{steps:6});await page.mouse.up();
   assert.notDeepEqual(await page.evaluate(()=>window.modelPreview.camera.position.toArray()),camera);
  });
  await test('M11 side view hides rear elbow; near-side views allow independent edits without separation',async()=>{
   await page.click('[data-view=side]');await page.waitForFunction(()=>document.getElementById('right-elbow-handle').hidden);
   assert(await page.locator('#elbow-handle').isVisible());assert.equal(await page.locator('.separated-handle').count(),0);
   const before=await pose();await drag('l',-10);await page.click('[data-view=right]');await page.waitForFunction(()=>document.getElementById('elbow-handle').hidden);await drag('r',-10);const after=await pose();assert.equal(after.lowerarm_l,before.lowerarm_l+5);assert.equal(after.lowerarm_r,before.lowerarm_r+5);
   fs.mkdirSync('outputs/right-elbow-drag',{recursive:true});await page.screenshot({path:'outputs/right-elbow-drag/elbow-pair.png'});
   // Sweep near the side view: the rear joint must remain hidden, not shift sideways.
   for(const offset of [-.06,-.03,.03,.06]){
    await page.click('[data-view=side]');
    await page.evaluate(offset=>{
     const c=window.modelPreview.camera;
     c.position.applyAxisAngle({x:0,y:1,z:0},offset);c.lookAt(0,1,0);
    },offset);
    await page.waitForTimeout(100);
    assert(await page.locator('#right-elbow-handle').evaluate(el=>el.hidden));
    assert.equal(await page.locator('.separated-handle').count(),0);
   }
  });
  assert.deepEqual(errors,[]);
 }finally{
  const report={testedAt:new Date().toISOString(),browser:await browser.version(),scope:'M09 pair regression with M11 occlusion replacing separation, male GLB; competing pointer/keyboard injected; normal mouse drag and camera orbit',cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};
  fs.writeFileSync('docs/05-validation/reports/elbow-pair.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
