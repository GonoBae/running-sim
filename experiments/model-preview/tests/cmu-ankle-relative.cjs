const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
  assert(await page.isChecked('#ankle-relative'));await page.uncheck('#grounding');await page.uncheck('#ankle-weights');
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async(model)=>{
     const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
     const a=window.mocapReview,neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;neutral.updateMatrixWorld(true);
     const p=b=>b.getWorldPosition(new T.Vector3()),q=b=>b.getWorldQuaternion(new T.Quaternion()).normalize(),rad=180/Math.PI;
     const sides=['l','r'].map(side=>{const foot=a.bones.find(b=>b.name==='foot_'+side),calf=foot.parent,nc=neutral.getObjectByName(calf.name),nf=neutral.getObjectByName(foot.name),cm=a.mapping.find(m=>m.name===side+'tibia'),fm=a.mapping.find(m=>m.name===side+'foot');return {side,foot,calf,nc,nf,cm,fm,rest:nf.quaternion.clone()};});
     const surfaces=[];
     a.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const g=mesh.geometry,{skinIndex,skinWeight}=g.attributes;
      for(const s of sides){const w=Array.from({length:skinIndex.count},(_,i)=>{let calf=0,foot=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[skinIndex.getComponent(i,j)].name,v=skinWeight.getComponent(i,j);if(name===s.calf.name)calf+=v;if(name===s.foot.name)foot+=v;}return {calf,foot};});
       const triangles=[];for(let i=0;i<(g.index?.count||skinIndex.count);i+=3){const ids=[0,1,2].map(j=>g.index?g.index.getX(i+j):i+j);if(ids.every(k=>w[k].calf+w[k].foot>.95)&&ids.some(k=>w[k].calf>.05&&w[k].foot>.05))triangles.push(ids);}if(triangles.length)surfaces.push({mesh,side:s.side,triangles,ids:[...new Set(triangles.flat())]});
      }
     });
     const readSkin=()=>surfaces.map(s=>{s.mesh.skeleton.update();const v=new Map(s.ids.map(i=>[i,s.mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(s.mesh.matrixWorld)]));return s.triangles.map(ids=>v.get(ids[1]).clone().sub(v.get(ids[0])).cross(v.get(ids[2]).clone().sub(v.get(ids[0]))).length()/2);});
     const percentile=(values,t)=>{values.sort((a,b)=>a-b);return values[Math.floor((values.length-1)*t)];};
     const metrics=(areas,control)=>surfaces.map((s,j)=>{const ratios=areas[j].flatMap((v,k)=>control[j][k]>1e-10?[v/control[j][k]]:[]);return {side:s.side,triangles:ratios.length,min:Math.min(...ratios),p05:percentile(ratios,.05),median:percentile(ratios,.5),p95:percentile(ratios,.95),max:Math.max(...ratios)};});
     const control=()=>{const old=sides.map(s=>s.foot.quaternion.clone());sides.forEach(s=>s.foot.quaternion.copy(s.rest));a.model.updateMatrixWorld(true);const result=readSkin();sides.forEach((s,i)=>s.foot.quaternion.copy(old[i]));a.model.updateMatrixWorld(true);return result;};
     let maxTransferError=0,maxMotionAngleError=0,maxUntouchedPositionError=0,maxUntouchedRotationError=0,maxLengthError=0;
     const trace=[],checkbox=document.getElementById('ankle-relative');
     const euler=delta=>{const e=new T.Euler().setFromQuaternion(delta,'XZY');return [e.x,e.y,e.z].map(v=>v*rad);};
     for(let f=0;f<=a.cycle.period;f+=.5){
      checkbox.checked=false;a.seek(f);const root=p(a.bones.find(b=>b.name==='pelvis')),before=a.bones.map(b=>({p:p(b).sub(root),q:q(b)})),beforeQ=sides.map(s=>s.foot.quaternion.clone()),beforeAreas=readSkin(),neutralAreas=control();
      checkbox.checked=true;a.seek(f);const afterRoot=p(a.bones.find(b=>b.name==='pelvis'));
      for(let i=0;i<a.bones.length;i++){const b=a.bones[i];if(!/^(foot|ball)_[lr]$/.test(b.name))maxUntouchedRotationError=Math.max(maxUntouchedRotationError,q(b).angleTo(before[i].q)*rad);if(!/^ball_[lr]$/.test(b.name))maxUntouchedPositionError=Math.max(maxUntouchedPositionError,p(b).sub(afterRoot).distanceTo(before[i].p));if(b.parent.isBone)maxLengthError=Math.max(maxLengthError,Math.abs(p(b).distanceTo(p(b.parent))-p(neutral.getObjectByName(b.name)).distanceTo(p(neutral.getObjectByName(b.parent.name)))));}
      const angles=sides.map((s,i)=>{
       const source=new T.Quaternion(...a.sampledFrame.q[s.cm.index]).invert().multiply(new T.Quaternion(...a.sampledFrame.q[s.fm.index])).normalize();
       const actual=s.foot.quaternion.clone().multiply(s.rest.clone().invert()).normalize();
       // Check the transferred rotation by transforming three independent basis vectors.
       for(const axis of [new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)]){const expected=axis.clone().applyQuaternion(s.cm.rest).applyQuaternion(source).applyQuaternion(s.cm.rest.clone().invert());maxTransferError=Math.max(maxTransferError,expected.angleTo(axis.clone().applyQuaternion(actual))*rad);}
       maxMotionAngleError=Math.max(maxMotionAngleError,Math.abs(source.angleTo(new T.Quaternion())-actual.angleTo(new T.Quaternion()))*rad);
       const inNeutralWorld=d=>q(s.nc).multiply(d).multiply(q(s.nc).invert());
       const ref=s.cm.rest.clone().invert().multiply(source).multiply(s.cm.rest);
       return {side:s.side,source:euler(inNeutralWorld(ref)),before:euler(inNeutralWorld(beforeQ[i].clone().multiply(s.rest.clone().invert()))),after:euler(inNeutralWorld(actual))};
      });
      trace.push({phase:f/a.cycle.period,angles,beforeSkin:metrics(beforeAreas,neutralAreas),afterSkin:metrics(readSkin(),neutralAreas)});
     }
     const {retargetAnkle}=await import('/review/ankle-relative.js');
     const neutralBias=sides.map(s=>({side:s.side,beforeDegrees:s.cm.rest.clone().invert().multiply(s.fm.rest).normalize().angleTo(s.rest.clone().normalize())*rad,afterDegrees:retargetAnkle(new T.Quaternion(),new T.Quaternion(),s.cm.rest,s.rest).angleTo(s.rest.clone().normalize())*rad}));
     const at=f=>{a.seek(f);return a.bones.map(b=>p(b));},h=1e-4,step=h/a.clip.fps,m=at(-h),z=at(0),n=at(h),end=at(a.cycle.period);
     const seamPosition=Math.max(...z.map((v,i)=>v.distanceTo(end[i]))),seamVelocity=Math.max(...z.map((v,i)=>v.clone().sub(m[i]).divideScalar(step).distanceTo(n[i].clone().sub(v).divideScalar(step))));
     const skinSummary=key=>({min:Math.min(...trace.flatMap(t=>t[key].map(s=>s.min))),max:Math.max(...trace.flatMap(t=>t[key].map(s=>s.max))),worstP05:Math.min(...trace.flatMap(t=>t[key].map(s=>s.p05)))});
     return {clip:a.clip.id,samples:trace.length,neutralBias,maxTransferError,maxMotionAngleError,maxUntouchedPositionError,maxUntouchedRotationError,maxLengthError,seamPosition,seamVelocity,skinTriangles:surfaces.map(s=>({side:s.side,count:s.triangles.length})),beforeSkin:skinSummary('beforeSkin'),afterSkin:skinSummary('afterSkin'),trace};
    },model);
    results.push({model,...result});console.log(model,JSON.stringify({...result,trace:undefined}));
    assert(result.maxTransferError<.0001);assert(result.maxMotionAngleError<.0001);assert(result.neutralBias.every(s=>s.afterDegrees<.0001));
    assert(result.maxUntouchedPositionError<1e-6);assert(result.maxUntouchedRotationError<.0001);assert(result.maxLengthError<1e-6);assert(result.seamPosition<1e-6);assert(result.seamVelocity<.001);
    assert(result.skinTriangles.every(s=>s.count>0));assert(result.afterSkin.min>0&&Number.isFinite(result.afterSkin.max));
   }
  }
  await page.check('#grounding');await page.evaluate(()=>window.mocapReview.seek(window.mocapReview.cycle.period*.25));
  const phase=await page.inputValue('#phase');await page.uncheck('#ankle-relative');assert.equal(await page.inputValue('#phase'),phase);await page.check('#ankle-relative');assert.equal(await page.inputValue('#phase'),phase);
  const gap=await page.evaluate(()=>{const c=window.mocapReview.contact;return c.support?Math.abs(c.after[c.support]):0;});assert(gap<.001);
  await page.selectOption('#mode','raw');assert(await page.isDisabled('#ankle-relative'));await page.selectOption('#mode','loop');assert(await page.isEnabled('#ankle-relative'));assert(await page.isChecked('#ankle-relative'));
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/05-validation/reports/cmu-ankle-relative.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M23: neutral-relative ankle retargeting; Euler XZY in target neutral world axes, NOT clinical joint angles. Skin triangle areas relative to same posed calf with neutral ankle; no collision/volume guarantee.',ui:{phasePreserved:true,groundPlanRebuilt:true,rawExcluded:true,errors},results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
