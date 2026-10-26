const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1240,height:920}}),results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
  assert.equal(await page.inputValue('#mode'),'loop');
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3}=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
     const pos=()=>a.bones.map(b=>b.getWorldPosition(new Vector3()));
     const at=f=>{a.seek(f);return pos();};
     const n=a.cycle.period,epsilon=.001,zero=at(0),end=at(n);
     const maxGap=Math.max(...zero.map((v,i)=>v.distanceTo(end[i])));
     const before=at(n-epsilon),after=at(epsilon),dt=epsilon/a.clip.fps;
     const velocityDifference=Math.max(...zero.map((v,i)=>v.clone().sub(before[i]).divideScalar(dt).distanceTo(after[i].clone().sub(v).divideScalar(dt))));
     const lengths=a.bones.map(b=>b.position.length()),neutral=a.bones.filter(b=>b.name.startsWith('clavicle_')).map(b=>b.quaternion.clone());
     let maxLengthError=0,maxClavicleError=0,maxFrameStep=0,maxSourceLengthError=0;
     let previous=at(-.5);let seamStep=0;
     for(let f=0;f<=n;f+=.5){
      const positions=at(f);const step=Math.max(...positions.map((p,i)=>p.distanceTo(previous[i])));maxFrameStep=Math.max(maxFrameStep,step);if(f===0||f===n)seamStep=Math.max(seamStep,step);previous=positions;
      a.bones.forEach((b,i)=>{maxLengthError=Math.max(maxLengthError,Math.abs(b.position.length()-lengths[i]));assertFinite(b.quaternion.toArray());});
      a.bones.filter(b=>b.name.startsWith('clavicle_')).forEach((b,i)=>maxClavicleError=Math.max(maxClavicleError,b.quaternion.angleTo(neutral[i])));
      const ps=a.points.map(p=>new Vector3(...p));a.clip.bones.forEach((b,i)=>maxSourceLengthError=Math.max(maxSourceLengthError,Math.abs(ps[i+1].distanceTo(ps[a.clip.parents[i+1]])-b.length)));
     }
     const fractionalDistance=Math.max(...at(.25).map((p,i)=>p.distanceTo(zero[i])));
     const interior= a.cycle.sample(20),raw=a.clip.frames[a.cycle.start+20];
     const interiorRotationError=Math.max(...interior.q.map((q,i)=>Math.min(...[1,-1].map(sign=>Math.max(...q.map((v,k)=>Math.abs(v-sign*raw.q[i][k])))))));
     function assertFinite(xs){if(xs.some(v=>!Number.isFinite(v)))throw Error('Nonfinite quaternion');}
     return {clip:a.clip.id,start:a.cycle.start,period:n,seconds:a.cycle.seconds,sampledFrames:2*n+1,maxGap,velocityDifference,maxLengthError,maxClavicleError,maxSourceLengthError,maxFrameStep,seamStep,fractionalDistance,interiorRotationError};
    });
    assert(result.maxGap<1e-8);assert(result.velocityDifference<.02,'seam velocity m/s');assert(result.maxLengthError<1e-8);assert(result.maxClavicleError<1e-6);assert(result.maxSourceLengthError<1e-6);assert(result.fractionalDistance>1e-5);assert(result.interiorRotationError<1e-6);assert(result.seamStep<=result.maxFrameStep);assert(result.maxFrameStep<.1,'no large per-half-frame jump');
    results.push({model,...result});console.log(model,result);
   }
  }
  // Smoke-check advancement and pause at both playback rates.
  const speeds=[];
  for(const speed of ['1','0.5']){
   await page.selectOption('#speed',speed);await page.evaluate(()=>window.mocapReview.seek(0));await page.click('#play');
   const first=+(await page.inputValue('#phase'));await page.waitForTimeout(120);const last=+(await page.inputValue('#phase'));await page.click('#play');
   assert(last>first,'both speeds advance');speeds.push(speed);
   const paused=await page.inputValue('#phase');await page.waitForTimeout(50);assert.equal(await page.inputValue('#phase'),paused);
  }
  await page.click('#front');await page.click('#side');
  await page.selectOption('#mode','raw');assert.match(await page.textContent('#source-label'),/원본/);
  await page.selectOption('#mode','loop');assert.match(await page.textContent('#source-label'),/가공/);
  await page.locator('#phase').fill('1');await page.locator('#phase').dispatchEvent('input');
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(errors,[]);
  results.push({test:'1x/0.5x advance, pause, front/side, raw/loop labels, scrub endpoint, no storage writes',passed:true,speeds});
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-loop.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'Periodic interpolation and default male/female rigs. Not foot contact, clinical validity or full surface collision validation.',results,errors},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
