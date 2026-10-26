// Render authored SVGs for sharing; do not reinterpret them as implementation screenshots.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {pathToFileURL}=require('node:url'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  for(const suffix of ['flow','screen','evidence']){
   const name='evidence-comparison-'+suffix;
   await page.goto(pathToFileURL(path.resolve('docs/assets/diagrams',name+'.svg')).href);
   await page.evaluate(()=>document.fonts.ready);
   await page.locator('svg').screenshot({path:'docs/assets/images/'+name+'.png'});
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
