const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const baseline=process.argv.includes('--baseline');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),results=[],snapshots=[];
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);await page.uncheck('#grounding');await page.uncheck('#ankle-weights');await page.uncheck('#arm-spacing');await page.uncheck('#ankle-relative');
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async(model)=>{
     const {Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
     const a=window.mocapReview,neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;neutral.updateMatrixWorld(true);
     const v=x=>new Vector3(...x),p=b=>b.getWorldPosition(new Vector3());
     const first=a.clip.frames[0].p[0],last=a.clip.frames.at(-1).p[0],heading=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(last[0]-first[0],last[2]-first[2]));
     const sides=['l','r'].map(side=>{
      const foot=neutral.getObjectByName('foot_'+side),axis=p(neutral.getObjectByName('ball_'+side)).sub(p(foot)).normalize();
      const source=v(a.clip.bones.find(b=>b.name===side+'foot').direction).normalize(),toe=v(a.clip.bones.find(b=>b.name===side+'toes').direction).normalize();
      return {bone:a.bones.find(b=>b.name==='foot_'+side),index:a.clip.names.indexOf(side+'foot'),rest:foot.getWorldQuaternion(new Quaternion()),targetUp:new Vector3(0,1,0).addScaledVector(axis,-axis.y).normalize(),sourceUp:source.clone().cross(toe.clone().cross(source).normalize()).normalize()};
     });
     const surfaces=[];a.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight}=mesh.geometry.attributes,indices=[];
      for(let i=0;i<skinIndex.count;i++){let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_[lr]$/.test(mesh.skeleton.bones[skinIndex.getComponent(i,j)].name))w+=skinWeight.getComponent(i,j);if(w>.15)indices.push(i);}surfaces.push({mesh,indices});
     });
     let maxSecondaryAxisError=0,minFootSurface=Infinity;const poses=[],heights=[],vertex=new Vector3();
     for(let f=0;f<=a.cycle.period;f+=.5){
      a.seek(f);const pelvis=p(a.bones.find(b=>b.name==='pelvis'));heights.push(pelvis.y);poses.push(a.bones.flatMap(b=>p(b).sub(pelvis).toArray()));
      for(const {mesh,indices} of surfaces){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);minFootSurface=Math.min(minFootSurface,vertex.y);}}
      for(const s of sides){
       const actual=s.targetUp.clone().applyQuaternion(s.bone.getWorldQuaternion(new Quaternion()).multiply(s.rest.clone().invert()));
       const expected=s.sourceUp.clone().applyQuaternion(heading.clone().multiply(new Quaternion(...a.sampledFrame.q[s.index])));
       maxSecondaryAxisError=Math.max(maxSecondaryAxisError,actual.angleTo(expected)*180/Math.PI);
      }
     }
     neutral.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});
     return {clip:a.clip.id,samples:poses.length,maxSecondaryAxisError,minFootSurface,poses,heights};
    },model);
    const {poses,heights,...summary}=result;snapshots.push({model,clip:result.clip,poses,heights});results.push({model,...summary});
    if(!baseline)assert(summary.maxSecondaryAxisError<.0001,'foot secondary axes match');
   }
  }
  let maxRelativePositionError,maxGlobalHeightShift;
  fs.mkdirSync('work/cmu-foot',{recursive:true});
  if(baseline)fs.writeFileSync('work/cmu-foot/before.json',JSON.stringify(snapshots));
  else if(fs.existsSync('work/cmu-foot/before.json')){
   const before=JSON.parse(fs.readFileSync('work/cmu-foot/before.json'));maxRelativePositionError=0;maxGlobalHeightShift=0;
   snapshots.forEach((s,i)=>s.poses.forEach((pose,f)=>{
    pose.forEach((v,k)=>maxRelativePositionError=Math.max(maxRelativePositionError,Math.abs(v-before[i].poses[f][k])));
    maxGlobalHeightShift=Math.max(maxGlobalHeightShift,Math.abs(s.heights[f]-before[i].heights[f]));
   }));assert(maxRelativePositionError<1e-6,'all pelvis-relative joint positions preserved');assert(maxGlobalHeightShift<.03,'constant floor recalibration within 3cm regression budget, not clinical threshold');
  }
  const report={testedAt:new Date().toISOString(),scope:'Neutral geometric secondary-axis alignment, default rigs only. Not a measured sole normal or clinical ankle angle.',maxRelativePositionError,maxGlobalHeightShift,results};
  fs.writeFileSync(`docs/05-validation/reports/cmu-foot-${baseline?'before':'after'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
