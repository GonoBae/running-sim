const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']}),report={status:'running',profiles:[],errors:[]};try{
 const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:4173/body');await p.waitForFunction(()=>window.stagePreview?.ready);
 for(const model of ['male','female'])for(const limit of ['min','max']){
  const ratio=limit==='min'?.85:1.15,scale=limit==='min'?.9:1.1;
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),{version:1,model,scale,ratios:Object.fromEntries(['torso','shoulders','upperArm','forearm','thigh','shin'].map(k=>[k,ratio])),leg:10,elbow:-20,lean:15,strike:'midfoot'});
  await p.goto('http://127.0.0.1:4173/pose');await p.waitForFunction(()=>window.stagePreview?.ready);
  const metrics=await p.evaluate(()=>{const r=window.stagePreview;r.seek(.28);const rt=r.runtime,max={floorChangeMm:0,anchorShiftMm:0,gapMm:0};let samples=0;
   for(let i=0;i<=100;i++){const phase=i/100;rt.apply(phase,10,-20,15,0);const floors=['r','l'].map(s=>rt.lane.readSurface(s).min);const d=rt.apply(phase,10,-20,15,1);for(const x of d.midfoot){const floor=rt.lane.readSurface(x.side).min;max.floorChangeMm=Math.max(max.floorChangeMm,Math.abs(floor-floors[x.side==='r'?0:1])*1000);max.anchorShiftMm=Math.max(max.anchorShiftMm,x.anchorDeltaMm);const t=((phase-(x.side==='l'?.5:0))%1+1)%1;if(t>=.28-1e-10&&t<=.34+1e-10)max.gapMm=Math.max(max.gapMm,Math.abs(x.gapMm));}rt.lane.model.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))throw Error('Non-finite bone transform');});samples++;}
   return {samples,max,state:r.state};});
  assert.equal(metrics.state.model,model);assert.equal(metrics.state.scale,scale);assert(Object.values(metrics.state.ratios).every(x=>x===ratio));assert(metrics.max.floorChangeMm<.02);assert(metrics.max.anchorShiftMm<.02);assert(metrics.max.gapMm<1);report.profiles.push({model,limit,...metrics});console.log(model,limit,metrics.max);
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync('docs/05-validation/reports/midfoot-limits.json',JSON.stringify(report,null,2));console.log(report.status,report.failure||'');}})();
