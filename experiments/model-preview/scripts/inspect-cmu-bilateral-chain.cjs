// Read-only stage tracing. Hooks are inserted into responses in an isolated
// browser; repository runtime files and the user's browser are never changed.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='experiments/model-preview/review/',out='outputs/cmu-bilateral-chain-audit';fs.mkdirSync(out,{recursive:true});
const names=['mocap.js','landing-width-comparison.js','stance-chain.js','stance-contact.js','swing-approach.js','left-ankle-direction.js','ankle-relative.js','ground-contact.js'];
const hashes=()=>Object.fromEntries(names.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(root+n)).digest('hex')]));
const beforeHashes=hashes();
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:940}}),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/review/landing-width-comparison.js*',async route=>{
  const response=await route.fetch();let body=await response.text();
  const hook=stage=>`\n    if(i===1)window.auditTrace?.('${stage}',lane);\n`;
  for(const [needle,stage] of [
   ['   if(chainPose||chainMotion){','travel'],
   ['    if(result)result.side=activeSide;','chain'],
   ['    if(pivotRelease&&(i>0||releaseRefinement)','plant'],
   ['    if(releaseRefinement&&(i>0||foreAftRelease)','pivot'],
   ['    if(foreAftRelease&&(i>0||stanceContact)','refinement'],
   ['    if(stanceContact&&(i>0||swingApproach)','foreAft'],
   ['    if(swingApproach&&(i>0||leftAnkleDirection)','contact'],
   ['    if(leftAnkleDirection&&i>0&&ankleDirectionPlan)','approach'],
   ['    diagnostics.push(result);','direction'],
  ]){assert(body.includes(needle),needle);body=body.replace(needle,hook(stage)+needle);}
  await route.fulfill({response,body});
 });
 await page.route('**/review/mocap.js*',async route=>{
  const response=await route.fetch();let body=await response.text();
  const needle=" if(!raw&&looping()&&$('ankle-relative').checked){";assert(body.includes(needle));
  body=body.replace(needle," window.auditTrace?.('mapped',{model,bones,group:modelGroup});\n"+needle);
  const next=" if(!raw&&looping()&&stancePlan&&$('stance-width').checked)";assert(body.includes(next));
  body=body.replace(next," window.auditTrace?.('relative',{model,bones,group:modelGroup});\n"+next);
  await route.fulfill({response,body});
 });
 for(const model of ['male','female']){
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=left-ankle-direction');await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
  if(model==='female'){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});}
  const data=await page.evaluate(async model=>{
   const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),a=window.mocapReview;
   a.renderer.setAnimationLoop(null);
   const rest=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;rest.updateMatrixWorld(true);
   const pos=b=>b.getWorldPosition(new T.Vector3()),quat=b=>b.getWorldQuaternion(new T.Quaternion()).normalize(),specs={};
   const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*q)];};
   for(const side of ['r','l']){
    const foot=rest.getObjectByName('foot_'+side),toe=rest.getObjectByName('ball_'+side),forward=pos(toe).sub(pos(foot)).normalize(),lateral=new T.Vector3(0,1,0).cross(forward).normalize(),inv=quat(foot).invert();
    const vertices=[];rest.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const {skinIndex,skinWeight}=mesh.geometry.attributes;
     for(let id=0;id<skinIndex.count;id++){let w=0;for(let k=0;k<4;k++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(id,k)].name))w+=skinWeight.getComponent(id,k);if(w>.5){const p=mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld);vertices.push({mesh:mesh.name,id,p:p.toArray()});}}
    });
    const minY=Math.min(...vertices.map(v=>v.p[1])),sole=vertices.filter(v=>v.p[1]<minY+.012);
    const zlo=quantile(sole.map(v=>v.p[2]),.2),zhi=quantile(sole.map(v=>v.p[2]),.8),xlo=quantile(sole.map(v=>v.p[0]),.2),xhi=quantile(sole.map(v=>v.p[0]),.8);
    specs[side]={forward:forward.applyQuaternion(inv),lateral:lateral.applyQuaternion(inv),vertices,sole,heel:sole.filter(v=>v.p[2]<=zlo),toe:sole.filter(v=>v.p[2]>=zhi),negativeX:sole.filter(v=>v.p[0]<=xlo),positiveX:sole.filter(v=>v.p[0]>=xhi)};
   }
   let stages={};
   window.auditTrace=(name,lane)=>{
    const by=n=>lane.bones.find(b=>b.name===n),point=n=>lane.group.worldToLocal(pos(by(n))),bones=Object.fromEntries(['pelvis','thigh_r','calf_r','foot_r','ball_r','thigh_l','calf_l','foot_l','ball_l'].map(n=>[n,{p:point(n).toArray(),q:quat(by(n)).toArray()}]));
    const hipMid=point('thigh_r').add(point('thigh_l')).multiplyScalar(.5),pelvis=bones.pelvis.p;
    const feet={};
    for(const side of ['r','l']){
     const spec=specs[side],footQ=quat(by('foot_'+side)),f=spec.forward.clone().applyQuaternion(footQ),lat=spec.lateral.clone().applyQuaternion(footQ);
     const points=new Map();for(const v of spec.vertices){const mesh=lane.model.getObjectByName(v.mesh);mesh.skeleton.update();points.set(v.mesh+':'+v.id,lane.group.worldToLocal(mesh.getVertexPosition(v.id,new T.Vector3()).applyMatrix4(mesh.matrixWorld)));}
     const read=list=>{const ps=list.map(v=>points.get(v.mesh+':'+v.id)),mean=ps.reduce((s,p)=>s.add(p),new T.Vector3()).divideScalar(ps.length);return {mean:mean.toArray(),minY:Math.min(...ps.map(p=>p.y))};};
     const heel=read(spec.heel),toe=read(spec.toe),minus=read(spec.negativeX),plus=read(spec.positiveX),skinForward=new T.Vector3(...toe.mean).sub(new T.Vector3(...heel.mean)),skinLateral=new T.Vector3(...plus.mean).sub(new T.Vector3(...minus.mean));
     const H=point('thigh_'+side),K=point('calf_'+side),F=point('foot_'+side),flex=180-H.clone().sub(K).angleTo(F.clone().sub(K))*180/Math.PI;
     feet[side]={kneeFlex: flex,axisYaw:Math.atan2(f.x,f.z)*180/Math.PI,axisPitch:Math.atan2(f.y,Math.hypot(f.x,f.z))*180/Math.PI,axisTilt:Math.atan2(lat.y,Math.hypot(lat.x,lat.z))*180/Math.PI,
      skinYaw:Math.atan2(skinForward.x,skinForward.z)*180/Math.PI,skinPitch:Math.atan2(skinForward.y,Math.hypot(skinForward.x,skinForward.z))*180/Math.PI,skinTilt:Math.atan2(skinLateral.y,Math.hypot(skinLateral.x,skinLateral.z))*180/Math.PI,
      heel,toe,minus,plus,minY:Math.min(...points.values().map(p=>p.y)),ankleHeight:F.y,relativeQ:quat(by('calf_'+side)).invert().multiply(footQ).toArray()};
    }
    stages[name]={bones,pelvis,hipMid:hipMid.toArray(),feet};
   };
   const source=()=>{
    const f=a.sampledFrame,ids=a.clip.names;
    const p=n=>new T.Vector3(...f.p[ids.indexOf(n)]).applyQuaternion(a.heading).multiplyScalar(a.scale);
    return Object.fromEntries(['r','l'].map(s=>{const H=p(s+'hipjoint'),K=p(s+'femur'),A=p(s+'tibia'),B=p(s+'foot'),v=B.clone().sub(A);return [s,{hip:H.toArray(),knee:K.toArray(),ankle:A.toArray(),ball:B.toArray(),kneeFlex:180-H.sub(K).angleTo(A.clone().sub(K))*180/Math.PI,yaw:Math.atan2(v.x,v.z)*180/Math.PI,pitch:Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI}];}));
   };
   const sample=phase=>{stages={};a.seek(phase*a.cycle.period);return {phase,stages,source:source(),diagnostic:structuredClone(a.comparison.diagnostics[1])};};
   const rows=Array.from({length:92},(_,i)=>sample(i/91));
   const paired=[];for(const u of [-.2,0,.25,.5,.75,1])for(const side of ['r','l']){const phase=((side==='r'?.28+.30*u:.75+.34*u)%1+1)%1;paired.push({u,side,...sample(phase)});}
   window.auditTrace=null;
   return {rows,paired,patchDefinition:Object.fromEntries(Object.entries(specs).map(([s,v])=>[s,Object.fromEntries(['sole','heel','toe','negativeX','positiveX'].map(k=>[k,v[k].map(({mesh,id})=>({mesh,id}))]))]))};
  },model);
  const old=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-left-ankle-direction.json')).results.find(r=>r.model===model);
  let finalErrorMm=0;for(const row of data.rows){const original=old.rows.find(r=>Math.abs(r.phase-row.phase)<1e-8).lanes[1];for(const [n,b]of Object.entries(row.stages.direction.bones))finalErrorMm=Math.max(finalErrorMm,Math.hypot(...b.p.map((x,i)=>x-original.bones[n].p[i]))*1000);}
  assert(finalErrorMm<.01,'observer changed pose');results.push({model,finalErrorMm,...data});
  console.log(model,'stage samples',data.rows.length+data.paired.length,'final pose error mm',finalErrorMm);
  for(const view of ['front','side'])for(const [side,phase]of [['r',.28],['l',.75],['r-mid',.43],['l-mid',.92]]){
   await page.click('#'+view);await page.evaluate(p=>window.mocapReview.seek(p*window.mocapReview.cycle.period),phase);await page.locator('#view canvas').screenshot({path:`${out}/${model}-${side}-${view}.png`});
  }
 }
 assert.deepEqual(hashes(),beforeHashes);assert.deepEqual(errors,[]);
 fs.writeFileSync('docs/05-validation/reports/cmu-bilateral-chain-audit.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'read-only response observer; current M50 preserved; authored support phases, not force measurements',hashes:beforeHashes,errors,results},null,2));
 console.log('PASS: trace is pose-neutral and runtime files unchanged');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
