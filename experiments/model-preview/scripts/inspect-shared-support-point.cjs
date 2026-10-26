// Follow individual material points, never reselecting the lowest point per frame.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const prior=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-stance-review.json'));
const check=()=>{for(const [f,h]of Object.entries(prior.runtimeHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),h);};
const report={status:'running',selection:'Lowest vertex within fixed toe patch at 43% and 50%, then same ID tracked',results:[]};
(async()=>{check();const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=shared-approach');
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);
  await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const patches=prior.results.find(r=>r.model===model).patches;
  const data=await page.evaluate(async patches=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
   const lane=a.lanes[1],point=v=>{const m=lane.model.getObjectByName(v.mesh);m.skeleton.update();return m.getVertexPosition(v.id,new T.Vector3()).applyMatrix4(m.matrixWorld);};
   const result=[];
   for(const side of ['r','l']){
    const shift=side==='l'?.5:0;
    for(const selectedAt of [.43,.5]){
     a.approachPlan.apply(lane,a.probe,selectedAt+shift);
     const vertex=patches[side].toe.slice().sort((u,v)=>point(u).y-point(v).y)[0];
     const rows=Array.from({length:501},(_,i)=>{
      const t=.35+.25*i/500+shift;a.approachPlan.apply(lane,a.probe,t);
      return {t,p:point(vertex).toArray(),pelvis:lane.model.getObjectByName('pelvis').getWorldPosition(new T.Vector3()).toArray()};
     });
     result.push({side,selectedAt:selectedAt+shift,vertex,rows});
    }
   }return {points:result,seconds:a.data.seconds};
  },patches);
  report.results.push({model,...data});
 }
 check();report.status='observation-complete';fs.writeFileSync('docs/05-validation/reports/cmu-shared-support-point.json',JSON.stringify(report));
 console.log('PASS: same material IDs tracked, runtime unchanged');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
