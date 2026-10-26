// Run at repository root with Vite at 127.0.0.1:5173 and PLAYWRIGHT_PATH when needed.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs');
(async()=>{
 const out='outputs/basic-run-height';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.modelPreview?.runningPose);await page.click('#next-pose');await page.click('[data-view=side]');
 await page.click('#play-run');await page.waitForTimeout(850);await page.click('#play-run');await page.screenshot({path:out+'/basic-run-desktop.png'});
 await page.click('[data-view=front]');await page.screenshot({path:out+'/basic-run-front.png'});await page.click('#edit-run');await page.click('[data-view=side]');
 await page.evaluate(async()=>{const a=window.modelPreview,{createBasicRunMotion,basicRunPeriodMs}=await import('/src/basic-run-motion.ts');window.capturePeriod=basicRunPeriodMs;window.captureMotion=createBasicRunMotion(a.runningPose,a.model,a.bones,a.scene.children.find(c=>c.type==='GridHelper').position.y+.005);document.body.dataset.runState='paused';});
 const period=await page.evaluate(()=>window.capturePeriod);
 const phases=[0,.25,.41,.5],labels=['왼발 지지','몸 전진','공중 구간','오른발 지지'],images=[];
 for(const [i,phase] of phases.entries()){
  await page.evaluate(p=>{const m=window.captureMotion;m.stop();m.start(0);m.pause(window.capturePeriod*p);window.modelPreview.followRun(m.travel);},phase);await page.waitForTimeout(50);
  const file=out+`/basic-run-phase-${i}.png`;await page.screenshot({path:file,clip:{x:280,y:210,width:560,height:720}});images.push(fs.readFileSync(file).toString('base64'));
 }
 await page.evaluate(()=>{window.captureMotion.stop();window.modelPreview.followRun();});
 await page.setViewportSize({width:1200,height:550});await page.setContent(`<html lang="ko"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f6f5f1;color:#28382e;font-family:'Malgun Gothic',sans-serif;padding:26px}h1{font-size:24px;margin:0 0 6px}p{font-size:13px;color:#657366;margin:0 0 16px}.frames{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:#fff;border-radius:12px;overflow:hidden}img{width:100%;display:block}figcaption{padding:12px;font-size:14px}</style><h1>기본 달리기 · 실제 모델의 한 주기</h1><p>M17 실제 화면 / 공중 높이 보정 축소 / 접지 시점·궤적은 시각적 설계 · 자연스러움 검토 중</p><div class="frames">${images.map((s,i)=>`<figure><img src="data:image/png;base64,${s}"><figcaption>0${i+1} · ${labels[i]} — ${Math.round(phases[i]*period)}ms</figcaption></figure>`).join('')}</div></html>`);
 await page.screenshot({path:out+'/basic-run-cycle.png',fullPage:true});await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
