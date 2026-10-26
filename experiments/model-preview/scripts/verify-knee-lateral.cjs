// M69: preserve the M68 bend and both leg endpoints; reduce hip-relative knee X backtracking.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file='docs/05-validation/reports/cmu-knee-lateral.json',out='outputs/cmu-knee-lateral';
fs.mkdirSync(out,{recursive:true});
const archived=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-release.json'));
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(report));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=knee-lateral');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
   const result=await page.evaluate(async({model,old})=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
    a.renderer.setAnimationLoop(null);
    a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
    const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),names=a.plan.reference.bones.map(b=>b.name),sides=['r','l'];
    const ids=model==='male'?{r:6707,l:13833}:{r:5462,l:12615};
    const sample=(plan,l,t,skin=true)=>{
     const diagnostic=plan.apply(l,a.probe,t);const mesh=l.model.getObjectByName('Human');mesh.skeleton.update();
     const bones=Object.fromEntries(names.map(n=>{const b=l.model.getObjectByName(n);return[n,{p:b.getWorldPosition(V()),q:b.getWorldQuaternion(Q()).normalize(),local:b.quaternion.clone(),offset:b.position.clone()}];}));
     const feet=Object.fromEntries(sides.map(s=>{
      const H=bones['thigh_'+s].p,K=bones['calf_'+s].p,A=bones['foot_'+s].p;
      return[s,{point:mesh.getVertexPosition(ids[s],V()).applyMatrix4(mesh.matrixWorld),floor:skin?l.readSurface(s).min:0,knee:180-H.clone().sub(K).angleTo(A.clone().sub(K))*180/Math.PI}];
     }));
     return {bones,feet,root:l.model.position.clone(),diagnostic};
    };
    const m={bodyMm:0,bodyDeg:0,boneOffsetMm:0,archivedM68Mm:0,archivedM68JointMm:0,archivedM68KneeDeg:0,outsideMm:0,outsideDeg:0,footWorldDeg:0,ankleHeightMm:0,
     pointHeightMm:0,floorDeltaMm:0,minFloorMm:Infinity,relativeAnkleDeg:0,kneeDeltaDeg:0,maxAnkleMoveMm:0,footBoneMm:0,kneeMoveMm:0,targetErrorMm:0,
     velocityGapMps:0,seamMm:0,seamDeg:0,repeatMm:0,seekMm:0,groupFrameMm:0};
    const row=(t,b,c,s)=>({t,kneeBefore:b.feet[s].knee,kneeAfter:c.feet[s].knee,before:b.feet[s].point.toArray(),after:c.feet[s].point.toArray(),
     jointBefore:b.bones['calf_'+s].p.toArray(),jointAfter:c.bones['calf_'+s].p.toArray(),hip:c.bones['thigh_'+s].p.toArray()});
    const cycle=[],poses=[],N=1000,angle=(x,y)=>x.angleTo(y)*180/Math.PI;
    for(let i=0;i<=N;i++){
     const t=i/N,b=sample(a.releasePlan,a.lanes[0],t),c=sample(a.kneeLateralPlan,a.lanes[1],t);
     poses.push(c);cycle.push({t,r:row(t,b,c,'r'),l:row(t,b,c,'l')});
     m.bodyMm=Math.max(m.bodyMm,b.root.distanceTo(c.root)*1000);
     for(const n of names){
      const x=b.bones[n],y=c.bones[n],leg=/^(thigh|calf|foot|ball)_([rl])$/.exec(n);
      m.boneOffsetMm=Math.max(m.boneOffsetMm,x.offset.distanceTo(y.offset)*1000);
      if(!leg){m.bodyMm=Math.max(m.bodyMm,x.p.distanceTo(y.p)*1000);m.bodyDeg=Math.max(m.bodyDeg,angle(x.q,y.q));}
      else{
       const t0=((t-(leg[2]==='l'?.5:0))%1+1)%1;
       if(t0<=.53||t0>=.68){m.outsideMm=Math.max(m.outsideMm,x.p.distanceTo(y.p)*1000);m.outsideDeg=Math.max(m.outsideDeg,angle(x.q,y.q));}
      }
     }
     for(const s of sides){
      m.archivedM68Mm=Math.max(m.archivedM68Mm,b.feet[s].point.distanceTo(new T.Vector3(...old.cycle[i][s].after))*1000);
      m.archivedM68JointMm=Math.max(m.archivedM68JointMm,b.bones['calf_'+s].p.distanceTo(new T.Vector3(...old.cycle[i][s].jointAfter))*1000);
      m.archivedM68KneeDeg=Math.max(m.archivedM68KneeDeg,Math.abs(b.feet[s].knee-old.cycle[i][s].kneeAfter));
      const target=c.diagnostic.kneeLateral.find(v=>v.side===s);
      if(target)m.targetErrorMm=Math.max(m.targetErrorMm,Math.abs(c.bones['calf_'+s].p.x-c.bones['thigh_'+s].p.x-target.targetX)*1000);
      for(const part of ['foot','ball']){m.footWorldDeg=Math.max(m.footWorldDeg,angle(b.bones[part+'_'+s].q,c.bones[part+'_'+s].q));m.footBoneMm=Math.max(m.footBoneMm,b.bones[part+'_'+s].p.distanceTo(c.bones[part+'_'+s].p)*1000);}
      m.kneeMoveMm=Math.max(m.kneeMoveMm,b.bones['calf_'+s].p.distanceTo(c.bones['calf_'+s].p)*1000);
      m.ankleHeightMm=Math.max(m.ankleHeightMm,Math.abs(b.bones['foot_'+s].p.y-c.bones['foot_'+s].p.y)*1000);
      m.pointHeightMm=Math.max(m.pointHeightMm,Math.abs(b.feet[s].point.y-c.feet[s].point.y)*1000);
      m.floorDeltaMm=Math.max(m.floorDeltaMm,Math.abs(b.feet[s].floor-c.feet[s].floor)*1000);
      m.minFloorMm=Math.min(m.minFloorMm,c.feet[s].floor*1000);
      m.relativeAnkleDeg=Math.max(m.relativeAnkleDeg,angle(b.bones['foot_'+s].local,c.bones['foot_'+s].local));
      m.kneeDeltaDeg=Math.max(m.kneeDeltaDeg,Math.abs(b.feet[s].knee-c.feet[s].knee));
      m.maxAnkleMoveMm=Math.max(m.maxAnkleMoveMm,b.bones['foot_'+s].p.distanceTo(c.bones['foot_'+s].p)*1000);
     }
    }
    const release={},motion={};
    for(const s of sides){
     const rows=[];
     for(let i=500;i<=720;i++){
      const t=i/1000+(s==='l'?.5:0),b=sample(a.releasePlan,a.lanes[0],t),c=sample(a.kneeLateralPlan,a.lanes[1],t);
      rows.push(row(i/1000,b,c,s));
     }
     const rs=rows.filter(r=>r.t>=.53&&r.t<=.68),dt=.001*a.data.seconds;
     const stats=key=>{
      const v=rs.slice(1).map((r,i)=>(r[key]-rs[i][key])/dt);
      return {reverseDeg:rs.slice(1).reduce((sum,r,i)=>sum+Math.max(0,rs[i][key]-r[key]),0),
       peakSpeedDegps:Math.max(...v.map(Math.abs)),peakAccelerationDegps2:Math.max(...v.slice(1).map((x,i)=>Math.abs(x-v[i])/dt))};
     };
     const path=(key,select)=>select.slice(1).reduce((sum,r,i)=>sum+Math.hypot(r[key][0]-select[i][key][0],r[key][2]-select[i][key][2])*1000,0);
     const near=rows.filter(r=>r.t>=.53&&r.t<=.68&&r.before[1]<=.001);
     const speed=key=>Math.max(...rs.slice(1).map((r,i)=>new T.Vector3(...r[key]).distanceTo(new T.Vector3(...rs[i][key]))/dt));
     const kneeMotion=key=>{
      const points=rs.map(r=>new T.Vector3(...r[key]));
      const velocities=points.slice(1).map((p,i)=>p.clone().sub(points[i]).divideScalar(dt));
      const xs=rs.map(r=>r[key][0]-r.hip[0]);
      const vx=xs.slice(1).map((x,i)=>(x-xs[i])/dt);
      return {peakLateralSpeedMps:Math.max(...vx.map(Math.abs)),peakLateralAccelerationMps2:Math.max(...vx.slice(1).map((v,i)=>Math.abs(v-vx[i])/dt)),peakSpeedMps:Math.max(...velocities.map(v=>v.length())),
       peakAccelerationMps2:Math.max(...velocities.slice(1).map((v,i)=>v.distanceTo(velocities[i])/dt)),
       lateralExtraPathMm:(xs.slice(1).reduce((sum,x,i)=>sum+Math.abs(x-xs[i]),0)-Math.abs(xs.at(-1)-xs[0]))*1000};
     };
     motion[s]={before:stats('kneeBefore'),after:stats('kneeAfter'),toeSpeed:{before:speed('before'),after:speed('after')},
      kneePosition:{before:kneeMotion('jointBefore'),after:kneeMotion('jointAfter')},
      nearGround:{start:near[0]?.t,end:near.at(-1)?.t,beforeMm:path('before',near),afterMm:path('after',near)}};
     release[s]=rows;
    }
    for(const t of [.53,.68,1.03,1.18,0,1]){
     const h=1e-5,ss=[-2,-1,0,1,2].map(k=>sample(a.kneeLateralPlan,a.lanes[1],t+k*h,false)),dt=h*a.data.seconds;
     for(const n of names){
      const ps=ss.map(s=>s.bones[n].p);
      const vl=ps[2].clone().multiplyScalar(3).addScaledVector(ps[1],-4).add(ps[0]).divideScalar(2*dt);
      const vr=ps[2].clone().multiplyScalar(-3).addScaledVector(ps[3],4).addScaledVector(ps[4],-1).divideScalar(2*dt);
      m.velocityGapMps=Math.max(m.velocityGapMps,vl.distanceTo(vr));
     }
    }
    for(const n of names){m.seamMm=Math.max(m.seamMm,poses[N].bones[n].p.clone().sub(a.plan.pelvisTravel).distanceTo(poses[0].bones[n].p)*1000);m.seamDeg=Math.max(m.seamDeg,angle(poses[0].bones[n].q,poses[N].bones[n].q));}
    for(const t of [-.4,.06,.12,.55,.59,.64,.68,1.16]){
     const one=sample(a.kneeLateralPlan,a.lanes[1],t,false),two=sample(a.kneeLateralPlan,a.lanes[1],t+1,false);
     for(const n of names)m.repeatMm=Math.max(m.repeatMm,two.bones[n].p.clone().sub(a.plan.pelvisTravel).distanceTo(one.bones[n].p)*1000);
    }
    const one=sample(a.kneeLateralPlan,a.lanes[1],.62,false);sample(a.kneeLateralPlan,a.lanes[1],.2,false);const two=sample(a.kneeLateralPlan,a.lanes[1],.62,false);
    for(const n of names)m.seekMm=Math.max(m.seekMm,one.bones[n].p.distanceTo(two.bones[n].p)*1000);
    a.lanes[1].group.position.set(.9,0,-.9);a.lanes[1].group.updateMatrixWorld(true);
    const shifted=sample(a.kneeLateralPlan,a.lanes[1],.62,false);
    for(const n of names)m.groupFrameMm=Math.max(m.groupFrameMm,shifted.bones[n].p.clone().sub(a.lanes[1].group.position).distanceTo(one.bones[n].p)*1000);
    a.lanes[1].group.position.set(0,0,0);a.lanes[1].group.updateMatrixWorld(true);
    return {model,samples:N+1,metrics:m,motion,release,cycle,degrees:Object.fromEntries(sides.map(s=>[s,a.kneeLateralPlan.curves[s].path.degree]))};
   },{model,old:archived.results.find(r=>r.model===model)});
   report.results.push(result);save();console.log(JSON.stringify({model,metrics:result.metrics,motion:result.motion,degrees:result.degrees}));
   const m=result.metrics;
   assert(m.bodyMm<.01&&m.bodyDeg<.001&&m.boneOffsetMm<.01,'body and bone lengths');
   assert(m.archivedM68Mm<.01&&m.archivedM68JointMm<.01&&m.archivedM68KneeDeg<.001&&m.outsideMm<.01&&m.outsideDeg<.001,'archived M68 and out-of-window recovery');
   assert(m.targetErrorMm<.01,'actual knee reaches the lateral target on its circle');
   assert(m.footWorldDeg<.001&&m.ankleHeightMm<.01&&m.pointHeightMm<.01,'foot world direction and height');
   assert(m.floorDeltaMm<.05&&m.minFloorMm>=-.01,'floor does not newly penetrate or float');
   assert(m.kneeDeltaDeg<.001&&m.footBoneMm<.01&&m.maxAnkleMoveMm<.01,'M68 knee bend and foot/ball positions');
   for(const s of ['r','l']){
    assert(result.motion[s].kneePosition.after.lateralExtraPathMm<.001,'actual knee X has no backtracking');
    assert(result.motion[s].after.reverseDeg<.001,'actual knee retains M68 flexion');
    assert(result.motion[s].after.peakSpeedDegps<result.motion[s].before.peakSpeedDegps*1.1,'knee speed guard');
    assert(Math.abs(result.motion[s].after.peakSpeedDegps-result.motion[s].before.peakSpeedDegps)<.001,'flexion speed retained');
    assert(result.motion[s].kneePosition.after.peakLateralSpeedMps<result.motion[s].kneePosition.before.peakLateralSpeedMps,'lateral speed does not acquire a burst');
    assert(result.motion[s].kneePosition.after.lateralExtraPathMm<result.motion[s].kneePosition.before.lateralExtraPathMm,'knee lateral backtracking improves');
    assert(result.motion[s].toeSpeed.after<result.motion[s].toeSpeed.before*1.05,'toe speed does not acquire a new burst');
   }
   assert(m.velocityGapMps<.001&&m.seamMm<.01&&m.seamDeg<.001&&m.repeatMm<.01&&m.seekMm<.01&&m.groupFrameMm<.01,'boundaries, looping, seeking, display coordinates');
   for(const view of ['front','side'])for(const t of [.03,.06,.10,.16,.53,.56,.60,.66]){
    await page.click('#'+view);await page.evaluate(t=>window.sharedGaitReview.seek(t),t);
    await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(t*100)}.png`});
   }
  }
  await page.reload();await page.waitForFunction(()=>window.sharedGaitReview?.ready);
  await page.selectOption('#speed','1');await page.click('#play');await page.waitForTimeout(1800);
  await page.click('#side');assert.equal(await page.textContent('#play'),'일시정지');await page.click('#play');
  await page.uncheck('#repeat');await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');
  await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생');
  report.playback={repeat:true,singleStop:true,viewDuringPlay:true};assert.deepEqual(report.errors,[]);
  const audit=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-stance-review.json'));
  report.unchanged=Object.entries(audit.runtimeHashes).filter(([f])=>!f.endsWith('shared-gait-view.js')&&!f.endsWith('shared-gait.html')).map(([f,h])=>{
   assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),h);return f;
  });
  report.status='passed';save();console.log('PASS M69');
 }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.error=e.stack;save();console.error(e);process.exitCode=1;});
