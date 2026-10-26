const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const report={status:'running',errors:[],models:[]};
 try{
  const p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=support-join');
  for(const model of ['male','female']){
   if(model==='female')await p.selectOption('#model',model);
   await p.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
   await p.selectOption('#speed','1');await p.uncheck('#repeat');
   await p.evaluate(()=>window.sharedGaitReview.seek(.9));await p.click('#play');
   await p.waitForFunction(()=>window.sharedGaitReview.phase===1);
   assert.equal(await p.locator('#play').innerText(),'처음부터 재생');
   await p.check('#repeat');await p.evaluate(()=>window.sharedGaitReview.seek(.9));await p.click('#play');
   await p.waitForFunction(()=>window.sharedGaitReview.phase<.8);
   await p.click('#play');assert.equal(await p.locator('#play').innerText(),'재생');
   await p.click('#front');await p.click('#side');
   const label=await p.locator('.labels').last().innerText();const note=await p.locator('.note').innerText();assert(model==='male'?label.includes('수정'):label.includes('유지'));if(model==='female')assert(note.includes('기존 동작'));report.models.push({model,label,note,readyMs:await p.evaluate(()=>performance.getEntriesByName('shared-gait-ready').at(-1).duration),singleStop:true,repeatWrap:true,pause:true,views:true});
  }
  await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=early-support');await p.waitForFunction(()=>window.sharedGaitReview?.ready);
  report.previousComparison=await p.evaluate(()=>({newSupportPlanAbsent:window.sharedGaitReview.supportJoinPlan===null,title:document.querySelector('h1').textContent}));
  assert(report.previousComparison.newSupportPlanAbsent);
  assert.equal(report.errors.length,0);report.status='passed';console.log(report);
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-support-join-ui.json',JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
