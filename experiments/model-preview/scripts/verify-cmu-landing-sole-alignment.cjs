const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),measure=require('./measure-landing-sole.cjs');
const out='outputs/cmu-landing-sole-alignment';fs.mkdirSync(out,{recursive:true});
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
const yawDiff=(a,b)=>Math.abs(Math.atan2(Math.sin((a-b)*Math.PI/180),Math.cos((a-b)*Math.PI/180))*180/Math.PI);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[],results=[];try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});page.on('pageerror',e=>errors.push(e.message));
 for(const model of ['male','female']){
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=landing-sole-alignment');await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
  if(model==='female'){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});}
  const specs=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model).patchDefinition;
  const paired=[];for(const u of [-.2,0,.125,.25,.375,.5,.75,1])for(const side of ['r','l'])paired.push({u,side,phase:((side==='r'?.28+.30*u:.75+.34*u)%1+1)%1});
  const landmarks=await page.evaluate(measure,{samples:paired.map(r=>r.phase),specs});
  console.log(model,'touchdown',landmarks.filter((r,i)=>paired[i].u===0).map((r,j)=>({side:paired[2+j].side,feet:r.lanes[1].feet,diagnostics:r.diagnostics[1].soleAlignment})));
  const rows=await page.evaluate(measure,{samples:Array.from({length:365},(_,i)=>i/364),specs});
  const boundaries=[];for(const phase of [.16,.28,.355,.43,.63,.75,.835,.92])boundaries.push({phase,samples:await page.evaluate(measure,{samples:[phase-.0001,phase,phase+.0001],specs})});
  const repeat=await page.evaluate(measure,{samples:[.78,.43,.78],specs});await page.click('#side');const sideView=await page.evaluate(measure,{samples:[.78],specs});await page.click('#front');
  const m={baselineMm:0,baselineDeg:0,pelvisMm:0,pelvisDeg:0,unaffectedMm:0,unaffectedDeg:0,patchXZmm:0,patchYChangeMm:0,floorMm:0,kneeXmm:0,kneeClampMm:0,lengthMm:0,reachMarginMm:Infinity,fullTiltDeg:0,fullPitchDeg:0,fullToeHeelMm:0,yawChangeDeg:0,relativeAnkleChangeDeg:0,residualMm:0,targetFrameDeg:0,maxIterations:0,repeatMm:0,viewMm:0,boundarySecondMm:0,boundaryRotationSecondDeg:0};
  const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-pelvis-reference-restore.json')).results.find(r=>r.model===model);
  for(const row of rows){
   const [B,C]=row.lanes,arch=old.rows.find(r=>Math.abs(r.phase-row.phase)<1e-9).lanes[1],diags=row.diagnostics[1].soleAlignment;
   for(const n of Object.keys(B.bones)){
    const b=B.bones[n],c=C.bones[n];m.baselineMm=Math.max(m.baselineMm,dist(b.p,arch.bones[n].p)*1000);m.baselineDeg=Math.max(m.baselineDeg,angle(b.q,arch.bones[n].q));
    const activeSide=diags.find(d=>d.weight>0)?.side;
    const affected=activeSide&&new RegExp(`^(thigh|calf|foot|ball)_${activeSide}$`).test(n);
    if(!affected){m.unaffectedMm=Math.max(m.unaffectedMm,dist(b.p,c.p)*1000);m.unaffectedDeg=Math.max(m.unaffectedDeg,angle(b.q,c.q));}
   }
   m.pelvisMm=Math.max(m.pelvisMm,dist(B.bones.pelvis.p,C.bones.pelvis.p)*1000);m.pelvisDeg=Math.max(m.pelvisDeg,angle(B.bones.pelvis.q,C.bones.pelvis.q));
   for(const side of ['r','l']){
    const b=B.feet[side],c=C.feet[side],d=diags.find(d=>d.side===side);
    m.patchXZmm=Math.max(m.patchXZmm,Math.hypot(b.patch[0]-c.patch[0],b.patch[2]-c.patch[2])*1000);m.floorMm=Math.max(m.floorMm,Math.abs(b.floor-c.floor)*1000);
    m.patchYChangeMm=Math.max(m.patchYChangeMm,Math.abs(b.patch[1]-c.patch[1])*1000);
    m.yawChangeDeg=Math.max(m.yawChangeDeg,yawDiff(b.yaw,c.yaw));m.relativeAnkleChangeDeg=Math.max(m.relativeAnkleChangeDeg,angle(b.relativeQ,c.relativeQ));
    const H=C.bones['thigh_'+side].p,K=C.bones['calf_'+side].p,F=C.bones['foot_'+side].p;
    m.reachMarginMm=Math.min(m.reachMarginMm,(dist(H,K)+dist(K,F)-dist(H,F))*1000);
    m.kneeXmm=Math.max(m.kneeXmm,Math.abs(K[0]-B.bones['calf_'+side].p[0])*1000);
    for(const [x,y] of [['thigh','calf'],['calf','foot']])m.lengthMm=Math.max(m.lengthMm,Math.abs(dist(B.bones[x+'_'+side].p,B.bones[y+'_'+side].p)-dist(C.bones[x+'_'+side].p,C.bones[y+'_'+side].p))*1000);
    if(d.weight>=1-1e-9){m.fullTiltDeg=Math.max(m.fullTiltDeg,Math.abs(c.tilt));m.fullPitchDeg=Math.max(m.fullPitchDeg,Math.abs(c.pitch));m.fullToeHeelMm=Math.max(m.fullToeHeelMm,Math.abs(c.toeHeelMm));}
    m.kneeClampMm=Math.max(m.kneeClampMm,(d.kneeClamp||0)*1000);m.residualMm=Math.max(m.residualMm,(d.residual||0)*1000);m.targetFrameDeg=Math.max(m.targetFrameDeg,(d.angleError||0)*180/Math.PI);m.maxIterations=Math.max(m.maxIterations,d.iterations||0);
   }
  }
  for(const n of Object.keys(repeat[0].lanes[1].bones)){m.repeatMm=Math.max(m.repeatMm,dist(repeat[0].lanes[1].bones[n].p,repeat[2].lanes[1].bones[n].p)*1000);m.viewMm=Math.max(m.viewMm,dist(repeat[0].lanes[1].bones[n].p,sideView[0].lanes[1].bones[n].p)*1000);}
  for(const boundary of boundaries){const [lo,at,hi]=boundary.samples.map(r=>r.lanes[1]);for(const n of Object.keys(at.bones)){m.boundarySecondMm=Math.max(m.boundarySecondMm,Math.hypot(...at.bones[n].p.map((v,j)=>lo.bones[n].p[j]+hi.bones[n].p[j]-2*v))*1000);m.boundaryRotationSecondDeg=Math.max(m.boundaryRotationSecondDeg,Math.abs(angle(lo.bones[n].q,at.bones[n].q)-angle(at.bones[n].q,hi.bones[n].q)));}}
  results.push({model,metrics:m,rows,landmarks:landmarks.map((r,i)=>({...r,side:paired[i].side,u:paired[i].u})),boundaries,repeat,sideView});console.log(model,m);
  for(const view of ['front','side']){await page.click('#'+view);for(const phase of [.28,.355,.43,.75,.835,.92]){await page.evaluate(p=>window.mocapReview.seek(p*window.mocapReview.cycle.period),phase);await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*1000)}.png`});}}
 }
 const hashes=Object.fromEntries(['landing-sole-alignment.js','landing-width-comparison.js','mocap.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
 fs.writeFileSync('docs/05-validation/reports/cmu-landing-sole-alignment.json',JSON.stringify({testedAt:new Date().toISOString(),errors,hashes,results},null,2));assert.deepEqual(errors,[]);
 for(const {metrics:m}of results){for(const k of ['baselineMm','pelvisMm','unaffectedMm','patchXZmm','floorMm','kneeXmm','kneeClampMm','lengthMm','residualMm','repeatMm','viewMm'])assert(m[k]<.01,k+' '+m[k]);for(const k of ['baselineDeg','pelvisDeg','unaffectedDeg'])assert(m[k]<.001,k+' '+m[k]);assert(m.fullTiltDeg<.05);assert(m.fullPitchDeg<.05);assert(m.fullToeHeelMm<.1);assert(m.yawChangeDeg<.01);assert(m.reachMarginMm>0);assert(m.targetFrameDeg<.001);assert(m.boundarySecondMm<.05);assert(m.boundaryRotationSecondDeg<.01);}
 console.log('PASS: independent skin alignment, M52 baseline/pelvis, both landing points, unaffected recovery/push-off, lengths/reach, boundaries and views');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
