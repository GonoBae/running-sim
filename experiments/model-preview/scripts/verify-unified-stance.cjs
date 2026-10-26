const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file='docs/05-validation/reports/cmu-unified-stance.json',out='outputs/cmu-unified-stance';
const archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-support-join.json'));
const sourceArchive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-full-run-review.json'));
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]};
fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(file,JSON.stringify(report));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=unified-stance');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
   const result=await page.evaluate(async({model,prior})=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js'),V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),deg=180/Math.PI;const {createSkinPointBatch}=await import('/review/skin-point-batch.js');const batches=new Map(a.lanes.map(l=>[l,createSkinPointBatch(l.model.getObjectByName('Human'))]));
    const names=a.data.models[model].bones.map(b=>b.name),sides=['r','l'],parts={r:a.earlySupportPlan.right,l:a.earlySupportPlan.left};
    a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
    const patches={};
    for(const s of sides){
     a.earlySupportPlan.apply(a.lanes[0],a.probe,.30+(s==='l'?.5:0));
     const mesh=a.lanes[0].model.getObjectByName('Human');mesh.skeleton.update();
     const p=parts[s].read(a.lanes[0]),candidates=[],at=mesh.geometry.attributes;
     for(let i=0;i<at.position.count;i++){
      let weight=0;
      for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${s}$`).test(mesh.skeleton.bones[at.skinIndex.getComponent(i,j)].name))weight+=at.skinWeight.getComponent(i,j);
      if(weight<.9)continue;
      const point=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld),distance=point.distanceTo(p);
      if(distance<.035)candidates.push({i,distance});
     }
     patches[s]=candidates.sort((x,y)=>x.distance-y.distance).slice(0,12).map(v=>v.i);
    }
    const read=(plan,l,t,skin=true)=>{
     const diagnostic=plan.apply(l,a.probe,t),model=l.model;
     const bones=Object.fromEntries(names.map(n=>{const b=model.getObjectByName(n);return[n,{p:b.getWorldPosition(V()),q:b.getWorldQuaternion(Q()).normalize(),local:b.quaternion.clone(),offset:b.position.clone()}];}));
     const legs={},mesh=model.getObjectByName('Human');mesh.skeleton.update();
     for(const s of sides){
      const h=bones['thigh_'+s].p,k=bones['calf_'+s].p,f=bones['foot_'+s].p;
      legs[s]={point:parts[s].read(l),knee:180-h.clone().sub(k).angleTo(f.clone().sub(k))*deg,
       floor:skin?l.readSurface(s).min:0,sole:skin?batches.get(l)(a.unifiedStancePlan.curves[s].indices):[],patch:skin?patches[s].map(i=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld)):[]};
     }
     return {root:model.position.clone(),bones,legs,diagnostic};
    };
    const m={protectedMm:0,protectedDeg:0,hipPositionMm:0,offsetMm:0,footWorldDeg:0,footHeightMm:0,pointHeightMm:0,floorDeltaMm:0,contactFloorDeltaMm:0,minFloorMm:Infinity,
     outsideMm:0,outsideDeg:0,archiveMm:0,archiveFootDeg:0,kneeChangeDeg:0,kneeShiftMm:0,ankleRelativeDeg:0,hipLocalDeg:0,calfLocalDeg:0,
     residualMm:0,kneeMinDeg:Infinity,velocityGapMps:0,angularGapDegps:0,repeatMm:0,repeatDeg:0,seekMm:0,groupMm:0,symmetryKneeDeg:0};const contact={before:{r:0,l:0},after:{r:0,l:0}},previous={before:{},after:{}};
    const frames=[];
    const active=(t,s)=>{const p=((t-(s==='l'?.5:0))%1+1)%1;return p>.28&&p<.68;};
    for(let i=0;i<=1000;i++){
     const t=i/1000,b=read(a.supportJoinPlan,a.lanes[0],t),c=read(a.unifiedStancePlan,a.lanes[1],t);
     m.protectedMm=Math.max(m.protectedMm,b.root.distanceTo(c.root)*1000);
     for(const n of names){
      const x=b.bones[n],y=c.bones[n],leg=/^(thigh|calf|foot|ball)_([rl])$/.exec(n);
      m.offsetMm=Math.max(m.offsetMm,x.offset.distanceTo(y.offset)*1000);
      if(!leg){m.protectedMm=Math.max(m.protectedMm,x.p.distanceTo(y.p)*1000);m.protectedDeg=Math.max(m.protectedDeg,x.q.angleTo(y.q)*deg);}
      if(leg&&!active(t,leg[2])){m.outsideMm=Math.max(m.outsideMm,x.p.distanceTo(y.p)*1000);m.outsideDeg=Math.max(m.outsideDeg,x.q.angleTo(y.q)*deg);}
      
     }
     for(const [key,value] of [['before',b],['after',c]])for(const s of sides){
      const points=value.legs[s].sole,old=previous[key][s],floor=Math.min(...points.map(p=>p.y));
      if(old&&floor<=.001&&old.floor<=.001){
       let sum=0,weights=0;
       for(let j=0;j<points.length;j++){
        const w=Math.exp(-Math.max(points[j].y-floor,old.points[j].y-old.floor)/.001);
        sum+=w*Math.hypot(points[j].x-old.points[j].x,points[j].z-old.points[j].z)*1000;weights+=w;
       }
       contact[key][s]+=sum/weights;
      }
      value.legs[s].contactActive=!!old&&floor<=.001&&old.floor<=.001;previous[key][s]={points,floor};
     }
     const row={t,before:{},after:{}};
     for(const s of sides){
      const x=b.legs[s],y=c.legs[s];
      m.hipPositionMm=Math.max(m.hipPositionMm,b.bones['thigh_'+s].p.distanceTo(c.bones['thigh_'+s].p)*1000);
      for(const n of ['foot','ball'])m.footWorldDeg=Math.max(m.footWorldDeg,b.bones[n+'_'+s].q.angleTo(c.bones[n+'_'+s].q)*deg);
      m.footHeightMm=Math.max(m.footHeightMm,Math.abs(b.bones['foot_'+s].p.y-c.bones['foot_'+s].p.y)*1000);
      m.pointHeightMm=Math.max(m.pointHeightMm,Math.abs(x.point.y-y.point.y)*1000);
      m.floorDeltaMm=Math.max(m.floorDeltaMm,Math.abs(x.floor-y.floor)*1000);const legPhase=((t-(s==='l'?.5:0))%1+1)%1;if(legPhase>=.28&&legPhase<=.55)m.contactFloorDeltaMm=Math.max(m.contactFloorDeltaMm,Math.abs(x.floor-y.floor)*1000);m.minFloorMm=Math.min(m.minFloorMm,y.floor*1000);
      m.kneeChangeDeg=Math.max(m.kneeChangeDeg,Math.abs(x.knee-y.knee));m.kneeMinDeg=Math.min(m.kneeMinDeg,y.knee);
      m.kneeShiftMm=Math.max(m.kneeShiftMm,b.bones['calf_'+s].p.distanceTo(c.bones['calf_'+s].p)*1000);
      for(const [n,key] of [['foot','ankleRelativeDeg'],['thigh','hipLocalDeg'],['calf','calfLocalDeg']])m[key]=Math.max(m[key],b.bones[n+'_'+s].local.angleTo(c.bones[n+'_'+s].local)*deg);
      m.archiveMm=Math.max(m.archiveMm,x.point.distanceTo(new T.Vector3(...prior.frames[i].after[s].point))*1000,b.bones['calf_'+s].p.distanceTo(new T.Vector3(...prior.frames[i].after[s].kneePoint))*1000);m.archiveFootDeg=Math.max(m.archiveFootDeg,Math.abs(x.knee-prior.frames[i].after[s].knee));
      for(const [key,v] of [['before',b],['after',c]])row[key][s]={point:v.legs[s].point.toArray(),knee:v.legs[s].knee,kneePoint:v.bones['calf_'+s].p.toArray(),hip:v.bones['thigh_'+s].p.toArray(),ankle:v.bones['foot_'+s].p.toArray(),ball:v.bones['ball_'+s].p.toArray(),contactMm:contact[key][s],contactActive:v.legs[s].contactActive,floor:v.legs[s].floor,patch:v.legs[s].patch.map(p=>p.toArray())};
     }
     
     frames.push(row);
    }
    const commonContact={before:{r:0,l:0},after:{r:0,l:0}},contactSeconds={before:{r:0,l:0},after:{r:0,l:0}};
    for(let i=1;i<frames.length;i++)for(const s of sides){
     const row=frames[i],prev=frames[i-1];
     for(const key of ['before','after']){
      if(row[key][s].contactActive)contactSeconds[key][s]+=.001*a.data.seconds;
      if(row.before[s].contactActive&&row.after[s].contactActive)commonContact[key][s]+=row[key][s].contactMm-prev[key][s].contactMm;
     }
    }
    const travel=(rows,key,s,selector=r=>r[key][s].point)=>rows.slice(1).reduce((sum,r,i)=>{
     const x=selector(rows[i]),y=selector(r);return sum+Math.hypot(y[0]-x[0],y[2]-x[2])*1000;
    },0);
    const paths={},neighbors={},speeds={};
    for(const s of sides){
     const shift=s==='l'?.5:0,subset=(lo,hi)=>frames.filter(r=>r.t>=lo+shift-1e-9&&r.t<=hi+shift+1e-9);
     paths[s]={};
     for(const [key,lo,hi] of [['entry',.28,.30],['hold',.30,.36],['join',.36,.43],['early',.28,.38],['all',.28,.43],['stance',.28,.50]]){
      const rows=subset(lo,hi);paths[s][key]={beforeMm:travel(rows,'before',s),afterMm:travel(rows,'after',s)};
     }
     const rows=subset(.28,.43);
     paths[s].nearGround={};
     for(const key of ['before','after']){
      let sum=0;
      for(let i=1;i<rows.length;i++)if(rows[i][key][s].point[1]<=.001&&rows[i-1][key][s].point[1]<=.001)
       sum+=Math.hypot(...[0,2].map(k=>rows[i][key][s].point[k]-rows[i-1][key][s].point[k]))*1000;
      paths[s].nearGround[key+'Mm']=sum;
     }
     neighbors[s]=patches[s].map((id,j)=>({id,beforeMm:travel(rows,'before',s,r=>r.before[s].patch[j]),afterMm:travel(rows,'after',s,r=>r.after[s].patch[j])}));
     speeds[s]=Object.fromEntries(['before','after'].map(key=>[key,Math.max(...rows.slice(1).map((r,i)=>new T.Vector3(...r[key][s].point).distanceTo(new T.Vector3(...rows[i][key][s].point))/.001/a.data.seconds))]));
    }
    for(let i=0;i<1000;i++)m.symmetryKneeDeg=Math.max(m.symmetryKneeDeg,Math.abs(frames[i].after.r.knee-frames[(i+500)%1000].after.l.knee));
    const omega=(p,q,dt)=>{const d=q.clone().multiply(p.clone().invert()).normalize();if(d.w<0)d.set(-d.x,-d.y,-d.z,-d.w);const n=Math.hypot(d.x,d.y,d.z);return n<1e-12?V():new T.Vector3(d.x,d.y,d.z).multiplyScalar(2*Math.atan2(n,d.w)/n/dt*deg);};
    const symmetry={};
    for(const [window,lo,hi] of [['join',.36,.43],['cycle',0,.999]]){
     symmetry[window]={};
     for(const key of ['before','after']){
      const values={knee:[],kneePoint:[],ankle:[],ball:[]};
      for(let i=Math.round(lo*1000);i<=Math.round(hi*1000);i++){
       const r=frames[i][key].r,l=frames[(i+500)%1000][key].l;
       values.knee.push(Math.abs(r.knee-l.knee));
       for(const name of ['kneePoint','ankle','ball']){
        const rp=new T.Vector3(...r[name]).sub(new T.Vector3(...r.hip));rp.x*=-1;
        const lp=new T.Vector3(...l[name]).sub(new T.Vector3(...l.hip));
        values[name].push(rp.distanceTo(lp)*1000);
       }
      }
      symmetry[window][key]=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{max:Math.max(...v),rms:Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length)}]));
     }
    }
    const release={};for(const s of sides){const rows=Array.from({length:131},(_,i)=>{const t=.55+i/1000+(s==='l'?.5:0);return read(a.unifiedStancePlan,a.lanes[1],t,false).legs[s].knee;});release[s]={minimumStepDeg:Math.min(...rows.slice(1).map((v,i)=>v-rows[i]))};}const boundary=[];
    for(const t of [0,.28,.30,.36,.40,.55,.68,.78,.8,.86,.9,1,1.05,1.18]){
     const h=1e-5,ss=[-2,-1,0,1,2].map(k=>read(a.unifiedStancePlan,a.lanes[1],t+k*h,false)),dt=h*a.data.seconds;
     let maxP=0,maxQ=0;
     for(const n of names){
      const ps=ss.map(r=>r.bones[n].p),qs=ss.map(r=>r.bones[n].q);
      const vl=ps[2].clone().multiplyScalar(3).addScaledVector(ps[1],-4).add(ps[0]).divideScalar(2*dt);
      const vr=ps[2].clone().multiplyScalar(-3).addScaledVector(ps[3],4).addScaledVector(ps[4],-1).divideScalar(2*dt);
      maxP=Math.max(maxP,vl.distanceTo(vr));maxQ=Math.max(maxQ,omega(qs[1],qs[2],dt).distanceTo(omega(qs[2],qs[3],dt)));
     }
     m.velocityGapMps=Math.max(m.velocityGapMps,maxP);m.angularGapDegps=Math.max(m.angularGapDegps,maxQ);boundary.push({t,velocityGapMps:maxP,angularGapDegps:maxQ});
    }
    for(const t of [0,.28,.34,.43,.78,.86,.88,.89,.9,.91,.92,.93,.98]){
     const x=read(a.unifiedStancePlan,a.lanes[1],t,false),y=read(a.unifiedStancePlan,a.lanes[1],t+1,false);
     read(a.unifiedStancePlan,a.lanes[1],t+.18,false);const z=read(a.unifiedStancePlan,a.lanes[1],t,false);
     for(const n of names){m.repeatMm=Math.max(m.repeatMm,y.bones[n].p.clone().sub(a.plan.pelvisTravel).distanceTo(x.bones[n].p)*1000);m.repeatDeg=Math.max(m.repeatDeg,x.bones[n].q.angleTo(y.bones[n].q)*deg);m.seekMm=Math.max(m.seekMm,x.bones[n].p.distanceTo(z.bones[n].p)*1000);}
     const l=a.lanes[1];l.group.position.set(-2,0,3);l.group.updateMatrixWorld(true);const shifted=read(a.unifiedStancePlan,l,t,false);
     for(const n of names)m.groupMm=Math.max(m.groupMm,shifted.bones[n].p.clone().sub(l.group.position).distanceTo(x.bones[n].p)*1000);
     l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);
    }
    return {model,release,contact,commonContact,contactSeconds,symmetry,metrics:m,paths,neighbors,speeds,boundary,vertices:Object.fromEntries(sides.map(s=>[s,parts[s].vertex])),options:a.unifiedStancePlan.options,seconds:a.data.seconds,
     frames:frames.map(r=>({t:r.t,before:Object.fromEntries(sides.map(s=>{const {patch,...v}=r.before[s];return[s,v];})),after:Object.fromEntries(sides.map(s=>{const {patch,...v}=r.after[s];return[s,v];}))}))};
   },{model,prior:archive.results.find(r=>r.model===model)});
   report.results.push(result);save();console.log(JSON.stringify({model,metrics:result.metrics,paths:result.paths,contact:result.contact,symmetry:result.symmetry}));
   const m=result.metrics;
   for(const key of ['protectedMm','hipPositionMm','offsetMm','contactFloorDeltaMm','outsideMm','archiveMm','residualMm','repeatMm','seekMm','groupMm'])assert(m[key]<.01,key);
   for(const key of ['protectedDeg','footWorldDeg','outsideDeg','archiveFootDeg','repeatDeg'])assert(m[key]<.001,key);
   assert(m.minFloorMm>=-.01&&m.kneeMinDeg>0,'floor and knee');
   assert(m.kneeChangeDeg<15&&m.ankleRelativeDeg<15,'small local correction guard, not anatomical limits');
   assert(m.velocityGapMps<.001&&m.angularGapDegps<2,'boundary continuity');
   for(const [window,v] of Object.entries(result.symmetry))for(const key of Object.keys(v.before))for(const measure of ['max','rms'])assert(v.after[key][measure]<=v.before[key][measure]+.001,window+' '+key+' '+measure+' symmetry');
   for(const s of ['r','l'])assert(result.release[s].minimumStepDeg>=-1e-5,'no release knee reversal');
   for(const s of ['r','l'])assert(result.commonContact.after[s]<result.commonContact.before[s]*.99,'same grounded intervals improve');
   for(const s of ['r','l'])assert(result.contact.after[s]<result.contact.before[s]*.65,'contact-patch slip reduced at least 35%');
   await page.uncheck('#bones');
   for(const view of ['front','side']){
    await page.click('#'+view);
    for(const t of [.28,.32,.40,.48,.56,.60,.64,.68,.82,.90,.98,.06,.10,.14,.18]){
     await page.evaluate(t=>window.sharedGaitReview.seek(t),t);
     await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(t*100)}.png`});
    }
   }
  }
  report.unchanged=archive.unchanged.map(f=>{
   assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),sourceArchive.runtimeHashes[f],f);return f;
  });
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.error=e.stack;throw e;}finally{save();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
