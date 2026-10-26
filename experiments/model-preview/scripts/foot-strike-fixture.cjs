// Capture before changing the runtime; compare the same independent bone/skin samples afterwards.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const output='outputs/foot-strike';fs.mkdirSync(output,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage(),samples=[];await p.goto('http://127.0.0.1:4173/body');
 for(const model of ['male','female'])for(const custom of [false,true]){
  const s={version:1,model,scale:custom?1.1:1,ratios:custom?{torso:1.15,shoulders:.85,upperArm:1.15,forearm:.85,thigh:1.15,shin:.85}:{},leg:5,elbow:10,lean:8};
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),s);await p.goto('http://127.0.0.1:4173/pose');await p.waitForFunction(()=>window.stagePreview?.ready);
  const data=await p.evaluate(()=>{const r=window.stagePreview;r.seek(.28);const rt=r.runtime,m=rt.lane.model,result=[];
   for(const phase of [0,.16,.2,.28,.34,.42,.5,.78,.92,1])for(const amount of [0,1])for(const a of [[0,0,0],[5,10,8],[10,-20,-10]]){
    rt.apply(phase,...a,amount);const bones=[];m.traverse(o=>{if(o.isBone)bones.push([o.name,...o.matrixWorld.elements]);});
    const skin=[];for(const side of ['r','l'])for(const region of ['heel','forefoot']){const ids=rt.footPatches[side][region];for(const v of [ids[0],ids.at(-1)]){const mesh=m.getObjectByName(v.mesh);mesh.skeleton.update();skin.push(mesh.getVertexPosition(v.id,m.position.clone()).applyMatrix4(mesh.matrixWorld).toArray());}}
    result.push({phase,amount,a,bones,skin});
   }return result;
  });
  for(const d of data)samples.push({model,custom,phase:d.phase,amount:d.amount,a:d.a,hash:crypto.createHash('sha256').update(JSON.stringify([d.bones,d.skin])).digest('hex')});
 }
 const file='docs/05-validation/reports/foot-strike-baseline.json';if(process.argv.includes('--capture'))fs.writeFileSync(file,JSON.stringify(samples,null,2));else{assert.deepEqual(samples,JSON.parse(fs.readFileSync(file)));fs.writeFileSync('docs/05-validation/reports/foot-strike-regression.json',JSON.stringify({status:'passed',samples:samples.length,comparison:'Exact before/after hashes: bone world matrices and independent Three.js skin points, original and midfoot, both sexes/default and custom bodies'},null,2));}console.log(process.argv.includes('--capture')?'captured':'passed',samples.length);
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
