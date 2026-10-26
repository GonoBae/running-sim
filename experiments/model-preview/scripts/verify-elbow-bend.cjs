const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]};
const prior=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-leg-height.json'));
const manifest=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-elbow-bend-baseline.json'));
const file='docs/05-validation/reports/cmu-elbow-bend.json';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=elbow-bend');
 for(const model of ['male','female']){
  if(model==='female')await p.selectOption('#model',model);await p.waitForFunction(()=>window.sharedGaitReview?.ready);
  const result=await p.evaluate(async({model,prior})=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
   const {readElbowFlex,createElbowTransition}=await import('/review/elbow-bend.js');
   const {createSkinPointBatch}=await import('/review/skin-point-batch.js');
   const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),deg=180/Math.PI;
   a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
   const names=a.data.models[model].bones.map(b=>b.name),changed=new Set();
   for(const s of ['r','l'])a.lanes[1].model.getObjectByName('lowerarm_'+s).traverse(b=>{if(b.isBone)changed.add(b.name);});
   const mesh=a.lanes[0].model.getObjectByName('Human'),attrs=mesh.geometry.attributes,protectedIds=[];
   for(let i=0;i<attrs.position.count;i++){
    let weight=0;for(let j=0;j<4;j++)if(changed.has(mesh.skeleton.bones[attrs.skinIndex.getComponent(i,j)].name))weight+=attrs.skinWeight.getComponent(i,j);
    if(weight===0)protectedIds.push(i);
   }
   const batches=a.lanes.map(l=>createSkinPointBatch(l.model.getObjectByName('Human')));
   const read=(l,t,cm,offset=null)=>{
    const plan=offset===null?a.legHeightPlan:a.elbowBendPlan;
    plan.apply(l,a.probe,t,cm,offset??0);
    const bones=Object.fromEntries(names.map(n=>{const b=l.model.getObjectByName(n);return[n,{p:b.getWorldPosition(V()),q:b.getWorldQuaternion(Q()).normalize(),local:b.quaternion.clone(),offset:b.position.clone()}];}));
    const flex={},normal={};
    for(const s of ['r','l']){
     flex[s]=readElbowFlex(l.model,s);
     normal[s]=bones['lowerarm_'+s].p.clone().sub(bones['upperarm_'+s].p).cross(bones['hand_'+s].p.clone().sub(bones['lowerarm_'+s].p)).normalize();
    }
    return {bones,flex,normal,root:l.model.position.clone()};
   };
   const m={zeroMm:0,zeroDeg:0,protectedMm:0,protectedDeg:0,protectedSkinMm:0,elbowPositionMm:0,offsetMm:0,handLocalDeg:0,angleErrorDeg:0,planeChangeDeg:0,archiveLegMm:0,archiveFloorMm:0,floorDeltaMm:0,minFlexDeg:Infinity,maxFlexDeg:-Infinity,seekMm:0,repeatMm:0,repeatDeg:0,groupMm:0,symmetryOffsetDeg:0,loopVelocityGapMps:0};
   const series=[],ranges=[];let poses=0,skinChecks=0;
   for(const cm of [0,5,10]){
    const baseline=[];
    for(let i=0;i<=500;i++){
     const b=read(a.lanes[0],i/500,cm);baseline.push(b);const old=prior.series.find(s=>s.cm===cm).frames[i];
     for(const s of ['r','l']){
      m.archiveLegMm=Math.max(m.archiveLegMm,Math.abs(b.bones['calf_'+s].p.y-old[s].kneeY)*1000,Math.abs(b.bones['foot_'+s].p.y-old[s].footY)*1000);
      if(i%100===0)m.archiveFloorMm=Math.max(m.archiveFloorMm,Math.abs(a.lanes[0].readSurface(s).min*1000-old[s].floorMm));
     }
    }
    for(const offset of [-20,-10,0,10,20]){
     const frames=[];let maxError=0;
     for(let i=0;i<=500;i++){
      const t=i/500,b=baseline[i],c=read(a.lanes[1],t,cm,offset);poses++;
      for(const n of names){
       const x=b.bones[n],y=c.bones[n],mm=x.p.distanceTo(y.p)*1000,rotation=x.q.angleTo(y.q)*deg;
       if(offset===0){m.zeroMm=Math.max(m.zeroMm,mm);m.zeroDeg=Math.max(m.zeroDeg,rotation);}
       if(!changed.has(n)){m.protectedMm=Math.max(m.protectedMm,mm);m.protectedDeg=Math.max(m.protectedDeg,rotation);}
       if(changed.has(n)&&!n.startsWith('lowerarm_'))m.handLocalDeg=Math.max(m.handLocalDeg,x.local.angleTo(y.local)*deg);
       m.offsetMm=Math.max(m.offsetMm,x.offset.distanceTo(y.offset)*1000);
      }
      m.protectedMm=Math.max(m.protectedMm,b.root.distanceTo(c.root)*1000);
      for(const s of ['r','l']){
       const error=Math.abs(c.flex[s]-b.flex[s]-offset);maxError=Math.max(maxError,error);m.angleErrorDeg=Math.max(m.angleErrorDeg,error);
       m.elbowPositionMm=Math.max(m.elbowPositionMm,b.bones['lowerarm_'+s].p.distanceTo(c.bones['lowerarm_'+s].p)*1000);
       m.planeChangeDeg=Math.max(m.planeChangeDeg,b.normal[s].angleTo(c.normal[s])*deg);
       m.minFlexDeg=Math.min(m.minFlexDeg,c.flex[s]);m.maxFlexDeg=Math.max(m.maxFlexDeg,c.flex[s]);
      }
      frames.push({t,r:c.flex.r,l:c.flex.l,baseR:b.flex.r,baseL:b.flex.l});
      if(cm===10&&Math.abs(offset)===20&&i%100===0){
       read(a.lanes[0],t,cm);const bs=batches[0](protectedIds),cs=batches[1](protectedIds);skinChecks++;
       for(let j=0;j<bs.length;j++)m.protectedSkinMm=Math.max(m.protectedSkinMm,bs[j].distanceTo(cs[j])*1000);
       for(const s of ['r','l'])m.floorDeltaMm=Math.max(m.floorDeltaMm,Math.abs(a.lanes[0].readSurface(s).min-a.lanes[1].readSurface(s).min)*1000);
      }
     }
     for(let i=0;i<500;i++)m.symmetryOffsetDeg=Math.max(m.symmetryOffsetDeg,Math.abs((frames[i].r-frames[i].baseR)-(frames[(i+250)%500].l-frames[(i+250)%500].baseL)));
     ranges.push({cm,offset,samples:501,maxErrorDeg:maxError});if(cm===5)series.push({cm,offset,frames});
    }
   }
   // Every allowed integer input, plus fractional values used by live easing.
   let integerSamples=0;
   for(let offset=-20;offset<=20;offset++)for(let i=0;i<=20;i++){
    const b=read(a.lanes[0],i/20,10),c=read(a.lanes[1],i/20,10,offset);integerSamples++;
    for(const s of ['r','l'])m.angleErrorDeg=Math.max(m.angleErrorDeg,Math.abs(c.flex[s]-b.flex[s]-offset));
   }
   for(const offset of [-19.87,-.1,.1,19.87]){
    const b=read(a.lanes[0],.357,7.25),c=read(a.lanes[1],.357,7.25,offset);
    for(const s of ['r','l'])m.angleErrorDeg=Math.max(m.angleErrorDeg,Math.abs(c.flex[s]-b.flex[s]-offset));
   }
   for(const offset of [-20,20])for(const t of [0,.04,.27,.54,.83,.99]){
    const b=read(a.lanes[1],t,10,offset),c=read(a.lanes[1],t+1,10,offset);
    for(const n of names){m.repeatMm=Math.max(m.repeatMm,b.bones[n].p.clone().add(a.plan.pelvisTravel).distanceTo(c.bones[n].p)*1000);m.repeatDeg=Math.max(m.repeatDeg,b.bones[n].q.angleTo(c.bones[n].q)*deg);}
    read(a.lanes[1],.8,0,0);const d=read(a.lanes[1],t,10,offset);
    for(const n of names)m.seekMm=Math.max(m.seekMm,b.bones[n].p.distanceTo(d.bones[n].p)*1000);
   }
   const h=1e-5,lo=read(a.lanes[1],1-h,10,20),mid=read(a.lanes[1],1,10,20),hi=read(a.lanes[1],1+h,10,20);
   for(const n of ['hand_r','hand_l'])m.loopVelocityGapMps=Math.max(m.loopVelocityGapMps,hi.bones[n].p.clone().sub(mid.bones[n].p).sub(mid.bones[n].p.clone().sub(lo.bones[n].p)).length()/h/a.data.seconds);
   const b=read(a.lanes[1],.24,10,20),shift=new T.Vector3(1.5,0,-1.2);a.lanes[1].group.position.copy(shift);a.lanes[1].group.updateMatrixWorld(true);
   const c=read(a.lanes[1],.24,10,20);for(const n of names)m.groupMm=Math.max(m.groupMm,b.bones[n].p.clone().add(shift).distanceTo(c.bones[n].p)*1000);
   a.lanes[1].group.position.set(0,0,0);a.lanes[1].group.updateMatrixWorld(true);
   let invalidRejected=0;for(const v of [-21,21,NaN,Infinity])try{a.elbowBendPlan.apply(a.lanes[1],a.probe,0,0,v);}catch(e){if(e instanceof RangeError)invalidRejected++;}
   const transition=createElbowTransition(),live=[];for(const target of [20,-20,0]){transition.set(target);for(let i=0;i<90;i++)live.push(transition.tick(1/60));}
   return {model,metrics:m,poses,integerSamples,skinChecks,protectedSkinVertices:protectedIds.length,ranges,series,invalidRejected,transition:{min:Math.min(...live),max:Math.max(...live),end:live.at(-1)}};
  },{model,prior:prior.results.find(r=>r.model===model)});
  report.results.push(result);fs.writeFileSync(file,JSON.stringify(report));console.log(model,JSON.stringify(result.metrics));
  const m=result.metrics;
  for(const key of ['zeroMm','protectedMm','protectedSkinMm','elbowPositionMm','offsetMm','archiveLegMm','archiveFloorMm','floorDeltaMm','seekMm','repeatMm','groupMm'])assert(m[key]<.00001,key+': '+m[key]);
  for(const key of ['zeroDeg','protectedDeg','handLocalDeg','angleErrorDeg','planeChangeDeg','symmetryOffsetDeg','repeatDeg'])assert(m[key]<.001,key+': '+m[key]);
  assert(m.minFlexDeg>80&&m.maxFlexDeg<135);assert(m.loopVelocityGapMps<.005);assert.equal(result.invalidRejected,4);
  assert(result.transition.min>=-20&&result.transition.max<=20);assert.equal(result.transition.end,0);
 }
 report.unchanged=Object.entries(manifest.hashes).map(([path,hash])=>({path,ok:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')===hash}));
 assert(report.unchanged.every(r=>r.ok));assert.equal(report.errors.length,0);report.status='passed';
}catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(file,JSON.stringify(report));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
