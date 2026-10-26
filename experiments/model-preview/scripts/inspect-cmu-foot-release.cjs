// M43 read-only audit. Reuse same-vertex M42 measurements; do not alter motion.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const folder='docs/05-validation/reports/';
const pose=JSON.parse(fs.readFileSync(folder+'cmu-foot-plant.json'));
const slip=JSON.parse(fs.readFileSync(folder+'cmu-foot-plant-slip.json'));
for(const report of [pose,slip])for(const [name,hash] of Object.entries(report.hashes)){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+name)).digest('hex'),hash,'stale input '+name);
}
const results=slip.results.map(m=>{
 const p=pose.results.find(p=>p.model===m.model),dt=.25/m.fps;
 const lanes=m.lanes.map((lane,index)=>{
  const key=index?'ankle':'beforeAnkle';
  const rows=lane.bands[1].rows.map(r=>{
   const i=p.rows.findIndex(v=>Math.abs(v.frame-r.frame)<1e-9);assert(i>0&&i<p.rows.length-1);
   const ankleZ=(p.rows[i+1][key][2]-p.rows[i-1][key][2])/(2*dt);
   const residualSquared=r.rmsZ**2-2*ankleZ*r.meanZ+ankleZ**2;
   assert(residualSquared> -1e-8);
   return {...r,ankleZ,relativeMeanZ:r.meanZ-ankleZ,relativeRmsZ:Math.sqrt(Math.max(0,residualSquared)),ankle:p.rows[i][key]};
  });
  const release=rows.filter(r=>r.phase>=.46&&r.phase<=.58),peak=release.reduce((a,b)=>a.rmsZ>b.rmsZ?a:b);
  const bands=lane.bands.map(b=>{const s=b.rows.filter(r=>r.phase>=.46&&r.phase<=.58);return {bandMm:b.band*1000,rmsZ:Math.sqrt(s.reduce((v,r)=>v+r.rmsZ**2*r.weight,0)/s.reduce((v,r)=>v+r.weight,0))};});
  return {name:lane.name,peak,bands,releaseMaxMinYmm:Math.max(...release.map(r=>r.minY))*1000,rows};
 });
 return {model:m.model,period:m.period,fps:m.fps,releaseDurationMs:.12*m.period/m.fps*1000,lanes};
});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const errors=[];fs.mkdirSync('outputs/cmu-foot-release',{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=foot-plant');await page.waitForFunction(()=>window.mocapReview?.ready);
  for(const result of results){
   await page.selectOption('#model',result.model);await page.waitForFunction(()=>window.mocapReview.ready);
   result.endpoints=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);
    return [.4,.46,.58,.62].map(phase=>{a.seek(phase*a.cycle.period);return {phase,lanes:a.comparison.lanes.map(l=>({ankle:l.group.worldToLocal(l.bones.find(b=>b.name==='foot_r').getWorldPosition(new T.Vector3())).toArray()}))};});
   });
   const start=result.endpoints[1].lanes[1].ankle,end=result.endpoints[2].lanes[1].ankle;
   result.releaseDisplacementCm=end.map((v,i)=>(v-start[i])*100);
   result.requiredMeanZ=(end[2]-start[2])/(result.releaseDurationMs/1000);
   result.peakDecomposition=await page.evaluate(async peakPhases=>{
    const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
    const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
    return peakPhases.map((phase,index)=>{
     const lane=a.comparison.lanes[index],foot=lane.bones.find(b=>b.name==='foot_r'),groups=[];
     lane.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;for(let k=0;k<skinIndex.count;k++){let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(k,j)].name))w+=skinWeight.getComponent(k,j);if(w>.5)ids.push(k);}groups.push({mesh,ids});});
     function sample(f){a.seek(f);const pts=[];for(const {mesh,ids} of groups){mesh.skeleton.update();for(const id of ids)pts.push(mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld));}return {p:foot.getWorldPosition(new T.Vector3()),q:foot.getWorldQuaternion(new T.Quaternion()).normalize(),pts};}
     const f=phase*a.cycle.period,dt=.25/a.clip.fps,lo=sample(f-.25),at=sample(f),hi=sample(f+.25);
     const qLo=lo.q.clone().multiply(at.q.clone().invert()),qHi=hi.q.clone().multiply(at.q.clone().invert());
     const av=hi.p.clone().sub(lo.p).divideScalar(2*dt);let sw=0,actual=0,rigid=0,remainder=0;
     for(let i=0;i<at.pts.length;i++){
      const p=at.pts[i],w=smooth((.004-Math.max(0,p.y))/.004);if(!w)continue;
      const rel=p.clone().sub(at.p),rv=rel.clone().applyQuaternion(qHi).sub(rel.clone().applyQuaternion(qLo)).divideScalar(2*dt).z;
      const v=(hi.pts[i].z-lo.pts[i].z)/(2*dt);sw+=w;actual+=w*v;rigid+=w*rv;remainder+=w*(v-av.z-rv);
     }
     return {phase,ankleZ:av.z,rigidFootRotationZ:rigid/sw,remainderZ:remainder/sw,actualSkinZ:actual/sw,footAngularSpeedDeg:lo.q.angleTo(hi.q)/(2*dt)*180/Math.PI};
    });
   },result.lanes.map(()=>result.lanes[1].peak.phase));
   result.peakDecomposition.forEach((d,i)=>{
    assert(Math.abs(d.actualSkinZ-d.ankleZ-d.rigidFootRotationZ-d.remainderZ)<1e-8);
    const same=result.lanes[i].rows.find(r=>Math.abs(r.phase-d.phase)<1e-9);
    assert(Math.abs(d.actualSkinZ-same.meanZ)<1e-6);
   });
   if(result.model==='male')for(const view of ['front','side']){
    await page.click('#'+view);
    for(const phase of [.46,.50,.54,.58]){
     await page.evaluate(phase=>window.mocapReview.seek(phase*window.mocapReview.cycle.period),phase);
     await page.locator('#view canvas').screenshot({path:`outputs/cmu-foot-release/${view}-${Math.round(phase*100)}.png`});
    }
   }
  }
 }finally{await browser.close();}
 assert.deepEqual(errors,[]);
 fs.writeFileSync(folder+'cmu-foot-release.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M43 read-only release audit; no motion changes',inputs:['cmu-foot-plant.json','cmu-foot-plant-slip.json'],hashes:slip.hashes,method:'Same material vertex velocity from M42; signed ankle translation removed algebraically from weighted foot velocity. Residual includes rotation, toe motion and skin deformation, not a causal percentage. Ground proximity is not measured contact force.',results,errors},null,2));
 for(const r of results)console.log(JSON.stringify({model:r.model,durationMs:r.releaseDurationMs,displacementCm:r.releaseDisplacementCm,requiredMeanZ:r.requiredMeanZ,decomposition:r.peakDecomposition,lanes:r.lanes.map(l=>({name:l.name,peakPhase:l.peak.phase,skinRmsZ:l.peak.rmsZ,groundMm:l.releaseMaxMinYmm,bands:l.bands}))}));
 console.log('PASS: input hashes, same-time velocity decomposition, exact endpoints, captures, no browser errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
