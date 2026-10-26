const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('outputs/cmu-arm-spacing',{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1240,height:980}});
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);await page.selectOption('#clip','0');await page.click('#front');
  await page.evaluate(()=>{const a=window.mocapReview;a.camera.position.set(1,1.45,2.5);a.camera.lookAt(1,1.3,0);});
  for(const state of ['before','after']){
   await page.locator('#arm-spacing').setChecked(state==='after');await page.evaluate(()=>window.mocapReview.seek(window.mocapReview.cycle.period*.25));
   await page.locator('#view canvas').screenshot({path:`docs/assets/images/cmu-arm-spacing-${state}.png`});
  }
  await page.evaluate(()=>{const a=window.mocapReview;a.camera.position.set(1,.65,2.5);a.camera.lookAt(1,.35,0);});
  for(const k of [1,3]){
   await page.evaluate(k=>window.mocapReview.seek(window.mocapReview.cycle.period*k/4),k);
   await page.locator('#view canvas').screenshot({path:`docs/assets/images/cmu-ankle-recheck-${k}.png`});
  }
  await page.click('#front');
  for(let i=0;i<24;i++){
   await page.evaluate(i=>window.mocapReview.seek(window.mocapReview.cycle.period*i/24),i);
   await page.screenshot({path:`outputs/cmu-arm-spacing/frame-${String(i).padStart(2,'0')}.png`,clip:{x:0,y:0,width:1240,height:830}});
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
