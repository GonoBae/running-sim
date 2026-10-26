const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),results=[];
 try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.dataset.loaded==='true');
  for(const model of ['male','female']){
   await page.click(`[data-model-type=${model}]`);await page.waitForFunction(()=>document.body.dataset.loaded==='true');
   const r=await page.evaluate(async()=>{
    const a=window.modelPreview,{createBasicRunMotion,basicRunPeriodMs}=await import('/src/basic-run-motion.ts');
    const {Vector3}=await import('/node_modules/three/build/three.module.js');
    const m=createBasicRunMotion(a.runningPose,a.model,a.bones,a.scene.children.find(c=>c.type==='GridHelper').position.y+.005);
    const original={root:a.model.position.toArray(),q:a.bones.map(b=>b.quaternion.toArray()),values:{...a.runningPose.values}};
    const p=n=>a.bones.find(b=>b.name===n).getWorldPosition(new Vector3());
    let lastContact,anchor,previous,previousDy=0,maxSlip=0,minHeight=Infinity,maxStep=0,maxVerticalStep=0,maxVelocityChange=0,minForwardStep=Infinity,flightSamples=0,flightClear=0,interiorFlight=0,interiorClear=0;
    let previousPelvis,minPelvis=Infinity,maxPelvis=-Infinity,maxFallSpeed=0;const heightTrace=[];
    m.start(0);
    for(let ms=0;ms<=basicRunPeriodMs*2;ms++){
     m.tick(ms);const c=m.contact,root=a.model.position.clone(),heights=m.footHeights;
     const pelvisY=p('pelvis').y;minPelvis=Math.min(minPelvis,pelvisY);maxPelvis=Math.max(maxPelvis,pelvisY);
     if(previousPelvis!==undefined)maxFallSpeed=Math.max(maxFallSpeed,(previousPelvis-pelvisY)*1000);
     previousPelvis=pelvisY;if(ms<=basicRunPeriodMs&&ms%3===0)heightTrace.push({ms,y:pelvisY});
     if(c!=='flight'){
      const toe=p('ball_'+c);if(c===lastContact)maxSlip=Math.max(maxSlip,Math.hypot(toe.x-anchor.x,toe.z-anchor.z));else anchor=toe;
     }else{flightSamples++;if(Math.min(heights.left,heights.right)>.001)flightClear++;const u=m.frame.phase%.5;if(u>.34&&u<.48){interiorFlight++;if(Math.min(heights.left,heights.right)>.001)interiorClear++;}}
     lastContact=c;minHeight=Math.min(minHeight,heights.left,heights.right);
     if(previous){const dy=root.y-previous.y;maxVerticalStep=Math.max(maxVerticalStep,Math.abs(dy));if(ms>1)maxVelocityChange=Math.max(maxVelocityChange,Math.abs(dy-previousDy));previousDy=dy;maxStep=Math.max(maxStep,root.distanceTo(previous));minForwardStep=Math.min(minForwardStep,root.z-previous.z);}
     previous=root;
    }
    const stepLength=m.stepLength;
    m.stop();const restored=JSON.stringify(original)===JSON.stringify({root:a.model.position.toArray(),q:a.bones.map(b=>b.quaternion.toArray()),values:{...a.runningPose.values}});
    const at=step=>{m.start(0);for(let t=step;t<333;t+=step)m.tick(t);m.tick(333);const s={p:a.model.position.toArray(),q:a.bones.map(b=>b.quaternion.toArray())};m.stop();return s;};
    return {frames:1561,stepLength,maxSlip,minHeight,maxStep,maxVerticalStep,maxVelocityChange,minForwardStep,flightSamples,flightClear,interiorFlight,interiorClear,excursion:maxPelvis-minPelvis,maxFallSpeed,heightTrace,restored,rateIndependent:JSON.stringify(at(1000/30))===JSON.stringify(at(1000/144))};
   });
   results.push({model,...r});console.log(model,JSON.stringify({...r,heightTrace:undefined}));
   assert(r.maxSlip<1e-6);assert(r.minHeight>-.001);assert(r.maxStep<.003);assert(r.maxVerticalStep<.002);assert(r.maxVelocityChange<.0003);
   assert(r.minForwardStep>0);assert(r.interiorFlight>0&&r.interiorClear===r.interiorFlight);assert(r.restored&&r.rateIndependent);
   // Regression limits for the default fixtures, not physiological running standards.
   assert(r.excursion<.03,'pelvis excursion must stay below 3cm');assert(r.maxFallSpeed<.5,'pelvis descent must stay below 0.5m/s');
  }
  await page.click('#next-pose');const before=await page.evaluate(()=>{const a=window.modelPreview;return {camera:a.camera.position.toArray(),grid:a.scene.children.find(c=>c.type==='GridHelper').position.toArray()};});
  await page.click('#play-run');await page.waitForTimeout(350);await page.click('#play-run');
  const paused=await page.evaluate(()=>{const a=window.modelPreview;return {camera:a.camera.position.toArray(),root:a.model.position.toArray(),grid:a.scene.children.find(c=>c.type==='GridHelper').position.toArray()};});
  assert(paused.camera[2]>before.camera[2]);await page.waitForTimeout(70);
  assert.deepEqual(await page.evaluate(()=>window.modelPreview.model.position.toArray()),paused.root);
  await page.click('[data-view=side]');await page.click('#reset-run');await page.click('#edit-run');
  const after=await page.evaluate(()=>{const a=window.modelPreview;return {grid:a.scene.children.find(c=>c.type==='GridHelper').position.toArray(),state:a.basicRunControls.state};});
  assert.equal(after.state,'idle');assert.deepEqual(after.grid,before.grid);
  results.push({test:'camera follows; pause holds world position; view/reset/edit restores ground',passed:true});
 }finally{
  fs.writeFileSync('docs/05-validation/reports/run-contact.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M17 default male/female pelvis height regression plus M16 contact/forward/camera checks; not full sole-contact or biomechanics validation',results},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
