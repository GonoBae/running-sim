const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
const p=await b.newPage({viewport:{width:1440,height:1000}});await p.goto('http://127.0.0.1:5173');await p.waitForFunction(()=>document.body.dataset.loaded==='true');
await p.locator('#skeleton').check();await p.selectOption('#body-part','2');
await p.locator('#part-number').fill('55');await p.locator('#part-number').press('Tab');
await p.locator('[data-view=side]').click();await p.locator('#length-section').evaluate(e=>{e.closest('aside').scrollTop=e.offsetTop-110;});
await p.screenshot({path:'docs/assets/images/body-length-controls.png'});
await p.setViewportSize({width:1440,height:1800});await p.goto('http://127.0.0.1:5173/admin');await p.locator('#policy').scrollIntoViewIfNeeded();await p.locator('#policy').screenshot({path:'docs/assets/images/admin-length-policy.png'});
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
