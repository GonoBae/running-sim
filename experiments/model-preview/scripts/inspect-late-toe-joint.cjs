// Read-only local sensitivity test: can toe articulation alone preserve M54?
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage(),results=[];
 for(const model of ['male','female']){
  await p.goto('http://127.0.0.1:5173/review/mocap.html?compare=late-stance-sole');await p.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:90000});if(model==='female'){await p.selectOption('#model',model);await p.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:90000});}
  const samples=await p.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);const out=[];
   for(const side of ['r','l'])for(const u of [.65,.75,.85,.95]){
    const phase=(side==='r'?.28+.3*u:.75+.34*u)%1;a.seek(phase*a.cycle.period);const l=a.comparison.lanes[1],ball=l.bones.find(b=>b.name==='ball_'+side),q=ball.getWorldQuaternion(new T.Quaternion()),parent=ball.parent.getWorldQuaternion(new T.Quaternion()).invert();
    const read=()=>{const p=l.contactPlans.find(p=>p.window.side===side).patch.read(),f=l.readSole(side),z=new T.Vector3(0,0,1).applyQuaternion(f.frame),x=new T.Vector3(1,0,0).applyQuaternion(f.frame),yaw=Math.atan2(z.x,z.z),hr=new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw));return [p.x*1000,p.z*1000,f.points.toe.y*1000,Math.atan2(z.y,Math.hypot(z.x,z.z))*180/Math.PI,Math.atan2(x.dot(z.clone().cross(hr)),x.dot(hr))*180/Math.PI,f.points.toe.x*1000,f.points.toe.z*1000];};
    const columns=[],epsilon=1e-5;
    for(const axis of [new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)]){
     const samples=[];for(const sign of [-1,1]){ball.quaternion.copy(parent.clone().multiply(new T.Quaternion().setFromAxisAngle(axis,sign*epsilon).multiply(q)));l.model.updateMatrixWorld(true);samples.push(read());}
     columns.push(samples[1].map((v,i)=>(v-samples[0][i])/(2*epsilon)));
    }
    ball.quaternion.copy(parent.clone().multiply(q));l.model.updateMatrixWorld(true);out.push({side,u,phase,jacobian:Array.from({length:7},(_,i)=>columns.map(c=>c[i]))});
   }
   return out;
  });results.push({model,samples});console.log(model,'toe-only sensitivities recorded');
 }
 fs.writeFileSync('docs/05-validation/reports/cmu-late-toe-joint.json',JSON.stringify({testedAt:new Date().toISOString(),rows:['patchX_mm','patchZ_mm','toeY_mm','solePitch_deg','soleBank_deg','toeX_mm','toeZ_mm'],stepRadians:1e-5,results},null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
