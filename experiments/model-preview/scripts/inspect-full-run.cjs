// M72 read-only full-body audit. No runtime modules, models or motion data edited.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='experiments/model-preview/',out='outputs/cmu-full-run-review';
fs.mkdirSync(out,{recursive:true});
const files=fs.readdirSync(root+'review').filter(n=>/\.(js|html)$/.test(n)).map(n=>root+'review/'+n)
 .concat(root+'review/data/cmu.json',root+'public/review-data/shared-gait-reference.json',...['male','female'].map(s=>root+'public/models/runner-'+s+'.glb'));
const hashes=()=>Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const before=hashes(),archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-arm-swing.json'));
const report={status:'running',testedAt:new Date().toISOString(),scope:'M71 geometry and visual review; not contact forces, COM or normative gait validation',errors:[],results:[]};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=hand-pose');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
   const data=await page.evaluate(async model=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
    const {createCycle}=await import('/review/cyclic-motion.js');
    const clip=(await fetch('/review/data/cmu.json').then(r=>r.json())).find(c=>c.id==='35_17'),cycle=createCycle(clip);
    a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
    const lane=a.lanes[1],V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),deg=180/Math.PI;
    const chestRest=new T.Quaternion(...a.data.models[model].bones.find(b=>b.name==='spine_03').worldQ);
    const names=['pelvis','spine_01','spine_02','spine_03','neck_01','head',...['r','l'].flatMap(s=>['clavicle','upperarm','lowerarm','hand','thigh','calf','foot','ball','middle_01','middle_02','middle_03'].map(n=>n+'_'+s))];
    const ids=model==='male'?{r:6707,l:13833}:{r:5462,l:12615};
    // Independently select the lowest material point at early support once,
    // rather than reselecting a different lowest vertex on each frame.
    const earlyIds={};
    for(const s of ['r','l']){
     a.handPosePlan.apply(lane,a.probe,.30+(s==='l'?.5:0));
     const mesh=lane.model.getObjectByName('Human');mesh.skeleton.update();
     const {skinIndex,skinWeight}=mesh.geometry.attributes;let lowest=Infinity;
     for(let id=0;id<skinIndex.count;id++){
      let weight=0;
      for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${s}$`).test(mesh.skeleton.bones[skinIndex.getComponent(id,j)].name))weight+=skinWeight.getComponent(id,j);
      if(weight<.9)continue;
      const p=mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld);
      if(p.y<lowest){lowest=p.y;earlyIds[s]=id;}
     }
    }
    const wrapAngle=x=>Math.atan2(Math.sin(x),Math.cos(x));
    const yaw=v=>Math.atan2(-v.z,v.x),bend=(h,k,f)=>180-h.clone().sub(k).angleTo(f.clone().sub(k))*deg;
    const sourceHeading=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.atan2(clip.frames.at(-1).p[0][0]-clip.frames[0].p[0][0],clip.frames.at(-1).p[0][2]-clip.frames[0].p[0][2]));
    const source=t=>{
     const f=cycle.sample(t*cycle.period),p=n=>new T.Vector3(...f.p[clip.names.indexOf(n)]).applyQuaternion(sourceHeading);
     const shoulders=p('lclavicle').sub(p('rclavicle')),hips=p('lhipjoint').sub(p('rhipjoint'));
     return {chestYawDeg:yaw(shoulders)*deg,hipYawDeg:yaw(hips)*deg,relativeYawDeg:wrapAngle(yaw(shoulders)-yaw(hips))*deg};
    };
    const snapshot=t=>{
     a.handPosePlan.apply(lane,a.probe,t);
     const bones=Object.fromEntries(names.map(n=>[n,lane.model.getObjectByName(n).getWorldPosition(V()).toArray()]));
     const pos=n=>new T.Vector3(...bones[n]),mid=pos('thigh_r').add(pos('thigh_l')).multiplyScalar(.5),up=pos('neck_01').sub(mid);
     const shoulders=pos('upperarm_l').sub(pos('upperarm_r')),hips=pos('thigh_l').sub(pos('thigh_r'));
     const frame=lane.model.getObjectByName('spine_03').getWorldQuaternion(Q()).multiply(chestRest.clone().invert()).invert();
     const mesh=lane.model.getObjectByName('Human');mesh.skeleton.update();
     const arms={},legs={};
     for(const s of ['r','l']){
      const H=pos('thigh_'+s),K=pos('calf_'+s),A=pos('foot_'+s),S=pos('upperarm_'+s),E=pos('lowerarm_'+s),W=pos('hand_'+s);
      const u=E.clone().sub(S).applyQuaternion(frame),f=W.clone().sub(E).applyQuaternion(frame),long=pos('middle_01_'+s).sub(W);
      arms[s]={swing:Math.atan2(u.z,-u.y)*deg,outward:Math.asin(u.clone().normalize().x*(s==='l'?1:-1))*deg,
       elbow:u.angleTo(f)*deg,hand:W.clone().sub(S).applyQuaternion(frame).toArray(),wristBend:W.clone().sub(E).angleTo(long)*deg,
       handLocal:lane.model.getObjectByName('hand_'+s).quaternion.toArray()};
      legs[s]={knee:bend(H,K,A),hipSwing:Math.atan2(K.z-H.z,H.y-K.y)*deg,
       minY:lane.readSurface(s).min,toePoint:mesh.getVertexPosition(ids[s],V()).applyMatrix4(mesh.matrixWorld).toArray(),
       earlyContactPoint:mesh.getVertexPosition(earlyIds[s],V()).applyMatrix4(mesh.matrixWorld).toArray(),
       ankleLocal:lane.model.getObjectByName('foot_'+s).quaternion.toArray()};
     }
     return {t,bones,hipMid:mid.toArray(),forwardTilt:Math.atan2(up.z,up.y)*deg,sideTilt:Math.atan2(up.x,up.y)*deg,
      chestYaw:yaw(shoulders)*deg,hipYaw:yaw(hips)*deg,relativeYaw:wrapAngle(yaw(shoulders)-yaw(hips))*deg,arms,legs,source:source(t)};
    };
    const rows=Array.from({length:1001},(_,i)=>snapshot(i/1000));
    const support=Object.fromEntries(['r','l'].map(s=>[s,Array.from({length:401},(_,i)=>snapshot(.28+.44*i/400+(s==='l'?.5:0)))]));
    const repeats=[snapshot(.43),snapshot(.12),snapshot(.43)];
    window.fullRunCapture=({phase,view})=>{
     snapshot(phase);a.lanes[0].group.visible=false;lane.lines.forEach(l=>l.visible=false);
     const center=lane.model.getObjectByName('pelvis').getWorldPosition(V());center.y=.95;
     a.renderer.setSize(540,680);Object.assign(a.camera,{left:-.82,right:.82,top:1.03,bottom:-1.03});
     a.camera.position.copy(center).add(new T.Vector3(view==='side'?10:0,0,view==='side'?0:10));
     a.camera.lookAt(center);a.camera.updateProjectionMatrix();a.renderer.render(a.scene,a.camera);
     const projected=Object.fromEntries(names.map(n=>{const p=lane.model.getObjectByName(n).getWorldPosition(V()).project(a.camera);return[n,[(p.x+1)*270,(1-p.y)*340]];}));
     return {png:a.renderer.domElement.toDataURL('image/png').split(',')[1],projected};
    };
    return {rows,support,repeatEqual:JSON.stringify(repeats[0])===JSON.stringify(repeats[2]),seconds:a.data.seconds,toeIds:ids,earlyIds};
   },model);
   let armErrorDeg=0,wristPathErrorMm=0;
   const old=archive.results.find(r=>r.model===model);
   data.rows.forEach((r,i)=>{for(const s of ['r','l']){
    for(const key of ['swing','outward','elbow'])armErrorDeg=Math.max(armErrorDeg,Math.abs(r.arms[s][key]-old.frames[i].after[s][key]));
    wristPathErrorMm=Math.max(wristPathErrorMm,Math.hypot(...r.arms[s].hand.map((v,k)=>v-old.frames[i].after[s].hand[k]))*1000);
   }});
   assert(armErrorDeg<.001);assert(wristPathErrorMm<.01);assert(data.repeatEqual);
   const captures=[];
   for(const view of ['front','side'])for(const phase of [0,.083,.167,.25,.333,.417,.5,.583,.667,.75,.833,.917]){
    const r=await page.evaluate(o=>window.fullRunCapture(o),{phase,view});
    const path=`${out}/${model}-${view}-${Math.round(phase*1000)}.png`;fs.writeFileSync(path,Buffer.from(r.png,'base64'));
    captures.push({phase,view,path,projected:r.projected});
   }
   report.results.push({model,armErrorDeg,wristPathErrorMm,...data,captures});console.log(model,'observed 1001 cycle + 802 support samples; 24 captures');
  }
  assert.deepEqual(hashes(),before);assert.deepEqual(report.errors,[]);
  report.status='observation-complete';report.runtimeHashes=before;
 }finally{fs.writeFileSync('docs/05-validation/reports/cmu-full-run-review.json',JSON.stringify(report));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
