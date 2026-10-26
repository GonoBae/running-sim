// Current regression: only user-approved 35_17. Earlier two-clip reports are historical.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=slip');await page.waitForFunction(()=>window.mocapReview?.ready&&window.mocapReview.comparison.slipPlan);
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3}=await import('/node_modules/three/build/three.module.js');
     const {sourceRootTravel}=await import('/review/root-travel.js');
     const a=window.mocapReview,c=a.comparison,plan=c.slipPlan,n=a.cycle.period,epsilon=.02;
     const read=model=>{
      const meshes=[];model.traverse(mesh=>{if(mesh.isSkinnedMesh)meshes.push(mesh);});
      const entries=meshes.map(mesh=>{
       const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;
       for(let i=0;i<skinIndex.count;i++){
        let w=0;for(let k=0;k<4;k++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))w+=skinWeight.getComponent(i,k);
        if(w>.5)ids.push(i);
       }
       return {mesh,ids};
      });
      return ()=>entries.flatMap(({mesh,ids})=>{mesh.skeleton.update();return ids.map(id=>mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld));});
     };
     const before=read(c.fixed),after=read(a.model),samples=[];
     const at=f=>{a.seek(f);return [before(),after()];};
     const metric={before:[],after:[],coreBefore:[],coreAfter:[]};
     let maxRotationError=0,maxYError=0,maxOffset=0,maxTranslationError=0,minY=Infinity;
     for(let f=.125;f<n;f+=.5){
      const minus=at(f-epsilon),plus=at(f+epsilon),center=at(f),phase=f/n,offset=plan.sample(f);
      maxOffset=Math.max(maxOffset,offset.length());
      a.bones.forEach((b,i)=>{
       maxRotationError=Math.max(maxRotationError,...b.quaternion.toArray().map((v,k)=>Math.abs(v-c.fixedBones[i].quaternion.toArray()[k])));
       const p=a.model.parent.worldToLocal(b.getWorldPosition(new Vector3()));
       const old=c.fixed.parent.worldToLocal(c.fixedBones[i].getWorldPosition(new Vector3()));
       maxYError=Math.max(maxYError,Math.abs(p.y-old.y));
       maxTranslationError=Math.max(maxTranslationError,p.sub(old).distanceTo(offset));
      });
      center[1].forEach((p,i)=>{minY=Math.min(minY,p.y);maxYError=Math.max(maxYError,Math.abs(p.y-center[0][i].y));});
      let count=0,sums=[0,0];
      const win=plan.supportWindow,isSupport=phase>=win.start&&phase<=win.end;
      // Independent validation: uniform 2mm skin band, finer time differences,
      // and phases offset from the planner's .25-frame training knots.
      if(isSupport)center[0].forEach((p,i)=>{
       if(p.y>.002)return;
       count++;
       for(let lane=0;lane<2;lane++){
        const v=plus[lane][i].clone().sub(minus[lane][i]).multiplyScalar(a.clip.fps/(2*epsilon));v.y=0;sums[lane]+=v.lengthSq();
       }
      });
      let rms=null;
      if(count){
       rms=sums.map(sum=>Math.sqrt(sum/count));metric.before.push(sums[0]/count);metric.after.push(sums[1]/count);
       if(phase>win.start+.04&&phase<win.end-.04){metric.coreBefore.push(sums[0]/count);metric.coreAfter.push(sums[1]/count);}
      }
      samples.push({phase,offset:offset.toArray(),skinSpeed:rms,vertices:count});
     }
     const rms=xs=>Math.sqrt(xs.reduce((a,b)=>a+b,0)/xs.length);
     let velocityGap=0,outsideVelocity=0;
     const e=.00001;
     for(const f of [...Array.from({length:n*4-1},(_,i)=>(i+1)*.25),plan.supportWindow.start*n,plan.supportWindow.end*n]){
      const p=plan.sample(f),v0=p.clone().sub(plan.sample(f-e)).multiplyScalar(a.clip.fps/e),v1=plan.sample(f+e).sub(p).multiplyScalar(a.clip.fps/e);
      velocityGap=Math.max(velocityGap,v0.distanceTo(v1));
      if(f/n<plan.supportWindow.start-.00001||f/n>plan.supportWindow.end+.00001)outsideVelocity=Math.max(outsideVelocity,v0.length(),v1.length());
     }
     const saved=at(n*.42)[1];at(n*.91);at(0);const replay=at(n*.42)[1];
     const seekError=Math.max(...saved.map((p,i)=>p.distanceTo(replay[i])));
     const bodyAcceleration={before:0,after:0},h=.05,dt=h/a.clip.fps;
     const root=f=>sourceRootTravel(a.clip,a.cycle,f,a.heading,a.scale);
     for(let f=.5;f<n-.5;f+=.25){
      const base=root(f+h).add(root(f-h)).addScaledVector(root(f),-2).divideScalar(dt*dt);
      const correction=plan.sample(f+h).add(plan.sample(f-h)).addScaledVector(plan.sample(f),-2).divideScalar(dt*dt);
      bodyAcceleration.before=Math.max(bodyAcceleration.before,base.length());
      bodyAcceleration.after=Math.max(bodyAcceleration.after,base.add(correction).length());
     }
     return {bodyAcceleration,clip:a.clip.id,sampledPoses:samples.length,supportSamples:metric.before.length,required:plan.required,gain:plan.gain,acceleration:plan.acceleration,maxOffset,endOffset:plan.endOffset,
      maxRotationError,maxYError,maxTranslationError,minY,velocityGap,outsideVelocity,seekError,
      skinSpeed:{before:rms(metric.before),after:rms(metric.after),coreBefore:rms(metric.coreBefore),coreAfter:rms(metric.coreAfter)},samples};
    });
    console.log('MEASURE',model,{...result,samples:undefined});
    assert(result.skinSpeed.after<result.skinSpeed.before*.9,'near-floor skin speed improves');
    assert(result.skinSpeed.coreAfter<result.skinSpeed.coreBefore*.85,'support core improves');
    assert(result.acceleration.filtered<result.acceleration.unfiltered*.5,'reduce correction acceleration as well as skin slip');
    assert(result.maxOffset<=.050001);assert(result.maxRotationError<1e-10);assert(result.maxYError<1e-9);assert(result.maxTranslationError<1e-8);
    assert(result.minY>-.0001);assert(result.velocityGap<.002);assert(result.outsideVelocity<1e-8);assert(result.seekError<1e-9);
    results.push({model,...result});
   }
  }
  const synthetic=await page.evaluate(async()=>{
   const {Vector3}=await import('/node_modules/three/build/three.module.js');
   const {createSoleSlipPlan}=await import('/review/sole-slip.js');
   const samples=Array.from({length:401},(_,i)=>({frame:i*.25,points:[new Vector3(i*.025,.001,0)]}));
   const plan=createSoleSlipPlan(samples,100,100,{start:.2,end:.8});
   let max=0;for(let f=0;f<=100;f+=.013)max=Math.max(max,plan.sample(f).length());
   return {gain:plan.gain,max,start:plan.sample(0).length()};
  });
  assert(synthetic.gain<1);assert(synthetic.max<=.05);assert.equal(synthetic.start,0);
  checks.push({test:'5cm bound including between knots with synthetic large slip',...synthetic});
  const phase=await page.inputValue('#phase');
  await page.uncheck('#sole-slip');
  const off=await page.evaluate(async()=>{
   const {Vector3}=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview,c=a.comparison;
   return Math.max(...a.bones.map((b,i)=>a.model.parent.worldToLocal(b.getWorldPosition(new Vector3())).distanceTo(c.fixed.parent.worldToLocal(c.fixedBones[i].getWorldPosition(new Vector3())))));
  });assert(off<1e-8);assert.equal(await page.inputValue('#phase'),phase);
  await page.check('#sole-slip');await page.uncheck('#grounding');assert(await page.isDisabled('#sole-slip'));await page.check('#grounding');assert(await page.isEnabled('#sole-slip'));
  await page.uncheck('#ankle-weights');await page.check('#ankle-weights');
  for(const speed of ['1','0.5']){
   await page.selectOption('#speed',speed);await page.evaluate(()=>{const a=window.mocapReview;a.seek(a.cycle.period-1);});await page.click('#play');
   await page.waitForFunction(()=>document.getElementById('play').textContent==='처음부터 재생');assert.equal(await page.inputValue('#phase'),'1');
  }
  await page.click('#front');await page.click('#side');assert.deepEqual(errors,[]);
  checks.push('off restores identical source-travel pose; phase preserved; grounding prerequisite; weight change rebuild; 1x/0.5x endpoint stop; front/side; no browser errors');
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-sole-slip-35.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'Right foot only. Uniform 2mm material-vertex velocity, independent .125-offset phases and .02-frame differences. Estimated contact, not measured forces or physical stability.',results,checks,errors},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
