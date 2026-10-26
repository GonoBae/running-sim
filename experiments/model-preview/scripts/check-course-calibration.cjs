const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173',production=process.argv.includes('--production'),out='outputs/course-calibration';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,checks:[],errors:[]};
(async()=>{const {createCourse,totalDistanceM}=await import('../src/course.ts'),{createCalibratedCourse,FIELD_REFERENCE}=await import('../src/course-calibration.ts');
 const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json')),raw=createCourse(asset),c=createCalibratedCourse(asset);
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready&&!document.getElementById('course-start').disabled),runReady=()=>p.waitForFunction(()=>window.courseRunPreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state),frame=()=>p.evaluate(()=>window.courseRunPreview.frame);
 const near=(a,b,t=1e-7)=>assert(Math.abs(a-b)<t,`${a} != ${b}`),vec=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
 const profile={version:1,model:'female',scale:1.05,ratios:{upperArm:1,forearm:.95,thigh:1.1,shin:1,torso:1,shoulders:1},leg:5,elbow:10,lean:8,strike:'midfoot',course:{id:asset.id,revision:asset.revision,startDistanceM:FIELD_REFERENCE.startDistanceM,direction:'reverse',laps:6,goal:{type:'distance',distanceM:5000},paceSecondsPerKm:360}};
 await p.goto(base+'/course');await ready();assert(await p.isDisabled('#course-compare'));
 await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),profile);await p.reload();await ready();assert.deepEqual(await state(),profile);assert.equal(await p.innerText('#lap-length'),'1.15 km');assert.equal(await p.innerText('#course-duration'),'30:00');
 const xs=c.local.map(q=>q[0]),ys=c.local.map(q=>q[1]),sx=Math.min(880/(Math.max(...xs)-Math.min(...xs)),460/(Math.max(...ys)-Math.min(...ys))),ox=500-(Math.min(...xs)+Math.max(...xs))/2*sx,oy=295+(Math.min(...ys)+Math.max(...ys))/2*sx;
 const svg=p=>[ox+p[0]*sx,oy-p[1]*sx],marker=async id=>[+await p.getAttribute(id,'cx'),+await p.getAttribute(id,'cy')];
 const verifyMap=async()=>{const s=await state();for(const km of [3,4]){vec(await marker('#course-before-'+km),svg(raw.atTravel(s.course,km*1000)));vec(await marker('#course-after-'+km),svg(c.atTravel(s.course,km*1000)));}vec(await marker('#course-finish-marker'),svg(c.atTravel(s.course,totalDistanceM(c,s.course))));};
 await verifyMap();assert((await p.innerText('#course-reference-note')).includes('38 m'));await p.screenshot({path:out+'/settings.png',fullPage:true});await p.locator('#course-map').screenshot({path:out+'/map.png'});
 await p.click('#course-compare');assert.equal(await p.locator('.calibration-marker').count(),0);assert.deepEqual(await state(),profile);await p.click('#course-compare');await verifyMap();assert.deepEqual(await state(),profile);
 for(const dir of ['forward','reverse']){await p.click('#course-'+dir);await verifyMap();}
 assert.deepEqual(await state(),profile);await p.reload();await ready();assert.deepEqual(await state(),profile);await verifyMap();
 report.checks.push('Existing custom body/pose/start/direction/goal/pace preserved byte-for-byte; before/after 3km/4km markers and 5km finish agree with calibrated metric; toggle is display-only; both directions/reload verified');
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png',fullPage:true});await p.setViewportSize({width:1440,height:1100});
 await p.click('#next');await runReady();assert.deepEqual(await state(),profile);near((await frame()).duration,1800);
 for(const [km,progress] of [[3,'0.6'],[4,'0.8'],[5,'1']]){await p.locator('#run-progress').fill(progress);const f=await frame();near(f.distanceM,km*1000);vec(f.position,c.atTravel(profile.course,km*1000));near(f.duration,1800);near(f.completedLaps,Math.floor(km*1000/c.lengthM));
  const world=await p.evaluate(()=>window.courseRunPreview.group.position.toArray());vec(world,[f.position[0]*c.distanceScale,0,-f.position[1]*c.distanceScale]);await p.screenshot({path:`${out}/run-${km}km.png`,fullPage:true});}
 const f=await frame();assert(f.complete&&!f.playing);vec(await marker('#run-map-finish'),[f.position[0],-f.position[1]]);
 await p.click('#previous');await ready();await p.click('#goal-laps');await p.locator('#course-laps').fill('2');await p.click('#next');await runReady();const lapState=await state();near((await frame()).totalM,c.lengthM*2);near((await frame()).duration,c.lengthM*2*.36);await p.locator('#run-progress').fill('1');vec((await frame()).position,c.atTravel(lapState.course,0));assert.equal((await frame()).completedLaps,2);
 report.checks.push('Playback 3/4/5km positions match map; exact finish/minimap, 4 completed laps at 5km, 30-minute km goal retained; 2-lap total/time recalculated and returns to same start; 3D path scale matches distance');
 // Distinguish map chainage from calibrated travel: valid original starts may exceed the new lap length.
 const endStart={...profile,course:{...profile.course,startDistanceM:(c.lengthM+c.mapLengthM)/2}};
 await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),endStart);await p.goto(base+'/course');await ready();assert(!(await p.isDisabled('#next')));assert.deepEqual(await state(),endStart);
 const old=createCourse(JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-b-v1.json'))),legacy={...profile,course:{...profile.course,revision:old.asset.revision,startDistanceM:900}};
 await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),legacy);await p.reload();await ready();const migrated=await state();vec(c.pointAt(migrated.course.startDistanceM),old.pointAt(900));assert.deepEqual({...migrated,course:null},{...profile,course:null});assert.equal(migrated.course.paceSecondsPerKm,360);
 report.checks.push('Original start near lap end stays valid; legacy B start migrates to same physical point while preserving other settings');
 let boneError=0,skinError=0,samples=0;
 for(const model of ['male','female']){
  const s={...profile,model};await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),s);await p.goto(base+'/backtest');await runReady();
  for(const progress of ['0.001','0.02','0.6','0.8']){await p.locator('#run-progress').fill(progress);const sample=await p.evaluate(()=>{
   const source=window.stagePreview.runtime.lane.model,copy=window.courseRunPreview.model;source.updateMatrixWorld(true);copy.updateMatrixWorld(true);const invA=source.matrixWorld.clone().invert(),invB=copy.matrixWorld.clone().invert();
   const a=[],z=[];source.traverse(o=>a.push(o));copy.traverse(o=>z.push(o));let bone=0,skin=0;
   for(let k=0;k<a.length;k++){const u=a[k],v=z[k];if(u.isBone){const p=u.matrixWorld.clone().premultiply(invA).elements,q=v.matrixWorld.clone().premultiply(invB).elements;for(let j=0;j<16;j++)bone=Math.max(bone,Math.abs(p[j]-q[j]));}
    if(u.isSkinnedMesh)for(const i of [0,100,500,1000].filter(i=>i<u.geometry.attributes.position.count)){const p=u.position.clone().fromBufferAttribute(u.geometry.attributes.position,i),q=v.position.clone().fromBufferAttribute(v.geometry.attributes.position,i);u.applyBoneTransform(i,p);v.applyBoneTransform(i,q);skin=Math.max(skin,p.distanceTo(q));}}
   return {bone,skin,scale:window.courseRunPreview.group.scale.toArray()};});boneError=Math.max(boneError,sample.bone);skinError=Math.max(skinError,sample.skin);vec(sample.scale,[1,1,1]);samples++;}
 }
 assert(boneError<1e-7&&skinError<1e-7);report.gaitCopy={samples,boneError,skinError};report.checks.push('Both sexes/4 phases: calibrated scene does not scale runner or change copied joints/skin');
 assert.deepEqual(report.errors,[]);report.status='passed';
 if(!production)for(const name of ['settings','map','mobile','run-3km','run-4km','run-5km'])fs.copyFileSync(`${out}/${name}.png`,`docs/assets/images/course-calibration-${name}.png`);
 }catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
 finally{await b.close();fs.writeFileSync(`docs/05-validation/reports/course-calibration-${production?'production':'ui'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
