// Short recordings of the real comparison page, not generated motion artwork.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{fs.mkdirSync('outputs/cmu-stance-chain-motion',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 for(const view of ['front','side']){
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=stance-chain-motion');await page.waitForFunction(()=>window.mocapReview?.ready);
  await page.click('#'+view);
  await page.evaluate(()=>{
   const source=document.querySelector('#view canvas'),capture=document.createElement('canvas');
   capture.width=source.width;capture.height=source.height+60;
   const ctx=capture.getContext('2d');let drawing=true;
   function draw(){ctx.fillStyle='#f6f5f1';ctx.fillRect(0,0,capture.width,capture.height);ctx.drawImage(source,0,60);ctx.fillStyle='#233b32';ctx.font='18px sans-serif';ctx.textAlign='center';['현재 동작','오른발 · 골반–무릎–발 연동'].forEach((label,i)=>ctx.fillText(label,capture.width*(i+.5)/2,35));if(drawing)requestAnimationFrame(draw);}draw();
   const stream=capture.captureStream(30),chunks=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
   window.landingRecording={recorder,stream,done:new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{drawing=false;const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(text));};})};recorder.start();
  });
  for(let repeat=0;repeat<2;repeat++){
   await page.click('#play');await page.waitForFunction(()=>document.getElementById('play').textContent==='처음부터 재생');await page.waitForTimeout(250);
  }
  await page.evaluate(()=>window.mocapReview.seek(39));await page.waitForTimeout(300);
  const encoded=await page.evaluate(async()=>{const r=window.landingRecording;r.recorder.stop();const data=await r.done;r.stream.getTracks().forEach(t=>t.stop());return data;});
  fs.writeFileSync(`outputs/cmu-stance-chain-motion/${view}.webm`,Buffer.from(encoded,'base64'));await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
