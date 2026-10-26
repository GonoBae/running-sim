// Acceptance checks against archived M42 measurements, in addition to geometry.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=n=>JSON.parse(fs.readFileSync('docs/05-validation/reports/'+n+'.json'));
const prior=load('cmu-foot-plant-slip'),current=load('cmu-pivot-release-slip');
for(const r of [current,load('cmu-pivot-release')])for(const [file,hash] of Object.entries(r.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+file)).digest('hex'),hash);
for(const model of current.results){
 const old=prior.results.find(r=>r.model===model.model).lanes[1];
 for(let i=0;i<3;i++){
  const before=model.lanes[0].bands[i],after=model.lanes[1].bands[i];
  for(const key of ['rmsX','rmsZ','rms'])assert(Math.abs(before.summary[key]-old.bands[i].summary[key])<1e-6,'M42 regression');
  const release=b=>{const r=b.rows.filter(r=>r.phase>.46&&r.phase<.58),den=r.reduce((s,r)=>s+r.weight,0);return Object.fromEntries(['rmsX','rmsZ'].map(k=>[k,Math.sqrt(r.reduce((s,r)=>s+r[k]**2*r.weight,0)/den)]));};
  const b=release(before),a=release(after);
  assert(a.rmsZ<b.rmsZ*.7,'release forward slip reduction');assert(a.rmsX<=b.rmsX,'release lateral slip must not worsen');
  console.log(model.model,after.band*1000+'mm',JSON.stringify({before:b,after:a,reductionPercent:100*(1-a.rmsZ/b.rmsZ)}));
 }
}
console.log('PASS: current code hashes, M42 regression, forward release reduction >30% and lateral non-regression at 1/4/8mm');
