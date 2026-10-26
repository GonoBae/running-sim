const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out='outputs/cmu-pelvis-reference-restore';fs.mkdirSync(out,{recursive:true});
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
const kneeFlex=b=>{const u=subtract(b.thigh_l.p,b.calf_l.p),v=subtract(b.foot_l.p,b.calf_l.p);return 180-Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)/Math.hypot(...u)/Math.hypot(...v))))*180/Math.PI;};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const errors=[],results=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:940}});page.on('pageerror',e=>errors.push(e.message));
  for(const model of ['male','female']){
   await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=pelvis-reference-restore');
   await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
   if(model==='female'){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});}
   const data=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);
    const snapshot=phase=>{
     a.seek(phase*a.cycle.period);
     return {phase,lanes:a.comparison.lanes.map(l=>({
      bones:Object.fromEntries(l.bones.map(b=>[b.name,{p:l.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).normalize().toArray()}])),
      feet:Object.fromEntries(l.contactPlans.map(p=>[p.window.side,{patch:l.group.worldToLocal(p.patch.read()).toArray(),floor:l.readSurface(p.window.side).min}]))
     })),diagnostics:a.comparison.diagnostics.map(d=>({reference:d.pelvisReference,restore:d.bodyRestore}))};
    };
    const rows=Array.from({length:365},(_,i)=>snapshot(i/364));
    const independentRows=Array.from({length:92},(_,i)=>snapshot(i/91));
    const landmarks=[.28,.43,.75,.83,.92,.989,.09].map(snapshot);
    const boundaries=[.75,.87,.97,.09].map(phase=>({phase,samples:[-.0001,0,.0001].map(d=>snapshot(phase+d))}));
    const first=snapshot(.92);snapshot(.43);const repeat=snapshot(.92);a.comparison.view(true);const side=snapshot(.92);a.comparison.view(false);
    return {rows,independentRows,landmarks,boundaries,first,repeat,side};
   });
   const m={baselineMm:0,baselineDeg:0,referenceMm:0,independentReferenceMm:0,beforeXmm:0,beforeYmm:0,afterXmm:0,afterYmm:0,bodyRelativeMm:0,bodyRotationDeg:0,inactiveMm:0,inactiveDeg:0,leftPatchXZmm:0,leftFloorMm:0,leftFootDeg:0,rightSupportMm:0,rightSupportDeg:0,lengthMm:0,residualMm:0,reachMarginMm:Infinity,minKneeFlexDeg:Infinity,maxKneeFlexDeg:0,kneeFlexChangeDeg:0,kneeShiftMm:0,repeatMm:0,viewMm:0,boundarySecondMm:0,boundaryRotationSecondDeg:0,maxIterations:0};
   const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-left-ankle-direction.json')).results.find(r=>r.model===model);
   const audit=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model);
   for(const r of data.rows){
    const [B,C]=r.lanes,archived=old.rows.find(v=>Math.abs(v.phase-r.phase)<1e-9).lanes[1],d=r.diagnostics[1],active=d.restore?.active;
    m.referenceMm=Math.max(m.referenceMm,distance(C.bones.pelvis.p,d.reference)*1000);
    for(const axis of [0,1]){const key=axis===0?'X':'Y';m['before'+key+'mm']=Math.max(m['before'+key+'mm'],Math.abs(B.bones.pelvis.p[axis]-d.reference[axis])*1000);m['after'+key+'mm']=Math.max(m['after'+key+'mm'],Math.abs(C.bones.pelvis.p[axis]-d.reference[axis])*1000);}
    for(const n of Object.keys(B.bones)){
     const b=B.bones[n],c=C.bones[n];
     m.baselineMm=Math.max(m.baselineMm,distance(b.p,archived.bones[n].p)*1000);m.baselineDeg=Math.max(m.baselineDeg,angle(b.q,archived.bones[n].q));
     if(!/^(thigh|calf|foot|ball)_l$/.test(n)){m.bodyRelativeMm=Math.max(m.bodyRelativeMm,distance(subtract(b.p,B.bones.pelvis.p),subtract(c.p,C.bones.pelvis.p))*1000);m.bodyRotationDeg=Math.max(m.bodyRotationDeg,angle(b.q,c.q));}
     if(!active){m.inactiveMm=Math.max(m.inactiveMm,distance(b.p,c.p)*1000);m.inactiveDeg=Math.max(m.inactiveDeg,angle(b.q,c.q));}
     if(r.phase>=.28&&r.phase<=.58){m.rightSupportMm=Math.max(m.rightSupportMm,distance(b.p,c.p)*1000);m.rightSupportDeg=Math.max(m.rightSupportDeg,angle(b.q,c.q));}
    }
    m.leftPatchXZmm=Math.max(m.leftPatchXZmm,Math.hypot(B.feet.l.patch[0]-C.feet.l.patch[0],B.feet.l.patch[2]-C.feet.l.patch[2])*1000);
    m.leftFloorMm=Math.max(m.leftFloorMm,Math.abs(B.feet.l.floor-C.feet.l.floor)*1000);
    for(const n of ['foot_l','ball_l'])m.leftFootDeg=Math.max(m.leftFootDeg,angle(B.bones[n].q,C.bones[n].q));
    for(const [x,y] of [['thigh_l','calf_l'],['calf_l','foot_l']])m.lengthMm=Math.max(m.lengthMm,Math.abs(distance(B.bones[x].p,B.bones[y].p)-distance(C.bones[x].p,C.bones[y].p))*1000);
    const b=C.bones;
    m.reachMarginMm=Math.min(m.reachMarginMm,(distance(b.thigh_l.p,b.calf_l.p)+distance(b.calf_l.p,b.foot_l.p)-distance(b.thigh_l.p,b.foot_l.p))*1000);
    m.minKneeFlexDeg=Math.min(m.minKneeFlexDeg,kneeFlex(b));m.maxKneeFlexDeg=Math.max(m.maxKneeFlexDeg,kneeFlex(b));m.kneeFlexChangeDeg=Math.max(m.kneeFlexChangeDeg,Math.abs(kneeFlex(b)-kneeFlex(B.bones)));m.kneeShiftMm=Math.max(m.kneeShiftMm,distance(b.calf_l.p,B.bones.calf_l.p)*1000);
    m.residualMm=Math.max(m.residualMm,(d.restore?.residual||0)*1000);m.maxIterations=Math.max(m.maxIterations,d.restore?.iterations||0);
   }
   for(const r of data.independentRows){const a=audit.rows.find(v=>Math.abs(v.phase-r.phase)<1e-9);m.independentReferenceMm=Math.max(m.independentReferenceMm,distance(r.lanes[1].bones.pelvis.p,a.stages.travel.pelvis)*1000);}
   for(const n of Object.keys(data.first.lanes[1].bones)){m.repeatMm=Math.max(m.repeatMm,distance(data.first.lanes[1].bones[n].p,data.repeat.lanes[1].bones[n].p)*1000);m.viewMm=Math.max(m.viewMm,distance(data.first.lanes[1].bones[n].p,data.side.lanes[1].bones[n].p)*1000);}
   for(const boundary of data.boundaries){const [lo,at,hi]=boundary.samples.map(r=>r.lanes[1]);for(const n of Object.keys(at.bones)){m.boundarySecondMm=Math.max(m.boundarySecondMm,Math.hypot(...at.bones[n].p.map((v,j)=>lo.bones[n].p[j]+hi.bones[n].p[j]-2*v))*1000);m.boundaryRotationSecondDeg=Math.max(m.boundaryRotationSecondDeg,Math.abs(angle(lo.bones[n].q,at.bones[n].q)-angle(at.bones[n].q,hi.bones[n].q)));}}
   console.log(model,m);results.push({model,metrics:m,...data});
   for(const view of ['front','side']){await page.click('#'+view);for(const phase of [.28,.43,.75,.83,.92,.989,.09]){await page.evaluate(p=>window.mocapReview.seek(p*window.mocapReview.cycle.period),phase);await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*1000)}.png`});}}
  }
  const hashes=Object.fromEntries(['pelvis-reference-restore.js','landing-width-comparison.js','mocap.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
  fs.writeFileSync('docs/05-validation/reports/cmu-pelvis-reference-restore.json',JSON.stringify({testedAt:new Date().toISOString(),errors,hashes,results},null,2));
  assert.deepEqual(errors,[]);
  for(const {metrics:m} of results){
   for(const k of ['baselineMm','referenceMm','independentReferenceMm','bodyRelativeMm','inactiveMm','leftPatchXZmm','leftFloorMm','rightSupportMm','lengthMm','residualMm','repeatMm','viewMm'])assert(m[k]<.01,k+' '+m[k]);
   for(const k of ['baselineDeg','bodyRotationDeg','inactiveDeg','leftFootDeg','rightSupportDeg'])assert(m[k]<.001,k+' '+m[k]);
   assert(m.reachMarginMm>0);assert(m.minKneeFlexDeg>0);assert(m.boundarySecondMm<.05);assert(m.boundaryRotationSecondDeg<.01);
  }
  console.log('PASS: M50 baseline, independent pre-chain pelvis, contact/orientation, body-relative recovery, leg length, support boundaries, repeat seeking and views');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
