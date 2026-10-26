const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=process.env.STAGE_URL||'http://127.0.0.1:5173';
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage(),samples=[];
 await p.goto(base+'/body');
 for(const model of ['male','female'])for(const custom of [false,true]){
  const state={version:1,model,scale:custom?1.1:1,ratios:custom?{torso:1.15,shoulders:.85,upperArm:1.15,forearm:.85,thigh:1.15,shin:.85}:{},leg:5,elbow:10,lean:8,strike:'original'};
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),state);await p.goto(base+'/pose');await p.waitForFunction(()=>window.stagePreview?.ready);
  for(const strike of ['original','heel','midfoot','forefoot']){
   await p.selectOption('#strike',strike);
   for(const phase of [.1,.28,.6,.78]){
    const values=await p.evaluate(t=>{const r=window.stagePreview;r.seek(t);const m=r.runtime.lane.model,a=[];m.traverse(o=>{if(o.isBone)a.push(...o.matrixWorld.elements);if(o.isSkinnedMesh){o.skeleton.update();for(const i of [0,100,500])if(i<o.geometry.attributes.position.count)a.push(...o.getVertexPosition(i,m.position.clone()).applyMatrix4(o.matrixWorld).toArray());}});return a;},phase);
    assert(values.every(Number.isFinite));samples.push({model,custom,strike,phase,hash:crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex')});
   }
  }
 }
 const file='docs/05-validation/reports/course-motion-baseline.json';
 if(process.argv.includes('--capture'))fs.writeFileSync(file,JSON.stringify(samples,null,2));
 else{assert.deepEqual(samples,JSON.parse(fs.readFileSync(file)));fs.writeFileSync('docs/05-validation/reports/course-motion-regression.json',JSON.stringify({status:'passed',samples:samples.length,scope:'Exact pre/post bone matrices and sampled skin positions; two sexes, default/custom body, four strike modes, four phases'},null,2));}
 console.log(process.argv.includes('--capture')?'baseline captured':'regression passed',samples.length);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
