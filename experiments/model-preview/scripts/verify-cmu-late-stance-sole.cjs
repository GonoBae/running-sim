const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),measure=require('./measure-landing-sole.cjs');
const out='outputs/cmu-late-stance-sole';fs.mkdirSync(out,{recursive:true});
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
const yawDiff=(a,b)=>Math.abs(Math.atan2(Math.sin((a-b)*Math.PI/180),Math.cos((a-b)*Math.PI/180))*180/Math.PI);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[],results=[];try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});page.on('pageerror',e=>errors.push(e.message));
 for(const model of ['male','female']){
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=late-stance-sole');await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
  if(model==='female'){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});}
  const specs=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model).patchDefinition;
  const paired=[];for(const u of [.25,.375,.5,.65,.75,.85,.95,1,1.1])for(const side of ['r','l'])paired.push({u,side,phase:((side==='r'?.28+.30*u:.75+.34*u)%1+1)%1});
  const landmarks=await page.evaluate(measure,{samples:paired.map(r=>r.phase),specs});
  console.log(model,'ready; late-stance samples measured');
  const rows=await page.evaluate(measure,{samples:Array.from({length:365},(_,i)=>i/364),specs});
  const boundaries=[];for(const phase of [.355,.475,.58,.835,.971,.09,.505,.005])boundaries.push({phase,samples:await page.evaluate(measure,{samples:[phase-.0001,phase,phase+.0001],specs})});
  const repeat=await page.evaluate(measure,{samples:[.005,.43,.005],specs});await page.click('#side');const sideView=await page.evaluate(measure,{samples:[.005],specs});await page.click('#front');
  const m={baselineMm:0,baselineDeg:0,pelvisMm:0,pelvisDeg:0,unaffectedMm:0,unaffectedDeg:0,patchXZmm:0,patchYChangeMm:0,toeXZChangeMm:0,floorMm:0,kneeXmm:0,kneeClampMm:0,lengthMm:0,reachMarginMm:Infinity,fullBankDeg:0,fullPitchDeg:0,fullToeHeelMm:0,yawChangeDeg:0,bankErrorDeg:0,pitchErrorDeg:0,relativeAnkleChangeDeg:0,residualMm:0,targetFrameDeg:0,maxIterations:0,repeatMm:0,viewMm:0,boundarySecondMm:0,boundaryRotationSecondDeg:0};
  const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-landing-sole-alignment.json')).results.find(r=>r.model===model);
  for(const row of rows){
   const [B,C]=row.lanes,arch=old.rows.find(r=>Math.abs(r.phase-row.phase)<1e-9).lanes[1],diags=row.diagnostics[1].lateSole;
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
    m.toeXZChangeMm=Math.max(m.toeXZChangeMm,Math.hypot(b.regions.toe[0]-c.regions.toe[0],b.regions.toe[2]-c.regions.toe[2])*1000);
    const expectedBank=b.bank*(1-(d.weight||0)),expectedPitch=d.weight?d.original.pitch*180/Math.PI+(d.referencePitch-d.original.pitch)*180/Math.PI*d.weight:b.pitch;
    m.bankErrorDeg=Math.max(m.bankErrorDeg,Math.abs(c.bank-expectedBank));m.pitchErrorDeg=Math.max(m.pitchErrorDeg,Math.abs(c.pitch-expectedPitch));
    m.yawChangeDeg=Math.max(m.yawChangeDeg,yawDiff(b.yaw,c.yaw));m.relativeAnkleChangeDeg=Math.max(m.relativeAnkleChangeDeg,angle(b.relativeQ,c.relativeQ));
    const H=C.bones['thigh_'+side].p,K=C.bones['calf_'+side].p,F=C.bones['foot_'+side].p;
    m.reachMarginMm=Math.min(m.reachMarginMm,(dist(H,K)+dist(K,F)-dist(H,F))*1000);
    m.kneeXmm=Math.max(m.kneeXmm,Math.abs(K[0]-B.bones['calf_'+side].p[0])*1000);
    for(const [x,y] of [['thigh','calf'],['calf','foot']])m.lengthMm=Math.max(m.lengthMm,Math.abs(dist(B.bones[x+'_'+side].p,B.bones[y+'_'+side].p)-dist(C.bones[x+'_'+side].p,C.bones[y+'_'+side].p))*1000);
    if(d.weight>=1-1e-9){m.fullBankDeg=Math.max(m.fullBankDeg,Math.abs(c.bank));m.fullPitchDeg=Math.max(m.fullPitchDeg,Math.abs(c.pitch));m.fullToeHeelMm=Math.max(m.fullToeHeelMm,Math.abs(c.toeHeelMm));}
    m.kneeClampMm=Math.max(m.kneeClampMm,(d.kneeClamp||0)*1000);m.residualMm=Math.max(m.residualMm,(d.residual||0)*1000);m.targetFrameDeg=Math.max(m.targetFrameDeg,(d.angleError||0)*180/Math.PI);m.maxIterations=Math.max(m.maxIterations,d.iterations||0);
   }
  }
  for(const n of Object.keys(repeat[0].lanes[1].bones)){m.repeatMm=Math.max(m.repeatMm,dist(repeat[0].lanes[1].bones[n].p,repeat[2].lanes[1].bones[n].p)*1000);m.viewMm=Math.max(m.viewMm,dist(repeat[0].lanes[1].bones[n].p,sideView[0].lanes[1].bones[n].p)*1000);}
  for(const boundary of boundaries){const [lo,at,hi]=boundary.samples.map(r=>r.lanes[1]);for(const n of Object.keys(at.bones)){m.boundarySecondMm=Math.max(m.boundarySecondMm,Math.hypot(...at.bones[n].p.map((v,j)=>lo.bones[n].p[j]+hi.bones[n].p[j]-2*v))*1000);m.boundaryRotationSecondDeg=Math.max(m.boundaryRotationSecondDeg,Math.abs(angle(lo.bones[n].q,at.bones[n].q)-angle(at.bones[n].q,hi.bones[n].q)));}}
  const pairMetrics=[];
  for(const u of [.5,.65,.75,.85,.95,1,1.1]){
   const at=side=>landmarks[paired.findIndex(p=>p.side===side&&p.u===u)];const R=at('r'),L=at('l');
   const values=[0,1].map(j=>{const r=R.lanes[j].feet.r,l=L.lanes[j].feet.l;return {pitchGapDeg:Math.abs(r.pitch-l.pitch),bankGapDeg:Math.abs(r.bank-l.bank),toeHeelGapMm:Math.abs(r.toeHeelMm-l.toeHeelMm),toeHeightGapMm:Math.abs(r.regions.toe[1]-l.regions.toe[1])*1000,heelHeightGapMm:Math.abs(r.regions.heel[1]-l.regions.heel[1])*1000};});
   const mean=(R.lanes[0].feet.r.pitch+L.lanes[0].feet.l.pitch)/2;
   const reference=R.diagnostics[1].lateSole.find(d=>d.side==='r').referencePitch;
   pairMetrics.push({u,before:values[0],after:values[1],referenceErrorDeg:Number.isFinite(reference)?Math.abs(reference*180/Math.PI-mean):0});
  }
  const seam=await page.evaluate(measure,{samples:[0,1],specs});let seamCorrectionMm=0;
  for(const n of Object.keys(seam[0].lanes[0].bones)){const deltas=seam.map(r=>r.lanes[1].bones[n].p.map((v,i)=>v-r.lanes[0].bones[n].p[i]));seamCorrectionMm=Math.max(seamCorrectionMm,dist(...deltas)*1000);}
  const seconds=91/120,dt=seconds/364;
  const maxAngularSpeed=[0,1].map(j=>Math.max(...rows.slice(1).flatMap((r,i)=>['r','l'].map(side=>angle(rows[i].lanes[j].bones['foot_'+side].q,r.lanes[j].bones['foot_'+side].q)/dt))));
  results.push({model,metrics:m,pairMetrics,seamCorrectionMm,maxAngularSpeed,rows,landmarks:landmarks.map((r,i)=>({...r,side:paired[i].side,u:paired[i].u})),boundaries,repeat,sideView});console.log(model,m);
  for(const view of ['front','side']){await page.click('#'+view);for(const phase of [.475,.505,.535,.971,.005,.039]){await page.evaluate(p=>window.mocapReview.seek(p*window.mocapReview.cycle.period),phase);await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*1000)}.png`});}}
 }
 const hashes=Object.fromEntries(['late-stance-sole.js','landing-sole-alignment.js','landing-width-comparison.js','mocap.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
 fs.writeFileSync('docs/05-validation/reports/cmu-late-stance-sole.json',JSON.stringify({testedAt:new Date().toISOString(),errors,hashes,results},null,2));assert.deepEqual(errors,[]);
 for(const {metrics:m}of results){for(const k of ['baselineMm','pelvisMm','unaffectedMm','patchXZmm','floorMm','kneeXmm','kneeClampMm','lengthMm','residualMm','repeatMm','viewMm'])assert(m[k]<.01,k+' '+m[k]);for(const k of ['baselineDeg','pelvisDeg','unaffectedDeg'])assert(m[k]<.001,k+' '+m[k]);assert(m.fullBankDeg<.05);assert(m.bankErrorDeg<.001);assert(m.pitchErrorDeg<.001);assert(m.yawChangeDeg<.01);assert(m.reachMarginMm>0);assert(m.targetFrameDeg<.001);assert(m.boundarySecondMm<.05);assert(m.boundaryRotationSecondDeg<.01);}
 for(const r of results){assert(r.seamCorrectionMm<.01);for(const p of r.pairMetrics.filter(p=>p.u<1)){assert(p.referenceErrorDeg<.02);assert(p.after.pitchGapDeg<=p.before.pitchGapDeg+.01);assert(p.after.bankGapDeg<=p.before.bankGapDeg+.01);}const p=r.pairMetrics.find(p=>p.u===.75);assert(p.after.pitchGapDeg<p.before.pitchGapDeg*.2);assert(p.after.bankGapDeg<p.before.bankGapDeg*.2);assert(p.after.toeHeelGapMm<p.before.toeHeelGapMm*.25);assert(p.after.toeHeightGapMm<p.before.toeHeightGapMm);assert(p.after.heelHeightGapMm<p.before.heelHeightGapMm);for(const row of r.landmarks.filter(row=>row.u>=1))for(const n of Object.keys(row.lanes[0].bones)){assert(dist(row.lanes[0].bones[n].p,row.lanes[1].bones[n].p)*1000<.01);assert(angle(row.lanes[0].bones[n].q,row.lanes[1].bones[n].q)<.001);}}
 console.log('PASS: independent skin alignment, M53 baseline/pelvis, both landing points, unchanged recovery/endpoints, progressive push-off, lengths/reach, boundaries and views');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
