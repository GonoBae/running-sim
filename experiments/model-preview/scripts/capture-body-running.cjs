const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const out='outputs/body-running';fs.mkdirSync(out,{recursive:true});const p=await b.newPage({viewport:{width:1280,height:1150}}),errors=[],recordings=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5173/body');const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready);
 const input=async(id,value)=>{await p.locator('#'+id).fill(String(value));await p.locator('#'+id).dispatchEvent('input');};
 for(const type of ['male','female']){
  if(type==='female'){await p.click('nav [data-step=body]');await ready();await p.selectOption('#model',type);}
  await ready();await p.click('#reset-body');await ready();await p.click('#next');await ready();await input('leg',5);await input('elbow',10);
  await p.evaluate(()=>window.stagePreview.seek(.24));await p.click('#front');await p.screenshot({path:`${out}/${type}-baseline.png`,fullPage:true});
  await p.click('nav [data-step=body]');await ready();
  // Values are entered through the actual body controls, not injected state.
  if(!await p.locator('#body-panel').evaluate(e=>e.open))await p.locator('#body-panel summary').click();
  for(const [part,end]of [['thigh','max'],['shin','min'],['upperArm','max'],['forearm','min'],['torso','max'],['shoulders','max']]){
   await p.selectOption('#part',part);await p.focus('#length');await p.keyboard.press(end==='max'?'End':'Home');
  }
  await input('scale',110);await p.screenshot({path:`${out}/${type}-body.png`,fullPage:true});const settings=await p.evaluate(()=>window.stagePreview.state);
  await p.click('#next');await ready();assert.equal(await p.inputValue('#leg'),'5');assert.equal(await p.inputValue('#elbow'),'10');
  for(const view of ['front','side']){
   await p.click('#'+view);await p.evaluate(()=>window.stagePreview.seek(.24));await p.screenshot({path:`${out}/${type}-${view}.png`,fullPage:true});await p.evaluate(()=>window.stagePreview.seek(0));
   await p.evaluate(type=>{
    const source=document.querySelector('#viewport canvas'),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height+82;
    const ctx=canvas.getContext('2d'),times=[];let running=true;
    function draw(t){times.push(t);ctx.fillStyle='#eff2ec';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,82);ctx.fillStyle='#294632';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText((type==='male'?'남성형':'여성형')+' · 변경한 신체 · 전체 크기 110%',canvas.width/2,30);ctx.font='16px sans-serif';ctx.fillText('다리 +5cm · 팔 +10° · 실제 1배속 재생',canvas.width/2,59);if(running)requestAnimationFrame(draw);}
    requestAnimationFrame(draw);const stream=canvas.captureStream(60),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
    window.bodyRecording={recorder,stream,times,done:new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{running=false;const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(text));};})};recorder.start();
   },type);
   await p.click('#play');await p.waitForTimeout(3400);await p.click('#play');
   const video=await p.evaluate(async()=>{const r=window.bodyRecording;r.recorder.stop();const encoded=await r.done;r.stream.getTracks().forEach(t=>t.stop());return {encoded,frames:r.times.length,durationMs:r.times.at(-1)-r.times[0],maxFrameGapMs:Math.max(...r.times.slice(1).map((t,i)=>t-r.times[i]))};});
   fs.writeFileSync(`${out}/${type}-${view}.webm`,Buffer.from(video.encoded,'base64'));delete video.encoded;recordings.push({type,view,settings,...video});
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/05-validation/reports/body-running-media.json',JSON.stringify({status:'passed',errors,recordings},null,2));console.log(recordings);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
