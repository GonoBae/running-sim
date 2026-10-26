const{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const fs=require('node:fs');
(async()=>{fs.mkdirSync('outputs/cmu-review',{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
const c=await b.newContext({viewport:{width:1240,height:920}});const p=await c.newPage();
await p.goto('http://127.0.0.1:5173/review/mocap.html');await p.waitForFunction(()=>window.mocapReview?.ready);await p.selectOption('#clip','0');await p.selectOption('#mode','raw');
for(let f=0;f<167;f+=5){await p.evaluate(f=>window.mocapReview.seek(f),f);await p.screenshot({path:`outputs/cmu-review/frame-${String(f).padStart(3,'0')}.png`,clip:{x:0,y:0,width:1240,height:760}});}
await p.evaluate(()=>window.mocapReview.seek(45));await p.screenshot({path:'docs/assets/images/cmu-35-17-side.png'});
await p.click('#front');await p.screenshot({path:'docs/assets/images/cmu-35-17-front.png'});
await p.click('#side');await p.selectOption('#clip','1');await p.evaluate(()=>window.mocapReview.seek(45));await p.screenshot({path:'docs/assets/images/cmu-127-06-side.png'});
await c.close();await b.close();})().catch(e=>{console.error(e);process.exitCode=1});
