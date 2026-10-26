const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{const p=await b.newPage({viewport:{width:1280,height:940}}),errors=[],results=[];p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
for(const model of ['male','female']){
await p.goto('http://127.0.0.1:5173/review/mocap.html?compare=swing-approach');await p.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});await p.selectOption('#model',model);await p.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
const data=await p.evaluate(async()=>{
const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);
const plans=a.comparison.contactPlans;
function snapshot(){return a.comparison.lanes.map(l=>({bones:Object.fromEntries(l.bones.map(b=>[b.name,{p:l.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).normalize().toArray()}])),feet:Object.fromEntries(l.contactPlans.map(plan=>[plan.window.side,{patch:l.group.worldToLocal(plan.patch.read()).toArray(),floor:l.readSurface(plan.window.side).min}]))}));}
const rows=[];for(let i=0;i<=364;i++){a.seek(i/364*a.cycle.period);rows.push({phase:i/364,active:plans.map(p=>!!p.swing.at(i/364)),lanes:snapshot()});}
const approach=[];for(const plan of plans){const s=plan.swing,rows=[];for(let i=0;i<=100;i++){const phase=s.start+(s.end-s.start)*i/100;a.seek((phase%1)*a.cycle.period);rows.push({phase,lanes:snapshot()});}approach.push({side:s.side,start:s.start,end:s.end,entryX:s.entryX,targetX:s.targetX,kneeStart:s.kneeStart,kneeTarget:s.kneeTarget,rows});}
const boundaries=[];for(const plan of plans)for(const t of [plan.swing.start,plan.swing.kneeStart,plan.swing.end]){const samples=[];for(const d of [-.0002,-.0001,0,.0001,.0002]){a.seek(((t+d)%1)*a.cycle.period);samples.push({d,lanes:snapshot()});}boundaries.push({phase:t,side:plan.window.side,samples});}
a.seek(.16*a.cycle.period);const first=snapshot();a.seek(.6*a.cycle.period);a.seek(.16*a.cycle.period);const repeat=snapshot();a.comparison.view(true);a.seek(.16*a.cycle.period);const side=snapshot();a.comparison.view(false);a.seek(.16*a.cycle.period);
return {rows,approach,boundaries,first,repeat,side,seconds:a.cycle.seconds};});
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const metrics={pelvisMm:0,upperMm:0,stanceAndOutsideMm:0,ankleZmm:0,floorMm:0,boneLengthMm:0,minReachMm:Infinity,repeatMm:0,viewMm:0,baselineMm:0,boundarySecondMm:0,approach:[]};
const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-stance-contact.json','utf8')).results.find(m=>m.model===model);
for(const row of data.rows){const [B,C]=row.lanes.map(l=>l.bones);metrics.pelvisMm=Math.max(metrics.pelvisMm,dist(B.pelvis.p,C.pelvis.p)*1000);
for(const n of Object.keys(B))if(!/^(thigh|calf|foot|ball)_[lr]$/.test(n))metrics.upperMm=Math.max(metrics.upperMm,dist(B[n].p,C[n].p)*1000);
for(const [j,s] of ['r','l'].entries()){const H='thigh_'+s,K='calf_'+s,F='foot_'+s;metrics.ankleZmm=Math.max(metrics.ankleZmm,Math.abs(B[F].p[2]-C[F].p[2])*1000);metrics.floorMm=Math.max(metrics.floorMm,Math.abs(row.lanes[0].feet[s].floor-row.lanes[1].feet[s].floor)*1000);for(const [x,y] of [[H,K],[K,F]])metrics.boneLengthMm=Math.max(metrics.boneLengthMm,Math.abs(dist(B[x].p,B[y].p)-dist(C[x].p,C[y].p))*1000);metrics.minReachMm=Math.min(metrics.minReachMm,(dist(C[H].p,C[K].p)+dist(C[K].p,C[F].p)-dist(C[H].p,C[F].p))*1000);if(!row.active[j])for(const n of [H,K,F,'ball_'+s])metrics.stanceAndOutsideMm=Math.max(metrics.stanceAndOutsideMm,dist(B[n].p,C[n].p)*1000);}
const prior=old.rows.find(r=>Math.abs(r.phase-row.phase)<1e-9);if(prior)for(const n of Object.keys(prior.lanes[1].bones))metrics.baselineMm=Math.max(metrics.baselineMm,dist(B[n].p,prior.lanes[1].bones[n].p)*1000);
}
// Compare each complete airborne approach in unwrapped travel coordinates.
const travel=data.rows.at(-1).lanes[0].bones.pelvis.p[0]-data.rows[0].lanes[0].bones.pelvis.p[0];
for(const app of data.approach){const side=app.side,sign=side==='r'?-1:1;const lanes=[0,1].map(lane=>{
const xs=app.rows.map(r=>r.lanes[lane].feet[side].patch[0]+Math.floor(r.phase)*travel),knees=app.rows.map(r=>r.lanes[lane].bones['calf_'+side].p[0]+Math.floor(r.phase)*travel);
const inward=values=>Math.max(0,...values.map(v=>(app.targetX-v)*sign))*1000;
const reversal=values=>values.slice(1).reduce((sum,v,i)=>sum+Math.max(0,(v-values[i])*sign),0)*1000;
const late=app.rows.map((r,i)=>r.phase>=app.kneeStart?knees[i]:null).filter(v=>v!==null);return {inwardBeyondLandingMm:inward(xs),outwardReversalMm:reversal(xs),kneeOutwardReversalMm:reversal(knees),lateKneeOutwardReversalMm:reversal(late),kneeInwardBeyondLandingMm:Math.max(0,...late.map(v=>(app.kneeTarget-v)*sign))*1000,x:xs,kneeX:knees};});metrics.approach.push({side,start:app.start,end:app.end,lanes});}
for(const {samples} of data.boundaries){const lo=samples[1].lanes[1].bones,at=samples[2].lanes[1].bones,hi=samples[3].lanes[1].bones;for(const n of Object.keys(at))metrics.boundarySecondMm=Math.max(metrics.boundarySecondMm,Math.hypot(...at[n].p.map((v,j)=>lo[n].p[j]+hi[n].p[j]-2*v))*1000);}
for(const n of Object.keys(data.first[1].bones)){metrics.repeatMm=Math.max(metrics.repeatMm,dist(data.first[1].bones[n].p,data.repeat[1].bones[n].p)*1000);metrics.viewMm=Math.max(metrics.viewMm,dist(data.first[1].bones[n].p,data.side[1].bones[n].p)*1000);}
const compact=r=>({phase:r.phase,lanes:r.lanes.map(l=>({...l,bones:Object.fromEntries(Object.entries(l.bones).filter(([n])=>/^(pelvis|(thigh|calf|foot|ball)_[lr])$/.test(n)))}))});
results.push({model,metrics,rows:data.rows.map(compact),approach:data.approach.map(a=>({...a,rows:a.rows.map(compact)}))});console.log(model,JSON.stringify(metrics,(k,v)=>['x','kneeX'].includes(k)?undefined:v));
fs.mkdirSync('outputs/cmu-swing-approach',{recursive:true});for(const view of ['front','side']){await p.click('#'+view);for(const phase of [.08,.16,.24,.28,.55,.63,.71,.75]){await p.evaluate(phase=>window.mocapReview.seek(phase*window.mocapReview.cycle.period),phase);await p.locator('#view canvas').screenshot({path:`outputs/cmu-swing-approach/${model}-${view}-${Math.round(phase*100)}.png`});}}
}
const hashes=Object.fromEntries(['swing-approach.js','stance-chain.js','stance-contact.js','landing-width-comparison.js','mocap.js'].map(n=>[n,require('crypto').createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+n)).digest('hex')]));
fs.writeFileSync('docs/05-validation/reports/cmu-swing-approach.json',JSON.stringify({testedAt:new Date().toISOString(),hashes,errors,results},null,2));assert.deepEqual(errors,[]);for(const {metrics:m} of results){for(const k of ['pelvisMm','upperMm','stanceAndOutsideMm','ankleZmm','boneLengthMm','baselineMm','repeatMm','viewMm'])assert(m[k]<.01,k);assert(m.floorMm<.1);assert(m.minReachMm>0);assert(m.boundarySecondMm<.05);for(const a of m.approach){assert(a.lanes[1].inwardBeyondLandingMm<.1);assert(a.lanes[1].outwardReversalMm<.1);assert(a.lanes[1].lateKneeOutwardReversalMm<.1);assert(a.lanes[1].kneeInwardBeyondLandingMm<.1);}}
console.log('PASS: both feet/models; fixed approach path, knee reversal reduction, M47 stance and pelvis preserved, continuity and baseline');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
