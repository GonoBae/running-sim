const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),measure=require('./measure-landing-sole.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage(),results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const model of ['male','female']){
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=pelvis-reference-restore');await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
  if(model==='female'){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});}
  const specs=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model).patchDefinition;
  const points=[];for(const u of [-.2,0,.25,.5,.75,1])for(const side of ['r','l'])points.push({side,u,phase:((side==='r'?.28+.30*u:.75+.34*u)%1+1)%1});
  const rows=await page.evaluate(measure,{samples:points.map(p=>p.phase),specs});
  results.push({model,rows:rows.map((r,i)=>({...r,side:points[i].side,u:points[i].u}))});
  console.log(model,rows.map((r,i)=>({side:points[i].side,u:points[i].u,...Object.fromEntries(['yaw','pitch','tilt','toeHeelMm','sideGapMm'].map(k=>[k,r.lanes[1].feet[points[i].side][k]]))})));
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/05-validation/reports/cmu-landing-tilt-before.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M52, independent M51 fixed skin regions, read-only',errors,results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
