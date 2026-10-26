const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out=process.env.SHARED_GAIT_OUTPUT||'outputs/cmu-shared-gait';fs.mkdirSync(out,{recursive:true});
const report={testedAt:new Date().toISOString(),status:'running',errors:[],results:[]};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))/Math.hypot(...a)/Math.hypot(...b)))*180/Math.PI;
// Full skeleton is checked in memory. Persist only the pelvis/lower chain.
const save=()=>fs.writeFileSync(process.env.SHARED_GAIT_REPORT||'docs/05-validation/reports/cmu-shared-gait.json',JSON.stringify(report,(key,value)=>key==='bones'?Object.fromEntries(Object.entries(value).filter(([n])=>/^(pelvis|(thigh|calf|foot|ball)_[rl])$/.test(n))):value));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:940}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled,null,{timeout:30000});
   const stats=await page.evaluate(async()=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
    const snapshot=phase=>{
     a.seek(phase);
     return {phase,diagnostic:{...a.diagnostic},lanes:a.lanes.map(l=>({
      bones:Object.fromEntries(a.plan.reference.bones.map(({name})=>{const b=l.model.getObjectByName(name);return [name,{p:l.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).normalize().toArray()}];})),
      floors:['r','l'].map(s=>l.readSurface(s).min)
     }))};
    };
    const rows=Array.from({length:365},(_,i)=>snapshot(i/364));
    const offgrid=Array.from({length:96},(_,i)=>snapshot((i+.371)/96));
    const offgridHalf=offgrid.map(r=>snapshot((r.phase+.5)%1));
    const release=Array.from({length:121},(_,i)=>{const u=i/120;return {u,right:snapshot(.58+.12*u),oldLeft:snapshot(.09+.12*u),newLeft:snapshot(.08+.12*u)};});
    const sameStage=[];
    for(const phase of [.28,.43,.58,.64,.70]){const r=snapshot(phase),l=snapshot((phase+.5)%1);sameStage.push({phase,right:r,left:l});}
    const boundaries=[0,.28,.58,.78,.08,.5,1].map(p=>({phase:p,samples:[p-.00001,p,p+.00001].map(t=>snapshot(((t%1)+1)%1))}));
    const repeat=[snapshot(.64),snapshot(.12),snapshot(.64)];a.view(true);const side=snapshot(.64);a.view(false);
    return {rows,offgrid,offgridHalf,release,sameStage,boundaries,repeat,side,loadMs:performance.getEntriesByName('shared-gait-ready').at(-1).duration};
   });
   console.log(model,'measured',stats.loadMs.toFixed(1)+'ms');
   const ref=JSON.parse(fs.readFileSync('experiments/model-preview/public/review-data/shared-gait-reference.json')).models[model];
   const archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-ankle-release-audit.json')).results.find(r=>r.model===model);
   const rest=Object.fromEntries(ref.bones.map(b=>[b.name,b.worldQ]));
   const mul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
   const inv=q=>[-q[0],-q[1],-q[2],q[3]],mirror=q=>[q[0],-q[1],-q[2],q[3]],reflect=p=>[-p[0],p[1],p[2]];
   const m={baselineMm:0,baselineDeg:0,mirrorPositionMm:0,mirrorRotationDeg:0,kneeFlexGapDeg:0,pelvisHeightGapMm:0,minFloorMm:Infinity,maxFloorGapMm:0,repeatMm:0,viewMm:0,lengthChangeMm:0,seamPoseMm:0,seamRotationDeg:0,boundaryIncrementGapMm:0};
   const flex=(pose,side)=>{const H=pose.bones['thigh_'+side].p,K=pose.bones['calf_'+side].p,A=pose.bones['foot_'+side].p;const u=H.map((v,i)=>v-K[i]),v=A.map((v,i)=>v-K[i]);return 180-Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)/Math.hypot(...u)/Math.hypot(...v))))*180/Math.PI;};
   for(let i=0;i<364;i++){
    const before=stats.rows[i].lanes[0],actual=stats.rows[i].lanes[1],other=stats.rows[(i+182)%364].lanes[1];
    for(const n of Object.keys(archive.rows[i].lanes[1].bones)){const old=archive.rows[i].lanes[1].bones[n];m.baselineMm=Math.max(m.baselineMm,distance(before.bones[n].p,old.p)*1000);m.baselineDeg=Math.max(m.baselineDeg,angle(before.bones[n].q,old.q));}
    for(const part of ['thigh','calf','foot','ball']){
     const r=actual.bones[part+'_r'],l=other.bones[part+'_l'];
     const rp=r.p.map((v,j)=>v-actual.bones.pelvis.p[j]),lp=l.p.map((v,j)=>v-other.bones.pelvis.p[j]);
     m.mirrorPositionMm=Math.max(m.mirrorPositionMm,distance(rp,reflect(lp))*1000);
     m.mirrorRotationDeg=Math.max(m.mirrorRotationDeg,angle(mul(r.q,inv(rest[part+'_r'])),mirror(mul(l.q,inv(rest[part+'_l'])))));
    }
    m.kneeFlexGapDeg=Math.max(m.kneeFlexGapDeg,Math.abs(flex(actual,'r')-flex(other,'l')));
    m.pelvisHeightGapMm=Math.max(m.pelvisHeightGapMm,Math.abs(actual.bones.pelvis.p[1]-other.bones.pelvis.p[1])*1000);
    for(const side of ['r','l'])for(const [n,p]of [['thigh','calf'],['calf','foot'],['foot','ball']]){
     const length=pose=>distance(pose.bones[n+'_'+side].p,pose.bones[p+'_'+side].p);
     m.lengthChangeMm=Math.max(m.lengthChangeMm,Math.abs(length(actual)-length(before))*1000);
    }
   }
   for(const row of [...stats.rows,...stats.offgrid]){m.minFloorMm=Math.min(m.minFloorMm,...row.lanes[1].floors.map(v=>v*1000));m.maxFloorGapMm=Math.max(m.maxFloorGapMm,(Math.min(...row.lanes[1].floors)-row.diagnostic.floorTarget)*1000);}
   for(let i=0;i<stats.offgrid.length;i++){
    const r=stats.offgrid[i].lanes[1],l=stats.offgridHalf[i].lanes[1];
    for(const n of ['thigh','calf','foot','ball']){
     m.mirrorPositionMm=Math.max(m.mirrorPositionMm,distance(r.bones[n+'_r'].p.map((v,j)=>v-r.bones.pelvis.p[j]),reflect(l.bones[n+'_l'].p.map((v,j)=>v-l.bones.pelvis.p[j])))*1000);
     m.mirrorRotationDeg=Math.max(m.mirrorRotationDeg,angle(mul(r.bones[n+'_r'].q,inv(rest[n+'_r'])),mirror(mul(l.bones[n+'_l'].q,inv(rest[n+'_l'])))));
    }
   }
   for(const boundary of stats.boundaries)for(const n of ['pelvis','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l']){
    // Remove forward/root translation at the loop seam before differencing.
    const points=boundary.samples.map(r=>r.lanes[1].bones[n].p.map((v,j)=>v-r.lanes[1].bones.pelvis.p[j]));
    m.boundaryIncrementGapMm=Math.max(m.boundaryIncrementGapMm,Math.hypot(...points[0].map((v,j)=>v+points[2][j]-2*points[1][j]))*1000);
   }
   for(const n of Object.keys(stats.repeat[0].lanes[1].bones)){
    m.repeatMm=Math.max(m.repeatMm,distance(stats.repeat[0].lanes[1].bones[n].p,stats.repeat[2].lanes[1].bones[n].p)*1000);
    m.viewMm=Math.max(m.viewMm,distance(stats.repeat[0].lanes[1].bones[n].p,stats.side.lanes[1].bones[n].p)*1000);
    const first=stats.rows[0].lanes[1],last=stats.rows[364].lanes[1];
    m.seamPoseMm=Math.max(m.seamPoseMm,distance(first.bones[n].p.map((v,i)=>v-first.bones.pelvis.p[i]),last.bones[n].p.map((v,i)=>v-last.bones.pelvis.p[i]))*1000);
    m.seamRotationDeg=Math.max(m.seamRotationDeg,angle(first.bones[n].q,last.bones[n].q));
   }
   // Half-cycle aligned calf-relative angular speed, including release.
   const relative=(pose,side)=>mul(inv(pose.bones['calf_'+side].q),pose.bones['foot_'+side].q);
   const speeds=['r','l'].map(side=>{
    const rows=stats.rows.slice(0,364),offset=side==='r'?0:182,dt=91/120/364;
    return rows.map((_,i)=>angle(relative(rows[(i+offset)%364].lanes[1],side),relative(rows[(i+offset+1)%364].lanes[1],side))/dt);
   });
   m.angularSpeedGap=Math.max(...speeds[0].map((v,i)=>Math.abs(v-speeds[1][i])));
   const releaseSpeeds={};
   for(const [key,column,laneIndex,side]of [['oldRight','right',0,'r'],['oldLeft','oldLeft',0,'l'],['newRight','right',1,'r'],['newLeft','newLeft',1,'l']]){
    releaseSpeeds[key]=stats.release.slice(1).map((r,i)=>({u:(r.u+stats.release[i].u)/2,speed:angle(relative(stats.release[i][column].lanes[laneIndex],side),relative(r[column].lanes[laneIndex],side))/(.12/120*91/120)}));
   }
   report.results.push({model,metrics:m,loadMs:stats.loadMs,releaseSpeeds,sameStage:stats.sameStage,rows:stats.rows,offgrid:stats.offgrid,boundaries:stats.boundaries});save();
   console.log(model,JSON.stringify(m));
   for(const view of ['front','side']){
    await page.click('#'+view);
    for(const phase of [.28,.43,.64,.78,.93,.14]){
     await page.evaluate(p=>window.sharedGaitReview.seek(p),phase);
     await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*100)}.png`});
    }
   }
  }
  // Real playback controls: two cycles, then one-cycle stop, then retry an
  // intentionally stale model-reference pair. Intentional error is separate.
  await page.evaluate(()=>{const a=window.sharedGaitReview;a.renderer.setAnimationLoop(null);});
  await page.reload();await page.waitForFunction(()=>window.sharedGaitReview?.ready,null,{timeout:30000});
  await page.click('#play');await page.waitForTimeout(3500);
  assert.equal(await page.textContent('#play'),'일시정지');await page.click('#play');
  await page.uncheck('#repeat');await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');
  await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생',null,{timeout:5000});
  report.playback={repeatContinues:true,singleCycleStops:true};
  const failurePage=await browser.newPage(),intentional=[];
  failurePage.on('pageerror',e=>intentional.push(e.message));
  await failurePage.route('**/review-data/shared-gait-reference.json',async route=>{const response=await route.fetch(),data=await response.json();data.models.male.modelHash='stale';await route.fulfill({response,json:data});});
  await failurePage.goto('http://127.0.0.1:5173/review/shared-gait.html');await failurePage.waitForSelector('#retry:not([hidden])');
  assert.equal(await failurePage.evaluate(()=>window.sharedGaitReview.ready),false);
  await failurePage.unroute('**/review-data/shared-gait-reference.json');await failurePage.click('#retry');await failurePage.waitForFunction(()=>window.sharedGaitReview.ready,null,{timeout:30000});
  report.versionGuard={mismatchBlocked:true,retrySucceeded:true,intentionalErrors:intentional};await failurePage.close();
  assert.deepEqual(report.errors,[]);
  for(const {metrics:m}of report.results){
   assert(m.baselineMm<.01&&m.baselineDeg<.001,'M56 baseline');
   assert(m.mirrorRotationDeg<.001&&m.angularSpeedGap<.02,'same motion and speed');
   assert(m.mirrorPositionMm<1&&m.kneeFlexGapDeg<.1,'mirrored joint geometry');
   assert(m.pelvisHeightGapMm<.01,'shared pelvis height');
   assert(m.minFloorMm>-.01,'floor penetration');
   assert(m.lengthChangeMm<.01&&m.repeatMm<.01&&m.viewMm<.01,'length and seek/view invariants');
   assert(m.seamPoseMm<.01&&m.seamRotationDeg<.001,'loop seam');
   assert(m.boundaryIncrementGapMm<.01,'no position jump at phase boundaries');
  }
  report.status='passed';report.hashes=Object.fromEntries(['shared-gait.js','shared-gait-view.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));save();
  console.log('PASS: same half-cycle leg motion, pelvis symmetry, baseline, floor, repeat, cameras, lengths and seam');
 }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1;});
