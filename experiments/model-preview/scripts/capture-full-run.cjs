// M72: record the current M71 result, without modifying its motion pipeline.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const output='outputs/cmu-full-run-review',report={errors:[],recordings:[],captures:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=hand-pose');
  await page.waitForFunction(()=>window.sharedGaitReview?.ready);
  await page.evaluate(async()=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
   a.renderer.setAnimationLoop(null);a.lanes[0].group.visible=false;
   const lane=a.lanes[1];lane.group.position.set(0,0,0);lane.group.updateMatrixWorld(true);
   lane.lines.forEach(l=>l.visible=false);a.renderer.setSize(540,680);
   Object.assign(a.camera,{left:-.82,right:.82,top:1.03,bottom:-1.03});a.camera.updateProjectionMatrix();
   window.drawFullRun=(t,view)=>{
    a.handPosePlan.apply(lane,a.probe,t);
    const center=lane.model.getObjectByName('pelvis').getWorldPosition(new T.Vector3());center.y=.95;
    a.camera.position.copy(center).add(new T.Vector3(view==='side'?10:0,0,view==='side'?0:10));
    a.camera.lookAt(center);a.renderer.render(a.scene,a.camera);
   };
  });
  for(const view of ['front','side']){
   for(const phase of [.55,.58,.61,.64,.68,.72]){
    const png=await page.evaluate(({phase,view})=>{window.drawFullRun(phase,view);return window.sharedGaitReview.renderer.domElement.toDataURL().split(',')[1];},{phase,view});
    const path=`${output}/release-${view}-${Math.round(phase*100)}.png`;
    fs.writeFileSync(path,Buffer.from(png,'base64'));report.captures.push({phase,view,path});
   }
   const result=await page.evaluate(async view=>{
    const a=window.sharedGaitReview,source=a.renderer.domElement,c=document.createElement('canvas');
    c.width=540;c.height=730;const ctx=c.getContext('2d'),times=[];
    const stream=c.captureStream(60),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});
    const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});
    recorder.start();let start;
    await new Promise(resolve=>{
     function frame(now){
      start??=now;const seconds=(now-start)/1000;
      window.drawFullRun((seconds/a.data.seconds)%1,view);times.push(now);
      ctx.fillStyle='#f6f5f1';ctx.fillRect(0,0,540,730);ctx.drawImage(source,0,50);
      ctx.fillStyle='#233b32';ctx.font='18px sans-serif';
      ctx.fillText(`현재 M71 · ${view==='front'?'정면':'측면'} · 1배속 · 보정 없음`,20,31);
      if(seconds<3.1)requestAnimationFrame(frame);else resolve();
     }
     requestAnimationFrame(frame);
    });
    recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());
    let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const gaps=times.slice(1).map((t,i)=>t-times[i]);
    return {encoded:btoa(text),frames:times.length,durationMs:times.at(-1)-times[0],maxFrameGapMs:Math.max(...gaps)};
   },view);
   const file=`${output}/${view}.webm`;fs.writeFileSync(file,Buffer.from(result.encoded,'base64'));
   delete result.encoded;
   // Decode separate timestamps to verify the file contains moving frames.
   const decoded=await page.evaluate(async encoded=>{
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'video/webm'}));
    const v=document.createElement('video');v.src=url;await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=rej;});
    const c=document.createElement('canvas');c.width=270;c.height=365;const ctx=c.getContext('2d'),images=[];
    for(const t of [.1,.3,.5]){v.currentTime=t;await new Promise(res=>v.onseeked=res);ctx.drawImage(v,0,0,270,365);images.push(c.toDataURL());}
    URL.revokeObjectURL(url);return images;
   },fs.readFileSync(file).toString('base64'));
   assert.equal(new Set(decoded.map(x=>crypto.createHash('sha256').update(x).digest('hex'))).size,3);
   report.recordings.push({view,file,...result,decodedDifferentFrames:3});
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-full-run-media.json',JSON.stringify(report,null,2));await browser.close();
 }
 console.log(report.recordings);
})().catch(e=>{console.error(e);process.exitCode=1;});
