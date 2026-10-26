// M67: same support algorithm on both sides, with the left hold across the seam.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file='docs/05-validation/reports/cmu-shared-support-bilateral.json',out='outputs/cmu-shared-support-bilateral';fs.mkdirSync(out,{recursive:true});
const previous=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-support.json'));
const oldAudit=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-stance-review.json'));
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]},save=()=>fs.writeFileSync(file,JSON.stringify(report));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=shared-support-bilateral');
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);
  await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const result=await page.evaluate(async({model,archived})=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
   const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),names=a.plan.reference.bones.map(b=>b.name),sides=['r','l'];
   // IDs from the preceding independent skin audit, not from the new selector.
   const ids=model==='male'?{r:6707,l:13833}:{r:5462,l:12615};
   const pos=(l,n)=>l.model.getObjectByName(n).getWorldPosition(V()),angle=(x,y)=>x.clone().normalize().angleTo(y.clone().normalize())*180/Math.PI;
   const sample=(plan,l,t,skin=true)=>{
    const diagnostic=plan.apply(l,a.probe,t);const m=l.model.getObjectByName('Human');m.skeleton.update();
    const bones=Object.fromEntries(names.map(n=>{const b=l.model.getObjectByName(n);return[n,{p:pos(l,n),q:b.getWorldQuaternion(Q()).normalize(),local:b.quaternion.clone(),offset:b.position.clone()}];}));
    const feet=Object.fromEntries(sides.map(s=>{const H=bones['thigh_'+s].p,K=bones['calf_'+s].p,A=bones['foot_'+s].p;return[s,{point:m.getVertexPosition(ids[s],V()).applyMatrix4(m.matrixWorld),
     floor:skin?l.readSurface(s).min:0,knee:180-K.clone().sub(H).negate().angleTo(A.clone().sub(K))*180/Math.PI}];}));
    return {bones,feet,root:l.model.position.clone(),diagnostic};
   };
   const m={bodyMm:0,bodyDeg:0,boneOffsetMm:0,rightRegressionMm:0,rightRegressionDeg:0,archivedRightMm:0,archivedRightKneeDeg:0,
    outsideMm:0,outsideDeg:0,worldFootDeg:0,footHeightMm:0,pointHeightMm:0,floorDeltaMm:0,minFloorMm:Infinity,
    relativeAnkleDeg:{r:0,l:0},kneeDeltaDeg:{r:0,l:0},minKneeDeg:Infinity,contactErrorMm:0,
    velocityGapMps:0,angularVelocityGapDegps:0,seamMm:0,seamDeg:0,repeatMm:0,repeatDeg:0,seekMm:0,groupFrameMm:0,
    halfCycleBeforeMm:0,halfCycleAfterMm:0};
   const rowOf=(t,b,c,s)=>({t,before:b.feet[s].point.toArray(),after:c.feet[s].point.toArray(),kneeBefore:b.feet[s].knee,kneeAfter:c.feet[s].knee,
    hip:c.bones['thigh_'+s].p.toArray(),knee:c.bones['calf_'+s].p.toArray(),ankle:c.bones['foot_'+s].p.toArray()});
   const N=1000,poses=[],oldPoses=[],cycle=[];
   for(let i=0;i<=N;i++){
    const t=i/N,b=sample(a.supportPlan,a.lanes[0],t),c=sample(a.supportBilateralPlan,a.lanes[1],t),raw=sample(a.approachPlan,a.lanes[0],t,false);
    poses.push(c);oldPoses.push(b);
    m.bodyMm=Math.max(m.bodyMm,b.root.distanceTo(c.root)*1000);
    for(const n of names){const x=b.bones[n],y=c.bones[n],leg=/^(thigh|calf|foot|ball)_[rl]$/.test(n);
     m.boneOffsetMm=Math.max(m.boneOffsetMm,x.offset.distanceTo(y.offset)*1000);
     if(!leg){m.bodyMm=Math.max(m.bodyMm,x.p.distanceTo(y.p)*1000);m.bodyDeg=Math.max(m.bodyDeg,angle(x.q,y.q));}
     if(n.endsWith('_r')){m.rightRegressionMm=Math.max(m.rightRegressionMm,x.p.distanceTo(y.p)*1000);m.rightRegressionDeg=Math.max(m.rightRegressionDeg,angle(x.q,y.q));}
     if(leg){const s=n.endsWith('_l')?'l':'r',phase=((t-(s==='l'?.5:0))%1+1)%1;
      if(phase<=.38||phase>=.60){m.outsideMm=Math.max(m.outsideMm,raw.bones[n].p.distanceTo(y.p)*1000);m.outsideDeg=Math.max(m.outsideDeg,angle(raw.bones[n].q,y.q));}
     }
    }
    for(const s of sides){
     for(const part of ['foot','ball'])m.worldFootDeg=Math.max(m.worldFootDeg,angle(raw.bones[part+'_'+s].q,c.bones[part+'_'+s].q));
     m.relativeAnkleDeg[s]=Math.max(m.relativeAnkleDeg[s],angle(raw.bones['foot_'+s].local,c.bones['foot_'+s].local));
     m.kneeDeltaDeg[s]=Math.max(m.kneeDeltaDeg[s],Math.abs(raw.feet[s].knee-c.feet[s].knee));m.minKneeDeg=Math.min(m.minKneeDeg,c.feet[s].knee);
     m.footHeightMm=Math.max(m.footHeightMm,Math.abs(raw.bones['foot_'+s].p.y-c.bones['foot_'+s].p.y)*1000);
     m.pointHeightMm=Math.max(m.pointHeightMm,Math.abs(raw.feet[s].point.y-c.feet[s].point.y)*1000);
     m.floorDeltaMm=Math.max(m.floorDeltaMm,Math.abs(b.feet[s].floor-c.feet[s].floor)*1000);m.minFloorMm=Math.min(m.minFloorMm,c.feet[s].floor*1000);
    }
    m.contactErrorMm=Math.max(m.contactErrorMm,c.diagnostic.support?.errorMm||0);
    const old=archived.rows[i];m.archivedRightMm=Math.max(m.archivedRightMm,c.feet.r.point.distanceTo(new T.Vector3(...old.after))*1000,c.bones.calf_r.p.distanceTo(new T.Vector3(...old.kneePointAfter))*1000);
    m.archivedRightKneeDeg=Math.max(m.archivedRightKneeDeg,Math.abs(c.feet.r.knee-old.kneeAfter));
    cycle.push({t,r:rowOf(t,raw,c,'r'),l:rowOf(t,raw,c,'l')});
   }
   // Quantify actual pose correspondence without assuming that the retained
   // lateral body travel and two world-fixed anchors imply exact mirroring.
   for(let i=0;i<=N/2;i++)for(const side of sides)for(const part of ['thigh','calf','foot','ball'])for(const [key,arr]of [['halfCycleBeforeMm',oldPoses],['halfCycleAfterMm',poses]]){
    const opposite=side==='r'?'l':'r';
    const x=arr[i].bones[part+'_'+side].p.clone().sub(arr[i].bones.pelvis.p),y=arr[i+N/2].bones[part+'_'+opposite].p.clone().sub(arr[i+N/2].bones.pelvis.p);y.x=-y.x;
    m[key]=Math.max(m[key],x.distanceTo(y)*1000);
   }
   const R=poses[550],L=poses[50],rp=R.feet.r.point.clone().sub(R.bones.pelvis.p),lp=L.feet.l.point.clone().sub(L.bones.pelvis.p);lp.x=-lp.x;
   const holdSymmetry={observedMm:rp.distanceTo(lp)*1000,lateralExpectedMm:2*Math.abs(a.plan.pelvisTravel.x)*.12*1000};
   const stance={},paths={},speeds={};
   const travel=(rows,key)=>rows.slice(1).reduce((sum,r,i)=>sum+Math.hypot(r[key][0]-rows[i][key][0],r[key][2]-rows[i][key][2])*1000,0);
   for(const s of sides){const shift=s==='l'?.5:0,rows=[];
    for(let i=0;i<=220;i++){
     const canonical=(380+i)/1000,t=canonical+shift,b=sample(a.approachPlan,a.lanes[0],t),c=sample(a.supportBilateralPlan,a.lanes[1],t);
     rows.push({...rowOf(t,b,c,s),canonical});
    }
    const windows={hold:rows.filter(r=>r.canonical>=.43&&r.canonical<=.55),late:rows.filter(r=>r.canonical>=.43&&r.canonical<=.58),all:rows,
     nearGround:rows.filter(r=>r.canonical>=.43&&r.canonical<=.58&&r.before[1]<=.001)};
    paths[s]=Object.fromEntries(Object.entries(windows).map(([key,rs])=>[key,{beforeMm:travel(rs,'before'),afterMm:travel(rs,'after'),start:rs[0]?.t,end:rs.at(-1)?.t}]));
    speeds[s]=Object.fromEntries(['before','after'].map(key=>[key,Math.max(...rows.slice(1).map((r,i)=>new T.Vector3(...r[key]).distanceTo(new T.Vector3(...rows[i][key]))/(r.t-rows[i].t)/a.data.seconds))]));stance[s]=rows;
   }
   const omega=(q0,q1,dt)=>{const q=q1.clone().multiply(q0.clone().invert()).normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const s=Math.hypot(q.x,q.y,q.z);return s<1e-12?V():new T.Vector3(q.x,q.y,q.z).multiplyScalar(2*Math.atan2(s,q.w)/s/dt*180/Math.PI);};
   for(const t of [.38,.43,.55,.60,.88,.93,1.05,1.10,0,1]){
    const h=1e-5,ss=[-2,-1,0,1,2].map(k=>sample(a.supportBilateralPlan,a.lanes[1],t+k*h,false)),dt=h*a.data.seconds;
    for(const n of names){const ps=ss.map(s=>s.bones[n].p),qs=ss.map(s=>s.bones[n].q);
     const vl=ps[2].clone().multiplyScalar(3).addScaledVector(ps[1],-4).add(ps[0]).divideScalar(2*dt),vr=ps[2].clone().multiplyScalar(-3).addScaledVector(ps[3],4).addScaledVector(ps[4],-1).divideScalar(2*dt),gap=vl.distanceTo(vr);
     if(gap>m.velocityGapMps){m.velocityGapMps=gap;m.worstVelocity={t,n,gap};}
     m.angularVelocityGapDegps=Math.max(m.angularVelocityGapDegps,omega(qs[1],qs[2],dt).distanceTo(omega(qs[2],qs[3],dt)));
    }
   }
   for(const n of names){m.seamMm=Math.max(m.seamMm,poses[N].bones[n].p.clone().sub(a.plan.pelvisTravel).distanceTo(poses[0].bones[n].p)*1000);m.seamDeg=Math.max(m.seamDeg,angle(poses[0].bones[n].q,poses[N].bones[n].q));}
   for(const t of [-.02,.03,.1,.5,.88,.98,1.07]){
    const one=sample(a.supportBilateralPlan,a.lanes[1],t,false),two=sample(a.supportBilateralPlan,a.lanes[1],t+1,false);
    for(const n of names){m.repeatMm=Math.max(m.repeatMm,two.bones[n].p.clone().sub(a.plan.pelvisTravel).distanceTo(one.bones[n].p)*1000);m.repeatDeg=Math.max(m.repeatDeg,angle(one.bones[n].q,two.bones[n].q));}
   }
   const one=sample(a.supportBilateralPlan,a.lanes[1],.03,false);sample(a.supportBilateralPlan,a.lanes[1],.7,false);const two=sample(a.supportBilateralPlan,a.lanes[1],.03,false);
   for(const n of names)m.seekMm=Math.max(m.seekMm,one.bones[n].p.distanceTo(two.bones[n].p)*1000);
   const l=a.lanes[1];l.group.position.set(.9,0,-.9);l.group.updateMatrixWorld(true);const shifted=sample(a.supportBilateralPlan,l,.03,false);
   for(const n of names)m.groupFrameMm=Math.max(m.groupFrameMm,shifted.bones[n].p.clone().sub(l.group.position).distanceTo(one.bones[n].p)*1000);
   l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);
   return {model,samples:N+1,metrics:m,holdSymmetry,ids,selected:{r:a.supportPlan.vertex,l:a.supportBilateralPlan.vertex},paths,speeds,cycle,stance,seconds:a.data.seconds,travel:a.plan.pelvisTravel.toArray()};
  },{model,archived:previous.results.find(r=>r.model===model)});
  report.results.push(result);save();console.log(JSON.stringify({model,metrics:result.metrics,paths:result.paths,speeds:result.speeds,selected:result.selected}));
  const m=result.metrics;
  assert(m.bodyMm<.01&&m.bodyDeg<.001&&m.boneOffsetMm<.01,'pelvis, body height, upper body and bone lengths');
  assert(m.rightRegressionMm<.01&&m.rightRegressionDeg<.001&&m.archivedRightMm<.01&&m.archivedRightKneeDeg<.001,'accepted M66 right leg and archived curve');
  assert(m.outsideMm<.01&&m.outsideDeg<.001,'original recovery outside each leg interval');
  assert(m.worldFootDeg<.001&&m.footHeightMm<.01&&m.pointHeightMm<.01&&m.floorDeltaMm<.01&&m.minFloorMm>=-.01,'both foot directions/heights and ground');
  assert(m.contactErrorMm<.01&&m.minKneeDeg>0,'reachable targets, fixed material point and knee direction');
  assert(m.halfCycleAfterMm<m.halfCycleBeforeMm,'both half-cycle leg pairings improve over one-sided M66');
  assert(Math.abs(result.holdSymmetry.observedMm-result.holdSymmetry.lateralExpectedMm)<.01,'remaining hold asymmetry agrees with preserved lateral root travel');
  for(const s of ['r','l']){
   assert(m.relativeAnkleDeg[s]<5&&m.kneeDeltaDeg[s]<8,'bounded ankle/knee change');
   assert(result.paths[s].hold.afterMm<.01,'fixed point throughout hold');
   assert(result.paths[s].nearGround.afterMm<result.paths[s].nearGround.beforeMm*.4&&result.paths[s].late.afterMm<result.paths[s].late.beforeMm*.8,'near-ground and whole late stance path improve');
   assert(result.speeds[s].after<result.speeds[s].before*1.25,'release speed guard');
  }
  assert(m.velocityGapMps<.001&&m.angularVelocityGapDegps<2&&m.seamMm<.01&&m.seamDeg<.001&&m.repeatMm<.01&&m.repeatDeg<.001&&m.seekMm<.01&&m.groupFrameMm<.01,'joins, loop, repeat, seek, display coordinates');
  for(const view of ['front','side'])for(const phase of [.04,.08,.10,.50,.54,.88,.93,.98]){
   await page.click('#'+view);await page.evaluate(t=>window.sharedGaitReview.seek(t),phase);await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*100)}.png`});
  }
 }
 await page.reload();await page.waitForFunction(()=>window.sharedGaitReview?.ready);await page.selectOption('#speed','1');await page.click('#play');await page.waitForTimeout(1800);await page.click('#side');assert.equal(await page.textContent('#play'),'일시정지');await page.click('#play');await page.uncheck('#repeat');await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생');
 report.playback={repeat:true,singleStop:true,viewDuringPlay:true};assert.deepEqual(report.errors,[]);
 report.unchanged=Object.entries(oldAudit.runtimeHashes).filter(([f])=>!f.endsWith('shared-gait-view.js')&&!f.endsWith('shared-gait.html')).map(([f,h])=>{assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),h);return f;});
 report.status='passed';save();console.log('PASS: bilateral support, M66 regression, foot directions, body, recovery and loop');
}finally{await browser.close();}})().catch(e=>{report.status='failed';report.error=e.stack;save();console.error(e);process.exitCode=1;});
