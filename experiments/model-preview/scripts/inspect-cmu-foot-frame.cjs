// Diagnose mapping axes; no posture correction is applied here.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('outputs/cmu-posture-audit',{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1240,height:920}}),results=[];
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const r=await page.evaluate(async(model)=>{
     const {Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js');
     const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
     const a=window.mocapReview,neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;
     neutral.updateMatrixWorld(true);
     const p=b=>b.getWorldPosition(new Vector3());
     const sides=['l','r'].map(side=>{
      const foot=neutral.getObjectByName('foot_'+side),ball=neutral.getObjectByName('ball_'+side),source=a.clip.bones.find(b=>b.name===side+'foot'),toe=a.clip.bones.find(b=>b.name===side+'toes');
      const targetAxis=p(ball).sub(p(foot)).normalize(),sourceAxis=new Vector3(...source.direction).normalize(),toeAxis=new Vector3(...toe.direction).normalize();
      // Source neutral foot/toe plane gives a geometric secondary axis. Target
      // neutral world-up is a proxy; it is not a measured sole contact normal.
      const sourceLateral=toeAxis.clone().cross(sourceAxis).normalize();
      const sourceUp=sourceAxis.clone().cross(sourceLateral).normalize();
      const targetUp=new Vector3(0,1,0).addScaledVector(targetAxis,-targetAxis.y).normalize();
      const alignedUp=targetUp.clone().applyQuaternion(new Quaternion().setFromUnitVectors(targetAxis,sourceAxis));
      const secondaryAxisError=alignedUp.angleTo(sourceUp)*180/Math.PI;
      const samples=[];
      for(let k=0;k<12;k++){
       a.seek(a.cycle.period*k/12);
       const bone=a.bones.find(b=>b.name==='foot_'+side);
       const delta=bone.getWorldQuaternion(new Quaternion()).multiply(foot.getWorldQuaternion(new Quaternion()).invert());
       const up=new Vector3(0,1,0).applyQuaternion(delta);
       const forward=new Vector3(0,0,1).applyQuaternion(delta);
       samples.push({phase:k/12,up:up.toArray(),forward:forward.toArray()});
      }
      return {side,targetAxis:targetAxis.toArray(),sourceAxis:sourceAxis.toArray(),secondaryAxisError,samples};
     });
     neutral.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});
     return {clip:a.clip.id,sides};
    },model);
    results.push({model,...r});console.log(model,r.clip,r.sides.map(s=>({side:s.side,secondaryAxisError:s.secondaryAxisError})));
    if(clip==='0')for(const view of ['front','side']){
     await page.click('#'+view);
     // Close camera captures use the same scene, only framing the lower legs.
     await page.evaluate(view=>{
      const a=window.mocapReview;a.camera.position.set(view==='side'?2.5:1,.65,view==='side'?-1:2.5);a.camera.lookAt(view==='side'?0:1,.35,view==='side'?-1:0);a.camera.updateProjectionMatrix();
     },view);
     for(let k=0;k<4;k++){await page.evaluate(k=>window.mocapReview.seek(window.mocapReview.cycle.period*k/4),k);await page.screenshot({path:`outputs/cmu-posture-audit/${model}-${view}-${k}.png`});}
    }
   }
  }
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-foot-frame-audit.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'Read-only mapping audit. Secondary-axis mismatch is based on source neutral foot/toe plane and target neutral world-up proxy, not clinical ankle angle or measured sole normal.',results},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
