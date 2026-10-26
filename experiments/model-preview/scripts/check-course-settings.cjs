const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173',out='outputs/course-settings';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,checks:[],profiles:[],errors:[]};
const keep=({course,...s})=>s;
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const context=await b.newContext({viewport:{width:1440,height:1100},hasTouch:true}),p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state);
 const courseReady=()=>p.waitForFunction(()=>!document.getElementById('course-start').disabled);
 const signature=()=>p.evaluate(()=>{const r=window.stagePreview;r.seek(.28);const out=[];r.runtime.lane.model.traverse(o=>{if(o.isBone)out.push(...o.matrixWorld.elements)});return out;});
 const routePoint=async(index,fraction=.5)=>p.evaluate(([i,f])=>{const svg=document.getElementById('course-map'),line=document.getElementById('course-route'),a=line.points.getItem(i),b=line.points.getItem(i+1),q=new DOMPoint(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f).matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};},[index,fraction]);
 await p.goto(base+'/course');await ready();await courseReady();assert(await p.isDisabled('#next'));assert.equal((await state()).course,null);
 await p.click('nav [data-step=backtest]',{force:true});assert.equal(new URL(p.url()).pathname,'/course');assert(await p.isDisabled('#next'));
 await p.selectOption('#course-start','0');assert(!(await p.isDisabled('#next')));assert.equal((await state()).course.startDistanceM,0);
 const point=await routePoint(8);await p.mouse.click(point.x,point.y);assert((await state()).course.startDistanceM>0);assert.equal(await p.inputValue('#course-start'),'custom');
 const start=(await state()).course.startDistanceM;await p.click('#course-reverse');assert.equal((await state()).course.direction,'reverse');assert.equal((await state()).course.startDistanceM,start);assert.equal(await p.locator('.direction-arrow').count(),4);
 await p.locator('#course-laps').fill('3');assert.equal(await p.locator('#course-total').innerText(),'3.56 km');
 const saved=await state();await p.locator('#course-map').click({position:{x:4,y:4}});assert.deepEqual(await state(),saved);
 for(const input of ['', '0','101','1.5']){await p.locator('#course-laps').fill(input);assert(await p.isDisabled('#next'));assert.equal(await p.locator('#course-total').innerText(),'—');assert.deepEqual(await state(),saved);}
 await p.locator('#course-laps').fill('100');assert(await p.isDisabled('#lap-plus'));await p.locator('#course-laps').fill('1');assert(await p.isDisabled('#lap-minus'));await p.click('#lap-plus');assert.equal((await state()).course.laps,2);await p.click('#lap-minus');assert.equal((await state()).course.laps,1);
 report.checks.push('No auto-selected start; navigation gate, map projection, outside click ignored, reverse arrows and unchanged start','Laps blank/0/101/fraction reject without overwriting draft; 1/100 limits, +/- and total 3.56 km at 3 laps');
 for(const model of ['male','female'])for(const custom of [false,true]){
  const ids=['upperArm','forearm','thigh','shin','torso','shoulders'],profile={version:1,model,scale:custom?1.1:1,ratios:Object.fromEntries(ids.map((id,i)=>[id,custom?(i%2?.85:1.15):1])),leg:5,elbow:10,lean:8,strike:'original',course:(await state()).course};
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),profile);await p.goto(base+'/pose');await ready();
  for(const strike of ['original','heel','midfoot','forefoot']){
   await p.selectOption('#strike',strike);const before=await state(),poseBones=await signature();await p.click('#next');await ready();await courseReady();assert.deepEqual(keep(await state()),keep(before));assert.deepEqual(await signature(),poseBones);
   await p.selectOption('#course-start','2');await p.click('#course-reverse');await p.locator('#course-laps').fill('3');assert.deepEqual(keep(await state()),keep(before));
   const picked=await state();await p.click('#next');assert.equal(new URL(p.url()).pathname,'/backtest');assert((await p.locator('#backtest-course').innerText()).includes('3.56 km'));assert((await p.locator('#pending-description').innerText()).includes('준비 중'));
   await p.goBack();await ready();assert.deepEqual(await state(),picked);await p.click('#previous');await ready();assert.deepEqual(await state(),picked);
  }
  const selected=await state();await p.goto(base+'/course');await ready();await courseReady();assert.deepEqual(await state(),selected);await p.reload();await ready();await courseReady();assert.deepEqual(await state(),selected);
  report.profiles.push({model,custom,strikes:4,bodyPoseExact:true,poseCourseBoneMatricesExact:true,refreshExact:true});
 }
 report.checks.push('16 model/body/strike combinations: pose->course->backtest->browser back->pose, exact body/pose values and exact bone matrices; 4 profile reloads');
 // Actual body and pose edits after selecting a course must preserve that course.
 const picked=(await state()).course;await p.click('nav [data-step=body]');await ready();await p.locator('#body-panel').evaluate(e=>e.open=true);await p.locator('#scale').fill('95');assert.deepEqual((await state()).course,picked);await p.click('#next');await ready();await p.locator('#leg').fill('7');assert.deepEqual((await state()).course,picked);await p.click('#next');await ready();assert.equal((await state()).scale,.95);assert.equal((await state()).leg,7);
 await p.click('#play');if(!await p.evaluate(()=>window.stagePreview.playing))await p.click('#play');const phase=await p.evaluate(()=>window.stagePreview.phase);await p.waitForFunction(t=>Math.abs(window.stagePreview.phase-t)>.12,phase);await p.evaluate(()=>window.stagePreview.seek(.28));
 report.checks.push('Body scale and pose edits keep selected course; existing runtime plays in the course preview');
 // Screenshot examples use explicit parameters, not the human user's session.
 const example={version:1,model:'male',scale:1.05,ratios:{upperArm:1.1,forearm:.95,thigh:1.1,shin:.9,torso:1.05,shoulders:1},leg:5,elbow:10,lean:8,strike:'midfoot',course:picked};
 await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),example);await p.goto(base+'/course');await ready();await courseReady();
 for(const view of ['front','side']){await p.click('#'+view);await p.evaluate(()=>window.stagePreview.seek(.28));await p.locator('#course-laps').blur();await p.screenshot({path:out+'/course-'+view+'.png',fullPage:true});}
 await p.click('#next');await p.screenshot({path:out+'/backtest.png',fullPage:true});await p.reload();await courseReady();assert.equal(new URL(p.url()).pathname,'/backtest');assert((await p.locator('#backtest-course').innerText()).includes('3.56'));
 await p.click('#previous');await ready();await p.setViewportSize({width:390,height:844});await p.locator('#course-map').scrollIntoViewIfNeeded();const tap=await routePoint(4);await p.touchscreen.tap(tap.x,tap.y);const touchState=await state();assert(Math.abs(touchState.course.startDistanceM-picked.startDistanceM)>10);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/course-mobile.png',fullPage:true});
 report.checks.push('Front/side live preview capture; valid backtest direct reload retains summary; 390px touch map and no horizontal overflow');
 // Previous and malformed stored courses do not destroy valid body/pose fields.
 for(const bad of [undefined,{...picked,revision:'stale'},{...picked,startDistanceM:999999},{...picked,laps:0}]){
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),{...example,course:bad});await p.goto(base+'/course');await ready();await courseReady();assert(await p.isDisabled('#next'));assert.deepEqual(keep(await state()),keep(example));await p.selectOption('#course-start','1');assert(!(await p.isDisabled('#next')));
 }
 report.checks.push('Old no-course storage, stale revision, out-of-range start and invalid laps: gate and explicit reselection; original body/pose retained');
 const fail=await context.newPage();fail.on('pageerror',e=>report.errors.push(e.message));await fail.route('**/courses/lotte-garden-c-v1.json',r=>r.fulfill({status:404,body:'missing'}));await fail.goto(base+'/course');await fail.waitForSelector('#course-retry');assert(await fail.isDisabled('#next'));await fail.unroute('**/courses/lotte-garden-c-v1.json');await fail.click('#course-retry');await fail.waitForFunction(()=>!document.getElementById('course-start').disabled);await fail.selectOption('#course-start','0');assert(!(await fail.isDisabled('#next')));
 await fail.close();
 const broken=await context.newPage();const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json'));asset.geometry.coordinates.pop();await broken.route('**/courses/lotte-garden-c-v1.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(asset)}));await broken.goto(base+'/course');await broken.waitForSelector('#course-retry');assert(await broken.isDisabled('#next'));await broken.close();
 report.checks.push('404 retry recovers; malformed open-loop asset blocks progression');assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync('docs/05-validation/reports/course-settings-ui.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
