const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=n=>JSON.parse(fs.readFileSync('docs/05-validation/reports/'+n+'.json'));
const oldPose=load('cmu-pivot-release'),pose=load('cmu-release-refinement'),oldSlip=load('cmu-pivot-release-slip'),slip=load('cmu-release-refinement-slip');
for(const r of [pose,slip])for(const [f,h] of Object.entries(r.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex'),h);
const results=pose.results.map(m=>{
 const prior=oldPose.results.find(r=>r.model===m.model),measure=slip.results.find(r=>r.model===m.model),old=oldSlip.results.find(r=>r.model===m.model);
 const core=rows=>rows.filter(r=>r.phase>=.47&&r.phase<=.57),height=rows=>({maxMm:Math.max(...rows.map(r=>r.pivot[1]))*1000,meanMm:rows.reduce((s,r)=>s+r.pivot[1],0)/rows.length*1000});
 const before=height(core(prior.rows)),after=height(core(m.rows));assert(after.meanMm<before.meanMm);assert(after.maxMm<before.maxMm);
 const maxLateralChangeMm=Math.max(...m.rows.map((r,i)=>Math.abs(r.pivot[0]-prior.rows[i].pivot[0])*1000));assert(maxLateralChangeMm<=8.01);
 const bands=measure.lanes[0].bands.map((b,i)=>{
  const b2=measure.lanes[1].bands[i];for(const k of ['rmsX','rmsZ'])assert(Math.abs(b.summary[k]-old.lanes[1].bands[i].summary[k])<1e-6);
  const metrics=b=>{const rows=b.rows.filter(r=>r.phase>.46&&r.phase<.58),w=rows.reduce((s,r)=>s+r.weight,0);return {rmsX:Math.sqrt(rows.reduce((s,r)=>s+r.rmsX**2*r.weight,0)/w),rmsZ:Math.sqrt(rows.reduce((s,r)=>s+r.rmsZ**2*r.weight,0)/w),peakX:Math.max(...rows.map(r=>r.rmsX))};};
  const before=metrics(b),after=metrics(b2);assert(after.rmsX<before.rmsX);assert(after.peakX<before.peakX*.9);
  return {bandMm:b.band*1000,before,after};
 });
 return {model:m.model,toeCore47to57:{before,after},maxLateralChangeMm,bands};
});
const report={testedAt:new Date().toISOString(),scope:'M45 acceptance and tradeoffs; core toe height excludes preserved endpoints',hashes:pose.hashes,results};
fs.writeFileSync('docs/05-validation/reports/cmu-release-refinement-summary.json',JSON.stringify(report,null,2));
for(const r of results)console.log(JSON.stringify({...r,bands:r.bands.filter(b=>b.bandMm===4)}));
console.log('PASS: hashes, M44 baseline, lateral cap, lower core toe height, lateral RMS and peaks improved at 1/4/8mm; forward tradeoff reported');
