// Short recordings of the real comparison page, not generated motion artwork.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{fs.mkdirSync('outputs/cmu-landing',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 for(const view of ['front','side']){
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=landing');await page.waitForFunction(()=>window.mocapReview?.ready);
  await page.click('#'+view);
  await page.evaluate(()=>{
   const stream=document.querySelector('#view canvas').captureStream(30),chunks=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
   window.landingRecording={recorder,stream,done:new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(text));};})};recorder.start();
  });
  for(let repeat=0;repeat<2;repeat++){
   await page.click('#play');await page.waitForFunction(()=>document.getElementById('play').textContent==='처음부터 재생');await page.waitForTimeout(250);
  }
  await page.evaluate(()=>window.mocapReview.seek(39));await page.waitForTimeout(300);
  const encoded=await page.evaluate(async()=>{const r=window.landingRecording;r.recorder.stop();const data=await r.done;r.stream.getTracks().forEach(t=>t.stop());return data;});
  fs.writeFileSync(`outputs/cmu-landing/${view}.webm`,Buffer.from(encoded,'base64'));await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
