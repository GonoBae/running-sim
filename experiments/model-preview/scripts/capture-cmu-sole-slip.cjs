const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=slip');
  await page.waitForFunction(()=>window.mocapReview?.ready);
  await page.selectOption('#clip','0'); // Historical M25/M26 capture: 35_17.
  await page.evaluate(()=>window.mocapReview.renderer.setAnimationLoop(null));
  const labels=await page.locator('.labels').boundingBox(),view=await page.locator('#view').boundingBox();
  const clip={x:labels.x,y:labels.y,width:labels.width,height:view.y+view.height-labels.y};
  fs.mkdirSync('outputs/cmu-sole-slip',{recursive:true});
  for(let i=0;i<24;i++){
   await page.evaluate(i=>{const a=window.mocapReview;a.seek(a.cycle.period*i/23);},i);
   await page.screenshot({path:`outputs/cmu-sole-slip/frame-${String(i).padStart(2,'0')}.png`,clip});
  }
  await page.evaluate(()=>{const a=window.mocapReview;a.seek(a.cycle.period*.43);});
  await page.screenshot({path:'docs/assets/images/cmu-sole-slip-side.png',fullPage:true});
  await page.click('#front');await page.evaluate(()=>{const a=window.mocapReview;a.seek(a.cycle.period*.43);});
  await page.screenshot({path:'docs/assets/images/cmu-sole-slip-front.png',fullPage:true});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
