// M70 diagnostic: source directions in chest coordinates vs the processed model.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage();await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=knee-lateral');
  await p.waitForFunction(()=>window.sharedGaitReview?.ready);
  const result=await p.evaluate(async()=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
   const {createCycle}=await import('/review/cyclic-motion.js');
   const clips=await fetch('/review/data/cmu.json').then(r=>r.json()),clip=clips.find(c=>c.id==='35_17'),cycle=createCycle(clip);
   a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
   const V=x=>new T.Vector3(...x),Q=x=>new T.Quaternion(...x),ref=a.data.models.male;
   const spineRest=Q(ref.bones.find(b=>b.name==='spine_03').worldQ);
   const dir=(f,n)=>V(clip.bones.find(b=>b.name===n).direction).applyQuaternion(Q(f.q[clip.names.indexOf(n)]));
   const angle=d=>Math.atan2(d.z,-d.y)*180/Math.PI;
   const frames=[];
   for(let i=0;i<=200;i++){
    const t=i/200,f=cycle.sample(t*cycle.period),chest=Q(f.q[clip.names.indexOf('thorax')]);
    const source=Object.fromEntries(['r','l'].map(s=>[s,{upper:dir(f,s+'humerus').applyQuaternion(chest.clone().invert()).toArray(),lower:dir(f,s+'radius').applyQuaternion(chest.clone().invert()).toArray()}]));
    const stages={};
    for(const [name,plan] of [['original',{apply:(l,pr,t)=>a.plan.original(l,t)}],['upper',a.upperPlan],['bilateral',a.bilateralPlan],['current',a.kneeLateralPlan]]){
     plan.apply(a.lanes[0],a.probe,t);const m=a.lanes[0].model,point=n=>m.getObjectByName(n).getWorldPosition(new T.Vector3());
     const frame=m.getObjectByName('spine_03').getWorldQuaternion(new T.Quaternion()).multiply(spineRest.clone().invert()).invert();
     stages[name]=Object.fromEntries(['r','l'].map(s=>{
      const u=point('lowerarm_'+s).sub(point('upperarm_'+s)).applyQuaternion(frame).normalize();
      const l=point('hand_'+s).sub(point('lowerarm_'+s)).applyQuaternion(frame).normalize();
      return [s,{upper:u.toArray(),lower:l.toArray(),swing:angle(u),elbow:u.angleTo(l)*180/Math.PI}];
     }));
    }
    frames.push({t,source,stages});
   }
   return {clip:clip.id,period:cycle.period,sourceBones:clip.bones.filter(b=>/humerus|radius|clavicle|thorax/.test(b.name)),frames};
  });
  result.ranges={};
  for(const side of ['r','l'])for(const stage of ['source','original','upper','bilateral','current']){
   const values=result.frames.map(f=>stage==='source'?Math.atan2(f.source[side].upper[2],-f.source[side].upper[1])*180/Math.PI:f.stages[stage][side].swing);
   result.ranges[side+'-'+stage]={min:Math.min(...values),max:Math.max(...values),span:Math.max(...values)-Math.min(...values)};
  }
  fs.writeFileSync('docs/05-validation/reports/cmu-arm-swing-diagnostic.json',JSON.stringify(result));
  console.log(result.ranges);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
