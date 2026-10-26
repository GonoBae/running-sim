// M71: preservation against M70, geometric hand directions and actual skin samples.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const file='docs/05-validation/reports/cmu-hand-pose.json',out='outputs/cmu-hand-pose';
const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-arm-swing.json'));
const diagnostic=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-hand-pose-diagnostic.json'));
const report={status:'running',testedAt:new Date().toISOString(),errors:[],results:[]};
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=hand-pose');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
   const result=await page.evaluate(async({model,archive})=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
    const V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),deg=180/Math.PI,ref=a.data.models[model],names=ref.bones.map(b=>b.name);
    const changed=new Set(a.handPosePlan.names),chestRest=new T.Quaternion(...ref.bones.find(b=>b.name==='spine_03').worldQ).normalize();
    const fingers=['index','middle','ring','pinky','thumb'],sides=['r','l'];
    a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
    // Choose a material point near each distal fingertip, once in neutral pose.
    const neutral=a.lanes[0].model,mesh=neutral.getObjectByName('Human'),at=mesh.geometry.attributes;
    ref.bones.forEach(b=>neutral.getObjectByName(b.name).quaternion.fromArray(b.localQ));
    neutral.updateMatrixWorld(true);mesh.skeleton.update();
    const points={},protectedIds=[];
    for(let i=0;i<at.position.count;i++){
     let alteredWeight=0;for(let j=0;j<4;j++)if(changed.has(mesh.skeleton.bones[at.skinIndex.getComponent(i,j)].name))alteredWeight+=at.skinWeight.getComponent(i,j);
     if(alteredWeight===0)protectedIds.push(i);
    }
    for(const side of sides)for(const finger of fingers){
     const name=finger+'_03_'+side,bone=neutral.getObjectByName(name),index=mesh.skeleton.bones.indexOf(bone),inverse=bone.matrixWorld.clone().invert();
     let id=-1,best=-Infinity;
     for(let i=0;i<at.position.count;i++){
      let weight=0;for(let j=0;j<4;j++)if(at.skinIndex.getComponent(i,j)===index)weight+=at.skinWeight.getComponent(i,j);
      if(weight<.5)continue;
      const y=mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse).y;
      if(y>best){best=y;id=i;}
     }
     if(id<0)throw Error('No distal skin sample '+name);points[name]=id;
    }
    const sample=(plan,l,t,skinAll=false)=>{
     plan.apply(l,a.probe,t);const model=l.model,m=model.getObjectByName('Human');m.skeleton.update();
     const bones=Object.fromEntries(names.map(n=>{const b=model.getObjectByName(n);return[n,{p:b.getWorldPosition(V()),q:b.getWorldQuaternion(Q()).normalize(),offset:b.position.clone()}];}));
     const chest=bones.spine_03.q.clone().multiply(chestRest.clone().invert()),inv=chest.clone().invert();
     const hands={},arms={};
     for(const s of sides){
      const w=bones['hand_'+s],elbow=bones['lowerarm_'+s],shoulder=bones['upperarm_'+s];
      const long=bones['middle_01_'+s].p.clone().sub(w.p).normalize();
      const across=bones['index_01_'+s].p.clone().sub(bones['pinky_01_'+s].p).normalize();
      const palm=long.clone().cross(across).normalize().multiplyScalar(s==='r'?-1:1);
      const fore=w.p.clone().sub(elbow.p).normalize();
      const u=elbow.p.clone().sub(shoulder.p).applyQuaternion(inv).normalize();
      arms[s]={swing:Math.atan2(u.z,-u.y)*deg,outward:Math.asin(u.x*(s==='l'?1:-1))*deg,
       elbow:u.angleTo(fore.clone().applyQuaternion(inv))*deg,hand:w.p.clone().sub(shoulder.p).applyQuaternion(inv).toArray()};
      hands[s]={bend:fore.angleTo(long)*deg,fingers:Object.fromEntries(fingers.map(f=>{
       const pt=m.getVertexPosition(points[f+'_03_'+s],V()).applyMatrix4(m.matrixWorld).sub(w.p);
       return[f,{distanceMm:pt.length()*1000,palmMm:pt.dot(palm)*1000,point:pt.clone().applyQuaternion(inv).toArray()}];
      })),joints:Object.fromEntries(names.filter(n=>changed.has(n)&&n.endsWith('_'+s)).map(n=>[n.slice(0,-2),bones[n].p.clone().sub(w.p).applyQuaternion(inv).toArray()]))};
     }
     return {bones,arms,hands,root:model.position.clone(),floor:sides.map(s=>l.readSurface(s).min),
      skin:skinAll?protectedIds.map(i=>m.getVertexPosition(i,V()).applyMatrix4(m.matrixWorld)):null};
    };
    const m={protectedMm:0,protectedDeg:0,wristMm:0,boneOffsetMm:0,protectedSkinMm:0,floorDeltaMm:0,minFloorMm:Infinity,
     archivedArmDeg:0,archivedWristMm:0,armDeg:0,symmetryMm:0,symmetryBendDeg:0,seamDeg:0,seamVelocityGapRadPerSec:0,seekDeg:0,displayGroupDeg:0};
    const frames=[],N=1000;
    for(let i=0;i<=N;i++){
     const t=i/N,b=sample(a.armSwingPlan,a.lanes[0],t,i%50===0),c=sample(a.handPosePlan,a.lanes[1],t,i%50===0);
     m.protectedMm=Math.max(m.protectedMm,b.root.distanceTo(c.root)*1000);
     for(const n of names){
      const x=b.bones[n],y=c.bones[n];
      m.boneOffsetMm=Math.max(m.boneOffsetMm,x.offset.distanceTo(y.offset)*1000);
      if(!changed.has(n)){m.protectedMm=Math.max(m.protectedMm,x.p.distanceTo(y.p)*1000);m.protectedDeg=Math.max(m.protectedDeg,x.q.angleTo(y.q)*deg);}
     }
     if(b.skin)for(let k=0;k<b.skin.length;k++)m.protectedSkinMm=Math.max(m.protectedSkinMm,b.skin[k].distanceTo(c.skin[k])*1000);
     for(const [si,s] of sides.entries()){
      m.wristMm=Math.max(m.wristMm,b.bones['hand_'+s].p.distanceTo(c.bones['hand_'+s].p)*1000);
      m.floorDeltaMm=Math.max(m.floorDeltaMm,Math.abs(b.floor[si]-c.floor[si])*1000);m.minFloorMm=Math.min(m.minFloorMm,c.floor[si]*1000);
      for(const key of ['swing','outward','elbow']){
       m.armDeg=Math.max(m.armDeg,Math.abs(b.arms[s][key]-c.arms[s][key]));
       m.archivedArmDeg=Math.max(m.archivedArmDeg,Math.abs(b.arms[s][key]-archive.frames[i].after[s][key]));
      }
      m.archivedWristMm=Math.max(m.archivedWristMm,new T.Vector3(...b.arms[s].hand).distanceTo(new T.Vector3(...archive.frames[i].after[s].hand))*1000);
     }
     frames.push({t,before:b.hands,after:c.hands});
    }
    for(let i=0;i<500;i++){
     const r=frames[i].after.r,l=frames[i+500].after.l;
     m.symmetryBendDeg=Math.max(m.symmetryBendDeg,Math.abs(r.bend-l.bend));
     const mirroredDistance=(x,y)=>new T.Vector3(...x).distanceTo(new T.Vector3(-y[0],y[1],y[2]))*1000;
     for(const n of Object.keys(r.joints))m.symmetryMm=Math.max(m.symmetryMm,mirroredDistance(r.joints[n],l.joints[n]));
     for(const f of fingers)m.symmetryMm=Math.max(m.symmetryMm,mirroredDistance(r.fingers[f].point,l.fingers[f].point));
    }
    // Quaternion angular velocities across the wrap; actual hand/finger world rotation.
    const read=t=>sample(a.handPosePlan,a.lanes[1],t),h=1e-5,x=read(1-h),y=read(1),z=read(1+h),zero=read(0);
    const velocity=(p,q)=>{
     const delta=q.clone().multiply(p.clone().invert());if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
     return new T.Vector3(delta.x,delta.y,delta.z).multiplyScalar(2/(h*a.data.seconds));
    };
    for(const n of changed){
     m.seamDeg=Math.max(m.seamDeg,y.bones[n].q.angleTo(zero.bones[n].q)*deg);
     m.seamVelocityGapRadPerSec=Math.max(m.seamVelocityGapRadPerSec,velocity(x.bones[n].q,y.bones[n].q).distanceTo(velocity(y.bones[n].q,z.bones[n].q)));
    }
    for(const t of [.23,0,.65,.02,1,.23]){
     const before=read(t);read(t+.31);const after=read(t);
     for(const n of names)m.seekDeg=Math.max(m.seekDeg,before.bones[n].q.angleTo(after.bones[n].q)*deg);
     a.lanes[1].group.position.set(-3,0,2);a.lanes[1].group.updateMatrixWorld(true);const shifted=read(t);
     for(const n of names)m.displayGroupDeg=Math.max(m.displayGroupDeg,before.bones[n].q.angleTo(shifted.bones[n].q)*deg);
     a.lanes[1].group.position.set(0,0,0);a.lanes[1].group.updateMatrixWorld(true);
    }
    const range=arr=>[Math.min(...arr),Math.max(...arr)];
    const hands=Object.fromEntries(sides.map(s=>[s,{beforeBendDeg:range(frames.map(f=>f.before[s].bend)),afterBendDeg:range(frames.map(f=>f.after[s].bend)),
     fingers:Object.fromEntries(fingers.map(n=>[n,{towardPalmMm:range(frames.map(f=>f.after[s].fingers[n].palmMm-f.before[s].fingers[n].palmMm)),
      shortenedMm:range(frames.map(f=>f.before[s].fingers[n].distanceMm-f.after[s].fingers[n].distanceMm))}]))}]));
    return {model,samples:N+1,protectedSkinVertices:protectedIds.length,skinPhases:21,skinPoints:points,metrics:m,hands,frames};
   },{model,archive:old.results.find(r=>r.model===model)});
   report.results.push(result);console.log(model,result.metrics,JSON.stringify(result.hands));
   const m=result.metrics;
   for(const n of ['protectedMm','wristMm','boneOffsetMm','protectedSkinMm','floorDeltaMm','archivedWristMm','symmetryMm'])assert(m[n]<.01,n);
   for(const n of ['protectedDeg','archivedArmDeg','armDeg','symmetryBendDeg','seamDeg','seekDeg','displayGroupDeg'])assert(m[n]<.001,n);
   assert(m.minFloorMm>=-.01);assert(m.seamVelocityGapRadPerSec<.01);
   for(const h of Object.values(result.hands)){
    assert(h.afterBendDeg[1]<8,'wrist near neutral geometry');
    for(const f of Object.values(h.fingers)){assert(f.towardPalmMm[0]>0,'skin bends toward palm');assert(f.shortenedMm[0]>0,'fingers no longer extended');}
   }
   await page.uncheck('#bones');
   for(const view of ['front','side']){
    await page.click('#'+view);
    for(const phase of [0,.15,.35,.5,.65,.85]){
     await page.evaluate(t=>window.sharedGaitReview.seek(t),phase);
     await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*100)}.png`});
    }
   }
  }
  report.unchangedModules=Object.fromEntries(Object.entries(diagnostic.hashes).map(([name,hash])=>[name,crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')===hash]));
  assert(Object.values(report.unchangedModules).every(Boolean));assert.equal(report.errors.length,0);report.status='passed';
 }catch(e){report.failure=e.stack;throw e;}
 finally{fs.writeFileSync(file,JSON.stringify(report));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
