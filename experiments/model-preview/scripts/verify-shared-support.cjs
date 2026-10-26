const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file='docs/05-validation/reports/cmu-shared-support.json',out='outputs/cmu-shared-support';fs.mkdirSync(out,{recursive:true});
const report={status:'running',testedAt:new Date().toISOString(),scope:'Right late stance only; M64 before vs M66 after; skin geometry, not force',errors:[],results:[]},save=()=>fs.writeFileSync(file,JSON.stringify(report));
const audit=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-stance-review.json'));
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await b.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=shared-support');
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);
  await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const result=await page.evaluate(async({model,patches})=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
   const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),pos=(l,n)=>l.model.getObjectByName(n).getWorldPosition(V());
   const names=a.plan.reference.bones.map(b=>b.name),vertex={mesh:'Human',id:model==='male'?6707:5462};
   const angle=(x,y)=>x.clone().normalize().angleTo(y.clone().normalize())*180/Math.PI;
   const snapshot=(l,withSkin=true)=>{
    l.model.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});
    const point=v=>{const m=l.model.getObjectByName(v.mesh);return m.getVertexPosition(v.id,V()).applyMatrix4(m.matrixWorld);};
    const H=pos(l,'thigh_r'),K=pos(l,'calf_r'),A=pos(l,'foot_r');
    return {root:l.model.position.clone(),bones:Object.fromEntries(names.map(n=>{const bone=l.model.getObjectByName(n);return[n,{p:pos(l,n),q:bone.getWorldQuaternion(Q()).normalize(),local:bone.quaternion.clone(),offset:bone.position.clone()}];})),
     point:point(vertex),patch:withSkin?patches.r.toe.map(point):[],floor:withSkin?l.readSurface('r').min:0,
     knee:180-K.clone().sub(H).negate().angleTo(A.clone().sub(K))*180/Math.PI};
   };
   const m={pelvisMm:0,bodyMm:0,bodyDeg:0,offsetMm:0,leftMm:0,leftDeg:0,outsideMm:0,outsideDeg:0,footWorldDeg:0,ankleRelativeDeg:0,
    footHeightMm:0,pointHeightMm:0,floorDeltaMm:0,minFloorMm:Infinity,kneeDeltaDeg:0,kneeMinDeg:Infinity,kneeMaxDeg:-Infinity,kneeShiftMm:0,
    contactResidualMm:0,velocityGapMps:0,angularVelocityGapDegps:0,repeatMm:0,repeatDeg:0,seekMm:0,groupFrameMm:0};
   const rows=[],N=1000;
   for(let i=0;i<=N;i++){
    const t=i/N;a.approachPlan.apply(a.lanes[0],a.probe,t);const d=a.supportPlan.apply(a.lanes[1],a.probe,t);
    const before=snapshot(a.lanes[0]),after=snapshot(a.lanes[1]);
    m.bodyMm=Math.max(m.bodyMm,before.root.distanceTo(after.root)*1000);m.pelvisMm=Math.max(m.pelvisMm,before.bones.pelvis.p.distanceTo(after.bones.pelvis.p)*1000);
    for(const n of names){const x=before.bones[n],y=after.bones[n],changed=/^(thigh|calf|foot|ball)_r$/.test(n);
     m.offsetMm=Math.max(m.offsetMm,x.offset.distanceTo(y.offset)*1000);
     if(!changed){m.bodyMm=Math.max(m.bodyMm,x.p.distanceTo(y.p)*1000);m.bodyDeg=Math.max(m.bodyDeg,angle(x.q,y.q));}
     if(n.endsWith('_l')){m.leftMm=Math.max(m.leftMm,x.p.distanceTo(y.p)*1000);m.leftDeg=Math.max(m.leftDeg,angle(x.q,y.q));}
     if(t<=.38||t>=.60){m.outsideMm=Math.max(m.outsideMm,x.p.distanceTo(y.p)*1000);m.outsideDeg=Math.max(m.outsideDeg,angle(x.q,y.q));}
     if(n==='foot_r'||n==='ball_r')m.footWorldDeg=Math.max(m.footWorldDeg,angle(x.q,y.q));
    }
    m.ankleRelativeDeg=Math.max(m.ankleRelativeDeg,angle(before.bones.foot_r.local,after.bones.foot_r.local));
    m.footHeightMm=Math.max(m.footHeightMm,Math.abs(before.bones.foot_r.p.y-after.bones.foot_r.p.y)*1000);
    m.pointHeightMm=Math.max(m.pointHeightMm,Math.abs(before.point.y-after.point.y)*1000);
    m.floorDeltaMm=Math.max(m.floorDeltaMm,Math.abs(before.floor-after.floor)*1000);m.minFloorMm=Math.min(m.minFloorMm,after.floor*1000);
    m.kneeDeltaDeg=Math.max(m.kneeDeltaDeg,Math.abs(before.knee-after.knee));m.kneeMinDeg=Math.min(m.kneeMinDeg,after.knee);m.kneeMaxDeg=Math.max(m.kneeMaxDeg,after.knee);
    m.kneeShiftMm=Math.max(m.kneeShiftMm,before.bones.calf_r.p.distanceTo(after.bones.calf_r.p)*1000);
    m.contactResidualMm=Math.max(m.contactResidualMm,d.support.errorMm||0);
    rows.push({t,before:before.point.toArray(),after:after.point.toArray(),kneeBefore:before.knee,kneeAfter:after.knee,
     kneePointBefore:before.bones.calf_r.p.toArray(),kneePointAfter:after.bones.calf_r.p.toArray(),
     relativeDeg:angle(before.bones.foot_r.local,after.bones.foot_r.local),patchBefore:before.patch.map(v=>v.toArray()),patchAfter:after.patch.map(v=>v.toArray())});
   }
   const travel=(rs,key)=>rs.slice(1).reduce((s,r,i)=>s+Math.hypot(r[key][0]-rs[i][key][0],r[key][2]-rs[i][key][2])*1000,0);
   const paths={};
   for(const [name,rs]of Object.entries({hold:rows.filter(r=>r.t>=.43&&r.t<=.55),late:rows.filter(r=>r.t>=.43&&r.t<=.58),all:rows.filter(r=>r.t>=.38&&r.t<=.6),
    nearGround:rows.filter(r=>r.t>=.43&&r.t<=.58&&r.before[1]<=.001)}))paths[name]={beforeMm:travel(rs,'before'),afterMm:travel(rs,'after'),start:rs[0]?.t,end:rs.at(-1)?.t};
   const neighbor=patches.r.toe.map((v,i)=>({vertex:v,before:travel(rows.filter(r=>r.t>=.43&&r.t<=.55).map(r=>({p:r.patchBefore[i]})),'p'),after:travel(rows.filter(r=>r.t>=.43&&r.t<=.55).map(r=>({p:r.patchAfter[i]})),'p')}));
   const speeds=Object.fromEntries(['before','after'].map(key=>[key,Math.max(...rows.slice(1).flatMap((r,i)=>r.t>.38&&r.t<=.60?
    [new T.Vector3(...r[key]).distanceTo(new T.Vector3(...rows[i][key]))/(r.t-rows[i].t)/a.data.seconds]:[]))]));
   // Boundary checks use signed three-component rotational velocities, not
   // unsigned angle magnitudes that could conceal a reversal.
   const velocity=(left,right,dt)=>right.clone().sub(left).divideScalar(dt);
   const omega=(q0,q1,dt)=>{const q=q1.clone().multiply(q0.clone().invert()).normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const s=Math.hypot(q.x,q.y,q.z);return s<1e-12?V():new T.Vector3(q.x,q.y,q.z).multiplyScalar(2*Math.atan2(s,q.w)/s/dt*180/Math.PI);};
   const boundary=[];
   for(const t of [.38,.43,.55,.60,0,1]){
    const h=1e-5,ss=[-2,-1,0,1,2].map(k=>{a.supportPlan.apply(a.lanes[1],a.probe,t+k*h);return snapshot(a.lanes[1],false);});
    for(const n of names){const ps=ss.map(s=>s.bones[n].p),qs=ss.map(s=>s.bones[n].q),dt=h*a.data.seconds;
     const vl=ps[2].clone().multiplyScalar(3).addScaledVector(ps[1],-4).add(ps[0]).divideScalar(2*dt),vr=ps[2].clone().multiplyScalar(-3).addScaledVector(ps[3],4).addScaledVector(ps[4],-1).divideScalar(2*dt);
     const gap=vl.distanceTo(vr),angularGap=omega(qs[1],qs[2],dt).distanceTo(omega(qs[2],qs[3],dt));
     if(gap>m.velocityGapMps){m.velocityGapMps=gap;m.worstVelocity={t,n,gap};}
     if(angularGap>m.angularVelocityGapDegps){m.angularVelocityGapDegps=angularGap;m.worstAngular={t,n,gap:angularGap};}
    }
    boundary.push(t);
   }
   for(const t of [.10,.38,.43,.50,.56,.60,.90]){
    a.supportPlan.apply(a.lanes[1],a.probe,t);const first=snapshot(a.lanes[1],false);
    a.supportPlan.apply(a.lanes[1],a.probe,t+1);const second=snapshot(a.lanes[1],false);
    for(const n of names){m.repeatMm=Math.max(m.repeatMm,second.bones[n].p.clone().sub(a.plan.pelvisTravel).distanceTo(first.bones[n].p)*1000);m.repeatDeg=Math.max(m.repeatDeg,angle(first.bones[n].q,second.bones[n].q));}
   }
   a.supportPlan.apply(a.lanes[1],a.probe,.5);const one=snapshot(a.lanes[1],false);a.supportPlan.apply(a.lanes[1],a.probe,.9);a.supportPlan.apply(a.lanes[1],a.probe,.5);const two=snapshot(a.lanes[1],false);
   for(const n of names)m.seekMm=Math.max(m.seekMm,one.bones[n].p.distanceTo(two.bones[n].p)*1000);
   // Translated front/side scene layout must not change the solved animation.
   const l=a.lanes[1];l.group.position.set(.9,0,-.9);l.group.updateMatrixWorld(true);a.supportPlan.apply(l,a.probe,.5);const shifted=snapshot(l,false);
   for(const n of names)m.groupFrameMm=Math.max(m.groupFrameMm,shifted.bones[n].p.clone().sub(l.group.position).distanceTo(one.bones[n].p)*1000);
   l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);
   // Keep individual neighbor measurements above; omit their repeated frame
   // arrays from the committed report. The fixed-point/knee curves remain.
   return {model,vertex,selectedVertex:a.supportPlan.vertex,metrics:m,paths,speeds,neighbors:neighbor,
    rows:rows.map(({patchBefore,patchAfter,...row})=>row),seconds:a.data.seconds};
  },{model,patches:audit.results.find(r=>r.model===model).patches});
  report.results.push(result);save();console.log(JSON.stringify({model,metrics:result.metrics,paths:result.paths,vertex:result.selectedVertex}));
  const m=result.metrics;
  assert(m.bodyMm<.01&&m.bodyDeg<.001&&m.pelvisMm<.01&&m.offsetMm<.01,'pelvis, upper body and bone lengths');
  assert(m.leftMm<.01&&m.leftDeg<.001&&m.outsideMm<.01&&m.outsideDeg<.001,'left leg, first landing, recovery and outside interval');
  assert(m.footWorldDeg<.001&&m.footHeightMm<.01&&m.pointHeightMm<.01&&m.floorDeltaMm<.01&&m.minFloorMm>=-.01,'foot world orientation and skin height');
  assert(m.contactResidualMm<.01&&result.paths.hold.afterMm<.01,'fixed material point stays put during hold');
  assert(m.ankleRelativeDeg<5&&m.kneeDeltaDeg<8&&m.kneeMinDeg>0,'bounded local angle change and no knee hyperextension');
  assert(result.paths.nearGround.afterMm<result.paths.nearGround.beforeMm*.4&&result.paths.late.afterMm<result.paths.late.beforeMm*.8,'near-ground and complete late interval improve');
  assert(result.speeds.after<result.speeds.before*1.25,'release speed does not increase by more than the review guard of 25%');
  assert(m.velocityGapMps<.001&&m.angularVelocityGapDegps<2&&m.repeatMm<.01&&m.repeatDeg<.001&&m.seekMm<.01&&m.groupFrameMm<.01,'joins, repeat, seek and display frame');
  for(const view of ['front','side'])for(const phase of [.38,.43,.50,.54,.58,.60]){
   await page.click('#'+view);await page.evaluate(t=>window.sharedGaitReview.seek(t),phase);
   await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*100)}.png`});
  }
 }
 await page.reload();await page.waitForFunction(()=>window.sharedGaitReview?.ready);await page.click('#play');await page.waitForTimeout(1900);await page.click('#side');assert.equal(await page.textContent('#play'),'일시정지');await page.click('#play');await page.uncheck('#repeat');await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생');
 report.playback={repeat:true,singleStop:true,viewDuringPlay:true};assert.deepEqual(report.errors,[]);
 report.unchanged=Object.entries(audit.runtimeHashes).filter(([f])=>!f.endsWith('shared-gait-view.js')&&!f.endsWith('shared-gait.html')).map(([f,h])=>{assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),h);return f;});
 report.status='passed';save();console.log('PASS: right support, preserved body/foot direction, joins, playback and unchanged reference assets');
}finally{await b.close();}})().catch(e=>{report.status='failed';report.error=e.stack;save();console.error(e);process.exitCode=1;});
