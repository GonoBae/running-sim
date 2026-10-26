const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=n=>JSON.parse(fs.readFileSync('docs/05-validation/reports/'+n+'.json'));
const oldPose=load('cmu-release-refinement'),pose=load('cmu-fore-aft-release'),oldSlip=load('cmu-release-refinement-slip'),slip=load('cmu-fore-aft-release-slip'),m44=load('cmu-pivot-release-slip');
for(const r of [pose,slip])for(const [f,h] of Object.entries(r.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex'),h);
const results=pose.results.map(m=>{
 const prior=oldPose.results.find(r=>r.model===m.model),current=slip.results.find(r=>r.model===m.model),old=oldSlip.results.find(r=>r.model===m.model),reference=m44.results.find(r=>r.model===m.model);
 const core=rows=>rows.filter(r=>r.phase>=.47&&r.phase<=.57),height=rows=>({maxMm:Math.max(...rows.map(r=>r.pivot[1]))*1000,meanMm:rows.reduce((s,r)=>s+r.pivot[1],0)/rows.length*1000});
 const before=height(core(prior.rows)),after=height(core(m.rows));
 const maxToeHeightDeltaMm=Math.max(...m.rows.map((r,i)=>Math.abs(r.pivot[1]-prior.rows[i].pivot[1])*1000));assert(maxToeHeightDeltaMm<.01);
 const bands=current.lanes[0].bands.map((b,i)=>{
  for(const k of ['rmsX','rmsZ'])assert(Math.abs(b.summary[k]-old.lanes[1].bands[i].summary[k])<1e-6);
  const metrics=b=>{const rows=b.rows.filter(r=>r.phase>.46&&r.phase<.58),w=rows.reduce((s,r)=>s+r.weight,0);return {rmsX:Math.sqrt(rows.reduce((s,r)=>s+r.rmsX**2*r.weight,0)/w),rmsZ:Math.sqrt(rows.reduce((s,r)=>s+r.rmsZ**2*r.weight,0)/w),peakX:Math.max(...rows.map(r=>r.rmsX)),peakZ:Math.max(...rows.map(r=>r.rmsZ))};};
  const before=metrics(b),after=metrics(current.lanes[1].bands[i]),m44=metrics(reference.lanes[1].bands[i]);
  assert(after.rmsZ<before.rmsZ);assert(after.rmsZ<m44.rmsZ);
  assert(after.rmsX<=before.rmsX+.0001);assert(after.peakX<=before.peakX+.0001);
  return {bandMm:b.band*1000,m44,before,after,reductionPercent:100*(1-after.rmsZ/before.rmsZ)};
 });
 return {model:m.model,toeCore47to57:{before,after},maxToeHeightDeltaMm,maxOffsetZmm:m.metrics.maxOffsetZmm,bands};
});
fs.writeFileSync('docs/05-validation/reports/cmu-fore-aft-release-summary.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M46 forward slip reduction; preservation of M45 lateral and toe height improvements',hashes:pose.hashes,results},null,2));
for(const r of results)console.log(JSON.stringify({...r,bands:r.bands.filter(b=>b.bandMm===4)}));
console.log('PASS: code hashes, M45 baseline, fore-aft RMS below M45 and M44 at 1/4/8mm, lateral non-regression, toe height preserved');
