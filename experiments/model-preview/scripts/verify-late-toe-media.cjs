const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const p=await b.newPage({viewport:{width:1280,height:900}}),results=[];
 const dest=path.resolve('outputs/cmu-late-toe-slip/media-check.html');fs.writeFileSync(dest,'<!doctype html><meta charset="utf-8"><title>M55 recordings</title>');await p.goto(pathToFileURL(dest).href);
 for(const view of ['front','side']){const url=pathToFileURL(path.resolve('outputs/cmu-late-toe-slip/'+view+'.webm')).href;
  await p.setContent(`<body style="background:#faf9f6"><h1>M54 유지 / M55 미채택 시험 · ${view}</h1><video style="max-width:1200px" src="${url}" controls muted></video></body>`);await p.waitForFunction(()=>document.querySelector('video').readyState>=2);await p.evaluate(()=>{document.querySelector('video').currentTime=1.2;});await p.waitForFunction(()=>!document.querySelector('video').seeking);const r=await p.evaluate(()=>{const v=document.querySelector('video');return {width:v.videoWidth,height:v.videoHeight,ready:v.readyState,error:v.error?.message||null};});assert(r.width>0&&r.height>0&&!r.error);results.push({view,...r});await p.screenshot({path:`outputs/cmu-late-toe-slip/recording-${view}.png`});
 }
 fs.writeFileSync('docs/05-validation/reports/cmu-late-toe-slip-media.json',JSON.stringify({testedAt:new Date().toISOString(),results},null,2));console.log(results);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
