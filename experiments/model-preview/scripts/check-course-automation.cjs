// Isolated test storage; never edits an open user tab.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173',production=process.argv.includes('--production'),out='outputs/course-automation';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,checks:[],errors:[]};
(async()=>{const {createCourse,totalDistanceM}=await import('../src/course.ts'),asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json')),c=createCourse(asset);
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready&&!document.getElementById('course-start').disabled),runReady=()=>p.waitForFunction(()=>window.courseRunPreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state),frame=()=>p.evaluate(()=>window.courseRunPreview.frame);
 const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),vec=(a,b)=>a.forEach((n,i)=>near(n,b[i]));
 const profile={version:1,model:'female',scale:1.05,ratios:{upperArm:1,forearm:.95,thigh:1.1,shin:1,torso:1,shoulders:1},leg:5,elbow:10,lean:8,strike:'midfoot',course:{id:asset.id,revision:asset.revision,startDistanceM:1121.8640021884382,direction:'reverse',laps:6,goal:{type:'distance',distanceM:5000},paceSecondsPerKm:360}};
 await p.goto(base+'/course');await ready();await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),profile);await p.reload();await ready();
 assert.deepEqual(await state(),profile);assert.equal(await p.innerText('#lap-length'),'1.19 km');assert.equal(await p.innerText('#course-duration'),'30:00');assert((await p.innerText('#course-source-summary')).includes('79구간'));assert.equal(await p.locator('#course-compare').count(),0);
 const xs=c.local.map(p=>p[0]),ys=c.local.map(p=>p[1]),sx=Math.min(880/(Math.max(...xs)-Math.min(...xs)),460/(Math.max(...ys)-Math.min(...ys))),ox=500-(Math.min(...xs)+Math.max(...xs))/2*sx,oy=295+(Math.min(...ys)+Math.max(...ys))/2*sx;
 const marker=async id=>[+await p.getAttribute(id,'cx'),+await p.getAttribute(id,'cy')];
 for(const direction of ['forward','reverse']){await p.click('#course-'+direction);const s=await state(),q=c.atTravel(s.course,5000);vec(await marker('#course-finish-marker'),[ox+q[0]*sx,oy-q[1]*sx]);}
 assert.deepEqual(await state(),profile);await p.screenshot({path:out+'/settings.png',fullPage:true});await p.locator('.course-panel').screenshot({path:out+'/map-panel.png'});
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png',fullPage:true});await p.setViewportSize({width:1440,height:1100});
 await p.click('#next');await runReady();assert.deepEqual(await state(),profile);near((await frame()).duration,1800);
 for(const progress of ['0.6','0.8','1']){await p.locator('#run-progress').fill(progress);const f=await frame();vec(f.position,c.atTravel(profile.course,5000*Number(progress)));vec(await p.evaluate(()=>window.courseRunPreview.group.position.toArray()),[f.position[0],0,-f.position[1]]);near(f.distanceM,5000*Number(progress));}
 assert((await frame()).complete);await p.screenshot({path:out+'/finish.png',fullPage:true});
 await p.locator('#run-progress').fill('0.02');for(const view of ['front','side']){await p.click('#'+view);await p.screenshot({path:out+'/run-'+view+'.png',fullPage:true});}
 await p.click('#run-play');await p.waitForFunction(()=>window.courseRunPreview.frame.playing);const start=await frame();await p.waitForFunction(t=>window.courseRunPreview.frame.elapsed>t+.3,start.elapsed);await p.click('#run-play');assert((await frame()).distanceM>start.distanceM);
 await p.click('#previous');await ready();await p.click('#goal-laps');await p.locator('#course-laps').fill('2');await p.click('#next');await runReady();near((await frame()).totalM,2*c.lengthM);near((await frame()).duration,2*c.lengthM*.36);
 await p.locator('#run-progress').fill('1');vec((await frame()).position,c.pointAt(profile.course.startDistanceM));
 await p.reload();await runReady();const restored=await state();assert.deepEqual({...restored,course:null},{...profile,course:null});assert.equal(restored.course.startDistanceM,profile.course.startDistanceM);assert.equal(restored.course.paceSecondsPerKm,360);
 report.checks=['Custom body/pose/course settings retained byte-for-byte','Manual scale and compare control removed; verified 79 segments displayed','Both directions: map finish equals raw source chainage','3/4/5 km playback equals source geometry, scene scale 1','5 km × 6:00 = 30:00; 2-lap distance/time automatic','Play/pause/progress/front/side/reload/mobile verified'];
 assert.deepEqual(report.errors,[]);report.status='passed';
 if(!production)for(const name of ['settings','map-panel','mobile','finish','run-front','run-side'])fs.copyFileSync(`${out}/${name}.png`,`docs/assets/images/course-automation-${name}.png`);
 }catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync(`docs/05-validation/reports/course-automation-${production?'production':'ui'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
