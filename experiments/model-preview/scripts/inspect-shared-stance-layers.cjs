// Separate the cached M56 reference, shared pelvis/leg transformation and M64.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const source=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-stance-review.json'));
const points=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-support-point.json'));
const check=()=>{for(const [f,h]of Object.entries(source.runtimeHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),h);};
(async()=>{check();const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage();await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=shared-approach');
 const results=[];
 for(const model of ['male','female']){
  if(model==='female')await p.selectOption('#model',model);
  await p.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const vertex=points.results.find(r=>r.model===model).points.find(r=>r.side==='r'&&r.selectedAt===.5).vertex;
  const layers=await p.evaluate(async vertex=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
   const lane=a.lanes[1],mesh=lane.model.getObjectByName(vertex.mesh),layers={};
   const stages={cachedM56:t=>a.plan.original(lane,t),sharedCore:t=>a.plan.core(lane,t),sharedFloor:t=>a.plan.apply(lane,a.probe,t),currentM64:t=>a.approachPlan.apply(lane,a.probe,t)};
   for(const [name,apply]of Object.entries(stages)){
    layers[name]=Array.from({length:301},(_,i)=>{
     const phase=.28+.30*i/300;apply(phase);mesh.skeleton.update();
     const point=mesh.getVertexPosition(vertex.id,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
     return {phase,point:point.toArray(),pelvis:lane.model.getObjectByName('pelvis').getWorldPosition(new T.Vector3()).toArray()};
    });
   }return layers;
  },vertex);
  results.push({model,vertex,layers});
 }
 check();fs.writeFileSync('docs/05-validation/reports/cmu-shared-stance-layers.json',JSON.stringify({status:'observation-complete',scope:'Same right-foot skin ID and same weight map at every stage; cached M56 is processed data, not original raw CMU',results}));
 console.log('PASS: cached/shared/current layers sampled without changing runtime');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
