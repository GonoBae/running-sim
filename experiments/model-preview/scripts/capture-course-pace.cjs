const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const out='outputs/course-pace';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json'));
 await p.goto('http://127.0.0.1:5173/course');await p.waitForFunction(()=>window.stagePreview?.ready);
 await p.evaluate(a=>{const s=window.stagePreview.state;Object.assign(s,{model:'female',scale:1.05,leg:5,elbow:10,lean:8,strike:'midfoot',course:{id:a.id,revision:a.revision,startDistanceM:1121.8640021884382,direction:'reverse',laps:6,goal:{type:'distance',distanceM:5000},paceSecondsPerKm:360}});s.ratios.thigh=1.1;s.ratios.forearm=.95;sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s));},asset);
 await p.reload();await p.waitForFunction(()=>window.stagePreview?.ready&&!document.getElementById('next').disabled);await p.screenshot({path:out+'/settings.png',fullPage:true});
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:out+'/mobile.png',fullPage:true});await p.setViewportSize({width:1440,height:1100});
 await p.click('#next');await p.waitForFunction(()=>window.courseRunPreview?.ready);await p.locator('#run-progress').fill('0.02');
 for(const view of ['front','side']){
  await p.click('#'+view);await p.screenshot({path:out+'/run-'+view+'.png',fullPage:true});await p.click('#run-play');
  const recording=await p.evaluate(async view=>{
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=550;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(30),chunks=[],samples=[];
   const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm',recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});
   const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});recorder.start();const begin=performance.now();
   await new Promise(resolve=>{function capture(){const f=window.courseRunPreview.frame;ctx.fillStyle='#f7f8f5';ctx.fillRect(0,0,1200,550);ctx.fillStyle='#294632';ctx.font='bold 22px "Malgun Gothic"';ctx.fillText('5 km · 목표 6:00/km · 예상 30:00',24,34);ctx.font='16px "Malgun Gothic"';ctx.fillText(view==='front'?'정면 · 같은 시점':'측면 · 같은 시점',930,34);
    ctx.drawImage(document.querySelector('#course-run-viewport canvas'),0,52,900,450);ctx.drawImage(document.querySelector('#viewport canvas'),920,52,280,450);ctx.fillText(`반시계 방향 · ${(f.distanceM/1000).toFixed(3)} km · 10.00 km/h · 실제 재생 화면`,24,533);samples.push({elapsed:f.elapsed,distance:f.distanceM,phase:f.phase});
    if(performance.now()-begin<6500)requestAnimationFrame(capture);else resolve();}requestAnimationFrame(capture);});recorder.stop();const blob=await done,bytes=new Uint8Array(await blob.arrayBuffer());stream.getTracks().forEach(t=>t.stop());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(str),samples,mime};
  },view);
  await p.click('#run-play');fs.writeFileSync(`${out}/course-pace-${view}.webm`,Buffer.from(recording.base64,'base64'));
  const first=recording.samples[0],last=recording.samples.at(-1),speed=(last.distance-first.distance)/(last.elapsed-first.elapsed);assert(Math.abs(speed-1000/360)<1e-8);assert(recording.samples.filter((s,i)=>i&&s.phase<recording.samples[i-1].phase).length>=2);
  await p.locator('#run-progress').fill('0.02');
 }
 await p.locator('#run-progress').fill('1');await p.screenshot({path:out+'/finish.png',fullPage:true});
 const decoded=[];for(const view of ['front','side']){await p.goto(pathToFileURL(path.resolve(`${out}/course-pace-${view}.webm`)).href);await p.waitForFunction(()=>document.querySelector('video')?.readyState>=2);for(const t of [1,3,5]){await p.evaluate(async t=>{const v=document.querySelector('video');v.pause();await new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=t;});},t);await p.locator('video').screenshot({path:`${out}/video-${view}-${t}.png`});decoded.push({view,seconds:t});}}
 for(const file of ['settings','mobile','run-front','run-side','finish'])fs.copyFileSync(`${out}/${file}.png`,`docs/assets/images/course-pace-${file}.png`);
 assert.deepEqual(errors,[]);const report={status:'passed',fixture:'Isolated custom female, 5 km reverse, target 6:00/km; user storage untouched',screens:5,videoViews:['front','side'],decoded,speedMps:1000/360,durationSeconds:1800,errors};fs.writeFileSync('docs/05-validation/reports/course-pace-media.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
