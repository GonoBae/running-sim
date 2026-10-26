const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='outputs/cmu-elbow-bend',report={status:'running',errors:[],models:[]};fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:1140}});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=elbow-bend');
 const ready=()=>p.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#elbowBend').disabled);
 const input=async(id,value)=>{await p.locator('#'+id).fill(String(value));await p.locator('#'+id).dispatchEvent('input');};
 await ready();assert.equal(await p.inputValue('#elbowBend'),'0');assert.equal(await p.inputValue('#legHeight'),'0');
 for(const model of ['male','female']){
  if(model==='female'){await p.selectOption('#model',model);await ready();assert.equal(await p.inputValue('#legHeight'),'5');assert.equal(await p.inputValue('#elbowBend'),'10');}
  await p.evaluate(()=>window.sharedGaitReview.seek(.24));await input('legHeight',5);
  for(const offset of [-20,20]){
   await input('elbowBend',offset);
   const angles=await p.evaluate(()=>window.sharedGaitReview.diagnostic.elbowBend);
   for(const v of angles)assert(Math.abs(v.actualDeg-v.baseDeg-offset)<.001);
   assert((await p.locator('#actualElbows').innerText()).includes('오른팔'));assert((await p.locator('#actualElbows').innerText()).includes('왼팔'));
   for(const view of ['front','side']){await p.click('#'+view);await p.screenshot({path:`${out}/${model}-${view}${offset<0?'-less':''}.png`});}
  }
  await p.click('#resetElbow');assert.equal(await p.evaluate(()=>window.sharedGaitReview.appliedElbow),0);assert.equal(await p.inputValue('#legHeight'),'5');
  await input('elbowBend',10);await p.click('#resetHeight');assert.equal(await p.inputValue('#elbowBend'),'10');assert.equal(await p.inputValue('#legHeight'),'0');
  await p.focus('#elbowBend');await p.keyboard.press('Home');assert.equal(await p.inputValue('#elbowBend'),'-20');await p.keyboard.press('End');assert.equal(await p.inputValue('#elbowBend'),'20');await p.keyboard.press('ArrowLeft');assert.equal(await p.inputValue('#elbowBend'),'19');
  const count=await p.evaluate(()=>performance.getEntriesByName('shared-gait-ready').length);
  await p.click('#play');await input('elbowBend',-20);await input('legHeight',7);
  await p.waitForFunction(()=>window.sharedGaitReview.appliedElbow< -19.99&&window.sharedGaitReview.appliedHeight>6.99);
  assert.equal(await p.locator('#play').innerText(),'일시정지');await p.click('#resetElbow');await p.waitForFunction(()=>window.sharedGaitReview.appliedElbow===0);assert.equal(await p.inputValue('#legHeight'),'7');
  assert.equal(await p.evaluate(()=>performance.getEntriesByName('shared-gait-ready').length),count);await p.click('#play');
  await p.uncheck('#repeat');await p.evaluate(()=>window.sharedGaitReview.seek(.9));await p.click('#play');await p.waitForFunction(()=>window.sharedGaitReview.phase===1);
  await p.check('#repeat');await p.click('#play');await p.waitForFunction(()=>window.sharedGaitReview.phase>.1&&window.sharedGaitReview.phase<.8);await p.click('#play');
  await input('legHeight',5);await input('elbowBend',10);
  report.models.push({model,readyMs:await p.evaluate(()=>performance.getEntriesByName('shared-gait-ready').at(-1).duration),actualAngleReadout:true,independentResets:true,liveBothInputs:true,noReload:true,keyboard:true,playLoopPause:true});
 }
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:`${out}/narrow.png`,fullPage:true});
 report.horizontalOverflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!report.horizontalOverflow);
 await p.reload();await ready();assert.equal(await p.inputValue('#legHeight'),'0');assert.equal(await p.inputValue('#elbowBend'),'0');report.refreshDefault=true;
 await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=leg-height');await p.waitForFunction(()=>window.sharedGaitReview?.ready);assert(await p.locator('#elbowControls').isHidden());assert.equal(await p.evaluate(()=>window.sharedGaitReview.elbowBendPlan),null);
 await input('legHeight',10);assert.equal(await p.evaluate(()=>window.sharedGaitReview.appliedHeight),10);report.previousLegHeightPage=true;
 assert.equal(report.errors.length,0);report.status='passed';console.log(report);
}catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync('docs/05-validation/reports/cmu-elbow-bend-ui.json',JSON.stringify(report,null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
