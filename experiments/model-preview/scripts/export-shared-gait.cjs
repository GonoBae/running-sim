// Bake the reviewed M56 right-leg reference and the full before pose.
// This is derived animation data, not a new motion-capture source.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const data={schema:1,source:'35_17 / processed M56, right leg reference',samples:364,seconds:91/120,models:{},hashes:{}},errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=toe-slip-path');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.mocapReview?.ready&&!document.querySelector('.bar').inert,null,{timeout:90000});
   data.models[model]=await page.evaluate(async({model,count})=>{
    const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const a=window.mocapReview;a.renderer.setAnimationLoop(null);
    const rest=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;rest.updateMatrixWorld(true);
    const lane=a.comparison.lanes[1],bones=lane.bones.map(b=>{const n=rest.getObjectByName(b.name);return {name:b.name,parent:b.parent.name,p:n.position.toArray(),localQ:n.quaternion.toArray(),worldQ:n.getWorldQuaternion(new T.Quaternion()).normalize().toArray()};});
    const frames=[];
    for(let i=0;i<=count;i++){
     a.seek(i/count*a.cycle.period);
     frames.push({position:lane.model.position.toArray(),q:lane.bones.map(b=>b.quaternion.toArray()),
      pelvis:lane.group.worldToLocal(lane.model.getObjectByName('pelvis').getWorldPosition(new T.Vector3())).toArray(),
      pelvisQ:lane.model.getObjectByName('pelvis').getWorldQuaternion(new T.Quaternion()).normalize().toArray(),
      rightQ:['thigh','calf','foot','ball'].map(n=>lane.model.getObjectByName(n+'_r').getWorldQuaternion(new T.Quaternion()).normalize().toArray()),
      floor:lane.readSurface('r').min});
    }
    return {bones,frames};
   },{model,count:data.samples});
   data.models[model].modelHash=sha('experiments/model-preview/public/models/runner-'+model+'.glb');
   console.log(model,'baked',data.models[model].frames.length,'frames',data.models[model].bones.length,'bones');
  }
  assert.deepEqual(errors,[]);
  for(const f of fs.readdirSync('experiments/model-preview/review').filter(f=>f.endsWith('.js')&&!f.startsWith('shared-gait')))data.hashes[f]=sha('experiments/model-preview/review/'+f);
  fs.mkdirSync('experiments/model-preview/public/review-data',{recursive:true});
  fs.writeFileSync('experiments/model-preview/public/review-data/shared-gait-reference.json',JSON.stringify(data));
  console.log('Reference written; no runtime/model changes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
