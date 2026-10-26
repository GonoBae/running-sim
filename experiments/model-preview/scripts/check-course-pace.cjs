// Isolated browser fixtures: never writes the user's browser storage.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173',production=process.argv.includes('--production'),out='outputs/course-pace';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,checks:[],errors:[]};
(async()=>{
 const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json'));
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>report.errors.push(e.message));
  const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready&&!document.getElementById('course-start').disabled),runReady=()=>p.waitForFunction(()=>window.courseRunPreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state),frame=()=>p.evaluate(()=>window.courseRunPreview.frame);
  const near=(a,z)=>assert(Math.abs(a-z)<1e-7,`${a} != ${z}`),finish=()=>p.locator('#course-finish-marker').evaluate(e=>[e.getAttribute('cx'),e.getAttribute('cy')]);
  await p.goto(base+'/course');await ready();assert(await p.isDisabled('#pace-target'));
  const original=await state(),profile={...original,model:'female',scale:1.05,leg:5,elbow:10,lean:8,strike:'midfoot',ratios:{...original.ratios,thigh:1.1,forearm:.95},course:{id:asset.id,revision:asset.revision,startDistanceM:1121.8640021884382,direction:'reverse',laps:6,goal:{type:'distance',distanceM:5000}}};
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),profile);await p.reload();await ready();
  assert.equal(await p.getAttribute('#pace-original','aria-pressed'),'true');assert.equal(await p.innerText('#course-duration'),'—');const endpoint=await finish();
  await p.click('#pace-target');const target={...profile,course:{...profile.course,paceSecondsPerKm:360}};assert.deepEqual(await state(),target);assert.equal(await p.innerText('#course-duration'),'30:00');assert.deepEqual(await finish(),endpoint);
  for(const [m,s,time] of [['5','00','25:00'],['6','30','32:30'],['1','00','5:00'],['30','00','2:30:00'],['6','00','30:00']]){
   await p.locator('#pace-seconds').fill('00');await p.locator('#pace-minutes').fill(m);await p.locator('#pace-seconds').fill(s);await p.click('#pace-label');assert.equal(await p.innerText('#course-duration'),time);assert.deepEqual(await finish(),endpoint);
  }
  const saved=await state();
  for(const [id,value] of [['pace-minutes',''],['pace-minutes','0'],['pace-minutes','31'],['pace-minutes','6.5'],['pace-seconds',''],['pace-seconds','60'],['pace-seconds','-1'],['pace-seconds','0.5']]){
   await p.locator('#'+id).fill(value);assert(await p.isDisabled('#next'));assert.equal(await p.innerText('#course-duration'),'—');assert.equal(await p.innerText('#course-total'),'5.00 km');assert.deepEqual(await finish(),endpoint);assert.deepEqual(await state(),saved);await p.click('#pace-target');assert(!(await p.isDisabled('#next')));
  }
  await p.locator('#pace-seconds').fill('60');await p.click('#goal-laps');assert(await p.isDisabled('#next'));await p.click('#goal-distance');await p.locator('#course-km').fill('5');await p.click('#pace-target');
  await p.locator('#course-km').fill('');await p.click('#pace-original');assert(await p.isDisabled('#next'));await p.click('#pace-target');assert(await p.isDisabled('#next'));await p.locator('#course-km').fill('5');
  assert.deepEqual(await state(),target);report.checks.push('5 km × 6:00 = 30:00; 1:00/5:00/6:30/30:00; invalid/partial fields never overwrite state; goal and pace errors remain independent; finish unchanged');
  await p.selectOption('#course-start','1');await p.click('#course-forward');await p.click('#goal-laps');await p.locator('#course-laps').fill('2');assert.equal((await state()).course.paceSecondsPerKm,360);assert.deepEqual({...await state(),course:null},{...profile,course:null});
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),target);await p.reload();await ready();assert.deepEqual(await state(),target);await p.screenshot({path:out+'/settings.png',fullPage:true});
  await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png',fullPage:true});await p.setViewportSize({width:1440,height:1100});
  await p.click('#next');await runReady();assert.deepEqual(await state(),target);near((await frame()).duration,1800);near((await frame()).speedMps,1000/360);assert.equal(await p.innerText('#run-duration'),'30:00');assert((await p.innerText('#run-course-label')).includes('6:00 /km'));
  await p.click('#run-play');await p.waitForFunction(()=>window.courseRunPreview.frame.elapsed>1);await p.click('#run-play');const paused=await frame();await p.selectOption('#run-rate','4');assert.equal((await frame()).elapsed,paused.elapsed);near((await frame()).duration,1800);
  await p.locator('#run-progress').fill('0.99999');await p.click('#run-play');await p.waitForFunction(()=>window.courseRunPreview.frame.complete);near((await frame()).distanceM,5000);assert(!(await frame()).playing);await p.screenshot({path:out+'/finish.png',fullPage:true});
  await p.reload();await runReady();assert.deepEqual(await state(),target);near((await frame()).elapsed,0);await p.locator('#run-progress').fill('0.02');for(const v of ['front','side']){await p.click('#'+v);await p.screenshot({path:out+'/run-'+v+'.png',fullPage:true});}
  report.checks.push('Custom body/leg/elbow/lean/strike/start/direction/goal survive pace edit, route edit, stage change and reload; play/pause/4×/exact finish; desktop and 390px screenshots');
  // Changing pace must not change any joint transform or skin position at the same distance/phase.
  const sample=()=>p.evaluate(()=>{const run=window.courseRunPreview,m=run.model;run.group.updateMatrixWorld(true);const inv=run.group.matrixWorld.clone().invert(),bones=[],skin=[];m.traverse(o=>{if(o.isBone)bones.push([o.name,...o.matrixWorld.clone().premultiply(inv).elements]);if(o.isSkinnedMesh)for(const i of [0,100,500,1000].filter(i=>i<o.geometry.attributes.position.count)){const v=o.position.clone().fromBufferAttribute(o.geometry.attributes.position,i);o.applyBoneTransform(i,v);skin.push(...v.toArray());}});return {phase:run.frame.phase,bones,skin};});
  let samples=0,maxBone=0,maxSkin=0;
  for(const model of ['male','female'])for(const pace of [undefined,300,390]){
   const d={...target,model,course:{...target.course}};if(pace===undefined)delete d.course.paceSecondsPerKm;else d.course.paceSecondsPerKm=pace;
   await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),d);await p.reload();await runReady();
   const key=model;if(!report.baselines)report.baselines={};
   for(const progress of ['0.001','0.02','0.05']){
    await p.locator('#run-progress').fill(progress);const actual=await sample(),id=key+progress;
    if(pace===undefined)report.baselines[id]=actual;else{const ref=report.baselines[id];near(actual.phase,ref.phase);assert.equal(actual.bones.length,ref.bones.length);actual.bones.forEach((bone,i)=>{assert.equal(bone[0],ref.bones[i][0]);bone.slice(1).forEach((v,j)=>{maxBone=Math.max(maxBone,Math.abs(v-ref.bones[i][j+1]));});});actual.skin.forEach((v,i)=>maxSkin=Math.max(maxSkin,Math.abs(v-ref.skin[i])));samples++;}
   }
  }
  delete report.baselines;assert(maxBone<1e-7&&maxSkin<1e-7);report.samePhase={comparisons:samples,maxBone,maxSkin};report.checks.push('Both models at 5:00/6:30 vs legacy speed: all bone matrices and sampled skin positions unchanged at matching distance/phase');
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
 finally{await b.close();fs.writeFileSync(`docs/05-validation/reports/course-pace-${production?'production':'ui'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})();
