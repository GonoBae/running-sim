const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out='outputs/cmu-body-height';fs.mkdirSync(out,{recursive:true});
const dest='docs/05-validation/reports/cmu-body-height.json';
const report={testedAt:new Date().toISOString(),status:'running',errors:[],results:[]};
const save=()=>fs.writeFileSync(dest,JSON.stringify(report));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=body-height');
 const archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-whole-body-audit.json'));
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);
  await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const old=archive.results.find(r=>r.model===model);
  const result=await page.evaluate(async old=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   const seconds=a.data.seconds,names=a.plan.reference.bones.map(b=>b.name),vec=()=>new T.Vector3();
   const m={worldRotationDeg:0,localRotationDeg:0,horizontalMm:0,relativePoseMm:0,outsideMm:0,contactHeightChangeMm:0,
    baselineMm:0,minSkinMm:Infinity,skinReaderErrorMm:0,groundClampCount:0,mirrorHeightMm:0,repeatMm:0,viewMm:0,seamMm:0,
    maxDeltaMm:0,maxBridgeVelocity:-Infinity,endpointPositionMm:0,endpointVelocityMps:0,endpointAccelerationMps2:0};
   // Matrix decomposition can return a quaternion with tiny norm error on a
   // scaled rig. Compare orientations after normalization, as in M58 checks.
   const angle=(u,v)=>u.clone().normalize().angleTo(v.clone().normalize())*180/Math.PI;
   // Independent skin evaluator: Three.getVertexPosition, including lower
   // weights than the runtime's batched >.15 foot selector.
   const surfaces=a.lanes.map(l=>{
    const groups=[];l.model.traverse(mesh=>{
     if(!mesh.isSkinnedMesh)return;const at=mesh.geometry.attributes,ids={r:[],l:[]};
     for(let i=0;i<at.skinIndex.count;i++)for(const s of ['r','l']){
      let w=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${s}$`).test(mesh.skeleton.bones[at.skinIndex.getComponent(i,j)].name))w+=at.skinWeight.getComponent(i,j);
      if(w>.05)ids[s].push(i);
     }
     groups.push({mesh,ids});
    });
    return ()=>Object.fromEntries(['r','l'].map(s=>{
     let min=Infinity;for(const {mesh,ids}of groups){mesh.skeleton.update();for(const id of ids[s])min=Math.min(min,mesh.getVertexPosition(id,vec()).applyMatrix4(mesh.matrixWorld).y);}
     return [s,min];
    }));
   });
   const position=(l,n)=>l.group.worldToLocal(l.model.getObjectByName(n).getWorldPosition(vec()));
   const measure=(phase,full=true)=>{
    a.seek(phase);const [before,after]=a.lanes,baseP=position(before,'pelvis'),newP=position(after,'pelvis');
    const floor=surfaces.map(read=>read()),t=((phase%.5)+.5)%.5,inside=t>.10&&t<.24;
    if(full)for(const n of names){
     const b=before.model.getObjectByName(n),c=after.model.getObjectByName(n),bp=position(before,n),cp=position(after,n);
     m.worldRotationDeg=Math.max(m.worldRotationDeg,angle(b.getWorldQuaternion(new T.Quaternion()),c.getWorldQuaternion(new T.Quaternion())));
     m.localRotationDeg=Math.max(m.localRotationDeg,angle(b.quaternion,c.quaternion));
     m.horizontalMm=Math.max(m.horizontalMm,Math.hypot(bp.x-cp.x,bp.z-cp.z)*1000);
     m.relativePoseMm=Math.max(m.relativePoseMm,bp.clone().sub(baseP).distanceTo(cp.clone().sub(newP))*1000);
     if(!inside)m.outsideMm=Math.max(m.outsideMm,bp.distanceTo(cp)*1000);
    }
    for(const s of ['r','l']){
     m.minSkinMm=Math.min(m.minSkinMm,floor[1][s]*1000);
     m.skinReaderErrorMm=Math.max(m.skinReaderErrorMm,Math.abs(floor[1][s]-after.readSurface(s).min)*1000);
     if(floor[0][s]<.001)m.contactHeightChangeMm=Math.max(m.contactHeightChangeMm,Math.abs(floor[1][s]-floor[0][s])*1000);
    }
    m.maxDeltaMm=Math.max(m.maxDeltaMm,Math.abs(a.diagnostic.bodyHeightDelta)*1000);
    if(a.diagnostic.groundLimited)m.groundClampCount++;
    if(inside)m.maxBridgeVelocity=Math.max(m.maxBridgeVelocity,a.heightPlan.bridge.read(t).v/seconds);
    return {phase,beforeY:baseP.y,afterY:newP.y,floors:floor,delta:a.diagnostic.bodyHeightDelta,groundLimited:a.diagnostic.groundLimited};
   };
   // Confirm the comparison's left lane is the previously inspected M58.
   for(let i=0;i<365;i++){
    a.seek(i/364);
    for(const [name,p]of Object.entries(old.rows[i].bones))m.baselineMm=Math.max(m.baselineMm,position(a.lanes[0],name).distanceTo(new T.Vector3(...p))*1000);
   }
   const rows=Array.from({length:1001},(_,i)=>measure(i/1000));
   for(let i=0;i<500;i++)m.mirrorHeightMm=Math.max(m.mirrorHeightMm,Math.abs(rows[i].afterY-rows[i+500].afterY)*1000);
   const detail=Array.from({length:241},(_,i)=>measure(.1+.06*i/240,false));
   const landing=[];
   for(const s of ['r','l'])for(const u of [0,.1,.25,.5,.75,1]){
    const phase=(.28+.28*u+(s==='l'?.5:0))%1,r=measure(phase);
    landing.push({side:s,u,phase,beforeMm:r.floors[0][s]*1000,afterMm:r.floors[1][s]*1000});
   }
   // Direct physical-time derivatives of the rendered height on either side.
   const height=p=>{a.seek(p);return position(a.lanes[1],'pelvis').y;};
   const boundaries=[];
   for(const phase of [.10,.114,.226,.24,.60,.614,.726,.74]){
    const h=1e-6,y=[-2,-1,0,1,2].map(k=>height(phase+k*h)),dt=h*seconds;
    const vl=(3*y[2]-4*y[1]+y[0])/(2*dt),vr=(-3*y[2]+4*y[3]-y[4])/(2*dt);
    const al=(y[2]-2*y[1]+y[0])/(dt*dt),ar=(y[4]-2*y[3]+y[2])/(dt*dt);
    m.endpointPositionMm=Math.max(m.endpointPositionMm,Math.abs(y[3]-y[1])*1000);
    m.endpointVelocityMps=Math.max(m.endpointVelocityMps,Math.abs(vl-vr));
    m.endpointAccelerationMps2=Math.max(m.endpointAccelerationMps2,Math.abs(al-ar));
    boundaries.push({phase,velocityGapMps:Math.abs(vl-vr),accelerationGapMps2:Math.abs(al-ar)});
   }
   const repeated=[measure(.137,false),measure(.4,false),measure(.137,false)];
   m.repeatMm=Math.abs(repeated[0].afterY-repeated[2].afterY)*1000;
   a.view(true);m.viewMm=Math.abs(measure(.137,false).afterY-repeated[0].afterY)*1000;a.view(false);
   m.seamMm=Math.abs(rows[0].afterY-rows[1000].afterY)*1000;
   const p=a.heightPlan.bridge;
   return {seconds,metrics:m,bridge:{start:p.start,end:p.end,edge:p.edge,A:p.A,B:p.B,middle:p.middle},rows,detail,landing,boundaries,loadMs:performance.getEntriesByName('shared-gait-ready').at(-1).duration};
  },old);
  report.results.push({model,...result});save();
  console.log(model,JSON.stringify(result.metrics),'landing max mm',Math.max(...result.landing.map(r=>r.afterMm)));
  const m=result.metrics;
  assert(m.baselineMm<.01,'M58 comparison baseline');
  assert(m.worldRotationDeg<.001&&m.localRotationDeg<.001,'all joint rotations');
  assert(m.horizontalMm<.01&&m.relativePoseMm<.01,'horizontal position and common pose');
  assert(m.outsideMm<.01&&m.contactHeightChangeMm<.01,'outside/contact preservation');
  assert(m.minSkinMm>=-.01&&m.groundClampCount===0,'floor and unclipped bridge');
  assert(m.skinReaderErrorMm<.01,'independent surface reader');
  assert(m.maxBridgeVelocity<=.00001,'no upward reversal');
  assert(m.endpointVelocityMps<.001&&m.endpointAccelerationMps2<.1,'smooth joins');
  assert(m.repeatMm<.01&&m.viewMm<.01&&m.mirrorHeightMm<.01&&m.seamMm<.01,'repeat and symmetry');
  assert(result.landing.every(r=>r.afterMm>=-.01&&r.afterMm<1),'landing skin within 1mm of ground');
  for(const view of ['front','side'])for(const phase of [.10,.12,.137,.18,.24,.28,.78]){
   await page.click('#'+view);await page.evaluate(p=>window.sharedGaitReview.seek(p),phase);
   await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*1000)}.png`});
  }
 }
 await page.reload();await page.waitForFunction(()=>window.sharedGaitReview?.ready);await page.click('#play');await page.waitForTimeout(3400);
 assert.equal(await page.textContent('#play'),'일시정지');await page.click('#play');
 await page.uncheck('#repeat');await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');
 await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생');
 report.playback={repeat:true,singleCycleStop:true};assert.deepEqual(report.errors,[]);
 report.hashes=Object.fromEntries(['body-height.js','shared-gait.js','shared-gait-view.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
 report.status='passed';save();console.log('PASS: height connection, all joint rotations, common gait, contact, ground, boundaries and playback');
}finally{await browser.close();}})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1;});
