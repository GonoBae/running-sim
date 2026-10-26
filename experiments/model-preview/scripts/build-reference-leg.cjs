// Repository root. Derive the small CC0 runtime subset; do not manually edit the generated JSON.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const input='docs/05-validation/reports/gait-reference-ab01.json';
const raw=fs.readFileSync(input),ref=JSON.parse(raw);
assert.equal(ref.participant,'AB01');assert.equal(ref.side,'left');assert.equal(ref.strideCount,35);
const period=[...ref.strideTimesSeconds].sort((a,b)=>a-b)[17]*1000;
const curves={thigh:ref.mean.ThighAbsolute,knee:ref.mean.KneeAngles};
assert(Object.values(curves).every(v=>v.length===150&&v.every(Number.isFinite)));
const result={source:ref.source,license:ref.license,participant:ref.participant,condition:ref.condition,side:ref.side,strideCount:ref.strideCount,periodMs:period,sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),curves};
fs.mkdirSync('experiments/model-preview/src/data',{recursive:true});
fs.writeFileSync('experiments/model-preview/src/data/reference-leg.json',JSON.stringify(result,null,2)+'\n');
console.log('Generated AB01 left-leg reference: 150 samples, '+period+'ms');
