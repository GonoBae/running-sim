const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:940}}),errors=[],recordings=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5173/review/shared-gait.html');await p.waitForFunction(()=>window.sharedGaitReview?.ready);
  await p.screenshot({path:'outputs/cmu-shared-gait/page.png'});
  for(const view of ['front','side']){
   await p.click('#'+view);await p.evaluate(()=>window.sharedGaitReview.seek(0));
   await p.evaluate(()=>{
    const source=document.querySelector('#view canvas'),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height+58;
    const ctx=canvas.getContext('2d'),times=[];let running=true;
    function draw(time){
     times.push(time);ctx.fillStyle='#f6f5f1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,58);ctx.fillStyle='#233b32';ctx.font='20px sans-serif';ctx.textAlign='center';
     ['기존 · 좌우 개별 보정','수정 · 양발 공통 기준'].forEach((s,i)=>ctx.fillText(s,canvas.width*(i+.5)/2,34));if(running)requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    const stream=canvas.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
    window.sharedRecording={recorder,stream,times,done:new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{running=false;const a=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let text='';for(let i=0;i<a.length;i+=8192)text+=String.fromCharCode(...a.subarray(i,i+8192));resolve(btoa(text));};})};recorder.start();
   });
   await p.click('#play');await p.waitForTimeout(3200);await p.click('#play');
   const result=await p.evaluate(async()=>{const r=window.sharedRecording;r.recorder.stop();const encoded=await r.done;r.stream.getTracks().forEach(t=>t.stop());return {encoded,frames:r.times.length,durationMs:r.times.at(-1)-r.times[0]};});
   fs.writeFileSync(`outputs/cmu-shared-gait/${view}.webm`,Buffer.from(result.encoded,'base64'));delete result.encoded;recordings.push({view,...result});
  }
  if(errors.length)throw Error(errors.join(';'));
  fs.writeFileSync('docs/05-validation/reports/cmu-shared-gait-media.json',JSON.stringify({testedAt:new Date().toISOString(),errors,recordings},null,2));console.log(recordings);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
