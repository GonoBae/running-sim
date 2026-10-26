const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const angle=(a,b)=>{const sign=a.reduce((s,v,i)=>s+v*b[i],0)<0?-1:1;return 4*Math.asin(Math.min(1,dist(a,b.map(v=>v*sign))/2))*180/Math.PI;};
async function capture(page,raw=false){return page.evaluate(async raw=>{
 const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);
 const lanes=raw?[a.comparison.lanes[0]]:a.comparison.lanes;
 const readers=lanes.map(l=>{const groups=[];l.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;for(let k=0;k<skinIndex.count;k++){let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(k,j)].name))w+=skinWeight.getComponent(k,j);if(w>.15)ids.push(k);}groups.push({mesh,ids});});return ()=>{const pts=[];for(const {mesh,ids} of groups){mesh.skeleton.update();for(const k of ids)pts.push(l.group.worldToLocal(mesh.getVertexPosition(k,new T.Vector3()).applyMatrix4(mesh.matrixWorld)));}const low=Math.min(...pts.map(p=>p.y)),center=new T.Vector3();let sw=0;for(const p of pts){const w=Math.exp((low-p.y)/.001);center.addScaledVector(p,w);sw+=w;}return {center:center.divideScalar(sw).toArray(),low};};});
 function snapshot(){return lanes.map((l,j)=>{const bones=Object.fromEntries(l.bones.map(b=>[b.name,{p:l.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).normalize().toArray(),local:b.quaternion.clone().normalize().toArray()}]));return {bones,skin:readers[j](),pivotTarget:j===1&&a.comparison.diagnostics[j]?.pivot?.active?l.group.worldToLocal(new T.Vector3(...a.comparison.diagnostics[j].pivot.target)).toArray():null,pivot:j===1?l.group.worldToLocal(a.comparison.releasePivot.read()).toArray():null};});}
 const rows=[];for(let f=0;f<=a.cycle.period;f+=.25){a.seek(f);rows.push({frame:f,phase:f/a.cycle.period,lanes:snapshot()});}
 const boundaries=[];for(const edge of [.32,.4,.46,.58]){const samples=[];for(const delta of [-.001,-.0005,-.0001,0,.0001,.0005,.001]){a.seek((edge+delta)*a.cycle.period);samples.push({delta,lanes:snapshot()});}boundaries.push({edge,samples});}
 a.seek(49);const first=snapshot();a.seek(80);a.seek(0);a.seek(49);const again=snapshot();a.comparison.view(true);a.seek(49);const sideSnapshot=snapshot();a.comparison.view(false);a.seek(49);
 a.seek(.4*a.cycle.period);const anchor=snapshot();return {clip:a.clip.id,seconds:a.cycle.seconds,rows,boundaries,first,again,anchor,sideSnapshot};
},raw);}

(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async(model)=>{await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=pivot-release');await page.waitForFunction(()=>window.mocapReview?.ready);await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);};
 const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-foot-plant.json','utf8'));
 for(const model of ['male','female']){
  await open(model);const data=await capture(page),prior=old.results.find(r=>r.model===model),anchor=data.anchor[0],rows=[];
  const m={unchangedMm:0,unchangedDeg:0,outsideMm:0,outsideDeg:0,lengthMm:0,holdAnkleMm:0,holdFootDeg:0,holdSurfaceMm:0,groundGapMm:0,penetrationMm:0,minimumReachMarginMm:Infinity,minKneeDeg:Infinity,maxKneeDeg:0,baselineMm:0,repeatMm:0,viewMm:0,footRotationDeg:0,pivotErrorMm:0,pivotMaxYmm:0};
  for(let i=0;i<data.rows.length;i++){
   const row=data.rows[i],[b,c]=row.lanes,B=b.bones,C=c.bones,active=row.phase>.46&&row.phase<.58,held=row.phase>=.4&&row.phase<=.46;
   for(const n of Object.keys(C)){
    if(!['thigh_r','calf_r','foot_r','ball_r'].includes(n)){m.unchangedMm=Math.max(m.unchangedMm,dist(C[n].p,B[n].p)*1000);m.unchangedDeg=Math.max(m.unchangedDeg,angle(C[n].q,B[n].q));}
    if(!active){m.outsideMm=Math.max(m.outsideMm,dist(C[n].p,B[n].p)*1000);m.outsideDeg=Math.max(m.outsideDeg,angle(C[n].q,B[n].q));}
   }
   m.footRotationDeg=Math.max(m.footRotationDeg,angle(C.foot_r.q,B.foot_r.q),angle(C.ball_r.q,B.ball_r.q));
   if(active){assert(c.pivotTarget);m.pivotErrorMm=Math.max(m.pivotErrorMm,Math.hypot(c.pivot[0]-c.pivotTarget[0],c.pivot[2]-c.pivotTarget[2])*1000);m.pivotMaxYmm=Math.max(m.pivotMaxYmm,c.pivot[1]*1000);}
   const h=C.thigh_r.p,k=C.calf_r.p,f=C.foot_r.p,a=dist(h,k),d=dist(k,f),length=dist(h,f),bend=Math.acos(Math.max(-1,Math.min(1,(length*length-a*a-d*d)/(2*a*d))))*180/Math.PI;
   m.lengthMm=Math.max(m.lengthMm,Math.abs(a-dist(B.thigh_r.p,B.calf_r.p))*1000,Math.abs(d-dist(B.calf_r.p,B.foot_r.p))*1000);
   if(active){m.minimumReachMarginMm=Math.min(m.minimumReachMarginMm,(a+d-length)*1000);m.minKneeDeg=Math.min(m.minKneeDeg,bend);m.maxKneeDeg=Math.max(m.maxKneeDeg,bend);m.groundGapMm=Math.max(m.groundGapMm,Math.abs(c.skin.low)*1000);m.penetrationMm=Math.max(m.penetrationMm,-c.skin.low*1000);}
   if(held){m.holdAnkleMm=Math.max(m.holdAnkleMm,dist(f,anchor.bones.foot_r.p)*1000);m.holdFootDeg=Math.max(m.holdFootDeg,angle(C.foot_r.q,anchor.bones.foot_r.q));m.holdSurfaceMm=Math.max(m.holdSurfaceMm,dist(c.skin.center,anchor.skin.center)*1000);}
   for(const [key,n] of [['hip','thigh_r'],['knee','calf_r'],['ankle','foot_r'],['pelvis','pelvis']])m.baselineMm=Math.max(m.baselineMm,dist(B[n].p,prior.rows[i][key])*1000);
   rows.push({frame:row.frame,phase:row.phase,held,pelvis:C.pelvis.p,hip:h,knee:k,ankle:f,beforeAnkle:B.foot_r.p,surface:c.skin.center,beforeSurface:b.skin.center,kneeDeg:bend,surfaceY:c.skin.low,pivot:c.pivot});
  }
  for(const n of Object.keys(data.first[1].bones))m.repeatMm=Math.max(m.repeatMm,dist(data.first[1].bones[n].p,data.again[1].bones[n].p)*1000);
  for(const n of Object.keys(data.first[1].bones))m.viewMm=Math.max(m.viewMm,dist(data.first[1].bones[n].p,data.sideSnapshot[1].bones[n].p)*1000);
  const boundaries=data.boundaries.map(({edge,samples})=>{const at=samples.find(s=>s.delta===0).lanes[1].bones;return {edge,samples:[.001,.0005,.0001].map(e=>{const lo=samples.find(s=>s.delta===-e).lanes[1].bones,hi=samples.find(s=>s.delta===e).lanes[1].bones;return {epsilon:e,positionSecondDifferenceMm:Math.max(...Object.keys(at).map(n=>Math.hypot(...at[n].p.map((v,j)=>2*v-lo[n].p[j]-hi[n].p[j]))*1000)),angularStepDifferenceDeg:Math.max(...Object.keys(at).map(n=>Math.abs(angle(lo[n].q,at[n].q)-angle(at[n].q,hi[n].q))))};})};});
  results.push({model,clip:data.clip,metrics:m,rows,boundaries});console.log({model,metrics:m,boundaries});
 }
 fs.mkdirSync('outputs/cmu-pivot-release',{recursive:true});await open('male');for(const view of ['front','side'])for(const [name,f] of [['hold',39],['release',49],['recovery',60]]){await page.click('#'+view);await page.evaluate(f=>window.mocapReview.seek(f),f);await page.locator('#view canvas').screenshot({path:`outputs/cmu-pivot-release/${view}-${name}.png`});}
 await open('male');await page.locator('#phase').fill('0.43');await page.locator('#phase').dispatchEvent('input');assert.match(await page.textContent('#contact-status'),/지면 고정/);await page.click('#play');await page.waitForFunction(()=>+document.getElementById('phase').value>.55);await page.click('#play');const paused=await page.inputValue('#phase');await page.waitForTimeout(150);assert.equal(await page.inputValue('#phase'),paused);await page.click('#side');await page.click('#front');await page.click('#play');await page.waitForFunction(()=>document.getElementById('play').textContent==='처음부터 재생');await page.click('#play');await page.waitForFunction(()=>+document.getElementById('phase').value<.5);
 const hashes=Object.fromEntries(['pivot-release.js','stance-chain.js','landing-width-comparison.js','mocap.js'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+n)).digest('hex')]));
 fs.writeFileSync('docs/05-validation/reports/cmu-pivot-release.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M44 right release pivot coupling, M42 pelvis and recovery preserved; geometric validation only',hashes,results,errors},null,2));
 assert.deepEqual(errors,[]);for(const r of results){assert.equal(r.clip,'35_17');const m=r.metrics;for(const k of ['unchangedMm','unchangedDeg','outsideMm','outsideDeg','lengthMm','baselineMm','repeatMm','viewMm'])assert(m[k]<.01,k);assert(m.pivotErrorMm<.1);assert(m.footRotationDeg<.01);assert(m.holdAnkleMm<.1);assert(m.holdFootDeg<.01);assert(m.holdSurfaceMm<.1);assert(m.minimumReachMarginMm>1);assert(m.minKneeDeg>2);assert(m.maxKneeDeg<160);assert(m.groundGapMm<1);assert(m.penetrationMm<1);for(const b of r.boundaries){assert(b.samples[2].positionSecondDifferenceMm<.02);assert(b.samples[2].angularStepDifferenceDeg<.01);assert(b.samples[1].positionSecondDifferenceMm<b.samples[0].positionSecondDifferenceMm*.5);}}
 console.log('PASS: 730 poses; anchor, foot orientation, pelvis/recovery, reach and lengths, four transition boundaries, M42 baseline and playback');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
