// Repository root, Vite at :5173. Run with `before` before the correction, `after` after it.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
 const label=process.argv[2]||'after';
 if(!['before','after'].includes(label))throw Error('Expected before or after');
 const out='outputs/leg-stance';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),results=[];
  await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.dataset.loaded==='true');
  for(const sex of ['male','female']){
   if(await page.locator('#previous-body').isVisible())await page.click('#previous-body');
   await page.click(`[data-model-type=${sex}]`);await page.waitForFunction(()=>document.body.dataset.loaded==='true');
   await page.click('#next-pose');await page.click('[data-view=front]');
   results.push(await page.evaluate(sex=>{
    const a=window.modelPreview,p=n=>a.bones.find(b=>b.name===n).getWorldPosition(a.camera.position.clone());
    const width=n=>Math.abs(p(n+'_l').x-p(n+'_r').x)*100;
    return {sex,hipCm:width('thigh'),kneeCm:width('calf'),ankleCm:width('foot')};
   },sex));
   await page.waitForTimeout(100);
   await page.screenshot({path:`${out}/${label}-${sex}.png`,clip:{x:280,y:210,width:560,height:720}});
  }
  fs.writeFileSync(`${out}/${label}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  if(label==='after'&&fs.existsSync(`${out}/before.json`)){
   const before=JSON.parse(fs.readFileSync(`${out}/before.json`));
   const cards=['male','female'].flatMap((sex,i)=>['before','after'].map(stage=>{
    const data=stage==='before'?before[i]:results[i];
    const pixels=fs.readFileSync(`${out}/${stage}-${sex}.png`).toString('base64');
    return `<figure><figcaption>${sex==='male'?'남성형':'여성형'} · ${stage==='before'?'수정 전':'수정 후'}<strong>발목 중심 간격 ${data.ankleCm.toFixed(1)}cm</strong></figcaption><img src="data:image/png;base64,${pixels}"></figure>`;
   }));
   await page.setViewportSize({width:1200,height:560});
   await page.setContent(`<html lang="ko"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f6f5f1;color:#28382e;font-family:'Malgun Gothic',sans-serif}h1{font-size:24px;margin:0 0 8px}p{font-size:13px;margin:0 0 16px;color:#657366}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:#fff;border-radius:12px;overflow:hidden}figcaption{padding:12px;font-size:14px}strong{display:block;font-size:13px;margin-top:6px}img{display:block;width:100%}</style><h1>기본 다리 간격 · 수정 전 / 후</h1><p>M12 · 실제 GLB / 같은 정면 시점 · 골반 너비와 다리 길이 유지 · 외형 충돌 전체 검증 아님</p><main>${cards.join('')}</main></html>`);
   await page.screenshot({path:`${out}/leg-stance-comparison.png`,fullPage:true});
   fs.writeFileSync('docs/05-validation/reports/leg-stance.json',JSON.stringify({scope:'M12 real GLB default stance, joint-center distance in cm; not a skin collision test',before,after:results},null,2));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
