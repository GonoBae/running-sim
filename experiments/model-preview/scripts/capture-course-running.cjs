const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path');
const base='http://127.0.0.1:5173',out='outputs/course-running';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/body');const profile={version:1,model:'male',scale:1.05,ratios:{upperArm:1.1,forearm:.95,thigh:1.1,shin:.9,torso:1.05,shoulders:1},leg:5,elbow:10,lean:8,strike:'midfoot',course:{id:'gimhae-lotte-garden-b',revision:'b-0b90da498b8f',startDistanceM:0,direction:'forward',laps:2}};
 await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),profile);await p.goto(base+'/backtest');await p.waitForFunction(()=>window.courseRunPreview?.ready);await p.locator('#run-progress').fill('0.018');
 const fits=[];
 for(const width of [1440,390]){
  await p.setViewportSize({width,height:1100});await p.click('#run-overview');
  const fitsAll=await p.evaluate(async()=>{const a=await(await fetch('/courses/lotte-garden-b-v1.json')).json(),c=await import('/src/course.ts'),course=c.createCourse(a),camera=window.courseRunPreview.camera;return course.local.every(v=>{const q=camera.position.clone().set(v[0],0,-v[1]).project(camera);return Math.abs(q.x)<.95&&Math.abs(q.y)<.95&&q.z>-1&&q.z<1;});});assert(fitsAll);fits.push({width,allRouteVerticesVisible:true});
  if(width===1440)await p.screenshot({path:out+'/run-overview.png',fullPage:true});else await p.screenshot({path:out+'/run-mobile.png',fullPage:true});
 }
 await p.setViewportSize({width:1440,height:1100});await p.click('#run-follow');await p.click('#side');await p.click('#run-play');
 const recorded=await p.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=550;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(30),chunks=[],samples=[];
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000});
  const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});
  recorder.start();const begin=performance.now();
  await new Promise(resolve=>{function capture(){const run=window.courseRunPreview,f=run.frame;ctx.fillStyle='#f7f8f5';ctx.fillRect(0,0,1200,550);ctx.fillStyle='#294632';ctx.font='bold 22px "Malgun Gothic"';ctx.fillText('설정한 코스 위 달리기',24,34);ctx.font='15px "Malgun Gothic"';ctx.fillText('같은 시점 · 자세',930,34);
   const a=document.querySelector('#course-run-viewport canvas'),b=document.querySelector('#viewport canvas');ctx.drawImage(a,0,52,900,450);ctx.drawImage(b,920,52,280,450);ctx.font='15px "Malgun Gothic"';ctx.fillText(`시계 방향 · 2바퀴 · ${(f.distanceM/1000).toFixed(2)} km / ${(f.totalM/1000).toFixed(2)} km · 화면 재생`,24,533);
   const h=run.model.getObjectByName('pelvis').getWorldPosition(run.group.position.clone());samples.push({t:f.elapsed,phase:f.phase,p:h.toArray()});
   if(performance.now()-begin<8000)requestAnimationFrame(capture);else resolve();}requestAnimationFrame(capture);});
  recorder.stop();const blob=await done,bytes=new Uint8Array(await blob.arrayBuffer());stream.getTracks().forEach(t=>t.stop());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(str),samples,mime};
 });
 await p.click('#run-play');const file=path.resolve(out+'/course-running.webm');fs.writeFileSync(file,Buffer.from(recorded.base64,'base64'));
 let wraps=0,maxSpeed=0;for(let i=1;i<recorded.samples.length;i++){const a=recorded.samples[i-1],s=recorded.samples[i],dt=s.t-a.t;if(dt<=0)continue;const speed=Math.hypot(...s.p.map((v,j)=>v-a.p[j]))/dt;maxSpeed=Math.max(maxSpeed,speed);if(s.phase<a.phase)wraps++;}assert(wraps>=3);assert(maxSpeed<12,`Cycle seam jump: ${maxSpeed} m/s`);
 await p.goto(pathToFileURL(file).href);await p.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 const decoded=[];for(const t of [1,3,6]){await p.evaluate(async t=>{const v=document.querySelector('video');v.pause();await new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=t;});},t);await p.locator('video').screenshot({path:out+`/video-${t}.png`});decoded.push(t);}
 assert.deepEqual(errors,[]);const report={status:'passed',fits,video:{path:'outputs/course-running/course-running.webm',mime:recorded.mime,bytes:fs.statSync(file).size,decodedSeconds:decoded},motion:{samples:recorded.samples.length,cycleWraps:wraps,maxPelvisSpeedMps:maxSpeed,limitMps:12},note:'Real 8-second playback capture; wrap check detects teleporting, not a biomechanical validation'};fs.writeFileSync('docs/05-validation/reports/course-running-media.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
