const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:4173',out='outputs/midfoot';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,profiles:[],checks:[],errors:[]};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await browser.newPage({viewport:{width:1280,height:1030}});p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state),seek=t=>p.evaluate(t=>window.stagePreview.seek(t),t);
 const input=(id,v)=>p.locator('#'+id).fill(String(v)),keep=s=>({model:s.model,scale:s.scale,ratios:s.ratios,leg:s.leg,elbow:s.elbow,lean:s.lean});
 await p.goto(base+'/body');await ready();
 for(const model of ['male','female'])for(const custom of [false,true]){
  console.log('Checking',model,custom?'changed body':'default body');
  if(new URL(p.url()).pathname!='/body'){await p.click('nav [data-step=body]');await ready();}
  await p.selectOption('#model',model);await ready();await p.click('#reset-body');await ready();
  if(custom)for(const [key,k]of [['scale','End'],['torso','End'],['shoulders-r','Home'],['upperArm-r','End'],['forearm-r','Home'],['thigh-r','End'],['shin-r','Home']]){await p.locator(`[data-body-part="${key}"]`).focus();await p.keyboard.press(k);}
  await p.click('#next');await ready();await input('leg',5);await input('elbow',10);await input('lean',8);await seek(.28);
  await p.selectOption('#strike','original');const before=await state();await p.selectOption('#strike','midfoot');assert.equal((await state()).strike,'midfoot');assert.deepEqual(keep(await state()),keep(before));assert.equal(await p.evaluate(()=>window.stagePreview.applied.midfoot),1);
  const metrics=await p.evaluate(()=>{
   const r=window.stagePreview;r.seek(.28);const rt=r.runtime,m=rt.lane.model,bones=[];m.traverse(o=>{if(o.isBone)bones.push(o);});
   const legSets={};for(const side of ['r','l']){legSets[side]=new Set();m.getObjectByName('thigh_'+side).traverse(o=>{if(o.isBone)legSets[side].add(o);});}
   const pos=b=>b.getWorldPosition(b.position.clone()),sample=()=>bones.map(b=>({matrix:b.matrixWorld.elements.slice(),p:pos(b),length:b.parent?.isBone?pos(b).distanceTo(pos(b.parent)):0}));
   // Independent Three.js skin evaluation, not the diagnostic's batched math.
   const patch=side=>{const result={};for(const region of ['heel','forefoot']){const ids=rt.footPatches[side][region],center=m.position.clone().set(0,0,0);let min=Infinity;const updated=new Set();for(const v of ids){const mesh=m.getObjectByName(v.mesh);if(!updated.has(mesh.skeleton)){mesh.skeleton.update();updated.add(mesh.skeleton);}const p=mesh.getVertexPosition(v.id,m.position.clone()).applyMatrix4(mesh.matrixWorld);min=Math.min(min,p.y);center.add(p);}result[region]={min,center:center.divideScalar(ids.length)};}result.anchor=result.heel.center.clone().add(result.forefoot.center).multiplyScalar(.5);return result;};
   const max={rootMatrix:0,upperMatrix:0,inactiveLegMatrix:0,lengthMm:0,floorChangeMm:0,anchorShiftMm:0,gapMm:0,patchHeightAboveFloorMm:0,initialPatchHeightAboveFloorMm:0,zeroRepeat:0,entryExitDeltaMm:0,legParameter:0,armParameter:0,leanParameter:0},contact=[],floorMinimum= {value:Infinity};let samples=0,contactSamples=0,sumBefore=0,sumAfter=0;
   for(let i=0;i<=200;i++)for(const params of [[0,0,0],[5,10,8],[10,-20,-10]]){
    const phase=i/200,d0=rt.apply(phase,...params,0),old=sample(),root=m.matrixWorld.elements.slice(),feet={};
    for(const s of ['r','l'])feet[s]={patch:patch(s),floor:rt.lane.readSurface(s).min};
    const d=rt.apply(phase,...params,1),active=new Set(d.midfoot.map(x=>x.side));
    bones.forEach((b,j)=>{let group='upperMatrix';for(const s of ['r','l'])if(legSets[s].has(b)){group=active.has(s)?null:'inactiveLegMatrix';break;}
     if(group)b.matrixWorld.elements.forEach((n,k)=>max[group]=Math.max(max[group],Math.abs(n-old[j].matrix[k])));
     if(b.parent?.isBone)max.lengthMm=Math.max(max.lengthMm,Math.abs(pos(b).distanceTo(pos(b.parent))-old[j].length)*1000);
    });m.matrixWorld.elements.forEach((n,j)=>max.rootMatrix=Math.max(max.rootMatrix,Math.abs(n-root[j])));
    for(const x of d.midfoot){const s=x.side,after=patch(s),floor=rt.lane.readSurface(s).min,before=feet[s];
     max.floorChangeMm=Math.max(max.floorChangeMm,Math.abs(floor-before.floor)*1000);floorMinimum.value=Math.min(floorMinimum.value,floor*1000);
     max.anchorShiftMm=Math.max(max.anchorShiftMm,Math.hypot(after.anchor.x-before.patch.anchor.x,after.anchor.z-before.patch.anchor.z)*1000);
     const t=((phase-(s==='l'?.5:0))%1+1)%1;
     if(t>=.28-1e-10&&t<=.34+1e-10){const gap=Math.abs(after.forefoot.min-after.heel.min)*1000,oldGap=Math.abs(before.patch.forefoot.min-before.patch.heel.min)*1000;
      max.gapMm=Math.max(max.gapMm,gap);max.patchHeightAboveFloorMm=Math.max(max.patchHeightAboveFloorMm,Math.max(after.heel.min,after.forefoot.min)*1000-floor*1000);sumBefore+=oldGap;sumAfter+=gap;contactSamples++;
      if(Math.abs(t-.28)<1e-9)max.initialPatchHeightAboveFloorMm=Math.max(max.initialPatchHeightAboveFloorMm,Math.max(after.heel.min,after.forefoot.min)*1000-floor*1000);
      if(params[0]===5&&Math.abs(t-.28)<1e-9)contact.push({side:s,phase,beforeGapMm:oldGap,gapMm:gap,heelMm:after.heel.min*1000,forefootMm:after.forefoot.min*1000,rotationDeg:x.rotationDeg});
     }
    }
    d.legHeight.forEach((x,j)=>max.legParameter=Math.max(max.legParameter,Math.abs(x.riseCm-d0.legHeight[j].riseCm)));
    d.elbowBend.forEach((x,j)=>max.armParameter=Math.max(max.armParameter,Math.abs(x.actualDeg-d0.elbowBend[j].actualDeg)));
    max.leanParameter=Math.max(max.leanParameter,Math.abs(d.upperLean.offsetDeg-d0.upperLean.offsetDeg));
    rt.apply(phase,...params,0);bones.forEach((b,j)=>b.matrixWorld.elements.forEach((n,k)=>max.zeroRepeat=Math.max(max.zeroRepeat,Math.abs(n-old[j].matrix[k]))));samples++;
   }
   for(const t of [.16,.42,.66,.92])for(const dt of [-.0001,0,.0001]){
    rt.apply(t+dt,5,10,8,0);const old=sample();rt.apply(t+dt,5,10,8,1);bones.forEach((b,j)=>max.entryExitDeltaMm=Math.max(max.entryExitDeltaMm,pos(b).distanceTo(old[j].p)*1000));
   }
   r.seek(.28);return {samples,contactSamples,max,meanBeforeGapMm:sumBefore/contactSamples,meanAfterGapMm:sumAfter/contactSamples,minFloorMm:floorMinimum.value,contact};
  });
  console.log(JSON.stringify({model,custom,...metrics}));report.profiles.push({model,custom,...metrics});
  for(const key of ['rootMatrix','upperMatrix','inactiveLegMatrix','zeroRepeat','legParameter','armParameter','leanParameter'])assert.equal(metrics.max[key],0,key);
  assert(metrics.max.lengthMm<.001);assert(metrics.max.floorChangeMm<.02);assert(metrics.max.anchorShiftMm<.02);assert(metrics.max.gapMm<1);assert(metrics.max.initialPatchHeightAboveFloorMm<1);assert(metrics.max.patchHeightAboveFloorMm<2);assert(metrics.meanAfterGapMm<metrics.meanBeforeGapMm);assert(metrics.minFloorMm>-.1);assert(metrics.max.entryExitDeltaMm<.001);
  for(const view of ['front','side']){await p.click('#'+view);await seek(.28);await p.screenshot({path:`${out}/${model}-${custom?'custom':'base'}-${view}.png`,fullPage:true});}
  // Existing inputs still change independently while midfoot stays selected.
  await input('leg',7);await input('elbow',5);await input('lean',10);assert.equal((await state()).strike,'midfoot');await input('leg',5);await input('elbow',10);await input('lean',8);
  const saved=await state();await p.click('#play');await p.selectOption('#strike','original');await p.waitForFunction(()=>window.stagePreview.applied.midfoot===0);await p.selectOption('#strike','midfoot');await p.waitForFunction(()=>window.stagePreview.applied.midfoot===1);await p.click('#play');assert.deepEqual(await state(),saved);
  await p.click('#next');assert((await p.locator('#summary').innerText()).includes('미드풋'));await p.click('#previous');await ready();assert.deepEqual(await state(),saved);await p.reload();await ready();assert.deepEqual(await state(),saved);
 }
 report.checks.push('2412 before/after poses: both sexes, default and resized bodies, three leg/elbow/lean combinations','Independent skin patch measurements: heel/forefoot contact, ground height, material anchor and bone length checks','Default restores exactly; upper body/root and inactive leg unchanged; boundary perturbations and both half-cycle contact phases checked','Selection and existing inputs coexist; live transitions reach both targets; stage round-trip and reload preserve all values');
 await p.setViewportSize({width:390,height:844});await seek(.28);await p.click('#front');await p.evaluate(()=>scrollTo(0,0));
 const box=await p.locator('#strike').boundingBox();assert(box.y>0&&box.y+box.height<844);await p.selectOption('#strike','original');await p.selectOption('#strike','midfoot');assert.equal((await state()).strike,'midfoot');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/mobile.png'});
 for(const [value,expected]of [[undefined,'original'],['invalid','original'],['midfoot','midfoot']]){
  await p.evaluate(v=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify({version:1,leg:5,elbow:10,lean:8,strike:v})),value);await p.goto(base+'/body');await ready();const s=await state();assert.equal(s.strike,expected);assert.equal(s.lean,8);assert.equal(s.leg,5);assert.equal(s.elbow,10);
 }
 report.checks.push('390px selector visible next to model without settings-panel scrolling; no horizontal overflow','Old and invalid saved mode defaults to original; other pose settings preserved');assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync('docs/05-validation/reports/midfoot.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
