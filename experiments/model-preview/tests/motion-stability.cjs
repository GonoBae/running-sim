const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),measurements=[];
 try{
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.dataset.loaded==='true');
  for(const model of ['male','female']){
   await page.click(`[data-model-type=${model}]`);await page.waitForFunction(()=>document.body.dataset.loaded==='true');
   const result=await page.evaluate(async()=>{
    const a=window.modelPreview,{createBasicRunMotion,basicRunPeriodMs}=await import('/src/basic-run-motion.ts');
    const {Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js');
    const p=n=>a.bones.find(b=>b.name===n).getWorldPosition(new Vector3()),q=n=>a.bones.find(b=>b.name===n).getWorldQuaternion(new Quaternion()).normalize();
    const original=a.bones.map(b=>b.quaternion.toArray()),root=a.model.position.clone();
    const motion=createBasicRunMotion(a.runningPose,a.model,a.bones,a.scene.children.find(c=>c.type==='GridHelper').position.y+.005);
    let prev,velocity=0,maxVerticalStep=0,maxVerticalVelocityChange=0,maxWristError=0,maxFootOrientationError=0,maxBoneStep=0,minClearance=Infinity;
    const neutral={l:a.runningPose.neutralFootRotation('l'),r:a.runningPose.neutralFootRotation('r')};
    // The neutral rotation must also agree with the actual GLB bind skeleton.
    let bindError=0;
    a.model.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.userData.selectionOverlay)return;for(const s of ['l','r']){const i=mesh.skeleton.bones.findIndex(b=>b.name==='foot_'+s);if(i>=0){const m=mesh.skeleton.boneInverses[i].clone().invert(),bq=new Quaternion();m.decompose(new Vector3(),bq,new Vector3());bindError=Math.max(bindError,bq.normalize().angleTo(neutral[s]));}}});
    motion.start(0);
    for(let ms=0;ms<=2*basicRunPeriodMs;ms++){
     motion.tick(ms);const frame=motion.frame,qs=a.bones.map(b=>b.getWorldQuaternion(new Quaternion())),y=a.model.position.y;
     if(prev){const dy=y-prev.y;maxVerticalStep=Math.max(maxVerticalStep,Math.abs(dy));if(ms>1)maxVerticalVelocityChange=Math.max(maxVerticalVelocityChange,Math.abs(dy-velocity));velocity=dy;qs.forEach((v,i)=>maxBoneStep=Math.max(maxBoneStep,v.angleTo(prev.qs[i])*180/Math.PI));}
     prev={qs,y};minClearance=Math.min(minClearance,...Object.values(motion.footHeights));
     for(const side of ['l','r']){
      const forearm=p('hand_'+side).sub(p('lowerarm_'+side)),hand=p('middle_01_'+side).sub(p('hand_'+side));
      maxWristError=Math.max(maxWristError,forearm.angleTo(hand)*180/Math.PI);
      // Remove the intended heading and pitch: the whole foot must retain its neutral frame, not only toe direction.
      const heading=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),frame.twist*Math.PI/180);
      const actual=heading.invert().multiply(q('foot_'+side)).multiply(neutral[side].clone().invert());
      const expected=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-frame.feet[side]*Math.PI/180);
      maxFootOrientationError=Math.max(maxFootOrientationError,actual.normalize().angleTo(expected)*180/Math.PI);
     }
    }
    motion.stop();const restored=JSON.stringify(original)===JSON.stringify(a.bones.map(b=>b.quaternion.toArray()))&&root.equals(a.model.position);
    const at=(step)=>{motion.start(0);for(let t=step;t<333;t+=step)motion.tick(t);motion.tick(333);const data={p:a.model.position.toArray(),q:a.bones.map(b=>b.quaternion.toArray())};motion.stop();return data;};
    const stableAcrossRates=JSON.stringify(at(1000/30))===JSON.stringify(at(1000/144));
    return {frames:1561,bindError,maxVerticalStep,maxVerticalVelocityChange,maxWristError,maxFootOrientationError,maxBoneStep,minClearance,restored,stableAcrossRates};
   });
   measurements.push({model,...result});console.log(model,JSON.stringify(result));
   assert(result.bindError<1e-5);assert(result.maxVerticalStep<.002);assert(result.maxVerticalVelocityChange<.0003);
   assert(result.maxWristError<.0001);assert(result.maxFootOrientationError<.0001);assert(result.maxBoneStep<.6);
   assert(result.minClearance>=-1e-6);assert(result.restored&&result.stableAcrossRates);
  }
 }finally{
  fs.writeFileSync('docs/05-validation/reports/motion-stability.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M16 geometry and deterministic 1ms sampling; not real-device FPS or naturalness validation',measurements},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
