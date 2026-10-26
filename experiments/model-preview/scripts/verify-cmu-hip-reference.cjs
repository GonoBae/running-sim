const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>{const sign=a.reduce((s,v,i)=>s+v*b[i],0)<0?-1:1;return 4*Math.asin(Math.min(1,dist(a,b.map(v=>v*sign))/2))*180/Math.PI;};
async function capture(page,raw=false){return page.evaluate(async raw=>{
 const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);
 const lanes=raw?[a.comparison.lanes[0]]:a.comparison.lanes;
 const readers=lanes.map(l=>{const groups=[];l.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;for(let k=0;k<skinIndex.count;k++){let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(k,j)].name))w+=skinWeight.getComponent(k,j);if(w>.15)ids.push(k);}groups.push({mesh,ids});});return ()=>{const pts=[];for(const {mesh,ids} of groups){mesh.skeleton.update();for(const k of ids)pts.push(l.group.worldToLocal(mesh.getVertexPosition(k,new T.Vector3()).applyMatrix4(mesh.matrixWorld)));}const low=Math.min(...pts.map(p=>p.y)),center=new T.Vector3();let sw=0;for(const p of pts){const w=Math.exp((low-p.y)/.001);center.addScaledVector(p,w);sw+=w;}return {center:center.divideScalar(sw).toArray(),low};};});
 function snapshot(){return lanes.map((l,j)=>{const bones=Object.fromEntries(l.bones.map(b=>[b.name,{p:l.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).normalize().toArray(),local:b.quaternion.clone().normalize().toArray()}]));return {bones,skin:readers[j]()};});}
 const rows=[];for(let f=0;f<=a.cycle.period;f+=.25){a.seek(f);rows.push({frame:f,phase:f/a.cycle.period,lanes:snapshot()});}
 const boundaries=[];for(const edge of [.28,.58]){const samples=[];for(const delta of [-.001,-.0005,-.0001,0,.0001,.0005,.001]){a.seek((edge+delta)*a.cycle.period);samples.push({delta,lanes:snapshot()});}boundaries.push({edge,samples});}
 a.seek(39);const first=snapshot();a.seek(80);a.seek(0);a.seek(39);const again=snapshot();
 return {clip:a.clip.id,seconds:a.cycle.seconds,rows,boundaries,first,again};
},raw);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async(url,model)=>{await page.goto('http://127.0.0.1:5173/review/mocap.html?compare='+url);await page.waitForFunction(()=>window.mocapReview?.ready);await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);};
 const historical=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-pelvis-sway.json','utf8'));
 for(const model of ['male','female']){
  await open('stance-chain-bilateral',model);const raw=await capture(page,true);
  await open('hip-reference',model);const data=await capture(page);
  const metrics={pelvisMm:0,pelvisDeg:0,leftWorldMm:0,leftLocalDeg:0,outsideMm:0,outsideDeg:0,lengthMm:0,fullAlignmentMm:0,fullKneePlaneMm:0,targetMm:0,footYZMm:0,footDeg:0,groundGapMm:0,penetrationMm:0,kneeChangeDeg:0,baselineRegressionMm:0,repeatMm:0};
  const prior=historical.results.find(x=>x.model===model),rows=[];
  for(let i=0;i<data.rows.length;i++){
   const row=data.rows[i],[before,after]=row.lanes,original=raw.rows[i].lanes[0],active=row.phase>.28&&row.phase<.58;
   const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));},weight=active?smooth((row.phase-.28)/.12)*smooth((.58-row.phase)/.12):0;
   const B=before.bones,C=after.bones,R=original.bones;
   for(const n of Object.keys(C)){
    if(!active){metrics.outsideMm=Math.max(metrics.outsideMm,dist(B[n].p,C[n].p)*1000);metrics.outsideDeg=Math.max(metrics.outsideDeg,angle(B[n].q,C[n].q));}
    if(['thigh_l','calf_l','foot_l','ball_l'].includes(n)){metrics.leftLocalDeg=Math.max(metrics.leftLocalDeg,angle(B[n].local,C[n].local));if(active)metrics.leftWorldMm=Math.max(metrics.leftWorldMm,dist(R[n].p,C[n].p)*1000);}
   }
   const points=b=>['thigh_r','calf_r','foot_r'].map(n=>new Float64Array(b[n].p));
   const [h,k,f]=points(C),[rh,rk,rf]=points(R);
   const bend=(h,k,f)=>{const u=Array.from(k,(v,j)=>v-h[j]),v=Array.from(f,(x,j)=>x-k[j]);return Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,j)=>s+x*v[j],0)/Math.hypot(...u)/Math.hypot(...v))))*180/Math.PI;};
   if(active){
    metrics.pelvisMm=Math.max(metrics.pelvisMm,dist(C.pelvis.p,R.pelvis.p)*1000);metrics.pelvisDeg=Math.max(metrics.pelvisDeg,angle(C.pelvis.q,R.pelvis.q));
    metrics.lengthMm=Math.max(metrics.lengthMm,Math.abs(dist(h,k)-dist(rh,rk))*1000,Math.abs(dist(k,f)-dist(rk,rf))*1000);
    metrics.footYZMm=Math.max(metrics.footYZMm,Math.hypot(f[1]-rf[1],f[2]-rf[2])*1000);metrics.footDeg=Math.max(metrics.footDeg,angle(C.foot_r.q,R.foot_r.q));
    const target=original.skin.center[0]+weight*(rh[0]-original.skin.center[0]);metrics.targetMm=Math.max(metrics.targetMm,Math.abs(after.skin.center[0]-target)*1000);
    if(weight>.999999){metrics.fullAlignmentMm=Math.max(metrics.fullAlignmentMm,Math.abs(after.skin.center[0]-h[0])*1000);metrics.fullKneePlaneMm=Math.max(metrics.fullKneePlaneMm,Math.abs(k[0]-h[0]-(k[1]-h[1])*(f[0]-h[0])/(f[1]-h[1]))*1000);}
    metrics.groundGapMm=Math.max(metrics.groundGapMm,Math.abs(after.skin.low)*1000);metrics.penetrationMm=Math.max(metrics.penetrationMm,-after.skin.low*1000);metrics.kneeChangeDeg=Math.max(metrics.kneeChangeDeg,Math.abs(bend(h,k,f)-bend(rh,rk,rf)));
   }
   const old=prior.rows[i],side=old.side;for(const [key,name] of [['hip','thigh_'+side],['knee','calf_'+side],['ankle','foot_'+side],['pelvis','pelvis']])metrics.baselineRegressionMm=Math.max(metrics.baselineRegressionMm,dist(B[name].p,old[key])*1000);
   rows.push({frame:row.frame,phase:row.phase,weight,hip:Array.from(h),knee:Array.from(k),ankle:Array.from(f),pelvis:C.pelvis.p,referencePelvis:R.pelvis.p,beforePelvis:B.pelvis.p,surface:after.skin.center,beforeSurface:before.skin.center,referenceHip:R.thigh_r.p,bend:bend(h,k,f),referenceBend:bend(rh,rk,rf)});
  }
  for(const n of Object.keys(data.first[1].bones))metrics.repeatMm=Math.max(metrics.repeatMm,dist(data.first[1].bones[n].p,data.again[1].bones[n].p)*1000);
  // Difference from M39 must vanish on each side of the edited interval.
  const boundaries=data.boundaries.map(({edge,samples})=>({edge,samples:samples.map(({delta,lanes:[b,c]})=>({delta,mm:Math.max(...Object.keys(c.bones).map(n=>dist(c.bones[n].p,b.bones[n].p)*1000)),deg:Math.max(...Object.keys(c.bones).map(n=>angle(c.bones[n].q,b.bones[n].q)))}))}));
  results.push({model,clip:data.clip,seconds:data.seconds,metrics,rows,boundaries});console.log({model,metrics});
 }
 fs.mkdirSync('outputs/cmu-hip-reference',{recursive:true});await open('hip-reference','male');for(const view of ['front','side'])for(const [name,frame] of [['support',43],['recovery',60]]){await page.click('#'+view);await page.evaluate(f=>window.mocapReview.seek(f),frame);await page.locator('#view canvas').screenshot({path:`outputs/cmu-hip-reference/${view}-${name}.png`});}
 await open('hip-reference','male');assert.match(await page.textContent('#source-label'),/50%/);assert.match(await page.textContent('#target-label'),/고관절/);await page.click('#play');await page.waitForFunction(()=>+document.getElementById('phase').value>.3);await page.click('#play');const paused=await page.inputValue('#phase');await page.waitForTimeout(150);assert.equal(await page.inputValue('#phase'),paused);await page.click('#side');await page.click('#front');await page.click('#play');await page.waitForFunction(()=>document.getElementById('play').textContent==='처음부터 재생');await page.click('#play');await page.waitForFunction(()=>+document.getElementById('phase').value<.5);
 const hashes=Object.fromEntries(['stance-chain.js','landing-width-comparison.js','mocap.js'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+n)).digest('hex')]));
 fs.writeFileSync('docs/05-validation/reports/cmu-hip-reference.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M40 fixed reference pelvis, right support only; not a physical validation',hashes,results,errors},null,2));
 assert.deepEqual(errors,[]);for(const r of results){const m=r.metrics;assert.equal(r.clip,'35_17');for(const key of ['pelvisMm','leftWorldMm','outsideMm','lengthMm','baselineRegressionMm','repeatMm'])assert(m[key]<.01,key);for(const key of ['pelvisDeg','leftLocalDeg','outsideDeg','footDeg'])assert(m[key]<.01,key);for(const key of ['targetMm','fullAlignmentMm','footYZMm'])assert(m[key]<.1,key);assert(m.fullKneePlaneMm<1);assert(m.groundGapMm<1);assert(m.penetrationMm<1);for(const b of r.boundaries){const inside=b.samples.filter(s=>b.edge===.28?s.delta>0:s.delta<0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));assert(b.samples.find(s=>s.delta===0).mm<.01);assert(b.samples.find(s=>s.delta===0).deg<.01);assert(inside[2].deg<.001);assert(inside[1].deg/Math.abs(inside[1].delta)<inside[0].deg/Math.abs(inside[0].delta)*.6);assert(inside[2].mm<.001);assert(inside[1].mm/Math.abs(inside[1].delta)<inside[0].mm/Math.abs(inside[0].delta)*.6);}}
 console.log('PASS: 730 candidate poses + 730 independent reference poses; fixed pelvis, right target, knee plane, recovery, M39 baseline and playback');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
