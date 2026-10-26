// M70: independent measured directions, preserved M69 poses, and loop checks.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const file='docs/05-validation/reports/cmu-arm-swing.json',out='outputs/cmu-arm-swing';
const archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-knee-lateral.json'));
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]};
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:1000}});
  p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=arm-swing');
  for(const model of ['male','female']){
   if(model==='female')await p.selectOption('#model',model);
   await p.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
   const result=await p.evaluate(async({model,old})=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
    a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
    const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),ref=a.data.models[model],names=ref.bones.map(b=>b.name),rad=180/Math.PI;
    const chestRest=new T.Quaternion(...ref.bones.find(b=>b.name==='spine_03').worldQ).normalize();
    const arm=n=>n.endsWith('_r')||n.endsWith('_l')?!/^(thigh|calf|foot|ball)_/.test(n):false;
    const sample=(plan,l,t,surface=true)=>{
     plan.apply(l,a.probe,t);
     const bones=Object.fromEntries(names.map(n=>{const o=l.model.getObjectByName(n);return[n,{p:o.getWorldPosition(V()),q:o.getWorldQuaternion(Q()).normalize(),local:o.quaternion.clone()}];}));
     const chest=bones.spine_03.q.clone().multiply(chestRest.clone().invert()),inv=chest.clone().invert();
     const arms=Object.fromEntries(['r','l'].map(s=>{
      const shoulder=bones['upperarm_'+s].p,elbow=bones['lowerarm_'+s].p,hand=bones['hand_'+s].p;
      const u=elbow.clone().sub(shoulder).applyQuaternion(inv).normalize(),lo=hand.clone().sub(elbow).applyQuaternion(inv).normalize();
      return[s,{swing:Math.atan2(u.z,-u.y)*rad,outward:Math.asin(u.x*(s==='l'?1:-1))*rad,
       elbow:u.angleTo(lo)*rad,hand:hand.clone().sub(shoulder).applyQuaternion(inv).toArray()}];
     }));
     return {bones,arms,root:l.model.position.clone(),floor:surface?['r','l'].map(s=>l.readSurface(s).min):[]};
    };
    const m={protectedMm:0,protectedDeg:0,armLocalDeg:0,shoulderMm:0,outwardDeg:0,elbowDeg:0,floorMm:0,minFloorMm:Infinity,
     archivedKneeMm:0,targetDeg:0,symmetryDeg:0,symmetryHandMm:0,seamDeg:0,seamVelocityGapDegPerSec:0,seekDeg:0,groupFrameDeg:0,maxCorrectionDeg:0};
    const frames=[],N=1000;
    for(let i=0;i<=N;i++){
     const t=i/N,before=sample(a.kneeLateralPlan,a.lanes[0],t),after=sample(a.armSwingPlan,a.lanes[1],t);
     // Original cached arm geometry is independent of the new correction formula.
     const raw=sample({apply:(l,pr,t)=>a.plan.original(l,t)},a.lanes[0],t,false);
     const rawOther=sample({apply:(l,pr,t)=>a.plan.original(l,t)},a.lanes[0],t+.5,false);
     const target=(raw.arms.r.swing+rawOther.arms.l.swing)/2;
     m.targetDeg=Math.max(m.targetDeg,Math.abs(target-after.arms.r.swing));
     m.protectedMm=Math.max(m.protectedMm,before.root.distanceTo(after.root)*1000);
     for(const n of names){
      if(!arm(n)||n.startsWith('clavicle_')){
       m.protectedMm=Math.max(m.protectedMm,before.bones[n].p.distanceTo(after.bones[n].p)*1000);
       m.protectedDeg=Math.max(m.protectedDeg,before.bones[n].q.angleTo(after.bones[n].q)*rad);
      }else if(!n.startsWith('upperarm_'))m.armLocalDeg=Math.max(m.armLocalDeg,before.bones[n].local.angleTo(after.bones[n].local)*rad);
     }
     for(const [si,s] of ['r','l'].entries()){
      m.shoulderMm=Math.max(m.shoulderMm,before.bones['upperarm_'+s].p.distanceTo(after.bones['upperarm_'+s].p)*1000);
      m.outwardDeg=Math.max(m.outwardDeg,Math.abs(before.arms[s].outward-after.arms[s].outward));
      m.elbowDeg=Math.max(m.elbowDeg,Math.abs(before.arms[s].elbow-after.arms[s].elbow));
      m.floorMm=Math.max(m.floorMm,Math.abs(before.floor[si]-after.floor[si])*1000);m.minFloorMm=Math.min(m.minFloorMm,after.floor[si]*1000);
      m.archivedKneeMm=Math.max(m.archivedKneeMm,before.bones['calf_'+s].p.distanceTo(new T.Vector3(...old.cycle[i][s].jointAfter))*1000);
     }
     m.maxCorrectionDeg=Math.max(m.maxCorrectionDeg,Math.abs(after.arms.r.swing-before.arms.r.swing));
     frames.push({t,before:before.arms,after:after.arms,rawRight:raw.arms.r.swing,rawLeftShifted:rawOther.arms.l.swing,target});
    }
    for(let i=0;i<500;i++){
     const right=frames[i].after.r,left=frames[i+500].after.l;
     m.symmetryDeg=Math.max(m.symmetryDeg,Math.abs(right.swing-left.swing),Math.abs(right.outward-left.outward),Math.abs(right.elbow-left.elbow));
     m.symmetryHandMm=Math.max(m.symmetryHandMm,new T.Vector3(...right.hand).distanceTo(new T.Vector3(-left.hand[0],left.hand[1],left.hand[2]))*1000);
    }
    const h=1e-5,read=t=>sample(a.armSwingPlan,a.lanes[1],t,false);
    const seam=[read(1-h),read(1),read(1+h),read(0)];
    for(const s of ['r','l']){
     const vals=seam.map(x=>x.arms[s].swing);
     m.seamDeg=Math.max(m.seamDeg,Math.abs(vals[1]-vals[3]));
     m.seamVelocityGapDegPerSec=Math.max(m.seamVelocityGapDegPerSec,Math.abs((vals[2]-vals[1])-(vals[1]-vals[0]))/(h*a.data.seconds));
    }
    for(const t of [.82,.08,.5,1,0,.23]){
     const before=read(t);read(t+.37);const after=read(t);
     for(const n of names)m.seekDeg=Math.max(m.seekDeg,before.bones[n].q.angleTo(after.bones[n].q)*rad);
     a.lanes[1].group.position.set(4,0,-3);a.lanes[1].group.updateMatrixWorld(true);const shifted=read(t);
     for(const n of names)m.groupFrameDeg=Math.max(m.groupFrameDeg,before.bones[n].q.angleTo(shifted.bones[n].q)*rad);
     a.lanes[1].group.position.set(0,0,0);a.lanes[1].group.updateMatrixWorld(true);
    }
    return {model,samples:N+1,metrics:m,frames};
   },{model,old:archive.results.find(r=>r.model===model)});
   report.results.push(result);console.log(model,result.metrics);
   const m=result.metrics;
   for(const key of ['protectedMm','shoulderMm','floorMm','archivedKneeMm','symmetryHandMm'])assert(m[key]<.01,key);
   for(const key of ['protectedDeg','armLocalDeg','outwardDeg','elbowDeg','targetDeg','symmetryDeg','seamDeg','seekDeg','groupFrameDeg'])assert(m[key]<.001,key);
   assert(m.seamVelocityGapDegPerSec<.1,'periodic arm velocity');assert(m.minFloorMm>=-.01,'no new floor penetration');
   await p.uncheck('#bones');
   for(const view of ['front','side']){
    await p.click('#'+view);
    for(const t of [0,.15,.35,.5,.65,.85]){
     await p.evaluate(t=>window.sharedGaitReview.seek(t),t);
     await p.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(t*100)}.png`});
    }
   }
  }
  assert.equal(report.errors.length,0);report.status='passed';
 }catch(e){report.failure=e.stack;throw e;}
 finally{fs.writeFileSync(file,JSON.stringify(report));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
