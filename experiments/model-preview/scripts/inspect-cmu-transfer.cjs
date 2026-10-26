// M31 read-only stage audit. App source, models and correction defaults are never written.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const files=['mocap.js','mocap.html','cyclic-motion.js','ground-contact.js','ankle-relative.js','ankle-weights.js','stance-width.js','root-travel.js','travel-comparison.js','data/cmu.json'].map(n=>'experiments/model-preview/review/'+n);
files.push(...['male','female'].map(s=>'experiments/model-preview/public/models/runner-'+s+'.glb'));
const hash=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
(async()=>{const before=hash(),browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const results=[],errors=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
 for(const model of ['male','female']){
  await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
  for(const stage of ['raw-transfer','loop-transfer','loop-ankle','loop-skin','current']){
   const result=await page.evaluate(async stage=>{
    const T=await import('/node_modules/three/build/three.module.js');const {sourceRootTravel}=await import('/review/root-travel.js');
    const a=window.mocapReview,$=id=>document.getElementById(id);a.renderer.setAnimationLoop(null);
    const raw=stage==='raw-transfer';$('mode').value=raw?'raw':'loop';
    $('stance-width').checked=false;$('arm-spacing').checked=stage==='current';$('grounding').checked=stage==='current';
    $('ankle-relative').checked=['loop-ankle','loop-skin','current'].includes(stage);$('ankle-weights').checked=['loop-skin','current'].includes(stage);
    $('mode').onchange();
    const by=n=>a.bones.find(b=>b.name===n),p=n=>by(n).getWorldPosition(new T.Vector3());
    const surfaceGroups=[];a.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight}=mesh.geometry.attributes,ids={l:[],r:[]};for(let i=0;i<skinIndex.count;i++)for(const s of ['l','r']){let w=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${s}$`).test(mesh.skeleton.bones[skinIndex.getComponent(i,j)].name))w+=skinWeight.getComponent(i,j);if(w>.15)ids[s].push(i);}surfaceGroups.push({mesh,ids});});
    const angle=(v,w)=>T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(v.clone().normalize().dot(w.clone().normalize()),-1,1)));
    const rows=[];
    for(let f=0;f<(raw?a.clip.frames.length:a.cycle.period);f++){
     a.seek(f);const pelvis=p('pelvis'),source=a.points.map(v=>new T.Vector3(...v).multiplyScalar(a.scale));const sp=n=>source[a.clip.names.indexOf(n)],sr=source[0];
     const sn={root:'root',lh:'lhipjoint',lk:'lfemur',la:'ltibia',lb:'lfoot',rh:'rhipjoint',rk:'rfemur',ra:'rtibia',rb:'rfoot'};
     const tn={root:'pelvis',lh:'thigh_l',lk:'calf_l',la:'foot_l',lb:'ball_l',rh:'thigh_r',rk:'calf_r',ra:'foot_r',rb:'ball_r'};
     const S=Object.fromEntries(Object.entries(sn).map(([k,n])=>[k,sp(n).clone().sub(sr)])),P=Object.fromEntries(Object.entries(tn).map(([k,n])=>[k,p(n).sub(pelvis)]));
     const expected=a.heading.clone().multiply(new T.Quaternion(...a.sampledFrame.q[0])).multiply(a.mapping[0].rest);
     const orientationError=T.MathUtils.radToDeg(expected.normalize().angleTo(by('pelvis').getWorldQuaternion(new T.Quaternion()).normalize()));
     const directional={},decomposition={};for(const s of ['l','r']){
      directional[s]={thigh:angle(P[s+'k'].clone().sub(P[s+'h']),S[s+'k'].clone().sub(S[s+'h'])),calf:angle(P[s+'a'].clone().sub(P[s+'k']),S[s+'a'].clone().sub(S[s+'k'])),foot:angle(P[s+'b'].clone().sub(P[s+'a']),S[s+'b'].clone().sub(S[s+'a']))};
      const hip=P[s+'h'].clone().sub(S[s+'h']),thigh=P[s+'k'].clone().sub(P[s+'h']).sub(S[s+'k'].clone().sub(S[s+'h'])),calf=P[s+'a'].clone().sub(P[s+'k']).sub(S[s+'a'].clone().sub(S[s+'k']));
      const lengthPrediction=S[s+'k'].clone().sub(S[s+'h']).normalize().multiplyScalar(P[s+'k'].distanceTo(P[s+'h'])-S[s+'k'].distanceTo(S[s+'h'])).add(S[s+'a'].clone().sub(S[s+'k']).normalize().multiplyScalar(P[s+'a'].distanceTo(P[s+'k'])-S[s+'a'].distanceTo(S[s+'k']))).add(hip);
      decomposition[s]={hip:hip.toArray(),thigh:thigh.toArray(),calf:calf.toArray(),ankle:P[s+'a'].clone().sub(S[s+'a']).toArray(),lengthPredictionResidualMm:lengthPrediction.distanceTo(P[s+'a'].clone().sub(S[s+'a']))*1000};
     }
     const surfaces={l:[],r:[]};for(const {mesh,ids} of surfaceGroups){mesh.skeleton.update();for(const s of ['l','r'])for(const i of ids[s])surfaces[s].push(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));}
     const soles={};for(const s of ['l','r']){const min=Math.min(...surfaces[s].map(v=>v.y)),band=surfaces[s].filter(v=>v.y<=min+.001),mean=band.reduce((sum,v)=>sum.add(v),new T.Vector3()).divideScalar(band.length);soles[s]={minY:min,lowestBandCenter:mean.sub(pelvis).toArray(),count:band.length};}
     const hipAxisS=S.lh.clone().sub(S.rh),hipAxisT=P.lh.clone().sub(P.rh);
     const rawIndex=raw?f:a.cycle.start+f,rawRoot=new T.Vector3(...a.clip.frames[rawIndex].p[0]).applyQuaternion(a.heading).multiplyScalar(a.scale);
     const targetRoot=a.model.parent.worldToLocal(pelvis.clone());
     rows.push({f,amcFrame:rawIndex+1,phase:raw?null:f/a.cycle.period,source:Object.fromEntries(Object.entries(S).map(([k,v])=>[k,v.toArray()])),target:Object.fromEntries(Object.entries(P).map(([k,v])=>[k,v.toArray()])),rootSource:sr.toArray(),rootRaw:rawRoot.toArray(),rootTarget:targetRoot.toArray(),travel:raw?null:sourceRootTravel(a.clip,a.cycle,f,a.heading,a.scale).toArray(),orientationError,directional,pelvisAxisError:angle(hipAxisS,hipAxisT),sourceHipRoll:Math.atan2(hipAxisS.y,hipAxisS.x)*180/Math.PI,targetHipRoll:Math.atan2(hipAxisT.y,hipAxisT.x)*180/Math.PI,decomposition,soles,contact:a.contact});
    }
    return {stage,clip:a.clip.id,scale:a.scale,cycle:{start:a.cycle.start,period:a.cycle.period},rows};
   },stage);
   assert.equal(result.clip,'35_17');assert.equal(result.rows.length,stage==='raw-transfer'?167:91);for(const row of result.rows){assert(row.orientationError<.001);for(const s of ['l','r']){assert(row.directional[s].thigh<.001);assert(row.directional[s].calf<.001);assert(row.decomposition[s].lengthPredictionResidualMm<.001);}}
   results.push({model,...result});console.log(model,stage,result.rows.length);
  }
 }
 // Actual current-model capture, same integer keys as the plotted comparisons.
 await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);await page.click('#front');
 fs.mkdirSync('outputs/cmu-transfer',{recursive:true});
 for(const f of [26,39,82])for(const view of ['front','side']){
  await page.evaluate(async({f,view})=>{
   const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);a.seek(f);
   a.scene.getObjectByName('transfer-guide')?.removeFromParent();a.scene.children.filter(o=>o.isGroup&&o!==a.model.parent).forEach(o=>o.visible=false);
   const pos=n=>a.bones.find(b=>b.name===n).getWorldPosition(new T.Vector3()),center=pos('pelvis'),source=a.points.map(v=>new T.Vector3(...v)),root=source[0],sp=n=>source[a.clip.names.indexOf(n)].clone().sub(root).multiplyScalar(a.scale).add(center);
   const guide=new T.Group();guide.name='transfer-guide';for(const s of ['l','r']){const line=new T.Line(new T.BufferGeometry().setFromPoints(['root',s+'hipjoint',s+'femur',s+'tibia',s+'foot'].map(sp)),new T.LineDashedMaterial({color:'#d68a24',depthTest:false,dashSize:.018,gapSize:.01}));line.computeLineDistances();line.renderOrder=5;guide.add(line);}a.scene.add(guide);
   const camera=new T.OrthographicCamera(-1.18*a.camera.aspect,1.18*a.camera.aspect,1.18,-1.18,.01,50);camera.position.set(center.x+(view==='side'?10:0),.90,center.z+(view==='front'?10:0));camera.lookAt(center.x,.90,center.z);a.renderer.render(a.scene,camera);
  },{f,view});
  const rect=await page.locator('#view').boundingBox(),width=400;await page.screenshot({path:`outputs/cmu-transfer/${view}-${f}.png`,clip:{x:rect.x+(rect.width-width)/2,y:rect.y,width,height:rect.height}});
 }
 // Verify the already implemented travel comparison as well, not a hypothetical restoration.
 const restored=[];await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=travel');await page.waitForFunction(()=>window.mocapReview?.ready&&window.mocapReview.comparison);
 for(const model of ['male','female']){
  await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
  const rows=await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview,rows=[];a.renderer.setAnimationLoop(null);for(let f=0;f<a.cycle.period;f++){a.seek(f);const p=n=>a.model.parent.worldToLocal(a.bones.find(b=>b.name===n).getWorldPosition(new T.Vector3()));rows.push({f,root:p('pelvis').toArray(),hipCenter:p('thigh_l').add(p('thigh_r')).multiplyScalar(.5).toArray()});}return rows;});
  const current=results.find(r=>r.model===model&&r.stage==='current').rows;
  const maxRootErrorMm=Math.max(...rows.map((r,i)=>Math.hypot(...r.root.map((v,j)=>v-current[i].rootTarget[j]-current[i].travel[j]))*1000));assert(maxRootErrorMm<.001);
  restored.push({model,rows,maxRootErrorMm});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(hash(),before);
 const report={testedAt:new Date().toISOString(),scope:'M31 read-only 35_17 transfer audit. Fresh isolated headless browser; no changes to user tab, runtime or models. Source scaled by target left leg total length; root anchors aligned only for shape comparisons. Surface lowest-band center is geometric proxy, not measured contact.',hashes:before,results,restored,errors};
 fs.writeFileSync('docs/05-validation/reports/cmu-transfer.json',JSON.stringify(report,null,2));console.log('PASS: stage direction/decomposition assertions, page errors, unchanged hashes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
