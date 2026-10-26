const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage();await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=arm-swing');
  await p.waitForFunction(()=>window.sharedGaitReview?.ready);
  const report={testedAt:new Date().toISOString(),models:[],hashes:{}};
  for(const model of ['male','female']){
   if(model==='female'){await p.selectOption('#model',model);await p.waitForFunction(()=>window.sharedGaitReview.ready);}
   report.models.push(await p.evaluate(async model=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;neutral.updateMatrixWorld(true);
    a.renderer.setAnimationLoop(null);const lane=a.lanes[1],V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),deg=180/Math.PI;
    const rest=[];neutral.traverse(o=>{if(o.isBone&&/^(lowerarm|hand|index|middle|ring|pinky|thumb)/.test(o.name))rest.push({name:o.name,parent:o.parent.name,p:o.getWorldPosition(V()).toArray(),local:o.quaternion.toArray(),q:o.getWorldQuaternion(Q()).toArray(),children:o.children.map(c=>({name:c.name,p:c.position.toArray()}))});});
    const frames=[];
    for(let i=0;i<=200;i++){
     a.armSwingPlan.apply(lane,a.probe,i/200);const m=lane.model,pos=n=>m.getObjectByName(n).getWorldPosition(V());
     const hands={};
     for(const s of ['r','l']){
      const lower=m.getObjectByName('lowerarm_'+s),hand=m.getObjectByName('hand_'+s);
      const fore=pos('hand_'+s).sub(pos('lowerarm_'+s)).normalize(),long=pos('middle_01_'+s).sub(pos('hand_'+s)).normalize();
      let fingerRest=0;for(const r of rest.filter(r=>/^(index|middle|ring|pinky|thumb)/.test(r.name)&&r.name.endsWith('_'+s))){
       fingerRest=Math.max(fingerRest,m.getObjectByName(r.name).quaternion.clone().normalize().angleTo(new T.Quaternion(...r.local).normalize())*deg);
      }
      hands[s]={axisBend:fore.angleTo(long)*deg,restDelta:hand.quaternion.clone().normalize().angleTo(neutral.getObjectByName(hand.name).quaternion.clone().normalize())*deg,
       relative:lower.getWorldQuaternion(Q()).invert().multiply(hand.getWorldQuaternion(Q())).toArray(),fingerRestDeg:fingerRest};
     }
     frames.push({t:i/200,hands});
    }
    return {model,rest,frames};
   },model));
  }
  for(const name of ['shared-gait.js','body-height.js','upper-center.js','bilateral-pose.js','shared-approach.js','shared-support.js','shared-release.js','knee-lateral.js','arm-swing.js']){
   const path='experiments/model-preview/review/'+name;report.hashes[path]=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  }
  fs.writeFileSync('docs/05-validation/reports/cmu-hand-pose-diagnostic.json',JSON.stringify(report));
  console.log(report.models.map(m=>({model:m.model,...Object.fromEntries(['r','l'].map(s=>[s,{
   bend:[Math.min(...m.frames.map(f=>f.hands[s].axisBend)),Math.max(...m.frames.map(f=>f.hands[s].axisBend))],
   restDelta:Math.max(...m.frames.map(f=>f.hands[s].restDelta)),fingerRest:Math.max(...m.frames.map(f=>f.hands[s].fingerRestDeg))
  }]))})));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
