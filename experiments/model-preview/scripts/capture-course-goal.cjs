// Explicit example, isolated browser context. Same fixture as check-course-goal.cjs.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs');
const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1440,height:1100}}),base=process.env.STAGE_URL||'http://127.0.0.1:5173',out='outputs/course-goal';fs.mkdirSync(out,{recursive:true});
 await p.goto(base+'/course');await p.waitForFunction(()=>window.stagePreview?.ready);
 await p.evaluate(asset=>{const s=window.stagePreview.state;Object.assign(s,{model:'female',scale:1.05,leg:5,elbow:10,lean:8,strike:'midfoot',course:{id:asset.id,revision:asset.revision,startDistanceM:0,direction:'forward',laps:6,goal:{type:'distance',distanceM:3000}}});s.ratios.thigh=1.1;s.ratios.forearm=.95;sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s));},asset);
 await p.reload();await p.waitForFunction(()=>window.stagePreview?.ready&&!document.getElementById('next').disabled);await p.screenshot({path:out+'/settings.png',fullPage:true});
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:out+'/mobile.png',fullPage:true});await p.setViewportSize({width:1440,height:1100});
 await p.click('#next');await p.waitForFunction(()=>window.courseRunPreview?.ready);await p.locator('#run-progress').fill('0.02');for(const view of ['front','side']){await p.click('#'+view);await p.screenshot({path:out+'/run-'+view+'.png',fullPage:true});}
 await p.locator('#run-progress').fill('1');await p.screenshot({path:out+'/finish.png',fullPage:true});
 for(const file of ['settings','mobile','run-front','run-side','finish'])fs.copyFileSync(`${out}/${file}.png`,`docs/assets/images/course-goal-${file}.png`);
 console.log('Five actual M89 screens captured and copied');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
