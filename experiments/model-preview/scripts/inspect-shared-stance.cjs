// M65 observation only. Runtime/model hashes must remain unchanged.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const out='outputs/cmu-shared-stance-review';fs.mkdirSync(out,{recursive:true});
const files=['shared-gait.js','shared-gait-view.js','shared-gait.html','body-height.js','upper-center.js','bilateral-pose.js','bilateral-skin.js','shared-approach.js','hip-landing.js','ankle-weights.js']
 .map(n=>'experiments/model-preview/review/'+n).concat('experiments/model-preview/public/review-data/shared-gait-reference.json',...['male','female'].map(n=>'experiments/model-preview/public/models/runner-'+n+'.glb'));
const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before=hashes(),report={status:'running',testedAt:new Date().toISOString(),scope:'M64 read-only review; geometry, not force/contact/COM measurement',errors:[],results:[]};
const dest='docs/05-validation/reports/cmu-shared-stance-review.json',save=()=>fs.writeFileSync(dest,JSON.stringify(report));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=shared-approach');
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);
  await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const data=await page.evaluate(async model=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
   const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
   a.renderer.setAnimationLoop(null);
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
   const lane=a.lanes[1],V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),pos=n=>lane.model.getObjectByName(n).getWorldPosition(V());
   const neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;neutral.updateMatrixWorld(true);
   const ankleY=neutral.getObjectByName('foot_r').getWorldPosition(V()).y;
   const sets={r:[],l:[]};
   neutral.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let id=0;id<mesh.geometry.attributes.position.count;id++){
    const p=mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld);
    if(p.y<ankleY-.03)sets[p.x<0?'r':'l'].push({mesh:mesh.name,id,p});
   }});
   const quantile=(xs,q)=>xs.slice().sort((x,y)=>x-y)[Math.floor((xs.length-1)*q)],patches={};
   for(const s of ['r','l']){
    const vs=sets[s],minY=Math.min(...vs.map(v=>v.p.y)),sole=vs.filter(v=>v.p.y<=minY+.012);
    const lo=quantile(sole.map(v=>v.p.z),.2),hi=quantile(sole.map(v=>v.p.z),.8);
    patches[s]={heel:sole.filter(v=>v.p.z<=lo),toe:sole.filter(v=>v.p.z>=hi),sole};
   }
   const names=['pelvis','spine_01','spine_02','spine_03','neck_01','head',...['r','l'].flatMap(s=>['upperarm','lowerarm','hand','thigh','calf','foot','ball'].map(n=>n+'_'+s))];
   const patch=vs=>{
    const points=vs.map(v=>{const mesh=lane.model.getObjectByName(v.mesh);return mesh.getVertexPosition(v.id,V()).applyMatrix4(mesh.matrixWorld);});
    return {mean:points.reduce((v,p)=>v.add(p),V()).divideScalar(points.length).toArray(),minY:Math.min(...points.map(p=>p.y))};
   };
   const snapshot=(phase,plan=a.approachPlan)=>{
    plan.apply(lane,a.probe,phase);lane.model.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});
    const bones=Object.fromEntries(names.map(n=>[n,pos(n).toArray()])),feet={};
    for(const s of ['r','l']){
     const H=pos('thigh_'+s),K=pos('calf_'+s),A=pos('foot_'+s);
     feet[s]={...Object.fromEntries(Object.entries(patches[s]).map(([k,vs])=>[k,patch(vs)])),minY:lane.readSurface(s).min};
     const heel=new T.Vector3(...feet[s].heel.mean),toe=new T.Vector3(...feet[s].toe.mean),sole=new T.Vector3(...feet[s].sole.mean),axis=toe.clone().sub(heel);
     feet[s].kneeDeg=180-K.clone().sub(H).negate().angleTo(A.clone().sub(K))*180/Math.PI;
     feet[s].legLength=H.distanceTo(A);
     feet[s].inwardMm=(s==='r'?1:-1)*(sole.x-H.x)*1000;
     feet[s].ankleInwardMm=(s==='r'?1:-1)*(A.x-H.x)*1000;
     feet[s].solePitchDeg=Math.atan2(axis.y,Math.hypot(axis.x,axis.z))*180/Math.PI;
     feet[s].soleYawDeg=Math.atan2(axis.x,axis.z)*180/Math.PI;
     feet[s].ankleLocal=lane.model.getObjectByName('foot_'+s).quaternion.toArray();
    }
    const hipMid=pos('thigh_r').add(pos('thigh_l')).multiplyScalar(.5);
    return {phase,bones,feet,hipMid:hipMid.toArray(),modelPosition:lane.model.position.toArray()};
   };
   const cycle=Array.from({length:721},(_,i)=>snapshot(i/720));
   const stance={};
   let preservedStanceMm=0,bodyMm=0;
   for(const side of ['r','l']){
    const shift=side==='l'?.5:0;
    stance[side]=Array.from({length:361},(_,i)=>{
     const t=.26+.34*i/360+shift,now=snapshot(t),old=snapshot(t,a.bilateralPlan);
     bodyMm=Math.max(bodyMm,new T.Vector3(...now.bones.pelvis).distanceTo(new T.Vector3(...old.bones.pelvis))*1000);
     if(t-shift>=.28&&t-shift<=.58)for(const part of ['thigh','calf','foot','ball']){
      const n=part+'_'+side;preservedStanceMm=Math.max(preservedStanceMm,new T.Vector3(...now.bones[n]).distanceTo(new T.Vector3(...old.bones[n]))*1000);
     }
     return now;
    });
   }
   const repeated=[snapshot(.43),snapshot(.1),snapshot(.43)];
   let sameStageMm=0;
   for(let i=0;i<stance.r.length;i++){
    const r=stance.r[i],l=stance.l[i];
    for(const part of ['thigh','calf','foot','ball']){
     const p=new T.Vector3(...r.bones[part+'_r']).sub(new T.Vector3(...r.bones.pelvis));
     const q=new T.Vector3(...l.bones[part+'_l']).sub(new T.Vector3(...l.bones.pelvis));q.x=-q.x;
     sameStageMm=Math.max(sameStageMm,p.distanceTo(q)*1000);
    }
   }
   // Capture only the current M64 model with a camera that follows pelvis.
   // Return projected joint/skin positions for source-driven annotations.
   window.stanceReviewCapture=({phase,view})=>{
    snapshot(phase);a.lanes[0].group.visible=false;lane.lines.forEach(l=>l.visible=false);
    const center=pos('pelvis');center.y=.95;
    a.renderer.setSize(540,680);Object.assign(a.camera,{left:-.82,right:.82,top:1.03,bottom:-1.03});
    a.camera.position.copy(center).add(new T.Vector3(view==='side'?10:0,0,view==='side'?0:10));a.camera.lookAt(center);a.camera.updateProjectionMatrix();a.renderer.render(a.scene,a.camera);
    const project=p=>{const v=p.clone().project(a.camera);return [(v.x+1)*270,(1-v.y)*340];};
    const projected=Object.fromEntries(names.map(n=>[n,project(pos(n))]));
    for(const s of ['r','l']){
     for(const [n,vs]of Object.entries(patches[s]))projected[n+'_'+s]=project(new T.Vector3(...patch(vs).mean));
     const ground=pos('thigh_'+s);ground.y=0;projected['hipGround_'+s]=project(ground);
    }
    return {png:a.renderer.domElement.toDataURL('image/png').split(',')[1],projected};
   };
   return {cycle,stance,seconds:a.data.seconds,travel:a.plan.pelvisTravel.toArray(),bodyMm,preservedStanceMm,sameStageMm,
    repeatIdentical:JSON.stringify(repeated[0])===JSON.stringify(repeated[2]),
    patches:Object.fromEntries(Object.entries(patches).map(([s,parts])=>[s,Object.fromEntries(Object.entries(parts).map(([k,vs])=>[k,vs.map(({mesh,id})=>({mesh,id}))]))]))};
  },model);
  const captures=[];
  for(const view of ['front','side'])for(const phase of [.28,.34,.43,.50,.56,.58,.78,.84,.93,1,1.06,1.08]){
   const c=await page.evaluate(args=>window.stanceReviewCapture(args),{phase,view});
   const path=`${out}/${model}-${view}-${Math.round(phase*100)}.png`;fs.writeFileSync(path,Buffer.from(c.png,'base64'));delete c.png;captures.push({phase,view,path,...c});
  }
  report.results.push({model,...data,captures});save();
  assert(data.repeatIdentical&&data.bodyMm<.01&&data.preservedStanceMm<.01&&data.sameStageMm<.01);
  console.log(model,JSON.stringify({samples:data.cycle.length+data.stance.r.length+data.stance.l.length,bodyMm:data.bodyMm,preservedStanceMm:data.preservedStanceMm,sameStageMm:data.sameStageMm,captures:captures.length}));
 }
 assert.deepEqual(hashes(),before);assert.deepEqual(report.errors,[]);report.runtimeHashes=before;report.status='observation-complete';save();
 console.log('PASS: read-only stance review, unchanged runtime/assets and deterministic samples');
}finally{await browser.close();}})().catch(e=>{report.status='failed';report.error=e.stack;save();console.error(e);process.exitCode=1;});
