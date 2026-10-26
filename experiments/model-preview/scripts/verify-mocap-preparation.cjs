// Same browser/machine: alternate original and batched CPU surface readers.
// The baseline is served by a test-only HTTP response substitution. No source
// file, sample count, motion setting, or saved model is changed between runs.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),measure=require('./measure-landing-sole.cjs');
const out='outputs/cmu-preparation';fs.mkdirSync(out,{recursive:true});
const report={testedAt:new Date().toISOString(),baseline:'Original getVertexPosition loop via test-only response override',runs:[],regression:[],errors:[]};
const oldLoop='for(const {mesh,indices} of groups){mesh.skeleton.update();for(const i of indices[side])points.push(mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));}';
const newLoop='for(const {mesh,indices,readPoints} of groups){mesh.skeleton.update();for(const point of readPoints(indices[side]))points.push(point);}';
const save=()=>fs.writeFileSync('docs/05-validation/reports/cmu-mocap-preparation.json',JSON.stringify(report,null,2));
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const reference={};
 for(let repeat=0;repeat<3;repeat++)for(const model of ['male','female'])for(const variant of repeat%2?['batch','original']:['original','batch']){
  const context=await browser.newContext({viewport:{width:1280,height:940}}),page=await context.newPage();
  try{
   page.on('pageerror',e=>report.errors.push({model,variant,message:e.message}));
   // Load each requested model directly, so preparation times exclude neither
   // model's GLB download/parse. Every run has a fresh browser context.
   if(model==='female')await page.route('**/review/mocap.html*',async route=>{const response=await route.fetch();let body=await response.text();body=body.replace('<option value="male">','<option value="male">').replace('<option value="female">','<option value="female" selected>');await route.fulfill({response,body});});
   if(variant==='original')await page.route('**/review/hip-landing.js*',async route=>{
    const response=await route.fetch();let body=await response.text();assert(body.includes(newLoop),'baseline substitution must match current source');
    body=body.replace(newLoop,oldLoop).replace('groups.push({mesh,indices,readPoints:createSkinPointBatch(mesh)});','groups.push({mesh,indices});');
    await route.fulfill({response,body});
   });
   await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=toe-slip-path');
   await page.waitForFunction(()=>window.mocapReview?.ready&&!document.querySelector('.bar').inert||!document.querySelector('#loading-retry').hidden,null,{timeout:120000});
   assert(await page.locator('#loading-retry').isHidden(),'unexpected load failure');
   const timing=await page.evaluate(()=>{const at=n=>performance.getEntriesByName(n).at(-1).startTime;return {previewMs:at('mocap-model-preview'),readyMs:at('mocap-load-ready'),preparationMs:at('mocap-load-ready')-at('mocap-model-preview'),selected:document.querySelector('#model').value};});
   assert.equal(timing.selected,model);report.runs.push({repeat,model,variant,...timing});console.log(JSON.stringify(report.runs.at(-1)));save();
   if(repeat===0){
    const specs=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model).patchDefinition;
    const rows=await page.evaluate(measure,{samples:Array.from({length:365},(_,i)=>i/364),specs});
    if(variant==='original')reference[model]=rows;
    else{
     let positionMm=0,rotationDeg=0,skinMm=0,angleDeg=0,diagnosticDifference=0;
     const compareNumbers=(a,b)=>{if(typeof a==='number'&&typeof b==='number'){assert(Number.isFinite(a)&&Number.isFinite(b));diagnosticDifference=Math.max(diagnosticDifference,Math.abs(a-b));}else if(a&&typeof a==='object'){for(const key of Object.keys(a)){assert(key in b);compareNumbers(a[key],b[key]);}}};
     for(let i=0;i<rows.length;i++){
      for(let lane=0;lane<2;lane++){
       const a=reference[model][i].lanes[lane],b=rows[i].lanes[lane];
       for(const name of Object.keys(a.bones)){positionMm=Math.max(positionMm,dist(a.bones[name].p,b.bones[name].p)*1000);rotationDeg=Math.max(rotationDeg,2*Math.acos(Math.min(1,Math.abs(a.bones[name].q.reduce((s,v,j)=>s+v*b.bones[name].q[j],0))))*180/Math.PI);}
       for(const side of ['r','l']){for(const key of Object.keys(a.feet[side].regions))skinMm=Math.max(skinMm,dist(a.feet[side].regions[key],b.feet[side].regions[key])*1000);skinMm=Math.max(skinMm,dist(a.feet[side].patch,b.feet[side].patch)*1000,Math.abs(a.feet[side].floor-b.feet[side].floor)*1000);for(const key of ['yaw','pitch','bank'])angleDeg=Math.max(angleDeg,Math.abs(a.feet[side][key]-b.feet[side][key]));}
      }
      compareNumbers(reference[model][i].diagnostics,rows[i].diagnostics);
     }
     assert(positionMm<.01&&rotationDeg<.001&&skinMm<.01&&angleDeg<.001&&diagnosticDifference<1e-10);
     report.regression.push({model,phases:365,lanes:2,bones:Object.keys(rows[0].lanes[0].bones).length,positionMm,rotationDeg,skinMm,angleDeg,diagnosticDifference});console.log('POSE',JSON.stringify(report.regression.at(-1)));save();
    }
    for(const view of ['front','side']){await page.click('#'+view);await page.evaluate(()=>window.mocapReview.seek(.505*window.mocapReview.cycle.period));await page.locator('#view').screenshot({path:`${out}/${model}-${variant}-${view}.png`});}
   }
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);
 report.summary=['male','female'].map(model=>{const median=variant=>report.runs.filter(r=>r.model===model&&r.variant===variant).map(r=>r.preparationMs).sort((a,b)=>a-b)[1];const originalMs=median('original'),batchMs=median('batch');assert(batchMs<originalMs*.8,'at least 20% preparation reduction');return {model,originalMs,batchMs,reductionPercent:100*(1-batchMs/originalMs)};});
 report.hashes=Object.fromEntries(['hip-landing.js','skin-point-batch.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
 report.status='passed';save();console.log('PASS',JSON.stringify(report.summary));
}finally{await browser.close();}})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1;});
