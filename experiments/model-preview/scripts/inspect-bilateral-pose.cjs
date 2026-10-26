const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:940}}),report={status:'observed',results:[],errors:[]};
 p.on('pageerror',e=>report.errors.push(e.message));
 const candidate=process.env.BILATERAL_CANDIDATE==='1';
 await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare='+(candidate?'bilateral-pose':'upper-center'));
 for(const model of ['male','female']){
  if(model==='female')await p.selectOption('#model',model);await p.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const result=await p.evaluate(async candidate=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   const lane=a.lanes[1],ref=a.plan.reference,V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
   const pos=n=>lane.group.worldToLocal(lane.model.getObjectByName(n).getWorldPosition(V()));
   const names=ref.bones.map(b=>b.name).filter(n=>n!=='Root');
   a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.scale.set(1,1,1);l.group.updateMatrixWorld(true);});
   const sample=t=>{(candidate?a.bilateralPlan:a.upperPlan).apply(lane,a.probe,t);const pelvis=pos('pelvis');return Object.fromEntries(names.map(n=>{const bone=lane.model.getObjectByName(n),rest=ref.bones.find(b=>b.name===n);return [n,{p:pos(n).sub(pelvis).toArray(),q:bone.getWorldQuaternion(Q()).normalize().multiply(new T.Quaternion(...rest.worldQ).normalize().invert()).normalize().toArray()}];}));};
   const maxima=Object.fromEntries(names.filter(n=>!n.endsWith('_l')).map(n=>[n,{mm:0,deg:0,phase:0}]));
   const mirrorQ=q=>new T.Quaternion(q[0],-q[1],-q[2],q[3]);
   const rows=[];
   for(let i=0;i<=180;i++){
    const phase=i/360,right=sample(phase),left=sample(phase+.5);
    for(const [n,m]of Object.entries(maxima)){
     const other=n.endsWith('_r')?n.slice(0,-2)+'_l':n,x=right[n],y=left[other];
     const mm=new T.Vector3(...x.p).distanceTo(new T.Vector3(-y.p[0],y.p[1],y.p[2]))*1000;
     const deg=new T.Quaternion(...x.q).angleTo(mirrorQ(y.q))*180/Math.PI;
     if(mm>m.mm){m.mm=mm;m.phase=phase;}m.deg=Math.max(m.deg,deg);
    }
    rows.push({phase,right,left});
   }
   return {maxima,rows};
  },candidate);
  report.results.push({model,...result});console.log(model,JSON.stringify(Object.fromEntries(Object.entries(result.maxima).filter(([n])=>/^(upperarm|lowerarm|hand|thigh|calf|foot|spine_03|head)/.test(n)))));
 }
 fs.writeFileSync('docs/05-validation/reports/cmu-bilateral-pose-'+(candidate?'candidate':'before')+'.json',JSON.stringify(report));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
