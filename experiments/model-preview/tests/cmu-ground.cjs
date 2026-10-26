const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1240,height:920}}),results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
  assert(await page.isChecked('#grounding'));
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview,checkbox=document.getElementById('grounding');
     const p=b=>b.getWorldPosition(new Vector3()),pelvis=a.bones.find(b=>b.name==='pelvis');
     const meshes=[];
     a.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight}=mesh.geometry.attributes,indices={l:[],r:[]};
      // Deliberately broader than the production >0.15 selection.
      for(let i=0;i<skinIndex.count;i++)for(const side of ['l','r']){let w=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(i,j)].name))w+=skinWeight.getComponent(i,j);if(w>.01)indices[side].push(i);}meshes.push({mesh,indices});
     });
     const v=new Vector3(),trace=[];let minSurface=Infinity,maxSupportGap=0,maxRelativeError=0,maxRotationError=0,maxOffset=0,flightMax=0;
     const supportCounts={l:0,r:0,flight:0};
     for(let f=0;f<=a.cycle.period;f+=.25){
      checkbox.checked=false;a.seek(f);const oldRoot=p(pelvis),old=a.bones.map(b=>({p:p(b).sub(oldRoot),q:b.getWorldQuaternion(new Quaternion()).normalize()}));
      checkbox.checked=true;a.seek(f);const root=p(pelvis),heights={l:Infinity,r:Infinity};
      for(const {mesh,indices} of meshes){mesh.skeleton.update();for(const side of ['l','r'])for(const i of indices[side]){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);heights[side]=Math.min(heights[side],v.y);}}
      for(let i=0;i<a.bones.length;i++){const b=a.bones[i];maxRelativeError=Math.max(maxRelativeError,p(b).sub(root).distanceTo(old[i].p));maxRotationError=Math.max(maxRotationError,b.getWorldQuaternion(new Quaternion()).normalize().angleTo(old[i].q));}
      const c=a.contact,min=Math.min(heights.l,heights.r);minSurface=Math.min(minSurface,min);maxOffset=Math.max(maxOffset,Math.abs(c.offset));
      if(c.support){supportCounts[c.support]++;maxSupportGap=Math.max(maxSupportGap,Math.abs(heights[c.support]));}else{supportCounts.flight++;flightMax=Math.max(flightMax,min);}
      trace.push({phase:f/a.cycle.period,support:c.support,before:c.before,after:heights,offset:c.offset,pelvisY:root.y});
     }
     const rootAt=phase=>{a.seek(phase*a.cycle.period);return p(pelvis);};
     const boundaries=a.clip.id==='35_17'?[0,.09,.28,.58,.75]:[0,.06,.08,.13,.53,.70];
     let boundaryVelocityDifference=0,boundaryPositionDifference=0;
     for(const phase of boundaries){const e=1e-5,t=e*a.cycle.seconds,m=rootAt(phase-e),z=rootAt(phase),n=rootAt(phase+e);
      boundaryVelocityDifference=Math.max(boundaryVelocityDifference,z.clone().sub(m).divideScalar(t).distanceTo(n.clone().sub(z).divideScalar(t)));
      boundaryPositionDifference=Math.max(boundaryPositionDifference,m.distanceTo(n));
     }
     const seamError=rootAt(0).distanceTo(rootAt(1));
     const range=Math.max(...trace.map(t=>t.pelvisY))-Math.min(...trace.map(t=>t.pelvisY));
     const maxVerticalSpeed=Math.max(...trace.slice(1).map((t,i)=>Math.abs(t.pelvisY-trace[i].pelvisY)/(a.cycle.seconds/(4*a.cycle.period))));
     return {clip:a.clip.id,samples:trace.length,minSurface,maxSupportGap,maxRelativeError,maxRotationError,maxOffset,flightMax,supportCounts,boundaryVelocityDifference,boundaryPositionDifference,seamError,pelvisRange:range,maxVerticalSpeed,trace};
    });
    results.push({model,...result});console.log(model,JSON.stringify({...result,trace:undefined}));
    assert(result.minSurface>=-1e-6,'no foot penetration');assert(result.maxSupportGap<.001,'support foot within 1mm');
    assert(result.maxRelativeError<1e-6);assert(result.maxRotationError<1e-6);assert(result.maxOffset<.1);
    assert(result.flightMax>.005,'retain visible aerial clearance');assert(result.supportCounts.l>0&&result.supportCounts.r>0&&result.supportCounts.flight>0);
    assert(result.boundaryVelocityDifference<.02,'contact transition velocity');assert(result.boundaryPositionDifference<.0001);assert(result.seamError<1e-8);
    assert(result.pelvisRange<.15&&result.maxVerticalSpeed<3,'visual regression budget, not biomechanical criteria');
   }
  }
  await page.uncheck('#grounding');assert.equal(await page.evaluate(()=>window.mocapReview.contact),null);
  await page.check('#grounding');assert(await page.evaluate(()=>!!window.mocapReview.contact));
  await page.selectOption('#mode','raw');assert(await page.isDisabled('#grounding'));assert.equal(await page.evaluate(()=>window.mocapReview.contact),null);
  await page.selectOption('#mode','loop');assert(await page.isEnabled('#grounding'));assert(await page.evaluate(()=>!!window.mocapReview.contact));
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(errors,[]);
  results.push({test:'correction toggle, raw bypass, loop restore, no storage writes',passed:true});
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-ground.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'Default male/female, authored support phases, vertical correction only. Broader independent foot vertex selection, quarter-frame samples. No X/Z foot lock or measured contact timings.',results,errors},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
