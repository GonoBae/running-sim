const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='outputs/cmu-shared-approach';fs.mkdirSync(out,{recursive:true});
const file='docs/05-validation/reports/cmu-shared-approach.json';
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]},save=()=>fs.writeFileSync(file,JSON.stringify(report));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=shared-approach');
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);
  await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const r=await page.evaluate(async model=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
   const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
   a.renderer.setAnimationLoop(null);
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
   const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),names=a.plan.reference.bones.map(b=>b.name);
   const pos=(l,n)=>l.model.getObjectByName(n).getWorldPosition(V());
   const neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;neutral.updateMatrixWorld(true);
   const soleIds={r:[],l:[]},cut=neutral.getObjectByName('foot_r').getWorldPosition(V()).y-.03;
   neutral.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
    for(let id=0;id<mesh.geometry.attributes.position.count;id++){
     const p=mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld);
     if(p.y<cut)soleIds[p.x<0?'r':'l'].push({name:mesh.name,id});
    }
   });
   const fixedSole=(l,side)=>{
    l.model.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});const center=V();
    for(const {name,id}of soleIds[side]){const mesh=l.model.getObjectByName(name);center.add(mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld));}
    return center.divideScalar(soleIds[side].length);
   };
   const angle=(p,q)=>p.clone().normalize().angleTo(q.clone().normalize())*180/Math.PI;
   const mirror=q=>new T.Quaternion(q.x,-q.y,-q.z,q.w).normalize();
   const rest=Object.fromEntries(a.plan.reference.bones.map(b=>[b.name,new T.Quaternion(...b.worldQ).normalize()]));
   const snapshot=l=>({model:l.model.position.clone(),root:pos(l,'pelvis'),bones:Object.fromEntries(names.map(n=>{
    const b=l.model.getObjectByName(n);return [n,{p:pos(l,n),q:b.getWorldQuaternion(Q()).normalize(),local:b.quaternion.clone(),offset:b.position.clone()}];
   })),surface:Object.fromEntries(['r','l'].map(s=>[s,l.readSurface(s)]))});
   const m={preservedBodyMm:0,preservedUpperDeg:0,boneOffsetMm:0,ankleWorldDeg:0,ankleLocalDeg:0,calfWorldDeg:0,
    footHeightMm:0,surfaceHeightMm:0,minSurfaceMm:Infinity,stanceMm:0,outsideMm:0,outsideDeg:0,maxForwardChangeMm:0,
    maxLateralChangeMm:0,mirrorMm:0,mirrorDeg:0,seamMm:0,seamDeg:0,velocityGapMps:0,velocityGapDegps:0,reseekMm:0};
   const poses=[],rows=[],N=720;
   for(let i=0;i<=N;i++){
    const t=i/N;a.bilateralPlan.apply(a.lanes[0],a.probe,t);a.approachPlan.apply(a.lanes[1],a.probe,t);
    const before=snapshot(a.lanes[0]),after=snapshot(a.lanes[1]);poses.push(after);
    m.preservedBodyMm=Math.max(m.preservedBodyMm,before.model.distanceTo(after.model)*1000);
    for(const n of names){
     const b=before.bones[n],c=after.bones[n],leg=/^(thigh|calf|foot|ball)_[rl]$/.test(n);
     m.boneOffsetMm=Math.max(m.boneOffsetMm,b.offset.distanceTo(c.offset)*1000);
     if(!leg){
      m.preservedBodyMm=Math.max(m.preservedBodyMm,b.p.distanceTo(c.p)*1000);
      m.preservedUpperDeg=Math.max(m.preservedUpperDeg,angle(b.q,c.q));
     }else{
      const side=n.endsWith('_l')?'l':'r',active=a.approachPlan.at(t+(side==='l'?.5:0));
      if(!active){m.outsideMm=Math.max(m.outsideMm,b.p.distanceTo(c.p)*1000);m.outsideDeg=Math.max(m.outsideDeg,angle(b.q,c.q));}
      if(n.startsWith('foot')||n.startsWith('ball')){
       m.ankleWorldDeg=Math.max(m.ankleWorldDeg,angle(b.q,c.q));
       m.ankleLocalDeg=Math.max(m.ankleLocalDeg,angle(b.local,c.local));
       m.footHeightMm=Math.max(m.footHeightMm,Math.abs(b.p.y-c.p.y)*1000);
       m.maxLateralChangeMm=Math.max(m.maxLateralChangeMm,Math.abs(b.p.x-c.p.x)*1000);
       m.maxForwardChangeMm=Math.max(m.maxForwardChangeMm,Math.abs(b.p.z-c.p.z)*1000);
       const phase=(t+(side==='l'?.5:0))%1;
       if(phase>=.28&&phase<=.58)m.stanceMm=Math.max(m.stanceMm,b.p.distanceTo(c.p)*1000);
      }
      if(n.startsWith('calf'))m.calfWorldDeg=Math.max(m.calfWorldDeg,angle(b.q,c.q));
     }
    }
    for(const s of ['r','l']){
     m.surfaceHeightMm=Math.max(m.surfaceHeightMm,Math.abs(before.surface[s].min-after.surface[s].min)*1000);
     m.minSurfaceMm=Math.min(m.minSurfaceMm,after.surface[s].min*1000);
    }
    rows.push({t,before:before.bones.foot_r.p.clone().sub(before.bones.thigh_r.p).toArray(),
     after:after.bones.foot_r.p.clone().sub(after.bones.thigh_r.p).toArray()});
   }
   for(let i=0;i<=N/2;i++)for(const n of names.filter(n=>n!=='Root'&&!n.endsWith('_l'))){
    const pair=n.endsWith('_r')?n.slice(0,-2)+'_l':n,b=poses[i],c=poses[i+N/2];
    const p=b.bones[n].p.clone().sub(b.root),q=c.bones[pair].p.clone().sub(c.root);q.x=-q.x;
    m.mirrorMm=Math.max(m.mirrorMm,p.distanceTo(q)*1000);
    m.mirrorDeg=Math.max(m.mirrorDeg,angle(b.bones[n].q.clone().multiply(rest[n].clone().invert()),mirror(c.bones[pair].q.clone().multiply(rest[pair].clone().invert()))));
   }
   // Independent curve measurements: total sideways distance minus net
   // displacement is the avoidable inward/outward excursion.
   const approach=[];
   for(const side of ['r','l']){
    const sign=side==='r'?1:-1,shift=side==='l'?.5:0,path=[];
    const {start,end}=a.approachPlan.window;
    for(let i=0;i<=400;i++){
     const canonical=start+(end-start)*i/400,t=canonical-shift;
     a.bilateralPlan.apply(a.lanes[0],a.probe,t);a.approachPlan.apply(a.lanes[1],a.probe,t);
     path.push({t:canonical,before:sign*(pos(a.lanes[0],'foot_'+side).x-pos(a.lanes[0],'thigh_'+side).x),
      after:sign*(pos(a.lanes[1],'foot_'+side).x-pos(a.lanes[1],'thigh_'+side).x),
      surfaceBefore:sign*(a.lanes[0].readSurface(side).center.x-pos(a.lanes[0],'thigh_'+side).x),
      surfaceAfter:sign*(a.lanes[1].readSurface(side).center.x-pos(a.lanes[1],'thigh_'+side).x),
      fixedBefore:sign*(fixedSole(a.lanes[0],side).x-pos(a.lanes[0],'thigh_'+side).x),
      fixedAfter:sign*(fixedSole(a.lanes[1],side).x-pos(a.lanes[1],'thigh_'+side).x)});
    }
    const excess=key=>{let travel=0,reverse=0;for(let i=1;i<path.length;i++){const d=path[i][key]-path[i-1][key];travel+=Math.abs(d);if(d<0)reverse-=d;}return {travelMm:travel*1000,reverseMm:reverse*1000,excessMm:(travel-Math.abs(path.at(-1)[key]-path[0][key]))*1000};};
    approach.push({side,before:excess('before'),after:excess('after'),
     fixedSurfaceBefore:excess('fixedBefore'),fixedSurfaceAfter:excess('fixedAfter'),fixedVertices:soleIds[side].length,
     changingLowestBefore:excess('surfaceBefore'),changingLowestAfter:excess('surfaceAfter'),path});
   }
   // C1 pose connection at both new joins, half-cycle counterparts and wrap.
   const {start,end}=a.approachPlan.window;
   const boundaries=[start,end,start-.5,end-.5,0,.5,1],h=1e-5;
   for(const t of boundaries){
    const s=[-2,-1,0,1,2].map(k=>{a.approachPlan.apply(a.lanes[1],a.probe,t+k*h);return snapshot(a.lanes[1]);});
    for(const n of names){
     const p=s.map(x=>x.bones[n].p.clone().sub(x.root)),q=s.map(x=>x.bones[n].q);
     const vl=p[2].clone().multiplyScalar(3).addScaledVector(p[1],-4).add(p[0]).divideScalar(2*h*a.data.seconds);
     const vr=p[2].clone().multiplyScalar(-3).addScaledVector(p[3],4).addScaledVector(p[4],-1).divideScalar(2*h*a.data.seconds);
     const gap=vl.distanceTo(vr);
     if(gap>m.velocityGapMps){m.velocityGapMps=gap;m.worstVelocity={t,n,vl:vl.toArray(),vr:vr.toArray()};}
     m.velocityGapDegps=Math.max(m.velocityGapDegps,Math.abs(angle(q[1],q[2])-angle(q[2],q[3]))/(h*a.data.seconds));
    }
   }
   for(const n of names){
    m.seamMm=Math.max(m.seamMm,poses[0].bones[n].p.clone().sub(poses[0].root).distanceTo(poses[N].bones[n].p.clone().sub(poses[N].root))*1000);
    m.seamDeg=Math.max(m.seamDeg,angle(poses[0].bones[n].q,poses[N].bones[n].q));
   }
   // Independent full surface correspondence; include skin affected by thigh
   // rotations, not only the retained foot bones.
   const cells=new Map(),vertices=[],key=v=>[v.x,v.y,v.z].map(x=>Math.round(x/.0002)).join(',');
   neutral.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let id=0;id<mesh.geometry.attributes.position.count;id++){
    const p=mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld),v={mesh:mesh.name,id,p};vertices.push(v);
    const k=key(p);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(v);
   }});
   const pairs=[];
   for(const v of vertices){
    const target=new T.Vector3(-v.p.x,v.p.y,v.p.z),base=[target.x,target.y,target.z].map(x=>Math.round(x/.0002));let best=null,distance=.0002;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const c of cells.get([base[0]+x,base[1]+y,base[2]+z].join(','))||[]){
     const d=c.p.distanceTo(target);if(d<distance){distance=d;best=c;}
    }if(best)pairs.push([v,best]);
   }
   let skinMirrorMm=0;
   for(let i=0;i<=24;i++){
    a.approachPlan.apply(a.lanes[0],a.probe,i/48);a.approachPlan.apply(a.lanes[1],a.probe,i/48+.5);
    const roots=a.lanes.map(l=>pos(l,'pelvis')),meshes=a.lanes.map(l=>{const map=new Map();l.model.traverse(m=>{if(m.isSkinnedMesh){m.skeleton.update();map.set(m.name,m);}});return map;});
    for(const [u,v]of pairs){
     const sm=meshes[0].get(u.mesh),tm=meshes[1].get(v.mesh);
     const p=sm.getVertexPosition(u.id,V()).applyMatrix4(sm.matrixWorld).sub(roots[0]);
     const q=tm.getVertexPosition(v.id,V()).applyMatrix4(tm.matrixWorld).sub(roots[1]);q.x=-q.x;
     skinMirrorMm=Math.max(skinMirrorMm,p.distanceTo(q)*1000);
    }
   }
   a.view(false);a.seek(.99);const p=pos(a.lanes[1],'foot_r');a.seek(.4);a.seek(.99);m.reseekMm=p.distanceTo(pos(a.lanes[1],'foot_r'))*1000;
   return {metrics:m,window:a.approachPlan.window,approach,rows,skin:{vertices:vertices.length,matched:pairs.length,maxMirrorMm:skinMirrorMm}};
  },model);
  report.results.push({model,...r});save();console.log(model,JSON.stringify({metrics:r.metrics,window:r.window,skin:r.skin,approach:r.approach.map(({path,...x})=>x)}));
  const m=r.metrics;
  assert(m.preservedBodyMm<.01&&m.preservedUpperDeg<.001&&m.boneOffsetMm<.01,'body and lengths');
  assert(m.ankleWorldDeg<.001&&m.ankleLocalDeg<.001&&m.calfWorldDeg<.001,'both ankle reference frames');
  assert(m.footHeightMm<.01&&m.surfaceHeightMm<.01&&m.minSurfaceMm>=-.01,'foot/ground height');
  assert(m.stanceMm<.01&&m.outsideMm<.01&&m.outsideDeg<.001,'stance and out-of-window motion');
  assert(m.mirrorMm<.01&&m.mirrorDeg<.001&&r.skin.matched===r.skin.vertices&&r.skin.maxMirrorMm<.001,'whole pose and skin symmetry');
  assert(m.seamMm<.01&&m.seamDeg<.001&&m.velocityGapMps<.001&&m.velocityGapDegps<1,'smooth joins');
  assert(m.reseekMm<.01,'deterministic seek');
  for(const p of r.approach){
   assert(p.after.reverseMm<.01&&p.after.excessMm<p.before.excessMm*.05,'remove ankle sideways reversals');
   assert(p.fixedSurfaceAfter.excessMm<p.fixedSurfaceBefore.excessMm*.6,'same fixed sole vertices path also improves');
  }
  for(const view of ['front','side'])for(const phase of [.86,.98,.10,.22,.28,.48,.60]){
   await page.click('#'+view);await page.evaluate(t=>window.sharedGaitReview.seek(t),phase);
   await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*1000)}.png`});
  }
 }
 await page.reload();await page.waitForFunction(()=>window.sharedGaitReview?.ready);
 await page.click('#play');await page.waitForTimeout(2600);assert.equal(await page.textContent('#play'),'일시정지');
 await page.click('#side');await page.click('#play');await page.uncheck('#repeat');
 await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');
 await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생');
 assert.deepEqual(report.errors,[]);report.playback={repeat:true,singleCycleStop:true,viewDuringPlay:true};
 report.status='passed';save();console.log('PASS: approach, whole-body/skin symmetry, both ankle frames, height, stance, joins and playback');
}finally{await browser.close();}})().catch(e=>{report.status='failed';report.error=e.stack;save();console.error(e);process.exitCode=1;});
