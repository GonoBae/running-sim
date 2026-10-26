const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const query of ['', '?compare=travel', '?compare=slip']){
   await page.goto('http://127.0.0.1:5173/review/mocap.html'+query);
   await page.waitForFunction(()=>window.mocapReview?.ready);
   assert.deepEqual(await page.locator('#clip option').evaluateAll(xs=>xs.map(x=>x.value)),['0']);
   assert.equal(await page.inputValue('#clip'),'0');
   for(const model of ['male','female']){
    await page.selectOption('#model',model);
    await page.waitForFunction(()=>window.mocapReview.ready);
    assert.equal(await page.evaluate(()=>window.mocapReview.clip.id),'35_17');
    assert.equal(await page.isChecked('#stance-width'),false,'rejected constant abduction defaults off');
    await page.click('#front');await page.click('#side');
    const sampled=await page.evaluate(()=>{
     const a=window.mocapReview;let count=0;
     for(const phase of [0,.25,.5,.75,1]){
      a.seek(a.cycle.period*phase);
      for(const b of a.bones){
       if(![...b.matrixWorld.elements,...b.quaternion.toArray()].every(Number.isFinite))throw Error('Invalid bone transform');
      }
      count++;
     }
     a.seek(0);return count;
    });
    await page.click('#play');
    await page.waitForFunction(()=>Number(document.getElementById('phase').value)>.05);
    if(query){
     await page.waitForFunction(()=>document.getElementById('play').textContent==='처음부터 재생');
     await page.click('#play');
     assert.equal(await page.textContent('#play'),'일시정지');
    }
    await page.evaluate(()=>window.mocapReview.seek(0));
    results.push({route:query||'original',model,clip:'35_17',sampled,playback:true,stanceCorrection:false});
   }
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/05-validation/reports/cmu-active-motion.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'User decision: 35_17 only. Selection, finite transforms, cameras, seek and playback. Selection smoke only; gait correction is tested separately. No naturalness validation.',results,errors},null,2));
  console.log(JSON.stringify({cases:results.length,sampled:results.reduce((n,x)=>n+x.sampled,0),errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
