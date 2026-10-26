const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:4173';
const report={status:'running',base,checks:[],errors:[]};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>report.errors.push(e.message));
 const response=await p.request.get(base+'/courses/lotte-garden-c-v1.json');assert(response.ok());const asset=await response.json();assert.equal(asset.revision,'c-3471370ec877');
 await p.goto(base+'/backtest');await p.waitForURL(base+'/course');await p.waitForFunction(()=>window.stagePreview?.ready);assert(await p.isDisabled('#next'));
 await p.selectOption('#course-start','3');await p.click('#course-reverse');await p.locator('#course-laps').fill('4');assert.equal(await p.locator('#course-total').innerText(),'4.75 km');
 const saved=await p.evaluate(()=>window.stagePreview.state);await p.click('#next');await p.waitForURL(base+'/backtest');await p.reload();await p.waitForFunction(()=>document.getElementById('backtest-course').textContent.includes('4.75'));assert.deepEqual(await p.evaluate(()=>window.stagePreview.state),saved);
 await p.click('#previous');await p.waitForFunction(()=>window.stagePreview?.ready);const t=await p.evaluate(()=>window.stagePreview.phase);await p.waitForFunction(t=>Math.abs(window.stagePreview.phase-t)>.1,t);
 report.checks.push('Built static asset matches requested C revision','Direct backtest without course returns to course and blocks next','Choose start/direction/4 laps -> 4.75 km; backtest direct reload preserves all state','Course preview plays with the existing runtime');
 await p.evaluate(()=>{const k='running-sim.stages.v1',s=JSON.parse(sessionStorage.getItem(k));s.course.revision='old';sessionStorage.setItem(k,JSON.stringify(s));});await p.goto(base+'/backtest');await p.waitForURL(base+'/course');assert(await p.isDisabled('#next'));assert.deepEqual({...await p.evaluate(()=>window.stagePreview.state),course:null},{...saved,course:null});
 report.checks.push('Stale stored revision also blocks direct backtest; body/pose remain intact');assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync('docs/05-validation/reports/course-settings-production.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
