// Read-only observer: stage snapshots are injected into a browser response.
// Repository runtime, GLBs, weights and motion settings are never modified.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const measure=require('./measure-landing-sole.cjs');
const out='outputs/cmu-ankle-release';fs.mkdirSync(out,{recursive:true});
const capturesOnly=process.argv.includes('--captures-only');
const report=capturesOnly?JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-ankle-release-audit.json')):{testedAt:new Date().toISOString(),scope:'Read-only M56 ankle release diagnosis; no correction',errors:[],results:[]};
const instrument=source=>{
 const observer=`
 function observe(stage,lane,i){
  if(i!==1||!window.__observeAnkles)return;
  const q=b=>b.getWorldQuaternion(new T.Quaternion()).normalize();
  const bones=Object.fromEntries(lane.bones.filter(b=>/^(pelvis|(thigh|calf|foot|ball)_[rl])$/.test(b.name)).map(b=>[b.name,{p:lane.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:q(b).toArray()}]));
  const relative=Object.fromEntries(['r','l'].map(s=>[s,new T.Quaternion(...bones['calf_'+s].q).invert().multiply(new T.Quaternion(...bones['foot_'+s].q)).normalize().toArray()]));
  window.__ankleStages.push({stage,bones,relative});
 }
`;
 source=source.replace(' function update(frame){',observer+'\n function update(frame){');
 const after=(needle,name)=>{assert(source.includes(needle),needle);source=source.replace(needle,needle+`\n    observe('${name}',lane,i);`);};
 after('const phase=frame/s.cycle.period,activeSide=chainBilateral&&chainMotionWeight(phase,\'l\')>0?\'l\':\'r\';','retarget');
 after('if(foreAftRelease&&(i>0||stanceContact)&&foreAftCurve&&!preparingForeAft&&!preparingPivot&&!preparingPlant){result.foreAft=applyForeAftRelease(lane.model,lane.bones,lane.releasePivot||releasePivot,phase,foreAftCurve,lane.readSurface);}','preContact');
 after('if(stanceContact&&(i>0||swingApproach)&&!preparingContact&&contactPlans.length)result.contact=applyStanceContact(lane,phase,lane.contactPlans,cycleTravelX);','contact');
 after('if(swingApproach&&(i>0||leftAnkleDirection)&&!preparingSwing&&!preparingContact&&contactPlans.length)result.swing=applySwingApproach(lane,phase,lane.contactPlans);','swing');
 after('if(leftAnkleDirection&&(i>0||pelvisReferenceRestore)&&ankleDirectionPlan)result.ankleDirection=applyLeftAnkleDirection(lane,phase,ankleDirectionPlan);','leftDirection');
 after('if(landingSoleAlignment&&(i>0||lateStanceSole)&&ankleDirectionPlan)result.soleAlignment=applyLandingSoleAlignment(lane,phase);','landingSole');
 after('if(lateStanceSole&&(i>0||lateToeTrial||toeSlipPath)&&lateStanceReference)result.lateSole=applyLateStanceSole(lane,phase,lateStanceReference);','lateSole');
 after('if(toeSlipPath&&i>0&&toeSlipPlans)result.toePath=applyToeSlipPath(lane,phase,toeSlipPlans);','toePath');
 return source;
};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:940}});
  await context.route('**/review/landing-width-comparison.js*',async route=>{
   const response=await route.fetch();await route.fulfill({response,body:instrument(await response.text())});
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const model of ['male','female']){
   if(model==='male')await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=toe-slip-path');
   else await page.selectOption('#model','female');
   await page.waitForFunction(()=>window.mocapReview?.ready&&!document.querySelector('.bar').inert,null,{timeout:60000});
   if(!capturesOnly){
   const specs=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json')).results.find(r=>r.model===model).patchDefinition;
   const rows=await page.evaluate(measure,{samples:Array.from({length:365},(_,i)=>i/364),specs});
   console.log(model,'fresh 365 phases observed');
   const stages=await page.evaluate(async()=>{
    const a=window.mocapReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
    window.__observeAnkles=true;const rows=[];
    for(const side of ['r','l'])for(let j=0;j<=120;j++){
     const v=j/120,unwrapped=(side==='r'?.58:1.09)+v*.12,phase=unwrapped%1;
     window.__ankleStages=[];a.seek(phase*a.cycle.period);
     const q=n=>new T.Quaternion(...a.sampledFrame.q[a.clip.names.indexOf(side+n)]);
     const sourceRelative=q('tibia').invert().multiply(q('foot')).normalize().toArray();
     rows.push({side,v,phase,sourceRelative,stages:window.__ankleStages,diagnostics:a.comparison.diagnostics[1]});
    }
    window.__observeAnkles=false;
    return rows;
   });
   // Skin and joints at identical normalized release progress, not same timeline frame.
   const paired=[];for(const side of ['r','l'])for(const v of [0,.25,.5,.75,1])paired.push({side,v,phase:((side==='r'?.58:1.09)+.12*v)%1});
   const pairedRows=await page.evaluate(measure,{samples:paired.map(p=>p.phase),specs});
   const current=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-toe-slip-path.json')).results.find(r=>r.model===model);
   let maxPositionMm=0,maxRotationDeg=0,maxSkinMm=0;
   const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
   const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;
   for(let i=0;i<rows.length;i++)for(let lane=0;lane<2;lane++){
    const a=rows[i].lanes[lane],b=current.rows[i].lanes[lane];
    for(const n of Object.keys(b.bones)){maxPositionMm=Math.max(maxPositionMm,dist(a.bones[n].p,b.bones[n].p)*1000);maxRotationDeg=Math.max(maxRotationDeg,angle(a.bones[n].q,b.bones[n].q));}
    for(const side of ['r','l'])for(const region of Object.keys(b.feet[side].regions))maxSkinMm=Math.max(maxSkinMm,dist(a.feet[side].regions[region],b.feet[side].regions[region])*1000);
   }
   assert(maxPositionMm<.01&&maxSkinMm<.01&&maxRotationDeg<.001,'observer preserves M56');
   report.results.push({model,regression:{maxPositionMm,maxRotationDeg,maxSkinMm},rows:rows.map(r=>({...r,diagnostics:undefined,lanes:r.lanes.map(l=>({...l,bones:Object.fromEntries(Object.entries(l.bones).filter(([n])=>/^(pelvis|(thigh|calf|foot|ball)_[rl])$/.test(n)))}))})),stages,paired:pairedRows.map((r,i)=>({...r,...paired[i]}))});
   }
   for(const side of ['r','l'])for(const v of [.25,.5,.75])for(const view of ['front','side']){
    const image=await page.evaluate(async({side,v,view})=>{
     const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
     a.renderer.setAnimationLoop(null);a.seek((((side==='r'?.58:1.09)+.12*v)%1)*a.cycle.period);
     const lane=a.comparison.lanes[1],by=n=>lane.bones.find(b=>b.name===n+'_'+side),pos=b=>b.getWorldPosition(new T.Vector3());
     const center=pos(by('foot')).add(new T.Vector3(0,-.035,0));
     const line=new T.Line(new T.BufferGeometry().setFromPoints(['calf','foot','ball'].map(n=>pos(by(n)))),new T.LineBasicMaterial({color:side==='r'?'#b96540':'#1687ad',depthTest:false}));line.renderOrder=10;a.scene.add(line);
     a.renderer.setSize(420,480);Object.assign(a.camera,{left:-.23,right:.23,top:.263,bottom:-.263});a.camera.updateProjectionMatrix();
     a.camera.position.copy(center).add(new T.Vector3(view==='side'?10:0,0,view==='front'?10:0));a.camera.lookAt(center);a.renderer.render(a.scene,a.camera);
     const png=a.renderer.domElement.toDataURL('image/png').split(',')[1];line.removeFromParent();line.geometry.dispose();line.material.dispose();return png;
    },{side,v,view});
    fs.writeFileSync(`${out}/${model}-${side}-${v}-${view}.png`,Buffer.from(image,'base64'));
   }
   fs.writeFileSync('docs/05-validation/reports/cmu-ankle-release-audit.json',JSON.stringify(report));
   console.log(model,'stage snapshots and skin images captured',report.results.find(r=>r.model===model).regression);
  }
  assert.deepEqual(report.errors,[]);report.status='observed-no-motion-change';
  report.hashes=Object.fromEntries(['stance-contact.js','left-ankle-direction.js','late-stance-sole.js','toe-slip-path.js','mocap.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
  fs.writeFileSync('docs/05-validation/reports/cmu-ankle-release-audit.json',JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
