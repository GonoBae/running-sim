const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const out='outputs/foot-strike';fs.mkdirSync(out,{recursive:true});const p=await b.newPage({viewport:{width:1280,height:1030}}),errors=[],videos=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/pose');await p.waitForFunction(()=>window.stagePreview?.ready);await p.evaluate(()=>window.stagePreview.seek(.28));
 // Exercise the preserved direct manipulation inputs rather than injecting pose parameters.
 for(const [key,dy]of [['leg-r',-40],['elbow-l',-30],['lean-center',-24]]){const c=await p.locator(`[data-pose-part="${key}"]`).boundingBox();await p.mouse.move(c.x+c.width/2,c.y+c.height/2);await p.mouse.down();await p.mouse.move(c.x+c.width/2,c.y+c.height/2+dy,{steps:4});await p.mouse.up();}
 assert.equal(await p.inputValue('#leg'),'5');assert.equal(await p.inputValue('#elbow'),'10');assert.equal(await p.inputValue('#lean'),'8');
 for(const view of ['front','side']){
  await p.click('#'+view);
  for(const mode of ['heel','midfoot','forefoot']){await p.evaluate(()=>window.stagePreview.seek(.28));await p.selectOption('#strike',mode);await p.locator('#viewport canvas').screenshot({path:`${out}/${mode}-${view}.png`});if(mode==='forefoot')await p.screenshot({path:`${out}/screen-${view}.png`,fullPage:true});}
  await p.selectOption('#strike','heel');await p.evaluate(()=>window.stagePreview.seek(.28));
  await p.evaluate(view=>{const source=document.querySelector('#viewport canvas'),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height+66;
   const ctx=canvas.getContext('2d');let active=true;const times=[];
   function draw(t){times.push(t);ctx.fillStyle='#eff2ec';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,66);ctx.fillStyle='#294632';ctx.font='17px sans-serif';ctx.textAlign='center';const label=document.querySelector('#strike').selectedOptions[0].textContent;ctx.fillText(label+' 착지 · 상체 +8° / 다리 +5cm / 팔 +10°',canvas.width/2,26);ctx.fillText((view==='front'?'정면':'측면')+' · 실제 1배속 재생',canvas.width/2,51);if(active)requestAnimationFrame(draw);}
   requestAnimationFrame(draw);const stream=canvas.captureStream(60),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
   window.strikeVideo={recorder,stream,times,done:new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{active=false;const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(s));};})};recorder.start();
  },view);
  const segments=[];for(const mode of ['heel','midfoot','forefoot']){await p.selectOption('#strike',mode);await p.evaluate(()=>window.stagePreview.seek(.28));const start=await p.evaluate(()=>window.strikeVideo.times.at(-1)-window.strikeVideo.times[0]);await p.click('#play');await p.waitForTimeout(2700);await p.click('#play');segments.push({mode,startMs:start});}
  const data=await p.evaluate(async()=>{const r=window.strikeVideo;r.recorder.stop();const encoded=await r.done;r.stream.getTracks().forEach(t=>t.stop());return {encoded,frames:r.times.length,durationMs:r.times.at(-1)-r.times[0]};});
  const file=`${out}/compare-${view}.webm`;fs.writeFileSync(file,Buffer.from(data.encoded,'base64'));delete data.encoded;videos.push({view,file,...data,segments});
 }
 const decoder=await b.newPage();for(const entry of videos){await decoder.goto(pathToFileURL(path.resolve(entry.file)).href);await decoder.waitForFunction(()=>document.querySelector('video')?.readyState>=2);const hashes=[];
  for(const t of [.3,1.5,3.7,6.8]){await decoder.evaluate(async t=>{const v=document.querySelector('video');v.pause();await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=t;});},t);const im=await decoder.locator('video').screenshot();hashes.push(crypto.createHash('sha256').update(im).digest('hex'));fs.writeFileSync(`${out}/decoded-${entry.view}-${t}.png`,im);}assert.equal(new Set(hashes).size,4);entry.decodedFrames=4;entry.error=await decoder.evaluate(()=>document.querySelector('video').error?.message||null);assert.equal(entry.error,null);}
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/05-validation/reports/foot-strike-media.json',JSON.stringify({status:'passed',errors,videos},null,2));console.log(videos);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
