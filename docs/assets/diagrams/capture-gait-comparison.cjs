// Documentation capture only; does not change the running application.
// Run at repo root with Vite :5173, built-in GLBs, PLAYWRIGHT_PATH.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),crypto=require('node:crypto');
// This frozen pre-M14 comparison requires its recorded source revision.
const recorded=JSON.parse(fs.readFileSync('docs/05-validation/reports/gait-current.json','utf8'));
for(const [file,expected] of Object.entries(recorded.sourceHashes)){
 const actual=crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/src/'+file)).digest('hex');
 if(actual!==expected)throw Error('Historical comparison requires the recorded source revision: '+file);
}
(async()=>{
 const out='outputs/gait-comparison';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.dataset.loaded==='true');await page.click('#next-pose');
  // Hide editor annotations in documentation captures of transient playback frames.
  await page.addStyleTag({content:'.joint-handle{visibility:hidden!important}'});
  const report=await page.evaluate(async()=>{
   const a=window.modelPreview,{createBasicRunMotion,sampleBasicRun}=await import('/src/basic-run-motion.ts');
   const motion=createBasicRunMotion(a.runningPose,a.model,a.bones,a.scene.children.find(c=>c.type==='GridHelper').position.y+.005);
   const p=name=>a.bones.find(b=>b.name===name).getWorldPosition(a.camera.position.clone());
   const frames=[];motion.start(0);
   for(let i=0;i<150;i++){
    const phase=i/149;motion.tick(phase*720);
    const hip=p('thigh_l'),knee=p('calf_l'),ankle=p('foot_l'),toe=p('ball_l');
    const thigh=knee.clone().sub(hip),shin=ankle.clone().sub(knee),foot=toe.clone().sub(ankle);
    frames.push({phase,thighAbsolute:Math.atan2(thigh.z,-thigh.y)*180/Math.PI,knee:thigh.angleTo(shin)*180/Math.PI,footPitch:Math.atan2(foot.y,Math.hypot(foot.x,foot.z))*180/Math.PI,points:{hip:hip.toArray(),knee:knee.toArray(),ankle:ankle.toArray(),toe:toe.toArray()},authored:sampleBasicRun(phase*720).values});
   }
   motion.stop();window.gaitCaptureMotion=motion;
   return {periodMs:720,model:'built-in male default dimensions',speed:null,phaseZero:'authored cycle start; not detected by measured contact',frames};
  });
  const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  report.sourceHashes=Object.fromEntries(['basic-run-motion.ts','running-pose.ts'].map(f=>[f,hash('experiments/model-preview/src/'+f)]));
  report.capturedAt=new Date().toISOString();
  fs.writeFileSync('docs/05-validation/reports/gait-current.json',JSON.stringify(report,null,2));
  for(const view of ['side','front']){
   await page.click(`[data-view=${view}]`);
   for(const [i,phase] of [0,.25,.5,.75].entries()){
    await page.evaluate(p=>{const m=window.gaitCaptureMotion;m.stop();m.start(0);m.pause(p*720);},phase);
    await page.waitForTimeout(70);
    await page.screenshot({path:`${out}/${view}-${i}.png`,clip:{x:280,y:210,width:560,height:720}});
   }
   await page.evaluate(()=>window.gaitCaptureMotion.stop());
  }
  console.log('Captured 150 frames and 8 images; app source unchanged');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
