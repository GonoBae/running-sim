// Verify the documentation data and its link to the unmodified application source.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const read=f=>JSON.parse(fs.readFileSync('docs/05-validation/reports/'+f));
const r=read('gait-reference-ab01.json'),c=read('gait-current.json'),s=read('gait-comparison-summary.json');
const checks=[];
const check=(name,fn)=>{fn();checks.push({name,passed:true});};
check('Reference condition and side are explicit',()=>{assert.equal(r.participant,'AB01');assert.equal(r.condition,'Run/s2x0/i0');assert.equal(r.side,'left');});
check('35 left cycles agree with event metadata',()=>{assert.equal(r.strideCount,35);assert.equal(r.events.filter(e=>e[3]===1).length,35);assert.equal(r.strideTimesSeconds.length,35);});
check('Reference curves have 150 finite values and nonnegative SD',()=>{for(const v of Object.values(r.mean)){assert.equal(v.length,150);assert(v.every(Number.isFinite));}for(const v of Object.values(r.std)){assert.equal(v.length,150);assert(v.every(x=>Number.isFinite(x)&&x>=0));}});
check('First-stride markers are finite and visible',()=>{for(const v of Object.values(r.markersFirstLeftStride)){assert.equal(v.length,4);for(const a of v){assert.equal(a.length,150);assert(a.every(Number.isFinite));}assert(v[3].every(x=>x===1));}});
check('Current frames have 150 finite measurements',()=>{assert.equal(c.frames.length,150);for(const f of c.frames)for(const k of ['phase','thighAbsolute','knee','footPitch'])assert(Number.isFinite(f[k]));});
check('Summary peak values are computed from supplied curves',()=>{for(const [key,ref] of [['knee','KneeAngles'],['thighAbsolute','ThighAbsolute']]){assert.equal(s[key].referencePeakDeg,Math.max(...r.mean[ref]));assert.equal(s[key].currentPeakDeg,Math.max(...c.frames.map(f=>f[key])));}});
check('Application source hashes still match documentation capture',()=>{for(const [file,hash] of Object.entries(c.sourceHashes)){assert.equal(crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/src/'+file)).digest('hex'),hash);}});
check('Comparison drawings and design document exist',()=>{for(const file of ['docs/04-technical/RUNNING_COMPARISON.md','docs/assets/images/gait-comparison-curves.png','docs/assets/images/gait-comparison-frames.png','docs/assets/diagrams/gait-angle-reference.svg','docs/assets/diagrams/gait-improvement-plan.svg'])assert(fs.statSync(file).size>0);});
const report={checkedAt:new Date().toISOString(),scope:'Documentation consistency only; no new motion implementation or biomechanical validation',passed:checks.length,checks};
fs.writeFileSync('docs/05-validation/reports/gait-comparison-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
