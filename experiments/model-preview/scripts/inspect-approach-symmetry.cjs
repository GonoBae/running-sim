// M61: compare actual rendered M60 in ground, pelvis, torso and screen frames.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out='outputs/cmu-approach-symmetry';fs.mkdirSync(out,{recursive:true});
const files=['shared-gait.js','body-height.js','shared-gait-view.js','shared-gait.html','ankle-weights.js','hip-landing.js'].map(n=>'experiments/model-preview/review/'+n);
const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before=hashes(),report={testedAt:new Date().toISOString(),status:'running',errors:[],results:[]};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=body-height');
 const archived=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-whole-body-audit.json'));
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const patches=archived.results.find(r=>r.model===model).patches;
  const data=await page.evaluate(async patches=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);a.view(false);
   const lane=a.lanes[1],V=()=>new T.Vector3(),pos=n=>lane.group.worldToLocal(lane.model.getObjectByName(n).getWorldPosition(V()));
   const screen=p=>{const world=lane.group.localToWorld(p.clone()).project(a.camera);return [(world.x+1)*a.renderer.domElement.width/2,(1-world.y)*a.renderer.domElement.height/2];};
   function snapshot(phase){
    a.seek(phase);const names=['pelvis','head','neck_01',...['r','l'].flatMap(s=>['thigh','calf','foot','ball','upperarm','lowerarm','hand'].map(n=>n+'_'+s))];
    const bones=Object.fromEntries(names.map(n=>[n,pos(n).toArray()]));
    const hipMid=pos('thigh_r').add(pos('thigh_l')).multiplyScalar(.5),shoulderMid=pos('upperarm_r').add(pos('upperarm_l')).multiplyScalar(.5);
    const feet={};
    for(const s of ['r','l']){
     feet[s]={};
     for(const key of ['heel','toe']){
      const points=patches[s][key].map(({mesh:name,id})=>{const mesh=lane.model.getObjectByName(name);mesh.skeleton.update();return lane.group.worldToLocal(mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld));});
      feet[s][key]=points.reduce((sum,p)=>sum.add(p),V()).divideScalar(points.length).toArray();
     }
     feet[s].center=new T.Vector3(...feet[s].heel).add(new T.Vector3(...feet[s].toe)).multiplyScalar(.5).toArray();
    }
    const projected={pelvis:screen(pos('pelvis')),hipMid:screen(hipMid),shoulderMid:screen(shoulderMid),head:screen(pos('head'))};
    for(const s of ['r','l'])for(const n of ['thigh','calf','foot','ball'])projected[n+'_'+s]=screen(pos(n+'_'+s));
    for(const s of ['r','l'])projected['surface_'+s]=screen(new T.Vector3(...feet[s].center));
    return {phase,bones,feet,hipMid:hipMid.toArray(),shoulderMid:shoulderMid.toArray(),camera:a.camera.position.toArray(),projected,delta:a.diagnostic.bodyHeightDelta};
   }
   const pairs=Array.from({length:181},(_,i)=>{const t=.10+.18*i/180;return {phase:t,right:snapshot(t),left:snapshot(t+.5)};});
   const cycle=Array.from({length:365},(_,i)=>snapshot(i/364));
   return {pairs,cycle,travel:a.plan.pelvisTravel.toArray(),seconds:a.data.seconds,pixelSize:[a.renderer.domElement.width,a.renderer.domElement.height]};
  },patches);
  const captures=[];
  for(const phase of [.10,.18,.24,.28,.60,.68,.74,.78]){
   await page.evaluate(p=>window.sharedGaitReview.seek(p),phase);
   const path=`${out}/${model}-front-${Math.round(phase*100)}.png`;await page.locator('#view canvas').screenshot({path});
   captures.push({phase,path});
  }
  report.results.push({model,...data,captures});console.log(model,'181 matched approaches and 365 full-cycle samples');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),before);
 report.status='observed';report.hashes=before;
 fs.writeFileSync('docs/05-validation/reports/cmu-approach-symmetry.json',JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
