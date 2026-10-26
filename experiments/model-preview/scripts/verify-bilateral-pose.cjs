const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out='outputs/cmu-bilateral-pose';fs.mkdirSync(out,{recursive:true});
const dest='docs/05-validation/reports/cmu-bilateral-pose.json';
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]},save=()=>fs.writeFileSync(dest,JSON.stringify(report));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=bilateral-pose');
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const r=await page.evaluate(async model=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
   const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
   a.renderer.setAnimationLoop(null);
   const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),ref=a.plan.reference,names=ref.bones.map(b=>b.name);
   const neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;neutral.updateMatrixWorld(true);
   const rest=Object.fromEntries(ref.bones.map(b=>[b.name,new T.Quaternion(...b.worldQ).normalize()]));
   const mirror=q=>new T.Quaternion(q.x,-q.y,-q.z,q.w).normalize();
   const angle=(x,y)=>x.clone().normalize().angleTo(y.clone().normalize())*180/Math.PI;
   const normalizeGroups=()=>a.lanes.forEach(l=>{l.group.scale.set(1,1,1);l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
   normalizeGroups();
   const position=(l,n)=>l.model.getObjectByName(n).getWorldPosition(V());
   const snapshot=l=>{const root=position(l,'pelvis');return {root,position:l.model.position.clone(),bones:Object.fromEntries(names.map(n=>{
    const b=l.model.getObjectByName(n);return [n,{p:position(l,n).sub(root),q:b.getWorldQuaternion(Q()).normalize(),local:b.quaternion.clone()}];
   }))};};
   const feet=a.lanes.map(l=>{
    const result=[];l.model.traverse(mesh=>{
     if(!mesh.isSkinnedMesh)return;const at=mesh.geometry.attributes,ids=[],neutralMesh=neutral.getObjectByName(mesh.name);
     neutralMesh.skeleton.update();
     const ankleY=neutral.getObjectByName('foot_r').getWorldPosition(V()).y;
     for(let i=0;i<at.skinIndex.count;i++){
      let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_[rl]$/.test(mesh.skeleton.bones[at.skinIndex.getComponent(i,j)].name))w+=at.skinWeight.getComponent(i,j);
      // A foot weight also affects calf skin >10cm above the ankle. Test
      // the geometric lower foot separately when preserving ground contact.
      const y=neutralMesh.getVertexPosition(i,V()).applyMatrix4(neutralMesh.matrixWorld).y;
      if(w>.05&&y<ankleY-.03)ids.push(i);
     }
     result.push({mesh,ids});
    });return ()=>{const points=[];for(const {mesh,ids}of result){mesh.skeleton.update();for(const i of ids)points.push(mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld));}return points;};
   });
   const m={preservedPositionMm:0,preservedRotationDeg:0,preservedLocalDeg:0,footSkinMm:0,minFootYmm:Infinity,modelPositionMm:0,
    contactHeightChangeMm:0,
    maxJointMirrorMm:0,maxJointMirrorDeg:0,seamMm:0,seamDeg:0,velocityGapMps:0,screenMirrorPx:0,reseekPx:0};
   const parts=Object.fromEntries(names.filter(n=>n!=='Root'&&!n.endsWith('_l')).map(n=>[n,{mm:0,deg:0}]));
   const pose=[],rows=[],N=720,allowed=new Set(a.bilateralPlan.rightNames.map(n=>n.slice(0,-2)+'_l'));
   for(let i=0;i<=N;i++){
    const t=i/N;a.poseSkin.setEnabled(false);a.upperPlan.apply(a.lanes[0],a.probe,t);
    const old=snapshot(a.lanes[0]),oldSkin=feet[0]();
    a.poseSkin.setEnabled(true);a.bilateralPlan.apply(a.lanes[1],a.probe,t);
    const now=snapshot(a.lanes[1]),skin=[oldSkin,feet[1]()];
    m.modelPositionMm=Math.max(m.modelPositionMm,old.position.distanceTo(now.position)*1000);
    for(const n of names)if(!allowed.has(n)){
     m.preservedPositionMm=Math.max(m.preservedPositionMm,old.bones[n].p.distanceTo(now.bones[n].p)*1000);
     m.preservedRotationDeg=Math.max(m.preservedRotationDeg,angle(old.bones[n].q,now.bones[n].q));
     m.preservedLocalDeg=Math.max(m.preservedLocalDeg,angle(old.bones[n].local,now.bones[n].local));
    }
    skin[1].forEach((v,j)=>{m.footSkinMm=Math.max(m.footSkinMm,v.distanceTo(skin[0][j])*1000);m.minFootYmm=Math.min(m.minFootYmm,v.y*1000);});
    for(const side of ['r','l']){
     a.poseSkin.setEnabled(false);const oldY=a.lanes[0].readSurface(side).min;
     a.poseSkin.setEnabled(true);const newY=a.lanes[1].readSurface(side).min;
     m.contactHeightChangeMm=Math.max(m.contactHeightChangeMm,Math.abs(oldY-newY)*1000);
    }
    pose.push(now);
    rows.push({phase:t,before:Object.fromEntries(['lowerarm_r','hand_r','lowerarm_l','hand_l'].map(n=>[n,old.bones[n].p.toArray()])),
     after:Object.fromEntries(['lowerarm_r','hand_r','lowerarm_l','hand_l'].map(n=>[n,now.bones[n].p.toArray()]))});
   }
   for(let i=0;i<=N/2;i++)for(const [name,part]of Object.entries(parts)){
    const paired=name.endsWith('_r')?name.slice(0,-2)+'_l':name,b=pose[i].bones[name],c=pose[i+N/2].bones[paired];
    const mm=b.p.distanceTo(new T.Vector3(-c.p.x,c.p.y,c.p.z))*1000;
    const deg=angle(b.q.clone().multiply(rest[name].clone().invert()),mirror(c.q.clone().multiply(rest[paired].clone().invert())));
    part.mm=Math.max(part.mm,mm);part.deg=Math.max(part.deg,deg);
    m.maxJointMirrorMm=Math.max(m.maxJointMirrorMm,mm);m.maxJointMirrorDeg=Math.max(m.maxJointMirrorDeg,deg);
   }
   for(const n of names){
    m.seamMm=Math.max(m.seamMm,pose[0].bones[n].p.distanceTo(pose[N].bones[n].p)*1000);
    m.seamDeg=Math.max(m.seamDeg,angle(pose[0].bones[n].q,pose[N].bones[n].q));
   }
   for(const t of [0,.5,1]){
    const h=1e-5,samples=[-2,-1,0,1,2].map(k=>{a.bilateralPlan.apply(a.lanes[1],a.probe,t+k*h);return snapshot(a.lanes[1]);});
    for(const n of names){
     const p=samples.map(s=>s.bones[n].p);
     const vl=p[2].clone().multiplyScalar(3).addScaledVector(p[1],-4).add(p[0]).divideScalar(2*h*a.data.seconds);
     const vr=p[2].clone().multiplyScalar(-3).addScaledVector(p[3],4).addScaledVector(p[4],-1).divideScalar(2*h*a.data.seconds);
     m.velocityGapMps=Math.max(m.velocityGapMps,vl.distanceTo(vr));
    }
   }
   // Match actual neutral surface vertices by reflected rest-world position.
   // Test skin separately from joint positions; report unmatched coverage.
   const cells=new Map(),vertices=[],key=v=>[v.x,v.y,v.z].map(x=>Math.round(x/.0002)).join(',');
   neutral.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
    for(let id=0;id<mesh.geometry.attributes.position.count;id++){
     const p=mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld),vertex={mesh:mesh.name,id,p};
     vertices.push(vertex);const k=key(p);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(vertex);
    }
   });
   const pairs=[];let maxRestMm=0;
   for(const v of vertices){
    const target=new T.Vector3(-v.p.x,v.p.y,v.p.z),base=[target.x,target.y,target.z].map(x=>Math.round(x/.0002));let best=null,distance=.0002;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const c of cells.get([base[0]+x,base[1]+y,base[2]+z].join(','))||[]){
     const d=c.p.distanceTo(target);if(d<distance){distance=d;best=c;}
    }
    if(best){pairs.push([v,best]);maxRestMm=Math.max(maxRestMm,distance*1000);}
   }
   let maxSkinMirrorMm=0,worstSkin=null;
   const skinRows=[];
   for(let i=0;i<=24;i++){
    const t=i/48;a.bilateralPlan.apply(a.lanes[0],a.probe,t);a.bilateralPlan.apply(a.lanes[1],a.probe,t+.5);
    const pelvis=a.lanes.map(l=>position(l,'pelvis')),points=a.lanes.map(l=>{
     const map=new Map();l.model.traverse(mesh=>{if(mesh.isSkinnedMesh){mesh.skeleton.update();map.set(mesh.name,mesh);}});return map;
    });let maximum=0;
    for(const [u,v]of pairs){
     const sm=points[0].get(u.mesh),tm=points[1].get(v.mesh);
     const p=sm.getVertexPosition(u.id,V()).applyMatrix4(sm.matrixWorld).sub(pelvis[0]);
     const q=tm.getVertexPosition(v.id,V()).applyMatrix4(tm.matrixWorld).sub(pelvis[1]);q.x=-q.x;
     const mm=p.distanceTo(q)*1000;maximum=Math.max(maximum,mm);
     if(mm>maxSkinMirrorMm){maxSkinMirrorMm=mm;worstSkin={phase:t,source:{mesh:u.mesh,id:u.id},target:{mesh:v.mesh,id:v.id}};}
    }
    skinRows.push({phase:t,maxMm:maximum});
   }
   // Verify actual displayed points in both camera views, including reflection.
   const projection=(l,n)=>position(l,n).project(a.camera);
   for(const side of [false,true])for(const t of [.1,.2555555556,.28,.6,.78]){
    a.view(side);a.seek(t);
    for(const n of names.filter(n=>n!=='Root')){
     const paired=n.endsWith('_r')?n.slice(0,-2)+'_l':n.endsWith('_l')?n.slice(0,-2)+'_r':n;
     const x=projection(a.lanes[0],n).sub(projection(a.lanes[0],'pelvis')),y=projection(a.lanes[1],paired).sub(projection(a.lanes[1],'pelvis'));
     m.screenMirrorPx=Math.max(m.screenMirrorPx,Math.hypot((x.x-y.x)*a.renderer.domElement.width/2,(x.y-y.y)*a.renderer.domElement.height/2));
    }
   }
   a.view(false);a.seek(.28);const first=projection(a.lanes[1],'hand_l');a.seek(.73);a.seek(.28);
   m.reseekPx=first.distanceTo(projection(a.lanes[1],'hand_l'))*a.renderer.domElement.width/2;
   return {metrics:m,parts,rows,poseSkin:a.poseSkin.summary,skin:{vertices:vertices.length,matched:pairs.length,coverage:pairs.length/vertices.length,maxRestMm,maxSkinMirrorMm,worstSkin,rows:skinRows},loadMs:performance.getEntriesByName('shared-gait-ready').at(-1).duration};
  },model);
  report.results.push({model,...r});save();console.log(model,JSON.stringify(r.metrics),JSON.stringify({...r.skin,rows:undefined}));
  assert(r.metrics.maxJointMirrorMm<.01&&r.metrics.maxJointMirrorDeg<.001,'all joint pairs');
  assert(r.metrics.preservedPositionMm<.01&&r.metrics.preservedRotationDeg<.001&&r.metrics.modelPositionMm<.01,'accepted body and right arm');
  assert(r.metrics.footSkinMm<.01&&r.metrics.minFootYmm>=-.01&&r.metrics.contactHeightChangeMm<.01,'independent lower foot surface and contact');
  assert(r.metrics.seamMm<.01&&r.metrics.seamDeg<.001&&r.metrics.velocityGapMps<.001,'whole-pose loop continuity');
  assert(r.skin.coverage>=.99&&r.skin.maxSkinMirrorMm<1,'actual full skin correspondence');
  assert(r.metrics.screenMirrorPx<.01&&r.metrics.reseekPx<.01,'actual front/side projection');
  for(const baseline of [true,false])for(const view of ['front','side'])for(const phase of [.1,.2555555556,.28]){
   await page.setChecked('#poseBaseline',baseline);await page.click('#'+view);await page.evaluate(t=>window.sharedGaitReview.seek(t),phase);
   await page.locator('#view canvas').screenshot({path:`${out}/${model}-${baseline?'before':'after'}-${view}-${Math.round(phase*1000)}.png`});
  }
 }
 await page.reload();await page.waitForFunction(()=>window.sharedGaitReview?.ready);await page.click('#play');await page.waitForTimeout(3300);
 assert.equal(await page.textContent('#play'),'일시정지');await page.click('#side');await page.click('#play');
 await page.uncheck('#repeat');await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');
 await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생');
 report.playback={repeat:true,singleCycleStop:true,viewDuringPlay:true};
 const archived=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-upper-center.json'));
 report.preservedSource=Object.fromEntries(['shared-gait.js','body-height.js','upper-center.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')===archived.hashes[f]]));
 assert(Object.values(report.preservedSource).every(Boolean));assert.deepEqual(report.errors,[]);
 report.status='passed';save();console.log('PASS: full skeleton, surface, preserved lower body, mirrored view and playback');
}finally{await browser.close();}})().catch(e=>{report.status='failed';report.error=e.stack;save();console.error(e);process.exitCode=1;});

