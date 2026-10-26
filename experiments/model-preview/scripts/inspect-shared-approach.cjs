const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage();await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=bilateral-pose');
 const results=[];
 for(const model of ['male','female']){
  if(model==='female')await p.selectOption('#model',model);
  await p.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const rows=await p.evaluate(async()=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});a.poseSkin.setEnabled(true);
   const l=a.lanes[0],pos=n=>l.model.getObjectByName(n).getWorldPosition(new T.Vector3()),rows=[];
   for(let i=0;i<=360;i++){
    const t=i/360;a.bilateralPlan.apply(l,a.probe,t);
    const hip=pos('thigh_r'),knee=pos('calf_r'),ankle=pos('foot_r'),toe=pos('ball_r'),surface=l.readSurface('r');
    rows.push({t,hip:hip.toArray(),knee:knee.toArray(),ankle:ankle.toArray(),toe:toe.toArray(),relative:ankle.clone().sub(hip).toArray(),upper:knee.clone().sub(hip).toArray(),surface:surface.center.toArray(),min:surface.min});
   }return rows;
  });results.push({model,rows});
  console.log(model,JSON.stringify(rows.filter((r,i)=>i%10===0).map(r=>({t:+r.t.toFixed(3),x:+(r.relative[0]*1000).toFixed(1),upper:r.upper.map(v=>+v.toFixed(4)),y:+(r.min*1000).toFixed(1)}))));
 }
 fs.writeFileSync('docs/05-validation/reports/cmu-shared-approach-before.json',JSON.stringify({status:'observed',results}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
