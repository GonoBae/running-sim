const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[],results=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=landing');await page.waitForFunction(()=>window.mocapReview?.ready&&window.mocapReview.comparison?.lanes?.length===3);
 for(const model of ['male','female']){
  await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
  const data=await page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js'),{footSurfaceReader}=await import('/review/ground-contact.js');
   const a=window.mocapReview; a.renderer.setAnimationLoop(null);const lanes=a.comparison.lanes,readers=lanes.map(l=>footSurfaceReader(l.model));
   const p=(lane,b)=>lane.group.worldToLocal(b.getWorldPosition(new T.Vector3()));
   const q=b=>b.getWorldQuaternion(new T.Quaternion()).normalize();
   const rows=[];let maxOtherMm=0,maxRecoveryMm=0,maxFootAngle=0,maxTargetMm=0,maxFootYZMm=0,maxRightPenetrationMm=0,maxRightGroundGapMm=0,limited=0;
   for(let f=0;f<=a.cycle.period;f+=.25){
    a.seek(f);const base=lanes[0],baseline=base.bones.map(b=>p(base,b)),read=readers.map(r=>r());
    const entry={frame:f,phase:f/a.cycle.period,support:a.contact?.support,root:p(base,base.bones.find(b=>b.name==='pelvis')).toArray(),variants:[]};
    for(let i=1;i<lanes.length;i++){
     const lane=lanes[i],foot=lane.bones.find(b=>b.name==='foot_r'),j=base.bones.findIndex(b=>b.name==='foot_r'),A=p(lane,foot),B=baseline[j],d=a.comparison.diagnostics[i];
     const outside=!d.weight;
     for(let k=0;k<lane.bones.length;k++){
      let b=lane.bones[k],right=false;for(let n=b;n?.isBone;n=n.parent)if(n.name==='thigh_r')right=true;
      const error=p(lane,b).distanceTo(baseline[k])*1000;
      if(!right)maxOtherMm=Math.max(maxOtherMm,error);if(outside)maxRecoveryMm=Math.max(maxRecoveryMm,error);
     }
     maxFootAngle=Math.max(maxFootAngle,T.MathUtils.radToDeg(q(foot).angleTo(q(base.bones[j]))));
     maxFootYZMm=Math.max(maxFootYZMm,Math.hypot(A.y-B.y,A.z-B.z)*1000);
     maxTargetMm=Math.max(maxTargetMm,(d.error||0)*1000);limited+=d.limited?1:0;
     if(a.contact?.support==='r'){maxRightPenetrationMm=Math.max(maxRightPenetrationMm,-read[i].r*1000);maxRightGroundGapMm=Math.max(maxRightGroundGapMm,Math.abs(read[i].r)*1000);}
     entry.variants.push({amount:i*.02,weight:d.weight,requested:d.requested,actual:B.x-A.x,ankle:A.toArray(),surfaceY:read[i].r});
    }
    rows.push(entry);
   }
   // Boundary checks on the correction displacement rather than source velocity.
   let maxBoundaryCorrectionMm=0;
   for(const phase of [.28-1e-6,.28,.28+1e-6,.58-1e-6,.58,.58+1e-6]){a.seek(phase*a.cycle.period);const b=lanes[0].bones.find(b=>b.name==='foot_r');for(const lane of lanes.slice(1))maxBoundaryCorrectionMm=Math.max(maxBoundaryCorrectionMm,p(lane,lane.bones.find(b=>b.name==='foot_r')).distanceTo(p(lanes[0],b))*1000);}
   a.seek(39);const first=lanes.map(l=>l.bones.map(b=>p(l,b).toArray()));a.seek(8);a.seek(70);a.seek(39);
   const maxRepeatMm=Math.max(...lanes.flatMap((l,i)=>l.bones.map((b,j)=>p(l,b).distanceTo(new T.Vector3(...first[i][j]))*1000)));
   return {clip:a.clip.id,rows,maxOtherMm,maxRecoveryMm,maxFootAngle,maxTargetMm,maxFootYZMm,maxRightPenetrationMm,maxRightGroundGapMm,maxBoundaryCorrectionMm,maxRepeatMm,limited};
  });
  results.push({model,...data});console.log({model,...Object.fromEntries(Object.entries(data).filter(([k])=>k!=='rows'))});
 }
 fs.mkdirSync('outputs/cmu-landing',{recursive:true});
 await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);
 for(const view of ['front','side']){
  await page.click('#'+view);await page.evaluate(()=>window.mocapReview.seek(39));await page.screenshot({path:`outputs/cmu-landing/${view}.png`});
 }
 await page.click('#front');await page.evaluate(()=>window.mocapReview.seek(70));await page.screenshot({path:'outputs/cmu-landing/recovery.png'});
 // Existing baseline route remains identical to the measured restored baseline.
 const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-transfer.json','utf8'));
 for(const result of results){const original=old.restored.find(a=>a.model===result.model).rows;const maxBaselineMm=Math.max(...original.map((r,i)=>Math.hypot(...r.root.map((v,j)=>v-result.rows[i*4].root[j]))*1000));result.maxBaselineMm=maxBaselineMm;assert(maxBaselineMm<.01);}
 // New page for real animation loop and button checks (sampling stopped the old loop).
 await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=landing');await page.waitForFunction(()=>window.mocapReview?.ready);
 await page.click('#play');await page.waitForFunction(()=>Number(document.getElementById('phase').value)>.1);await page.click('#play');
 const paused=await page.inputValue('#phase');await page.waitForTimeout(120);assert.equal(await page.inputValue('#phase'),paused);
 await page.click('#side');await page.click('#front');await page.locator('#phase').fill('0.43');await page.locator('#phase').dispatchEvent('input');
 assert.equal(await page.locator('.labels span').count(),3);
 const hashes=Object.fromEntries(['mocap.js','mocap.html','landing-width.js','landing-width-comparison.js'].map(n=>{const f='experiments/model-preview/review/'+n;return [f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')];}));
 fs.writeFileSync('docs/05-validation/reports/cmu-landing.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M33 35_17 right support width experiment. 2/4cm offsets only within authored 28-58% support. Not a biomechanics validation.',hashes,results,errors},null,2));
 for(const r of results){assert.equal(r.clip,'35_17');assert(r.maxOtherMm<.01);assert(r.maxRecoveryMm<.01);assert(r.maxFootAngle<.001);assert(r.maxTargetMm<.1);assert(r.maxFootYZMm<.1);assert(r.maxRightPenetrationMm<1);assert(r.maxBoundaryCorrectionMm<.01);assert(r.maxRepeatMm<.01);assert.equal(r.limited,0);}
 assert.deepEqual(errors,[]);console.log('PASS: 730 poses, invariant/recovery/contact/boundary/reseek/baseline and playback UI');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
