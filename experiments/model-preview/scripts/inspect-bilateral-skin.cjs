const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage();await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=upper-center');
 await p.waitForFunction(()=>window.sharedGaitReview?.ready);
 const result=await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const rows=[];
  for(const model of ['male','female']){
   const asset=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;asset.updateMatrixWorld(true);
   const mesh=asset.getObjectByName('Human');mesh.skeleton.update();
   rows.push({model,vertices:[11455,4229,12159,5006,5217,12370,4796].map(id=>({
    id,position:mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld).toArray(),
    weights:Array.from({length:4},(_,j)=>({bone:mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(id,j)].name,weight:mesh.geometry.attributes.skinWeight.getComponent(id,j)})).filter(v=>v.weight>0)
   }))});
  }
  return rows;
 });
 fs.writeFileSync('docs/05-validation/reports/cmu-bilateral-skin-source.json',JSON.stringify({source:'Original neutral GLB; before ankle smoothing and M63 weight correspondence',results:result},null,2));console.log('Saved original elbow, knee, calf/ankle and centerline weights.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
