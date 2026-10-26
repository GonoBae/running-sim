const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const report={status:'running',errors:[],models:[]},out='outputs/cmu-leg-height';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:1000}});p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=leg-height');
  const ready=()=>p.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#legHeight').disabled);
  await ready();assert.equal(await p.inputValue('#legHeight'),'0');assert.equal(await p.inputValue('#speed'),'1');
  const height=async cm=>{await p.locator('#legHeight').fill(String(cm));await p.locator('#legHeight').dispatchEvent('input');};
  for(const model of ['male','female']){
   if(model==='female'){await p.selectOption('#model',model);await ready();assert.equal(await p.inputValue('#legHeight'),'5');}
   await p.evaluate(()=>window.sharedGaitReview.seek(.04));await height(10);
   assert.equal(await p.evaluate(()=>window.sharedGaitReview.appliedHeight),10);
   const peak=await p.evaluate(()=>window.sharedGaitReview.diagnostic.legHeight.find(r=>r.side==='r').riseCm);assert(Math.abs(peak-10)<1e-9);
   await p.click('#front');await p.screenshot({path:`${out}/${model}-front.png`});
   await p.click('#side');await p.screenshot({path:`${out}/${model}-side.png`});
   await p.evaluate(()=>window.sharedGaitReview.seek(.54));
   const left=await p.evaluate(()=>window.sharedGaitReview.diagnostic.legHeight.find(r=>r.side==='l').riseCm);assert(Math.abs(left-10)<1e-9);
   await p.click('#resetHeight');assert.equal(await p.evaluate(()=>window.sharedGaitReview.appliedHeight),0);
   await p.focus('#legHeight');await p.keyboard.press('End');assert.equal(await p.inputValue('#legHeight'),'10');
   await p.keyboard.press('Home');assert.equal(await p.inputValue('#legHeight'),'0');
   await p.keyboard.press('ArrowRight');assert.equal(await p.inputValue('#legHeight'),'1');
   await p.click('#play');const phase=await p.evaluate(()=>window.sharedGaitReview.phase);
   const count=await p.evaluate(()=>performance.getEntriesByName('shared-gait-ready').length);
   await height(10);await p.waitForFunction(()=>window.sharedGaitReview.appliedHeight>9.99);
   assert.equal(await p.locator('#play').innerText(),'일시정지');assert.notEqual(await p.evaluate(()=>window.sharedGaitReview.phase),phase);
   await p.click('#resetHeight');await p.waitForFunction(()=>window.sharedGaitReview.appliedHeight===0);
   assert.equal(await p.evaluate(()=>performance.getEntriesByName('shared-gait-ready').length),count);
   await p.click('#play');await p.uncheck('#repeat');await p.evaluate(()=>window.sharedGaitReview.seek(.9));await p.click('#play');
   await p.waitForFunction(()=>window.sharedGaitReview.phase===1);assert.equal(await p.locator('#play').innerText(),'처음부터 재생');
   await p.check('#repeat');await p.click('#play');await p.waitForFunction(()=>window.sharedGaitReview.phase>.1&&window.sharedGaitReview.phase<.9);await p.click('#play');
   await height(5);report.models.push({model,peakRightCm:peak,peakLeftCm:left,readyMs:await p.evaluate(()=>performance.getEntriesByName('shared-gait-ready').at(-1).duration),liveNoReload:true,resetExact:true,keyboard:true,playLoopPause:true});
  }
  await p.setViewportSize({width:390,height:844});await p.click('#front');await p.screenshot({path:`${out}/narrow.png`,fullPage:true});
  report.horizontalOverflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!report.horizontalOverflow);
  await p.reload();await ready();assert.equal(await p.inputValue('#legHeight'),'0');report.refreshDefault=true;
  await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=unified-stance');await p.waitForFunction(()=>window.sharedGaitReview?.ready);
  assert(await p.locator('#heightControls').isHidden());assert.equal(await p.evaluate(()=>window.sharedGaitReview.legHeightPlan),null);
  assert((await p.locator('.labels').innerText()).includes('통합 접촉 경로'));report.previousComparison=true;
  assert.equal(report.errors.length,0);report.status='passed';console.log(report);
 }catch(e){report.failure=e.stack;throw e;}
 finally{fs.writeFileSync('docs/05-validation/reports/cmu-leg-height-ui.json',JSON.stringify(report,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
