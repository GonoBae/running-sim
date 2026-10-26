const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out='outputs/basic-run';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),cases=[],errors=[],measurements=[];
 page.on('pageerror',e=>errors.push(e.message));
 const test=async(name,fn)=>{console.log(name);try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:String(e.stack)});throw e;}};
 const ready=()=>page.waitForFunction(()=>document.body.dataset.loaded==='true');
 const state=()=>page.evaluate(()=>{const a=window.modelPreview;return {values:{...a.runningPose.values},root:a.model.position.toArray(),rotation:a.model.quaternion.toArray(),bones:a.bones.map(b=>b.quaternion.toArray()),state:a.basicRunControls.state,phase:a.basicRunControls.frame?.phase,camera:a.camera.position.toArray()};});
 const start=async()=>{await page.click('#play-run');await page.waitForFunction(()=>window.modelPreview.basicRunControls.playing);};
 try{
  await page.goto('http://127.0.0.1:5173');await ready();
  await test('source timing, opposite arm swing and policy checks match the revised cycle',async()=>{
   const result=await page.evaluate(async()=>{
    const {sampleBasicRun,basicRunPeriodMs,basicRunAvailable}=await import('/src/basic-run-motion.ts');
    const {referenceLegData}=await import('/src/reference-leg-motion.ts');
    let maxKnee=0,peak=0;
    for(let i=0;i<150;i++){const f=sampleBasicRun(i/149*basicRunPeriodMs);if(f.values.calf_l>maxKnee){maxKnee=f.values.calf_l;peak=i/149;}}
    const v=sampleBasicRun(.86*basicRunPeriodMs).values,p=window.modelPreview.runningPose;
    const policy=max=>({...p,definitions:p.definitions.map(j=>j.id.startsWith('calf_')?{...j,max}:j)});
    return {period:basicRunPeriodMs,maxKnee,sourceMax:Math.max(...referenceLegData.curves.knee),peak,opposite:v.upperarm_l<-19&&v.upperarm_r>23,allows71:basicRunAvailable(policy(71)),blocks70:!basicRunAvailable(policy(70))};
   });
   assert.equal(result.period,780);assert(Math.abs(result.maxKnee-result.sourceMax)<1e-8);assert(result.peak>.71&&result.peak<.73);assert(result.opposite&&result.allows71&&result.blocks70);
  });
  for(const sex of ['male','female']){
   if(await page.locator('#previous-body').isVisible())await page.click('#previous-body');await page.click(`[data-model-type=${sex}]`);await ready();await page.click('#next-pose');
   await test(`${sex}: real rig cycle, flexion, bone lengths, skin clearance, wrap continuity and restoration`,async()=>{
    const result=await page.evaluate(async()=>{
     const a=window.modelPreview,{createBasicRunMotion,sampleBasicRun,basicRunAvailable,basicRunPeriodMs}=await import('/src/basic-run-motion.ts');
     const {sampleReferenceLeg}=await import('/src/reference-leg-motion.ts');
     const {Box3}=await import('/node_modules/three/build/three.module.js');
     const floor=a.scene.children.find(c=>c.type==='GridHelper').position.y+.005;
     const pose=a.runningPose,values=JSON.stringify(pose.values),positions=JSON.stringify(a.bones.map(b=>b.position.toArray())),rotations=JSON.stringify(a.bones.map(b=>b.quaternion.toArray())),root=a.model.position.toArray(),rotation=a.model.quaternion.toArray();
     const point=name=>a.bones.find(b=>b.name===name).getWorldPosition(a.camera.position.clone());
     const edges=['l','r'].flatMap(s=>[['upperarm','lowerarm'],['lowerarm','hand'],['thigh','calf'],['calf','foot']].map(([x,y])=>[x+'_'+s,y+'_'+s]));
     const lengths=edges.map(([x,y])=>point(x).distanceTo(point(y)));
     const gap=name=>point(name+'_l').x-point(name+'_r').x;
     const initialGap={hip:gap('thigh'),knee:gap('calf'),ankle:gap('foot')};
     const motion=createBasicRunMotion(pose,a.model,a.bones,floor);if(!motion.start(0))throw Error('Run unavailable');
     let maxReferenceError=0,maxLengthError=0,maxFlexError=0,minSkinHeight=Infinity,maxStepRotation=0,maxStepPosition=0,maxFrameMs=0;
     let minKneeGap=Infinity,minAnkleGap=Infinity;
     let prev=null;const sampled=[];
     for(let ms=0;ms<=basicRunPeriodMs;ms+=6){
      const start=performance.now();motion.tick(ms);maxFrameMs=Math.max(maxFrameMs,performance.now()-start);
      const frame=motion.frame;
      for(const [side,offset] of [['l',0],['r',.5]]){
       const ref=sampleReferenceLeg((frame.phase+offset)%1),leg=point('calf_'+side).sub(point('thigh_'+side)),shin=point('foot_'+side).sub(point('calf_'+side));
       maxReferenceError=Math.max(maxReferenceError,Math.abs(Math.atan2(leg.z,-leg.y)*180/Math.PI-ref.thigh),Math.abs(leg.angleTo(shin)*180/Math.PI-ref.knee));
      }
      minKneeGap=Math.min(minKneeGap,gap('calf'));minAnkleGap=Math.min(minAnkleGap,gap('foot'));
      for(const [i,[x,y]] of edges.entries())maxLengthError=Math.max(maxLengthError,Math.abs(point(x).distanceTo(point(y))-lengths[i]));
      for(const side of ['l','r'])for(const [x,y,z,id] of [['upperarm','lowerarm','hand','lowerarm'],['thigh','calf','foot','calf']]){
       const u=point(y+'_'+side).sub(point(x+'_'+side)),v=point(z+'_'+side).sub(point(y+'_'+side));
       maxFlexError=Math.max(maxFlexError,Math.abs(u.angleTo(v)*180/Math.PI-frame.values[id+'_'+side]));
      }
      for(const j of pose.definitions)if(frame.values[j.id]<j.min-1e-8||frame.values[j.id]>j.max+1e-8)throw Error('Policy exceeded');
      if(ms%78===0){const box=new Box3().setFromObject(a.model,true);minSkinHeight=Math.min(minSkinHeight,box.min.y-floor);sampled.push({ms,feet:motion.footHeights,root:a.model.position.toArray()});}
      const now=a.bones.map(b=>b.getWorldQuaternion(a.model.quaternion.clone()));
      if(prev){for(let i=0;i<now.length;i++)maxStepRotation=Math.max(maxStepRotation,prev.q[i].angleTo(now[i]));maxStepPosition=Math.max(maxStepPosition,prev.p.distanceTo(a.model.position));}
      prev={q:now,p:a.model.position.clone()};
      if(JSON.stringify(pose.values)!==values)throw Error('Editing values changed');
     }
     motion.tick(2*basicRunPeriodMs-.01);const before=a.bones.map(b=>b.getWorldPosition(a.camera.position.clone()));
     motion.tick(2*basicRunPeriodMs+.01);let boundaryDistance=0;for(let i=0;i<a.bones.length;i++)boundaryDistance=Math.max(boundaryDistance,before[i].distanceTo(a.bones[i].getWorldPosition(a.camera.position.clone())));
     motion.pause(2*basicRunPeriodMs+10);const paused=JSON.stringify(a.bones.map(b=>b.quaternion.toArray()));motion.tick(2000);const pauseStable=paused===JSON.stringify(a.bones.map(b=>b.quaternion.toArray()));
     motion.stop();
     const restored=JSON.stringify(a.bones.map(b=>b.quaternion.toArray()))===rotations&&JSON.stringify(a.model.position.toArray())===JSON.stringify(root)&&JSON.stringify(a.model.quaternion.toArray())===JSON.stringify(rotation);
     const mirror=sampleBasicRun(0),half=sampleBasicRun(basicRunPeriodMs/2);let phaseError=0;for(const id of ['thigh','calf','upperarm','lowerarm'])phaseError=Math.max(phaseError,Math.abs(mirror.values[id+'_l']-half.values[id+'_r']));
     return {periodMs:basicRunPeriodMs,frames:131,maxReferenceError,initialGap,minKneeGap,minAnkleGap,maxLengthError,maxFlexError,minSkinHeight,maxStepRotation,maxStepPosition,maxFrameMs,boundaryDistance,pauseStable,restored,positionsUnchanged:positions===JSON.stringify(a.bones.map(b=>b.position.toArray())),phaseError,sampled,available:basicRunAvailable(pose)};
    });
    measurements.push({model:sex,...result});assert(result.available&&result.restored&&result.pauseStable&&result.positionsUnchanged);
    assert(result.maxReferenceError<.0001,`reference error ${result.maxReferenceError}`);assert(result.maxLengthError<1e-6);assert(result.maxFlexError<.0001);assert(result.minSkinHeight>-.001);assert(result.boundaryDistance<.001);assert(result.phaseError<1e-8);
    assert(Math.abs(result.initialGap.knee-result.initialGap.hip)<1e-5);assert(Math.abs(result.initialGap.ankle-result.initialGap.hip)<1e-5);
    assert(result.minKneeGap>0&&result.minAnkleGap>0,'Left/right legs crossed during baseline run');
    assert(result.maxStepRotation<.25,`rotation jump ${result.maxStepRotation}`);assert(result.maxStepPosition<.03,`position jump ${result.maxStepPosition}`);
   });
   await test(`${sex}: UI pause/resume/reset and edit restore preserve snapshot and camera`,async()=>{
    await page.selectOption('#bone','1');await page.locator('#pose-number').fill('96');await page.locator('#pose-number').dispatchEvent('change');await page.click('#save-pose');
    const original=await state();const events=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).length);
    await start();await page.waitForTimeout(200);await page.click('#play-run');const paused=await state();assert.equal(paused.state,'paused');assert.deepEqual(paused.values,original.values);assert.notDeepEqual(paused.bones,original.bones);
    await page.waitForTimeout(150);assert.deepEqual((await state()).bones,paused.bones);await start();await page.waitForTimeout(100);await page.click('#play-run');assert.notDeepEqual((await state()).bones,paused.bones);
    await page.click('#reset-run');assert.equal((await state()).phase,0);assert.equal((await state()).state,'paused');
    await page.click('#edit-run');const restored=await state();assert.deepEqual(restored.bones,original.bones);assert.deepEqual(restored.root,original.root);assert.deepEqual(restored.rotation,original.rotation);assert(restored.camera.every((v,i)=>Math.abs(v-original.camera[i])<1e-8));
    await start();await page.click('#load-pose');assert.equal((await state()).state,'idle');assert.deepEqual((await state()).values,original.values);
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).length),events);
   });
  }
  await test('basic run and leg lift are mutually exclusive; numeric editing stops run',async()=>{
   await page.click('#play-lift');assert(await page.evaluate(()=>window.modelPreview.legLiftControls.playing));await start();assert(!(await page.evaluate(()=>window.modelPreview.legLiftControls.playing)));
   await page.click('#play-lift');assert.equal((await state()).state,'idle');await page.click('#stop-lift');await start();await page.locator('#pose-number').fill('88');await page.locator('#pose-number').dispatchEvent('change');assert.equal((await state()).state,'idle');assert.equal((await state()).values.lowerarm_l,88);
  });
  await test('view controls keep playback; body step and model change restore safely',async()=>{
   await start();await page.click('[data-view=side]');assert.equal((await state()).state,'playing');await page.click('#previous-body');assert.equal((await state()).state,'idle');await page.click('[data-model-type=male]');await ready();assert.equal((await state()).state,'idle');await page.click('#next-pose');assert(!(await page.locator('#play-run').isDisabled()));
  });
  await test('edited leg length and height still preserve lengths and prevent foot penetration',async()=>{
   await page.click('#previous-body');await page.selectOption('#body-part','2');const cm=Number(await page.locator('#part-number').inputValue());await page.locator('#part-number').fill((cm*1.1).toFixed(1));await page.locator('#part-number').dispatchEvent('change');
   await page.locator('#body-height').evaluate(el=>{el.value=String(Number(el.value)*1.05);el.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#next-pose');
   const before=await page.evaluate(()=>window.modelPreview.bodyDimensions.measure());await start();await page.waitForTimeout(250);await page.click('#play-run');const after=await page.evaluate(()=>window.modelPreview.bodyDimensions.measure());
   for(const key in before)assert(Math.abs(before[key]-after[key])<.0001);assert(await page.evaluate(()=>Math.min(...Object.values(window.modelPreview.basicRunControls.footHeights))>=-1e-6));await page.click('#edit-run');
  });
  await test('390px playback controls remain accessible without page overflow',async()=>{
   await page.setViewportSize({width:390,height:844});await start();await page.click('#play-run');assert.equal((await state()).state,'paused');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/basic-run-narrow.png',fullPage:true});await page.click('#edit-run');await page.setViewportSize({width:1440,height:1050});
  });
  await test('hidden tab pauses without automatic resume; frame failure restores edit pose',async()=>{
   const original=await state();await start();
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
   assert.equal((await state()).state,'paused');const paused=await state();await page.waitForTimeout(100);assert.deepEqual((await state()).bones,paused.bones);
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert.equal((await state()).state,'paused');await page.click('#edit-run');
   await start();await page.evaluate(()=>{const p=window.modelPreview.runningPose,original=p.applyRunFrame;p.applyRunFrame=()=>({ok:false,reason:'injected-failure'});window.modelPreview.basicRunControls.tick(performance.now());p.applyRunFrame=original;});
   const after=await state();assert.equal(after.state,'idle');assert.deepEqual(after.bones,original.bones);assert.deepEqual(after.root,original.root);assert.deepEqual(after.values,original.values);
  });
  await test('policy revision stops running and blocks stale restart; narrow or hidden policy blocks baseline',async()=>{
   await start();await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.calf.max=60;s.saveSettings(v);});await page.waitForFunction(()=>window.modelPreview.basicRunControls.state==='idle');assert(await page.locator('#play-run').isDisabled());
   await page.reload();await ready();await page.click('#next-pose');assert(await page.locator('#play-run').isDisabled());
   await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.calf.max=120;v.categories.lowerarm.enabled=false;s.saveSettings(v);});await page.reload();await ready();await page.click('#next-pose');assert(await page.locator('#play-run').isDisabled());
  });
  await test('unsupported model cannot start baseline run',async()=>{
   await page.evaluate(()=>localStorage.removeItem('running-sim.lab.settings.v1'));await page.goto('http://127.0.0.1:5173/?admin-preview=1');
   const buffer=fs.readFileSync('experiments/model-preview/public/models/runner-male.glb');const len=buffer.readUInt32LE(12),json=JSON.parse(buffer.subarray(20,20+len));json.asset.extras={unverifiedRun:true};const text=Buffer.from(JSON.stringify(json)),body=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(body);const tail=buffer.subarray(20+len),glb=Buffer.alloc(20+body.length+tail.length);buffer.copy(glb,0,0,20);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(body.length,12);body.copy(glb,20);tail.copy(glb,20+body.length);
   await page.locator('#file').setInputFiles({name:'unverified.glb',mimeType:'model/gltf-binary',buffer:glb});await ready();assert(await page.locator('#play-run').isDisabled());
  });
  assert.deepEqual(errors,[]);
 }finally{
  const report={testedAt:new Date().toISOString(),browser:await browser.version(),scope:'M16 planted toe X/Z, forward root motion, authored flight and camera follow; AB01 thighs/knees; right half-cycle assumed; real male/female GLB, sampled mesh clearance and bone lengths; 390px desktop viewport, not physical mobile; naturalness and contact mechanics not validated',measurements,cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};fs.writeFileSync('docs/05-validation/reports/basic-run.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
