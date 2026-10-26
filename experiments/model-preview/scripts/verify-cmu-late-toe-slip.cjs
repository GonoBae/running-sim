// A counterexample/rejection test, not an acceptance test for a new gait.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),measure=require('./measure-landing-sole.cjs');
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
const xz=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2])*1000;
const out='outputs/cmu-late-toe-slip';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[],results=[];try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});page.on('pageerror',e=>errors.push(e.message));
 for(const model of ['male','female']){
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=late-toe-slip-trial');await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:90000});
  if(model==='female'){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:90000});}
  console.log(model,'ready');
  const specs=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model).patchDefinition;
  const rows=await page.evaluate(measure,{samples:Array.from({length:365},(_,i)=>i/364),specs});
  const paired=[];for(const side of ['r','l'])for(let i=0;i<=100;i++){const u=.5+i*.005;paired.push({side,u,phase:((side==='r'?.28+.30*u:.75+.34*u)%1+1)%1});}
  const landmarks=(await page.evaluate(measure,{samples:paired.map(p=>p.phase),specs})).map((r,i)=>({...r,...paired[i]}));
  const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-late-stance-sole.json')).results.find(r=>r.model===model);
  const metrics={baselineMm:0,baselineDeg:0,pelvisMm:0,pelvisDeg:0,unaffectedMm:0,unaffectedDeg:0,patchXZmm:0,soleAngleDeg:0,footWorldDeg:0,ankleRelativeDeg:0,toeHeightMm:0,heelHeightMm:0,floorMm:0,lengthMm:0,kneeXmm:0,reachMarginMm:Infinity,residualMm:0,kneeClampMm:0};
  for(let i=0;i<rows.length;i++){
   const row=rows[i],[B,C]=row.lanes,A=old.rows[i].lanes[1],d=row.diagnostics[1].toeTrial,active=d.find(d=>d.weight>0)?.side;
   for(const n of Object.keys(B.bones)){
    const b=B.bones[n],c=C.bones[n];metrics.baselineMm=Math.max(metrics.baselineMm,dist(b.p,A.bones[n].p)*1000);metrics.baselineDeg=Math.max(metrics.baselineDeg,angle(b.q,A.bones[n].q));
    if(!active||!new RegExp(`^(thigh|calf|foot|ball)_${active}$`).test(n)){metrics.unaffectedMm=Math.max(metrics.unaffectedMm,dist(b.p,c.p)*1000);metrics.unaffectedDeg=Math.max(metrics.unaffectedDeg,angle(b.q,c.q));}
   }
   metrics.pelvisMm=Math.max(metrics.pelvisMm,dist(B.bones.pelvis.p,C.bones.pelvis.p)*1000);metrics.pelvisDeg=Math.max(metrics.pelvisDeg,angle(B.bones.pelvis.q,C.bones.pelvis.q));
   for(const s of ['r','l']){
    const b=B.feet[s],c=C.feet[s];metrics.patchXZmm=Math.max(metrics.patchXZmm,xz(b.patch,c.patch));metrics.soleAngleDeg=Math.max(metrics.soleAngleDeg,...['pitch','bank','yaw'].map(k=>Math.abs(b[k]-c[k])));metrics.ankleRelativeDeg=Math.max(metrics.ankleRelativeDeg,angle(b.relativeQ,c.relativeQ));
    for(const bone of ['foot','ball'])metrics.footWorldDeg=Math.max(metrics.footWorldDeg,angle(B.bones[bone+'_'+s].q,C.bones[bone+'_'+s].q));
    for(const k of ['toe','heel'])metrics[k+'HeightMm']=Math.max(metrics[k+'HeightMm'],Math.abs(b.regions[k][1]-c.regions[k][1])*1000);
    metrics.floorMm=Math.max(metrics.floorMm,Math.abs(b.floor-c.floor)*1000);metrics.kneeXmm=Math.max(metrics.kneeXmm,Math.abs(B.bones['calf_'+s].p[0]-C.bones['calf_'+s].p[0])*1000);
    const H=C.bones['thigh_'+s].p,K=C.bones['calf_'+s].p,F=C.bones['foot_'+s].p;metrics.reachMarginMm=Math.min(metrics.reachMarginMm,(dist(H,K)+dist(K,F)-dist(H,F))*1000);
    for(const [a,z]of [['thigh','calf'],['calf','foot']])metrics.lengthMm=Math.max(metrics.lengthMm,Math.abs(dist(B.bones[a+'_'+s].p,B.bones[z+'_'+s].p)-dist(C.bones[a+'_'+s].p,C.bones[z+'_'+s].p))*1000);
   }
   for(const q of d){metrics.residualMm=Math.max(metrics.residualMm,(q.residual||0)*1000);metrics.kneeClampMm=Math.max(metrics.kneeClampMm,(q.kneeClamp||0)*1000);}
  }
  // Local lane coordinates remove only the display offset; unwrap the finite
  // captured root segment, NOT the camera motion. Do not count the loop reset.
  const travel=rows.at(-1).lanes[0].bones.pelvis.p.map((v,i)=>v-rows[0].lanes[0].bones.pelvis.p[i]);
  const tracks=['r','l'].map(side=>{
   const track=landmarks.filter(r=>r.side===side).map(r=>({u:r.u,phase:r.phase,lanes:r.lanes.map(l=>{const f=l.feet[side],shift=side==='l'&&r.phase<.75?1:0;const un=p=>p.map((v,i)=>v+shift*travel[i]);return {toe:un(f.regions.toe),heel:un(f.regions.heel),patch:un(f.patch),pitch:f.pitch,bank:f.bank};})}));
   const span=(j,key,lo,hi)=>{const samples=track.filter(r=>r.u>=lo-1e-7&&r.u<=hi+1e-7),p=samples.map(r=>r.lanes[j][key]);let path=0,maxSpeed=0;for(let i=1;i<p.length;i++){const step=xz(p[i],p[i-1]);path+=step;maxSpeed=Math.max(maxSpeed,step/((samples[i].u-samples[i-1].u)*(side==='r'?.3:.34)*91/120));}return {pathMm:path,netMm:xz(p[0],p.at(-1)),maxSpeedMmS:maxSpeed};};
   return {side,track,metrics:[0,1].map(j=>({hold:span(j,'toe',.65,.85),release:span(j,'toe',.85,1),late:span(j,'toe',.5,1),patchLate:span(j,'patch',.5,1)}))};
  });
  const bounds=[];for(const s of ['r','l'])for(const u of [.5,.65,.85,1]){const phase=(s==='r'?.28+.3*u:.75+.34*u)%1;bounds.push(...await page.evaluate(measure,{samples:[phase-.0001,phase,phase+.0001],specs}));}
  let boundarySecondMm=0;for(let i=0;i<bounds.length;i+=3)for(const n of Object.keys(bounds[i].lanes[1].bones)){const [a,b,c]=bounds.slice(i,i+3).map(r=>r.lanes[1].bones[n].p);boundarySecondMm=Math.max(boundarySecondMm,Math.hypot(...a.map((v,j)=>v+c[j]-2*b[j]))*1000);}
  const repeat=await page.evaluate(measure,{samples:[.005,.51,.005],specs});await page.click('#side');const view=await page.evaluate(measure,{samples:[.005],specs});await page.click('#front');let repeatMm=0,viewMm=0;
  for(const n of Object.keys(repeat[0].lanes[1].bones)){repeatMm=Math.max(repeatMm,dist(repeat[0].lanes[1].bones[n].p,repeat[2].lanes[1].bones[n].p)*1000);viewMm=Math.max(viewMm,dist(repeat[0].lanes[1].bones[n].p,view[0].lanes[1].bones[n].p)*1000);}
  let seamCorrectionMm=0;
  for(const n of Object.keys(rows[0].lanes[0].bones)){const delta=r=>r.lanes[1].bones[n].p.map((v,i)=>v-r.lanes[0].bones[n].p[i]);seamCorrectionMm=Math.max(seamCorrectionMm,dist(delta(rows[0]),delta(rows.at(-1)))*1000);}
  results.push({model,metrics,tracks,boundarySecondMm,repeatMm,viewMm,seamCorrectionMm,travel,rows,landmarks});console.log(model,JSON.stringify({metrics,tracks:tracks.map(t=>({side:t.side,metrics:t.metrics})),boundarySecondMm,repeatMm,viewMm}));
  for(const v of ['front','side']){await page.click('#'+v);for(const phase of [.505,.565,.005,.073]){await page.evaluate(p=>window.mocapReview.seek(p*window.mocapReview.cycle.period),phase);await page.locator('#view canvas').screenshot({path:`${out}/${model}-${v}-${Math.round(phase*1000)}.png`});}}
 }
 const hashes=Object.fromEntries(['late-toe-slip-trial.js','late-stance-sole.js','landing-sole-alignment.js','landing-width-comparison.js','mocap.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
 fs.writeFileSync('docs/05-validation/reports/cmu-late-toe-slip.json',JSON.stringify({testedAt:new Date().toISOString(),status:'rejected-trial',errors,hashes,results},null,2));
 assert.deepEqual(errors,[]);for(const r of results){const m=r.metrics;for(const k of ['baselineMm','pelvisMm','unaffectedMm','floorMm','lengthMm','kneeXmm','residualMm','kneeClampMm','toeHeightMm','heelHeightMm'])assert(m[k]<.01,k+' '+m[k]);for(const k of ['baselineDeg','pelvisDeg','unaffectedDeg','footWorldDeg'])assert(m[k]<.001,k+' '+m[k]);assert(m.reachMarginMm>0);assert(m.soleAngleDeg<.001);assert(r.seamCorrectionMm<.01);assert(r.repeatMm<.01);assert(r.viewMm<.01);assert(r.boundarySecondMm<.05);assert(m.patchXZmm>1,'trial must NOT be accepted as contact-preserving');for(const t of r.tracks){assert(t.metrics[1].hold.pathMm<t.metrics[0].hold.pathMm*.76);assert(t.metrics[1].late.netMm>=t.metrics[0].late.netMm-.01);}assert(r.tracks.find(t=>t.side==='l').metrics[1].release.maxSpeedMmS>r.tracks.find(t=>t.side==='l').metrics[0].release.maxSpeedMmS);}
 console.log('PASS diagnosis: M54 reproduced; trial rejected for moving contact patch and deferring slip into release. NOT a successful gait correction.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
