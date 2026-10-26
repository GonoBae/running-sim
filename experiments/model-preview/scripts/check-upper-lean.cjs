const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:4173',out='outputs/upper-lean';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,profiles:[],checks:[],errors:[]};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await browser.newPage({viewport:{width:1280,height:1030}});p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state);
 const seek=t=>p.evaluate(t=>window.stagePreview.seek(t),t),input=(id,v)=>p.locator('#'+id).fill(String(v));
 const grip=p.locator('[data-pose-part="lean-center"]');
 const point=()=>grip.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 const snapshot=()=>p.evaluate(()=>({state:window.stagePreview.state,phase:window.stagePreview.phase,playing:window.stagePreview.playing}));
 const keep=s=>({model:s.model,scale:s.scale,ratios:s.ratios,leg:s.leg,elbow:s.elbow});
 async function drag(dy,cancel=false){const c=await point();await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x,c.y+dy,{steps:4});await p.evaluate(()=>new Promise(requestAnimationFrame));if(cancel)await p.keyboard.press('Escape');await p.mouse.up();}
 await p.goto(base+'/body');await ready();
 for(const model of ['male','female'])for(const custom of [false,true]){
  console.log('Checking',model,custom?'changed body':'default body');
  if(new URL(p.url()).pathname!='/body'){await p.click('nav [data-step=body]');await ready();}
  await p.selectOption('#model',model);await ready();await p.click('#reset-body');await ready();
  if(custom)for(const [key,k]of [['scale','End'],['torso','End'],['shoulders-r','Home'],['upperArm-r','End'],['forearm-r','Home'],['thigh-r','End'],['shin-r','Home']]){
   await p.locator(`[data-body-part="${key}"]`).focus();await p.keyboard.press(k);
  }
  await p.click('#next');await ready();await input('leg',5);await input('elbow',10);await input('lean',0);await seek(.24);await p.click('#front');
  const before=await snapshot();assert(await grip.isVisible());await drag(-24);const after=await snapshot();assert.equal(after.state.lean,8);assert.equal(after.phase,before.phase);assert(!after.playing);assert.deepEqual(keep(after.state),keep(before.state));
  await drag(15,true);assert.deepEqual(await snapshot(),after);
  await drag(-120);assert.equal((await state()).lean,15);await drag(180);assert.equal((await state()).lean,-10);
  await grip.focus();await p.keyboard.press('End');await p.keyboard.press('ArrowDown');assert.equal((await state()).lean,14);await p.keyboard.press('Home');assert.equal((await state()).lean,-10);
  await input('lean',0);await seek(.24);const c=await point();let skin=false;
  for(const [dx,dy]of [[26,0],[-26,0],[0,30],[0,-30],[35,15],[-35,15]]){
   const x=c.x+dx,y=c.y+dy;if(!await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName==='CANVAS',{x,y}))continue;
   await p.mouse.move(x,y);await p.mouse.down();const matched=await grip.evaluate(e=>e.classList.contains('selected')&&e.parentElement.classList.contains('is-dragging'));
   if(!matched){await p.keyboard.press('Escape');await p.mouse.up();continue;}
   await p.mouse.move(x,y-24,{steps:4});await p.mouse.up();skin=true;break;
  }
  assert(skin,'Direct torso skin must be draggable');assert.equal((await state()).lean,8);
  const metrics=await p.evaluate(()=>{
   const r=window.stagePreview;r.seek(.24);const rt=r.runtime,m=rt.lane.model,spine=m.getObjectByName('spine_01'),bones=[];m.traverse(o=>{if(o.isBone)bones.push(o);});
   const upper=new Set();spine.traverse(o=>{if(o.isBone)upper.add(o);});
   for(const name of ['head','upperarm_l','upperarm_r','hand_l','hand_r'])if(!upper.has(m.getObjectByName(name)))throw Error('Missing upper-body child: '+name);
   const pos=b=>b.getWorldPosition(b.position.clone());
   const elbow=side=>{const a=pos(m.getObjectByName('upperarm_'+side)),b=pos(m.getObjectByName('lowerarm_'+side)),c=pos(m.getObjectByName('hand_'+side));return b.clone().sub(a).angleTo(c.sub(b))*180/Math.PI;};
   const max={lowerMatrix:0,rootMatrix:0,soleHeight:0,rigidPositionM:0,rigidQuaternion:0,elbowAngleDeg:0,legRiseCm:0,zeroRepeat:0};let samples=0,minSole=Infinity,maxSole=-Infinity;
   for(let frame=0;frame<=20;frame++)for(const [leg,arm]of [[0,0],[5,10],[10,-20]]){
    const phase=frame/20,base=rt.apply(phase,leg,arm,0),pivot=pos(spine),root=m.matrixWorld.elements.slice(),original=bones.map(b=>({matrix:b.matrixWorld.elements.slice(),p:pos(b),q:b.getWorldQuaternion(b.quaternion.clone())}));
    const flex=['r','l'].map(elbow),sole=['r','l'].map(s=>rt.lane.readSurface(s).min);
    for(const lean of [-10,8,15]){
     const d=rt.apply(phase,leg,arm,lean),turn=spine.quaternion.clone().setFromAxisAngle(m.position.clone().set(1,0,0),lean*Math.PI/180);
     bones.forEach((b,i)=>{const old=original[i];if(upper.has(b)){
      const expected=old.p.clone().sub(pivot).applyQuaternion(turn).add(pivot);max.rigidPositionM=Math.max(max.rigidPositionM,expected.distanceTo(pos(b)));
      const q=old.q.clone().premultiply(turn),actual=b.getWorldQuaternion(b.quaternion.clone());max.rigidQuaternion=Math.max(max.rigidQuaternion,1-Math.min(1,Math.abs(q.normalize().dot(actual.normalize()))));
     }else b.matrixWorld.elements.forEach((n,j)=>{max.lowerMatrix=Math.max(max.lowerMatrix,Math.abs(n-old.matrix[j]));});});
     m.matrixWorld.elements.forEach((n,j)=>max.rootMatrix=Math.max(max.rootMatrix,Math.abs(n-root[j])));
     ['r','l'].forEach((s,i)=>{max.elbowAngleDeg=Math.max(max.elbowAngleDeg,Math.abs(elbow(s)-flex[i]));const h=rt.lane.readSurface(s).min;max.soleHeight=Math.max(max.soleHeight,Math.abs(h-sole[i]));minSole=Math.min(minSole,h);maxSole=Math.max(maxSole,h);});
     d.legHeight.forEach((x,i)=>max.legRiseCm=Math.max(max.legRiseCm,Math.abs(x.riseCm-base.legHeight[i].riseCm)));
     if(d.upperLean.offsetDeg!==lean)throw Error('Wrong lean diagnostic');samples++;
    }
    rt.apply(phase,leg,arm,0);bones.forEach((b,i)=>b.matrixWorld.elements.forEach((n,j)=>max.zeroRepeat=Math.max(max.zeroRepeat,Math.abs(n-original[i].matrix[j]))));
   }
   // Verify positive offset moves the head toward lane +Z, independently of Euler convention.
   rt.apply(.24,5,10,0);const h0=pos(m.getObjectByName('head'));rt.apply(.24,5,10,8);const headForward=pos(m.getObjectByName('head')).z-h0.z;
   r.seek(.24);return {samples,max,headForwardM:headForward,soleRangeM:[minSole,maxSole]};
  });
  console.log(JSON.stringify(metrics));
  assert.equal(metrics.max.lowerMatrix,0);assert.equal(metrics.max.rootMatrix,0);assert(metrics.max.soleHeight<1e-12);assert.equal(metrics.max.zeroRepeat,0);assert(metrics.max.rigidPositionM<1e-7);assert(metrics.max.rigidQuaternion<1e-10);assert(metrics.max.elbowAngleDeg<1e-4);assert.equal(metrics.max.legRiseCm,0);assert(metrics.headForwardM>.03);
  const handleVisibility={};for(const view of ['front','side']){await p.click('#'+view);await seek(.24);handleVisibility[view]=await grip.isVisible();await p.screenshot({path:`${out}/${model}-${custom?'custom':'base'}-${view}.png`,fullPage:true});}
  await p.click('#front');await seek(.24);const center=await point();await p.click('#play');await p.mouse.move(center.x,center.y);await p.mouse.down();assert(!await p.evaluate(()=>window.stagePreview.playing));assert(await grip.evaluate(e=>e.parentElement.classList.contains('is-dragging')));await p.mouse.up();
  await p.click('#play');const start=await p.evaluate(()=>window.stagePreview.phase);await p.waitForFunction(v=>Math.abs(window.stagePreview.phase-v)>.1,start);await input('lean',15);await p.waitForFunction(()=>window.stagePreview.applied.lean===15);await p.click('#play');await p.click('#reset-lean');assert.equal((await state()).lean,0);assert.deepEqual(keep(await state()),keep(before.state));
  await input('lean',8);const saved=await state();await p.click('#next');await p.click('#previous');await ready();assert.deepEqual(await state(),saved);await p.reload();await ready();assert.deepEqual(await state(),saved);
  report.profiles.push({model,custom,directSkin:true,handleVisibility,...metrics});console.log(JSON.stringify(report.profiles.at(-1)));
 }
 report.checks.push('Four profiles: torso handle and actual skin / clamp / keyboard / Escape / pause and replay / independent reset / stage round-trip and reload','756 pose samples: lower-body matrices, soles, leg lift and elbow flex preserved; entire upper subtree follows specified rotation; zero restores exactly');
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await seek(.24);await p.click('#front');await input('lean',0);await p.evaluate(()=>scrollTo(0,0));
 const touch=await p.context().newCDPSession(p),c=await point(),scroll=await p.evaluate(()=>scrollY);
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[c]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x,y:c.y-24}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state()).lean,8);assert.equal(await p.evaluate(()=>scrollY),scroll);
 const saved=await snapshot(),q=await point();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[q]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:q.x,y:q.y+18}]});await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await snapshot(),saved);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png'});
 report.checks.push('390px native browser touch and cancellation; no canvas scrolling or horizontal overflow');
 for(const [value,expected]of [[undefined,0],['bad',0],[null,0],[999,15],[-999,-10]]){
  await p.evaluate(v=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify({version:1,leg:5,elbow:10,lean:v})),value);await p.goto(base+'/body');await ready();const s=await state();assert.equal(s.lean,expected);assert.equal(s.leg,5);assert.equal(s.elbow,10);
 }
 report.checks.push('Old version-1 drafts without lean default to zero; invalid and out-of-range saved lean safely normalized');
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync('docs/05-validation/reports/upper-lean.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
