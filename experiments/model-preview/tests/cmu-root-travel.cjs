// Current regression: only user-approved 35_17. Earlier two-clip reports are historical.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=travel');
  await page.waitForFunction(()=>window.mocapReview?.ready&&window.mocapReview.comparison?.fixed);
  assert(await page.isDisabled('#mode'));
  assert.equal(await page.textContent('#play'),'재생');
  assert(await page.evaluate(()=>window.mocapReview.camera.isOrthographicCamera));
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3}=await import('/node_modules/three/build/three.module.js');
     const {sourceRootTravel}=await import('/review/root-travel.js');
     const a=window.mocapReview,c=a.comparison,n=a.cycle.period;
     const world=b=>b.getWorldPosition(new Vector3());
     const local=(b,group)=>group.worldToLocal(world(b));
     let maxSourceError=0,maxPoseError=0,maxHeightError=0,maxTranslationError=0,maxTraceError=0,maxMarkerError=0;
     const start=new Vector3(...a.clip.frames[a.cycle.start].p[0]);
     const traces=[],velocities={fixed:[],restored:[]};let previous;
     for(let f=0;f<=n;f+=.5){
      a.seek(f);
      const delta=sourceRootTravel(a.clip,a.cycle,f,a.heading,a.scale);
      if(Number.isInteger(f)){
       const expected=new Vector3(...a.clip.frames[a.cycle.start+f].p[0]).sub(start);expected.y=0;expected.applyQuaternion(a.heading).multiplyScalar(a.scale);
       maxSourceError=Math.max(maxSourceError,delta.distanceTo(expected));
      }
      const fixed=c.fixedBones.map(b=>local(b,c.fixed.parent));
      const restored=a.bones.map(b=>local(b,a.model.parent));
      a.bones.forEach((b,i)=>{
       maxPoseError=Math.max(maxPoseError,...b.quaternion.toArray().map((v,k)=>Math.abs(v-c.fixedBones[i].quaternion.toArray()[k])));
       maxHeightError=Math.max(maxHeightError,Math.abs(restored[i].y-fixed[i].y));
       maxTranslationError=Math.max(maxTranslationError,restored[i].clone().sub(fixed[i]).distanceTo(delta));
      });
      const p=[fixed,restored].map(ps=>['pelvis','ball_l','ball_r'].map(name=>ps[a.bones.findIndex(b=>b.name===name)]));
      for(let lane=0;lane<2;lane++)for(let j=0;j<3;j++){
       if(Number.isInteger(f))maxTraceError=Math.max(maxTraceError,p[lane][j].distanceTo(c.traces[lane][j][f]));
       maxMarkerError=Math.max(maxMarkerError,p[lane][j].distanceTo(c.markers[lane*3+j].position));
      }
      const support=a.contact?.support;
      if(previous&&support&&previous.support===support){
       const j=support==='l'?1:2,dt=.5/a.clip.fps;
       for(let lane=0;lane<2;lane++){
        const d=p[lane][j].clone().sub(previous.p[lane][j]);d.y=0;
        velocities[lane?'restored':'fixed'].push(d.length()/dt);
       }
      }
      traces.push({phase:f/n,support,points:p.map(lane=>lane.map(v=>v.toArray()))});
      previous={p,support};
     }
     const end=sourceRootTravel(a.clip,a.cycle,n,a.heading,a.scale);
     const rms=xs=>Math.sqrt(xs.reduce((sum,v)=>sum+v*v,0)/xs.length);
     return {clip:a.clip.id,period:n,samples:traces.length,maxSourceError,maxPoseError,maxHeightError,maxTranslationError,maxTraceError,maxMarkerError,
      endDisplacement:end.toArray(),supportReferenceSpeedRms:{fixed:rms(velocities.fixed),restored:rms(velocities.restored)},traces};
    });
    for(const key of ['maxSourceError','maxPoseError','maxHeightError','maxTranslationError','maxTraceError','maxMarkerError'])assert(result[key]<1e-7,key);
    assert(result.endDisplacement[2]>0.5,'original forward travel present');
    results.push({model,...result});console.log(model,result.clip,{...result,traces:undefined});
   }
  }
  // Rebuild paths on correction/model/clip changes and keep the scrubbed phase.
  await page.evaluate(()=>window.mocapReview.seek(20));
  const phaseBefore=await page.inputValue('#phase');
  await page.uncheck('#grounding');await page.check('#grounding');
  await page.uncheck('#ankle-weights');await page.check('#ankle-weights');
  assert.equal(await page.inputValue('#phase'),phaseBefore);
  for(const speed of ['1','0.5']){
   await page.selectOption('#speed',speed);
   await page.evaluate(()=>{const a=window.mocapReview;a.seek(a.cycle.period-1);});
   await page.click('#play');await page.waitForFunction(()=>document.getElementById('play').textContent==='처음부터 재생');
   assert.equal(await page.inputValue('#phase'),'1');
   await page.waitForTimeout(70);assert.equal(await page.inputValue('#phase'),'1');
   await page.click('#play');await page.waitForTimeout(70);assert(Number(await page.inputValue('#phase'))<1);
   await page.evaluate(()=>window.mocapReview.seek(0));
  }
  await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);
  await page.selectOption('#clip','0');await page.click('#side');
  await page.evaluate(()=>{const a=window.mocapReview;a.seek(a.cycle.period*.43);});
  fs.mkdirSync('outputs/stance-review',{recursive:true});
  await page.screenshot({path:'outputs/stance-review/cmu-root-travel-side.png',fullPage:true});
  await page.click('#front');
  await page.screenshot({path:'outputs/stance-review/cmu-root-travel-front.png',fullPage:true});
  for(const size of [{width:1440,height:1000},{width:980,height:850}]){
   await page.setViewportSize(size);
   for(const view of ['#front','#side']){
    await page.click(view);
    const max=await page.evaluate(()=>{
     const a=window.mocapReview,c=a.comparison;
     a.camera.updateMatrixWorld(true);
     return Math.max(...c.traces.flatMap((lane,i)=>lane.flat().map(p=>{
      const screen=p.clone().applyMatrix4((i?a.model:c.fixed).parent.matrixWorld).project(a.camera);
      return Math.max(Math.abs(screen.x),Math.abs(screen.y));
     })));
    });
    assert(max<1,'traces fit fixed camera');
    const bodyMax=await page.evaluate(async()=>{
     const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
     const a=window.mocapReview;let max=0;
     for(const phase of [0,.25,.5,.75,1]){
      a.seek(a.cycle.period*phase);
      for(const model of [a.model,a.comparison.fixed]){
       const box=new Box3().setFromObject(model,true);
       for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const p=new Vector3(x,y,z).project(a.camera);max=Math.max(max,Math.abs(p.x),Math.abs(p.y));
       }
      }
     }
     return max;
    });
    assert(bodyMax<1,'entire skinned runner fits at five phases');
   }
  }
  checks.push('initial pause; shared orthographic camera; both speeds end/pause/restart; correction rebuild keeps phase; front/side traces fit 1440px and 980px');
  // Existing page remains the default comparison, still loops and permits raw.
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
  assert.equal(await page.evaluate(()=>Boolean(window.mocapReview.comparison)),false);
  await page.selectOption('#mode','raw');await page.selectOption('#mode','loop');
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(errors,[]);checks.push('default source/model view; raw/loop switch; no storage writes; no browser errors');
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-root-travel-35.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M25 finite original horizontal root travel; identical processed poses/Y. Foot reference velocities are not measured sole slip. No physical stability or anatomical validation.',results,checks,errors},null,2));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
