const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173',production=process.argv.includes('--production'),out='outputs/course-goal';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,checks:[],errors:[]};
(async()=>{
 const {createCourse}=await import('../src/course.ts'),asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json')),c=createCourse(asset);
 const old=createCourse(JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-b-v1.json')));
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1100},hasTouch:true});p.on('pageerror',e=>report.errors.push(e.message));
  const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready&&!document.getElementById('course-start').disabled),runReady=()=>p.waitForFunction(()=>window.courseRunPreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state);
  const near=(a,z)=>assert(Math.hypot(...a.map((n,i)=>n-z[i]))<1e-7,`${a} != ${z}`);
  const physical=(s)=>c.pointAt(s.course.startDistanceM);
  await p.goto(base+'/course');await ready();assert(await p.isDisabled('#next'));assert(await p.isDisabled('#goal-distance'));
  const original=await state();const body={...original,model:'female',scale:1.05,leg:5,elbow:10,lean:8,strike:'midfoot',ratios:{...original.ratios,thigh:1.1,forearm:.95}};
  const legacy={...body,course:{id:old.asset.id,revision:old.asset.revision,startDistanceM:900,direction:'reverse',laps:6}};
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),legacy);await p.reload();await ready();const migrated=await state();near(physical(migrated),old.pointAt(900));assert.equal(migrated.course.laps,6);assert.deepEqual({...migrated,course:null},{...legacy,course:null});assert.equal(migrated.course.revision,asset.revision);
  assert(await p.isVisible('#course-finish-marker'));assert((await p.locator('#course-map').textContent()).includes('출발 · 도착'));
  report.checks.push('Legacy B start migrated to identical physical point on C; reverse/6 laps and custom body/pose retained; shared start/finish label');
  await p.click('#goal-distance');assert.equal(await p.locator('#course-km').inputValue(),'1');
  await p.locator('#course-km').fill('3');const saved=await state();assert.equal(saved.course.goal.distanceM,3000);assert.equal(await p.innerText('#course-total'),'3.00 km');
  for(const value of ['', '0','-1','100.01','0.001','1.005']){await p.locator('#course-km').fill(value);assert(await p.isDisabled('#next'));assert.equal(await p.innerText('#course-total'),'—');assert.equal(await p.locator('#course-finish-marker').count(),0);assert.deepEqual(await state(),saved);}
  for(const value of ['0.01','0.29','100','3']){await p.locator('#course-km').fill(value);assert(!(await p.isDisabled('#next')));assert.equal((await state()).course.goal.distanceM,Math.round(Number(value)*1000));}
  report.checks.push('Km 0.01/0.29/3/100 accepted; blank/zero/negative/over-max/sub-step rejected without overwriting or showing stale finish');
  await p.click('#goal-laps');assert.equal(await p.locator('#course-laps').inputValue(),'6');assert.equal((await state()).course.goal,undefined);
  await p.click('#goal-distance');await p.locator('#course-km').fill('3');await p.selectOption('#course-start','0');
  for(const direction of ['forward','reverse']){
   await p.click('#course-'+direction);
   for(const km of ['0.01','1.50','3']){
    await p.locator('#course-km').fill(km);const s=await state(),finish=c.atTravel(s.course,Number(km)*1000);
    const xs=c.local.map(q=>q[0]),ys=c.local.map(q=>q[1]),sx=Math.min(880/(Math.max(...xs)-Math.min(...xs)),460/(Math.max(...ys)-Math.min(...ys))),ox=500-(Math.min(...xs)+Math.max(...xs))/2*sx,oy=295+(Math.min(...ys)+Math.max(...ys))/2*sx;
    near([+await p.getAttribute('#course-finish-marker','cx'),+await p.getAttribute('#course-finish-marker','cy')],[ox+finish[0]*sx,oy-finish[1]*sx]);
    await p.click('#next');await runReady();assert.deepEqual(await state(),s);assert.equal(await p.innerText('#run-course-label'),`${direction==='forward'?'시계':'반시계'} 방향 · ${Number(km).toFixed(2)} km`);
    near([+await p.getAttribute('#run-map-finish','cx'),+await p.getAttribute('#run-map-finish','cy')],[finish[0],-finish[1]]);
    await p.locator('#run-progress').fill('0.99999');await p.click('#run-play');await p.waitForFunction(()=>window.courseRunPreview.frame.complete);
    const f=await p.evaluate(()=>window.courseRunPreview.frame);near(f.position,finish);assert.equal(f.distanceM,Number(km)*1000);assert(!f.playing);assert.equal(f.completedLaps,Math.floor(f.distanceM/c.lengthM));
    await p.reload();await runReady();assert.deepEqual(await state(),s);assert.equal((await p.evaluate(()=>window.courseRunPreview.frame)).distanceM,0);
    await p.click('#previous');await ready();assert.equal(await p.locator('#course-km').inputValue(),String(Number(km)));
   }
  }
  report.checks.push('2 directions × 3 partial-lap goals: settings finish = minimap finish = exact stopped runner; reload/reset and phase entry preserve every setting');
  await p.click('#course-forward');await p.locator('#course-km').fill('3');await p.screenshot({path:out+'/settings.png',fullPage:true});
  await p.setViewportSize({width:390,height:844});await p.locator('#goal-laps').scrollIntoViewIfNeeded();const box=await p.locator('#goal-laps').boundingBox();await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);assert(await p.isVisible('#course-laps'));await p.click('#goal-distance');await p.locator('#course-km').fill('3');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png',fullPage:true});
  await p.setViewportSize({width:1440,height:1100});await p.click('#next');await runReady();await p.locator('#run-progress').fill('0.02');for(const view of ['front','side']){await p.click('#'+view);await p.screenshot({path:out+'/run-'+view+'.png',fullPage:true});}
  await p.locator('#run-progress').fill('1');await p.screenshot({path:out+'/finish.png',fullPage:true});
  report.checks.push('Desktop / 390px touch controls and no horizontal overflow; front/side and finish screenshots captured');
  const tip={...legacy,course:{...legacy.course,startDistanceM:old.cumulative[13]}};
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),tip);await p.goto(base+'/backtest');await p.waitForURL(base+'/course');await ready();assert(await p.isDisabled('#next'));assert((await p.innerText('#course-feedback')).includes('다시 선택'));assert.deepEqual({...await state(),course:null},{...tip,course:null});
  await p.selectOption('#course-start','1');assert(!(await p.isDisabled('#next')));assert.equal((await state()).course.laps,6);assert.equal((await state()).course.direction,'reverse');
  report.checks.push('Removed tip start is not silently moved: direct playback blocked, reselection recovers and retains preferences');
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
 finally{await b.close();fs.writeFileSync(`docs/05-validation/reports/course-goal-${production?'production':'ui'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
