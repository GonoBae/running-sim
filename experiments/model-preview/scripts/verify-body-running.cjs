const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const report={status:'running',models:[],errors:[]};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:5173/body');
 const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/stages-motion-baseline.json','utf8'));
 for(const type of ['male','female']){
  const result=await p.evaluate(async({type,old})=>{
   const T=await import('/node_modules/.vite/deps/three.js');
   const {loadModel,createRunningRuntime}=await import('/src/running-runtime.js');
   const {createBodyRunning}=await import('/src/body-running.js');
   const {cloneBodySource,createBodyModel,applyBodySettings}=await import('/src/body-runtime.js');
   const {normalizeState}=await import('/src/stage-state.ts');
   const {legHeightWeight}=await import('/review/leg-height.js');
   const source=await loadModel(type),base=createRunningRuntime(cloneBodySource(source.model),source.reference,type);
   const point=(model,name)=>model.getObjectByName(name).getWorldPosition(new T.Vector3());
   const getQ=(model,name)=>model.getObjectByName(name).getWorldQuaternion(new T.Quaternion()).normalize();
   const fingerprint=model=>{model.updateMatrixWorld(true);const a=[];model.traverse(o=>{if(o.isBone)a.push(...o.matrixWorld.elements);if(o.isSkinnedMesh){a.push(...o.skeleton.boneInverses.flatMap(m=>m.elements));for(const id of [0,100,500,1000,13000])if(id<o.geometry.attributes.position.count)a.push(...o.getVertexPosition(id,new T.Vector3()).toArray());}});return a;};
   const pristine=fingerprint(source.model);
   const maxDiff=(a,b)=>a.reduce((v,n,i)=>Math.max(v,Math.abs(n-b[i])),0);
   const values=l=>{const a=[];l.model.traverse(o=>{if(o.isBone)a.push(...o.matrixWorld.elements);if(o.isSkinnedMesh)for(const id of [0,100,200,500,1000])if(id<o.geometry.attributes.position.count)a.push(...o.localToWorld(o.getVertexPosition(id,new T.Vector3())).toArray());});return a;};
   let defaultError=0;for(const row of old){base.apply(row.phase,row.leg,row.elbow);defaultError=Math.max(defaultError,maxDiff(values(base.lane),row.values));}
   const fields=['upperArm','forearm','thigh','shin','torso','shoulders'],cases=[];
   cases.push({name:'default',state:normalizeState(null)});
   for(const field of fields)for(const value of [.85,1.15]){const state=normalizeState(null);state.ratios[field]=value;cases.push({name:field+'-'+value,state});}
   for(const scale of [.9,1.1]){const state=normalizeState(null);state.scale=scale;cases.push({name:'scale-'+scale,state});}
   // Every corner of the six length controls, alternating the scale extremes.
   for(let bits=0;bits<64;bits++){const state=normalizeState(null);fields.forEach((f,k)=>state.ratios[f]=(bits>>k)&1?1.15:.85);state.scale=bits%2?1.1:.9;cases.push({name:'corner-'+bits,state});}
   let seed=734;
   for(let i=0;i<8;i++){const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const state=normalizeState(null);fields.forEach(f=>state.ratios[f]=.85+.3*random());state.scale=.9+.2*random();cases.push({name:'interior-'+i,state});}
   const rows=[];
   for(const {name,state} of cases){
    const runtime=createBodyRunning(source.model,base,state),model=runtime.lane.model,dim=runtime.body.dimensions;
    const measured=dim.measure();let neutralErrorCm=0;
    for(const f of fields)neutralErrorCm=Math.max(neutralErrorCm,Math.abs(measured[f]-dim.baseline[f]*state.ratios[f]*state.scale));
    const stats={name,scale:state.scale,ratios:state.ratios,samples:0,neutralErrorCm,maxLengthErrorCm:0,maxKneeRiseErrorCm:0,maxElbowErrorDeg:0,maxFootDirectionRad:0,minSole:Infinity,maxClearanceError:0,maxStanceSole:0,sourceMutation:0,loopError:0,maxRootVelocityStep:0};
    let prevY=null,prevV=null;
    const stride=runtime.travelScale,segmentPairs={upperArm:['upperarm','lowerarm'],forearm:['lowerarm','hand'],thigh:['thigh','calf'],shin:['calf','foot']};
    const originalLengths={};base.apply(0,0,0);for(const [id,pair]of Object.entries(segmentPairs))for(const side of ['r','l'])originalLengths[id+side]=point(base.lane.model,pair[0]+'_'+side).distanceTo(point(base.lane.model,pair[1]+'_'+side));
    for(let i=0;i<=100;i++){
     const phase=i/100;runtime.apply(phase,0,0);const low0=Math.min(runtime.lane.readSurface('r').min,runtime.lane.readSurface('l').min);
     const neutralK=Object.fromEntries(['r','l'].map(s=>[s,point(model,'calf_'+s).y]));
     const pos=model.position.clone();
     const origSole=Math.min(base.lane.readSurface('r').min,base.lane.readSurface('l').min);
     stats.maxClearanceError=Math.max(stats.maxClearanceError,Math.abs(low0-Math.max(0,origSole)*stride));
     const rPhase=phase%1,lPhase=(phase+.5)%1;
     for(const [s,t]of [['r',rPhase],['l',lPhase]])if(t>=.30&&t<=.53)stats.maxStanceSole=Math.max(stats.maxStanceSole,runtime.lane.readSurface(s).min);
     if(prevY!==null){const v=(pos.y-prevY)*100;if(prevV!==null)stats.maxRootVelocityStep=Math.max(stats.maxRootVelocityStep,Math.abs(v-prevV));prevV=v;}prevY=pos.y;
     for(const [leg,arm]of [[0,-20],[5,0],[10,20]]){
      const d=runtime.apply(phase,leg,arm);stats.samples++;
      for(const side of ['r','l']){
       const expected=leg*legHeightWeight(phase-(side==='l'?.5:0));
       stats.maxKneeRiseErrorCm=Math.max(stats.maxKneeRiseErrorCm,Math.abs((point(model,'calf_'+side).y-neutralK[side])*100-expected));
       const a=d.elbowBend.find(a=>a.side===side);stats.maxElbowErrorDeg=Math.max(stats.maxElbowErrorDeg,Math.abs(a.actualDeg-a.baseDeg-arm));
       stats.maxFootDirectionRad=Math.max(stats.maxFootDirectionRad,getQ(model,'foot_'+side).angleTo(getQ(base.lane.model,'foot_'+side)));
       for(const [id,pair]of Object.entries(segmentPairs))stats.maxLengthErrorCm=Math.max(stats.maxLengthErrorCm,Math.abs(point(model,pair[0]+'_'+side).distanceTo(point(model,pair[1]+'_'+side))-originalLengths[id+side]*state.ratios[id]*state.scale)*100);
       stats.minSole=Math.min(stats.minSole,runtime.lane.readSurface(side).min);
      }
      model.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))throw Error('Non-finite bone '+name);});
      if(pos.distanceTo(model.position)>1e-8)throw Error('Pose input moved root.');
     }
    }
    // Pose at the loop boundary must agree after removing root travel.
    const pose=t=>{runtime.apply(t,10,20);const H=point(model,'pelvis'),a=[];model.traverse(o=>{if(o.isBone)a.push(...o.getWorldPosition(new T.Vector3()).sub(H).toArray(),...o.quaternion.toArray());});return a;};
    stats.loopError=maxDiff(pose(0),pose(1));stats.sourceMutation=maxDiff(pristine,fingerprint(source.model));
    runtime.dispose();rows.push(stats);
    if(rows.length%16===0)await new Promise(r=>setTimeout(r,0));
   }
   base.dispose();return {type,defaultError,cases:rows};
  },{type,old:old.models[type]});
  report.models.push(result);console.log(type+': '+result.cases.length+' bodies checked');
  assert(result.defaultError<1e-10);
  for(const r of result.cases){assert(r.neutralErrorCm<.001,r.name+' neutral length');assert(r.maxLengthErrorCm<.001,r.name+' posed length');assert(r.maxKneeRiseErrorCm<.001,r.name+' cm');assert(r.maxElbowErrorDeg<.001,r.name+' elbow');assert(r.maxFootDirectionRad<1e-5,r.name+' foot');assert(r.minSole>-.00001,r.name+' ground');assert(r.maxClearanceError<1e-6,r.name+' clearance');assert(r.loopError<1e-7,r.name+' loop');assert(r.sourceMutation===0,r.name+' source mutation');}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync('docs/05-validation/reports/body-running.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,failure:report.failure,models:report.models.map(m=>({model:m.type,cases:m.cases.length,samples:m.cases.reduce((s,c)=>s+c.samples,0),maxStanceSole:Math.max(...m.cases.map(c=>c.maxStanceSole)),minSole:Math.min(...m.cases.map(c=>c.minSole))}))}));}})();
