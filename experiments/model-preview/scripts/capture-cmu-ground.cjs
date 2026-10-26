const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('outputs/cmu-ground',{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1240,height:980}});
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);await page.selectOption('#clip','0');
  await page.evaluate(()=>{const a=window.mocapReview;a.camera.position.set(2.6,.65,-1);a.camera.lookAt(0,.30,-1);});
  for(const state of ['before','after']){
   await page.locator('#grounding').setChecked(state==='after');
   await page.evaluate(()=>window.mocapReview.seek(window.mocapReview.cycle.period*.83));
   await page.locator('#view canvas').screenshot({path:`docs/assets/images/cmu-ground-${state}.png`});
  }
  await page.click('#side');
  for(let i=0;i<24;i++){
   await page.evaluate(i=>window.mocapReview.seek(window.mocapReview.cycle.period*i/24),i);
   await page.screenshot({path:`outputs/cmu-ground/frame-${String(i).padStart(2,'0')}.png`,clip:{x:0,y:0,width:1240,height:830}});
  }
  await page.evaluate(()=>window.mocapReview.seek(window.mocapReview.cycle.period*.4));
  await page.screenshot({path:'docs/assets/images/cmu-ground-screen.png'});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
