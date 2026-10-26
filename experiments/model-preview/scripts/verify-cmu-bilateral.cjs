const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[],results=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=bilateral');await page.waitForFunction(()=>window.mocapReview?.ready&&window.mocapReview.comparison?.lanes?.length===3);
 for(const model of ['male','female']){
  await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
  const data=await page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js'),{footSurfaceReader}=await import('/review/ground-contact.js');
   const {landingWeight,applyLandingWidth}=await import('/review/landing-width.js');
   const a=window.mocapReview;a.renderer.setAnimationLoop(null);const lanes=a.comparison.lanes,readers=lanes.map(l=>footSurfaceReader(l.model));
   const p=(lane,b)=>lane.group.worldToLocal(b.getWorldPosition(new T.Vector3())),q=b=>b.getWorldQuaternion(new T.Quaternion()).normalize();
   const branch=b=>{for(let n=b;n?.isBone;n=n.parent){if(n.name==='thigh_r')return 'r';if(n.name==='thigh_l')return 'l';}return null;};
   const metrics=()=>({maxRecoveryMm:0,maxRecoveryAngle:0,maxFootAngle:0,maxTargetMm:0,maxFootYZMm:0,maxDisplacementErrorMm:0,maxPenetrationMm:0,maxGroundGapMm:0,limited:0});
   const feet={r:metrics(),l:metrics()},rows=[];let maxOtherMm=0,maxOtherAngle=0;
   for(let f=0;f<=a.cycle.period;f+=.25){
    a.seek(f);const base=lanes[0],baseline=base.bones.map(b=>p(base,b)),read=readers.map(r=>r());
    const entry={frame:f,phase:f/a.cycle.period,support:a.contact?.support,root:p(base,base.bones.find(b=>b.name==='pelvis')).toArray(),variants:[]};
    for(let i=1;i<lanes.length;i++){
     const lane=lanes[i],d=a.comparison.diagnostics[i],variant={amount:i*.02,feet:{}};
     lane.bones.forEach((b,k)=>{const side=branch(b),error=p(lane,b).distanceTo(baseline[k])*1000,angle=T.MathUtils.radToDeg(q(b).angleTo(q(base.bones[k])));
      if(!side){maxOtherMm=Math.max(maxOtherMm,error);maxOtherAngle=Math.max(maxOtherAngle,angle);}
      else if(!d[side].weight){feet[side].maxRecoveryMm=Math.max(feet[side].maxRecoveryMm,error);feet[side].maxRecoveryAngle=Math.max(feet[side].maxRecoveryAngle,angle);}
     });
     for(const side of ['r','l']){
      const m=feet[side],diag=d[side],foot=lane.bones.find(b=>b.name==='foot_'+side),j=base.bones.findIndex(b=>b.name==='foot_'+side),A=p(lane,foot),B=baseline[j],actual=(side==='r'?-1:1)*(A.x-B.x);
      m.maxFootAngle=Math.max(m.maxFootAngle,T.MathUtils.radToDeg(q(foot).angleTo(q(base.bones[j]))));
      m.maxFootYZMm=Math.max(m.maxFootYZMm,Math.hypot(A.y-B.y,A.z-B.z)*1000);
      m.maxTargetMm=Math.max(m.maxTargetMm,(diag.error||0)*1000);m.limited+=diag.limited?1:0;
      // Independently check expected direction, plateau and support windows.
      const phase=f/a.cycle.period,outside=side==='r'?(phase<=.28||phase>=.58):(phase>=.09&&phase<=.75);
      const plateau=side==='r'?(phase>=.34&&phase<=.52):(phase<=.03||phase>=.81);
      if(outside&&diag.weight!==0)throw Error('Correction outside support: '+side+' '+phase);
      if(plateau)m.maxDisplacementErrorMm=Math.max(m.maxDisplacementErrorMm,Math.abs(actual-i*.02)*1000);
      if(actual < -1e-6)throw Error('Wrong outward direction: '+side);
      if(a.contact?.support===side){m.maxPenetrationMm=Math.max(m.maxPenetrationMm,-read[i][side]*1000);m.maxGroundGapMm=Math.max(m.maxGroundGapMm,Math.abs(read[i][side])*1000);}
      variant.feet[side]={weight:diag.weight,requested:diag.requested,actual,ankle:A.toArray(),surfaceY:read[i][side]};
     }
     entry.variants.push(variant);
    }
    rows.push(entry);
   }
   let maxBoundaryCorrectionMm=0;
   for(const [side,edges] of [['r',[.28,.58]],['l',[.09,.75]]])for(const edge of edges)for(const delta of [-1e-6,0,1e-6]){
    a.seek((edge+delta)*a.cycle.period);const b=lanes[0].bones.find(b=>b.name==='foot_'+side);
    for(const lane of lanes.slice(1))maxBoundaryCorrectionMm=Math.max(maxBoundaryCorrectionMm,p(lane,lane.bones.find(b=>b.name==='foot_'+side)).distanceTo(p(lanes[0],b))*1000);
   }
   // Weight continuity at the periodic seam; do not confuse it with forward root travel.
   const seamWeights=[landingWeight(1-1e-7,'l'),landingWeight(0,'l'),landingWeight(1e-7,'l'),landingWeight(1,'l')];
   const correction=[];for(const f of [0,a.cycle.period]){a.seek(f);correction.push(lanes.slice(1).map(l=>p(l,l.bones.find(b=>b.name==='foot_l')).sub(p(lanes[0],lanes[0].bones.find(b=>b.name==='foot_l'))).toArray()));}
   const seamCorrectionMm=Math.max(...correction[0].map((v,i)=>new T.Vector3(...v).distanceTo(new T.Vector3(...correction[1][i]))*1000));
   a.seek(80);const first=lanes.map(l=>l.bones.map(b=>p(l,b).toArray()));a.seek(8);a.seek(39);a.seek(80);
   const maxRepeatMm=Math.max(...lanes.flatMap((l,i)=>l.bones.map((b,j)=>p(l,b).distanceTo(new T.Vector3(...first[i][j]))*1000)));
   // Evaluate the two sides in reverse order from fresh baseline, checking independence.
   let maxOrderMm=0;for(const f of [0,39,80]){a.seek(f);const lane=lanes[2],base=lanes[0],expected=lane.bones.map(b=>p(lane,b));
    base.bones.forEach((b,j)=>{lane.bones[j].position.copy(b.position);lane.bones[j].quaternion.copy(b.quaternion);lane.bones[j].scale.copy(b.scale);});lane.model.updateMatrixWorld(true);
    applyLandingWidth(lane.model,lane.bones,f/a.cycle.period,.04,'l');applyLandingWidth(lane.model,lane.bones,f/a.cycle.period,.04,'r');
    lane.bones.forEach((b,j)=>maxOrderMm=Math.max(maxOrderMm,p(lane,b).distanceTo(expected[j])*1000));
   }
   return {clip:a.clip.id,rows,feet,maxOtherMm,maxOtherAngle,maxBoundaryCorrectionMm,seamWeights,seamCorrectionMm,maxRepeatMm,maxOrderMm};
  });
  results.push({model,...data});console.log({model,...Object.fromEntries(Object.entries(data).filter(([k])=>k!=='rows'))});
 }
 fs.mkdirSync('outputs/cmu-bilateral',{recursive:true});
 await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);
 for(const view of ['front','side'])for(const [name,frame] of [['right',39],['left',80],['recovery',60]]){
  await page.click('#'+view);await page.evaluate(f=>window.mocapReview.seek(f),frame);await page.locator('#view canvas').screenshot({path:`outputs/cmu-bilateral/${view}-${name}.png`});
 }
 const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-landing.json','utf8'));
 for(const r of results){const prev=old.results.find(x=>x.model===r.model);r.maxRightRegressionMm=0;r.maxBaselineMm=0;
  r.rows.forEach((row,k)=>{r.maxBaselineMm=Math.max(r.maxBaselineMm,Math.hypot(...row.root.map((v,j)=>v-prev.rows[k].root[j]))*1000);row.variants.forEach((v,i)=>{r.maxRightRegressionMm=Math.max(r.maxRightRegressionMm,Math.hypot(...v.feet.r.ankle.map((x,j)=>x-prev.rows[k].variants[i].ankle[j]))*1000);});});
 }
 await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=bilateral');await page.waitForFunction(()=>window.mocapReview?.ready);
 await page.click('#play');await page.waitForFunction(()=>Number(document.getElementById('phase').value)>.1);await page.click('#play');const paused=await page.inputValue('#phase');await page.waitForTimeout(120);assert.equal(await page.inputValue('#phase'),paused);
 await page.click('#side');await page.click('#front');await page.locator('#phase').fill('0.88');await page.locator('#phase').dispatchEvent('input');assert.match(await page.textContent('#contact-status'),/왼발/);assert.equal(await page.locator('.labels span').count(),3);
 const hashes=Object.fromEntries(['mocap.js','mocap.html','landing-width.js','landing-width-comparison.js','ground-contact.js'].map(n=>{const f='experiments/model-preview/review/'+n;return [f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')];}));
 fs.writeFileSync('docs/05-validation/reports/cmu-bilateral.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M34 35_17 bilateral support-only width experiment. Not biomechanical validation.',hashes,results,errors},null,2));
 for(const r of results){assert.equal(r.clip,'35_17');for(const m of Object.values(r.feet)){assert(m.maxRecoveryMm<.01);assert(m.maxRecoveryAngle<.001);assert(m.maxFootAngle<.001);assert(m.maxTargetMm<.1);assert(m.maxFootYZMm<.1);assert(m.maxDisplacementErrorMm<.1);assert(m.maxPenetrationMm<1);assert(m.maxGroundGapMm<1);assert.equal(m.limited,0);}
  for(const k of ['maxOtherMm','maxBoundaryCorrectionMm','seamCorrectionMm','maxRepeatMm','maxOrderMm','maxRightRegressionMm','maxBaselineMm'])assert(r[k]<.01,k);assert(r.maxOtherAngle<.001);assert.deepEqual(r.seamWeights,[1,1,1,1]);}
 assert.deepEqual(errors,[]);console.log('PASS: 730 poses; both support windows, recovery, seam, side independence, right regression and playback UI');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
