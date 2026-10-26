const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  fs.mkdirSync('outputs/cmu-leg-height',{recursive:true});
  const p=await b.newPage({viewport:{width:1280,height:1000}}),errors=[],recordings=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=leg-height');await p.waitForFunction(()=>window.sharedGaitReview?.ready);
  await p.uncheck('#bones');
  await p.locator('#legHeight').fill('10');await p.locator('#legHeight').dispatchEvent('input');
  await p.selectOption('#speed','1');
  await p.screenshot({path:'outputs/cmu-leg-height/page.png'});
  for(const model of ['male','female']){if(model==='female'){await p.selectOption('#model',model);await p.waitForFunction(()=>window.sharedGaitReview?.ready);}for(const view of ['front','side']){
   await p.click('#'+view);await p.evaluate(()=>window.sharedGaitReview.seek(0));
   await p.evaluate(()=>{
    const source=document.querySelector('#view canvas'),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height+58;
    const ctx=canvas.getContext('2d'),times=[];let running=true;
    function draw(time){
     times.push(time);ctx.fillStyle='#f6f5f1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,58);ctx.fillStyle='#233b32';ctx.font='20px sans-serif';ctx.textAlign='center';
     ['기본 달리기 · 0cm / 1배속','설정 · 양쪽 무릎 +10cm / 1배속'].forEach((s,i)=>ctx.fillText(s,canvas.width*(i+.5)/2,34));if(running)requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    const stream=canvas.captureStream(60),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
    window.bilateralRecording={recorder,stream,times,done:new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{
     running=false;const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let text='';
     for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(text));
    };})};recorder.start();
   });
   await p.click('#play');await p.waitForTimeout(3400);await p.click('#play');
   const r=await p.evaluate(async()=>{const r=window.bilateralRecording;r.recorder.stop();const encoded=await r.done;r.stream.getTracks().forEach(t=>t.stop());const gaps=r.times.slice(1).map((t,i)=>t-r.times[i]);return {encoded,frames:r.times.length,durationMs:r.times.at(-1)-r.times[0],maxFrameGapMs:Math.max(...gaps)};});
   fs.writeFileSync(`outputs/cmu-leg-height/${model}-${view}.webm`,Buffer.from(r.encoded,'base64'));delete r.encoded;recordings.push({model,view,...r});
  }
  }
  if(errors.length)throw Error(errors.join(';'));
  fs.writeFileSync('docs/05-validation/reports/cmu-leg-height-media.json',JSON.stringify({testedAt:new Date().toISOString(),speed:1,errors,recordings},null,2));console.log(recordings);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
