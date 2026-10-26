// Historical M77 capture: restore review/shared-gait.html from history/review-shared-gait.html.txt before running.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{fs.mkdirSync('outputs/stages',{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage();await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=elbow-bend');const models={};
 for(const type of ['male','female']){if(type==='female')await p.selectOption('#model',type);await p.waitForFunction(()=>window.sharedGaitReview?.ready);
 models[type]=await p.evaluate(()=>{const r=window.sharedGaitReview,l=r.lanes[1];r.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});const rows=[];
 for(const phase of [0,.12,.27,.49,.68,.86,1])for(const leg of [0,10])for(const elbow of [-20,0,20]){r.elbowBendPlan.apply(l,r.probe,phase,leg,elbow);const values=[];l.model.traverse(o=>{if(o.isBone)values.push(...o.matrixWorld.elements);if(o.isSkinnedMesh)for(const i of [0,100,200,500,1000])if(i<o.geometry.attributes.position.count)values.push(...o.localToWorld(o.getVertexPosition(i,o.position.clone())).toArray());});rows.push({phase,leg,elbow,values});}return rows;});
 }
 const files={};for(const f of fs.readdirSync('experiments/model-preview/review').filter(f=>f.endsWith('.js')))files[f]=crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex');
 fs.writeFileSync('outputs/stages/baseline.json',JSON.stringify({models,files}));console.log('Captured M77 motion, 84 samples, all bone matrices and selected skin vertices.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
