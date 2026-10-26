const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]};
const archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-unified-stance.json'));
const manifest=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-leg-height-baseline.json'));
const file='docs/05-validation/reports/cmu-leg-height.json';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=leg-height');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.sharedGaitReview?.ready,{},{timeout:30000});
   const result=await page.evaluate(async({model,prior})=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
    const {legHeightWeight,createHeightTransition}=await import('/review/leg-height.js');
    const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),deg=180/Math.PI,wrap=t=>((t%1)+1)%1;
    a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
    const names=a.data.models[model].bones.map(b=>b.name),baseline=[],series=[];
    const read=(plan,l,t,cm=0)=>{
     plan.apply(l,a.probe,t,cm);
     const bones=Object.fromEntries(names.map(n=>{const b=l.model.getObjectByName(n);return[n,{p:b.getWorldPosition(V()),q:b.getWorldQuaternion(Q()).normalize(),local:b.quaternion.clone(),offset:b.position.clone()}];}));
     const floor={r:l.readSurface('r').min,l:l.readSurface('l').min};
     return {bones,floor,root:l.model.position.clone()};
    };
    const metrics={archiveMm:0,zeroMm:0,zeroDeg:0,protectedMm:0,protectedDeg:0,offsetMm:0,footWorldDeg:0,kneeFlexDeg:0,kneeLateralMm:0,heightErrorMm:0,outsideMm:0,outsideDeg:0,contactFloorDeltaMm:0,minFloorMm:Infinity,appliedMinFloorMm:Infinity,maxThighTurnDeg:0,maxFootLiftMm:0,repeatMm:0,seekMm:0,groupMm:0,symmetryAddedHeightMm:0};
    for(let i=0;i<=500;i++){
     const t=i/500,b=read(a.unifiedStancePlan,a.lanes[0],t);baseline.push(b);
     for(const s of ['r','l'])for(const [bone,key] of [['thigh','hip'],['calf','kneePoint'],['foot','ankle'],['ball','ball']])
      metrics.archiveMm=Math.max(metrics.archiveMm,b.bones[bone+'_'+s].p.distanceTo(new T.Vector3(...prior.frames[2*i].after[s][key]))*1000);
    }
    const ranges=[];
    for(let cm=0;cm<=10;cm++){
     let minFloor=Infinity,maxRise=0;const rows=[];
     for(let i=0;i<=500;i++){
      const t=i/500,b=baseline[i],c=read(a.legHeightPlan,a.lanes[1],t,cm);
      for(const n of names){
       const x=b.bones[n],y=c.bones[n],leg=/^(thigh|calf|foot|ball)_([rl])$/.exec(n);
       const distance=x.p.distanceTo(y.p)*1000,rotation=x.q.angleTo(y.q)*deg;
       metrics.offsetMm=Math.max(metrics.offsetMm,x.offset.distanceTo(y.offset)*1000);
       if(cm===0){metrics.zeroMm=Math.max(metrics.zeroMm,distance);metrics.zeroDeg=Math.max(metrics.zeroDeg,rotation);}
       if(!leg){metrics.protectedMm=Math.max(metrics.protectedMm,distance);metrics.protectedDeg=Math.max(metrics.protectedDeg,rotation);}
       if(leg&&legHeightWeight(t-(leg[2]==='l'?.5:0))===0){metrics.outsideMm=Math.max(metrics.outsideMm,distance);metrics.outsideDeg=Math.max(metrics.outsideDeg,rotation);}
      }
      const row={t,r:{},l:{}};
      for(const s of ['r','l']){
       const x=b.bones,y=c.bones,k='calf_'+s,f='foot_'+s,h='thigh_'+s,weight=legHeightWeight(t-(s==='l'?.5:0));
       const rise=(y[k].p.y-x[k].p.y)*1000;
       metrics.heightErrorMm=Math.max(metrics.heightErrorMm,Math.abs(rise-cm*10*weight));
       metrics.protectedMm=Math.max(metrics.protectedMm,x[h].p.distanceTo(y[h].p)*1000,b.root.distanceTo(c.root)*1000);
       metrics.kneeFlexDeg=Math.max(metrics.kneeFlexDeg,x[k].local.angleTo(y[k].local)*deg);
       metrics.kneeLateralMm=Math.max(metrics.kneeLateralMm,Math.abs(y[k].p.x-x[k].p.x)*1000,Math.abs(y[f].p.x-x[f].p.x)*1000);
       for(const part of ['foot_','ball_'])metrics.footWorldDeg=Math.max(metrics.footWorldDeg,x[part+s].q.angleTo(y[part+s].q)*deg);
       metrics.maxThighTurnDeg=Math.max(metrics.maxThighTurnDeg,x[h].local.angleTo(y[h].local)*deg);
       metrics.maxFootLiftMm=Math.max(metrics.maxFootLiftMm,(y[f].p.y-x[f].p.y)*1000);
       minFloor=Math.min(minFloor,c.floor[s]*1000);metrics.minFloorMm=Math.min(metrics.minFloorMm,c.floor[s]*1000);
       if(weight>0&&cm>0)metrics.appliedMinFloorMm=Math.min(metrics.appliedMinFloorMm,c.floor[s]*1000);
       if(weight===0)metrics.contactFloorDeltaMm=Math.max(metrics.contactFloorDeltaMm,Math.abs(b.floor[s]-c.floor[s])*1000);
       maxRise=Math.max(maxRise,rise);
       row[s]={riseMm:rise,kneeY:c.bones[k].p.y,footY:c.bones[f].p.y,floorMm:c.floor[s]*1000};
      }
      rows.push(row);
     }
     for(let i=0;i<500;i++)metrics.symmetryAddedHeightMm=Math.max(metrics.symmetryAddedHeightMm,Math.abs(rows[i].r.riseMm-rows[(i+250)%500].l.riseMm));
     ranges.push({cm,minFloorMm:minFloor,maxRiseMm:maxRise,samples:501});
     if([0,5,10].includes(cm))series.push({cm,frames:rows});
    }
    const delta=(t,s,cm=10)=>{
     const b=read(a.unifiedStancePlan,a.lanes[0],t),c=read(a.legHeightPlan,a.lanes[1],t,cm);
     return ['calf_','foot_'].map(n=>c.bones[n+s].p.clone().sub(b.bones[n+s].p));
    };
    const boundaries=[];
    for(const s of ['r','l'])for(const canonical of [.84,1.04,1.28]){
     const t=canonical+(s==='l'?.5:0),h=1e-5,lo=delta(t-h,s),mid=delta(t,s),hi=delta(t+h,s);
     const gap=Math.max(...mid.map((p,j)=>hi[j].clone().sub(p).sub(p.clone().sub(lo[j])).length()/h/a.data.seconds));
     boundaries.push({side:s,phase:t,velocityGapMps:gap});
    }
    for(const t of [0,.04,.27,.54,.83,.99]){
     const b=read(a.legHeightPlan,a.lanes[1],t,10),c=read(a.legHeightPlan,a.lanes[1],t+1,10);
     for(const n of names)metrics.repeatMm=Math.max(metrics.repeatMm,b.bones[n].p.clone().add(a.plan.pelvisTravel).distanceTo(c.bones[n].p)*1000);
     read(a.legHeightPlan,a.lanes[1],.7,3);const d=read(a.legHeightPlan,a.lanes[1],t,10);
     for(const n of names)metrics.seekMm=Math.max(metrics.seekMm,b.bones[n].p.distanceTo(d.bones[n].p)*1000);
    }
    const b=read(a.legHeightPlan,a.lanes[1],.04,10),translation=new T.Vector3(1.2,0,-.7);
    a.lanes[1].group.position.copy(translation);a.lanes[1].group.updateMatrixWorld(true);
    const c=read(a.legHeightPlan,a.lanes[1],.04,10);
    for(const n of names)metrics.groupMm=Math.max(metrics.groupMm,b.bones[n].p.clone().add(translation).distanceTo(c.bones[n].p)*1000);
    a.lanes[1].group.position.set(0,0,0);a.lanes[1].group.updateMatrixWorld(true);
    let invalidRejected=0;for(const invalid of [-1,11,NaN,Infinity])try{a.legHeightPlan.apply(a.lanes[1],a.probe,.04,invalid);}catch(e){if(e instanceof RangeError)invalidRejected++;}
    const transition=createHeightTransition();transition.set(10);const live=[];
    for(let i=0;i<60;i++)live.push(transition.tick(1/60));transition.set(0);
    for(let i=0;i<60;i++)live.push(transition.tick(1/60));
    return {model,metrics,ranges,boundaries,invalidRejected,transition:{min:Math.min(...live),max:Math.max(...live),end:live.at(-1)},series};
   },{model,prior:archive.results.find(r=>r.model===model)});
   report.results.push(result);fs.writeFileSync(file,JSON.stringify(report));
   console.log(model,JSON.stringify(result.metrics));
   const m=result.metrics;
   for(const key of ['archiveMm','zeroMm','protectedMm','offsetMm','kneeLateralMm','heightErrorMm','outsideMm','contactFloorDeltaMm','repeatMm','seekMm','groupMm','symmetryAddedHeightMm'])assert(m[key]<.00001,key+': '+m[key]);
   for(const key of ['zeroDeg','protectedDeg','footWorldDeg','kneeFlexDeg','outsideDeg'])assert(m[key]<.001,key+': '+m[key]);
   assert(m.minFloorMm>=-.001,'ground penetration');assert(m.maxThighTurnDeg<25,'unbounded swing change');
   for(const r of result.ranges)assert(Math.abs(r.maxRiseMm-r.cm*10)<.00001,'peak height cm');
   for(const b of result.boundaries)assert(b.velocityGapMps<.002,'transition discontinuity');
   assert.equal(result.invalidRejected,4);assert.equal(result.transition.end,0);assert(result.transition.min>=0&&result.transition.max<=10);
  }
  report.unchanged=Object.entries(manifest.hashes).map(([path,hash])=>({path,ok:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')===hash}));
  assert(report.unchanged.every(r=>r.ok));assert.equal(report.errors.length,0);report.status='passed';
 }catch(e){report.failure=e.stack;throw e;}
 finally{fs.writeFileSync(file,JSON.stringify(report));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
