const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('fs'),assert=require('assert/strict');
// Run from the repository root against the local preview. PLAYWRIGHT_PATH may name an existing installation.
fs.mkdirSync('outputs',{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[],reports=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>document.body.dataset.loaded==='true');
 const measure=()=>page.evaluate(()=>{
  const a=window.modelPreview;a.model.updateMatrixWorld(true);let mesh;a.model.traverse(o=>{if(o.isSkinnedMesh)mesh=o});mesh.skeleton.update();
  const v=a.camera.position.clone(),points=[];for(let i=0;i<mesh.geometry.attributes.position.count;i+=13){mesh.getVertexPosition(i,v);mesh.localToWorld(v);points.push(...v.toArray());}
  const p=n=>a.bones.find(b=>b.name===n).getWorldPosition(v.clone());let error=0;
  for(const side of ['l','r']){
   const arm=p('lowerarm_'+side).sub(p('upperarm_'+side)).normalize(),fore=p('hand_'+side).sub(p('lowerarm_'+side)).normalize(),leg=p('calf_'+side).sub(p('thigh_'+side)).normalize(),shin=p('foot_'+side).sub(p('calf_'+side)).normalize();
   [Math.atan2(arm.z,-arm.y),arm.angleTo(fore),Math.atan2(leg.z,-leg.y),leg.angleTo(shin)].forEach((r,i)=>error=Math.max(error,Math.abs(r*180/Math.PI-a.runningPose.values[['upperarm','lowerarm','thigh','calf'][i]+'_'+side])));
  }
  return {lengths:a.bodyDimensions.measure(),baseline:a.bodyDimensions.baseline,points,pose:{...a.runningPose.values},angleError:error,scale:a.model.scale.x,ratios:{...a.bodyDimensions.ratios}};
 });
 const difference=(a,b)=>Math.max(...a.map((n,i)=>Math.abs(n-b[i])));
 const edit=async(id,value)=>{await page.selectOption('#body-part',String(['upperArm','forearm','thigh','shin','torso','shoulders'].indexOf(id)));await page.locator('#part-number').fill(String(value));await page.locator('#part-number').dispatchEvent('change');};
 for(const type of ['male','female']){
  await page.locator(`[data-model-type=${type}]`).click();await page.waitForFunction(t=>document.body.dataset.loaded==='true'&&document.getElementById('filename').textContent===`runner-${t}.glb`,type);
  await page.evaluate(()=>{const p=window.modelPreview.runningPose;p.set('upperarm_l',30);p.set('thigh_r',45);p.set('calf_r',75);});
  const base=await measure(),cases=[];
  for(const id of Object.keys(base.lengths))for(const factor of [.85,1.15]){
   await page.locator('#reset-lengths').click();await edit(id,base.lengths[id]*factor);
   const after=await measure();
   assert(Math.abs(after.lengths[id]-base.lengths[id]*factor)<.0001,`${type} ${id} incorrect length`);
   for(const other of Object.keys(base.lengths).filter(k=>k!==id))assert(Math.abs(after.lengths[other]-base.lengths[other])<.0001,`${id} changed ${other}: ${after.lengths[other]} vs ${base.lengths[other]}, ratios ${JSON.stringify(after.ratios)}`);
   assert.deepEqual(after.pose,base.pose);assert(after.angleError<.0001);assert(after.points.every(Number.isFinite));
   const meshDelta=difference(base.points,after.points);assert(meshDelta>.001,'Mesh did not deform');
   cases.push({id,factor,actualCm:after.lengths[id],meshDelta,angleError:after.angleError});
  }
  await page.locator('#reset-lengths').click();const reset=await measure(),resetError=difference(base.points,reset.points);assert(resetError<.00001,`Reset drift ${resetError}`);
  for(const id of Object.keys(base.lengths))await edit(id,base.lengths[id]*1.15);
  const combined=await measure();for(const id of Object.keys(base.lengths))assert(Math.abs(combined.lengths[id]-base.lengths[id]*1.15)<.0001);
  await page.locator('#skeleton').check();await page.locator('#fit').click();await page.locator('#length-section').scrollIntoViewIfNeeded();
  await page.screenshot({path:`outputs/lengths-${type}-front.png`});await page.locator('[data-view=side]').click();await page.screenshot({path:`outputs/lengths-${type}-side.png`});
  await page.locator('#body-height').evaluate(i=>{i.value=i.max;i.dispatchEvent(new Event('input'));});
  const scaled=await measure();await edit('thigh',scaled.lengths.thigh*.85/1.15);const changed=await measure();assert(Math.abs(changed.scale-scaled.scale)<1e-8);assert(changed.angleError<.0001);
  reports.push({type,cases,resetError,combinedAngleError:combined.angleError,scaleRetained:changed.scale});
  await page.locator('#apply-settings').click();
 }
 const data=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).map(k=>JSON.parse(localStorage.getItem(k))).filter(e=>e.kind==='configuration_applied'));
 assert.equal(data.length,2);assert(data.every(e=>e.bodyRecipe==='rest-lengths-v1'&&Object.keys(e.lengthsCm).length===6));
 const rankCount=await page.evaluate(async sample=>{
  const {ranked}=await import('/src/analytics.ts');
  return ranked([sample,{...sample,lengthsCm:{...sample.lengthsCm,thigh:sample.lengthsCm.thigh+3}}],'body').length;
 },data[0]);assert.equal(rankCount,2,'Different lengths with same height were merged');
 const admin=await context.newPage();await admin.goto('http://127.0.0.1:5173/admin');await admin.locator('#length-thigh').uncheck();await admin.locator('button[type=submit]').click();await admin.waitForFunction(()=>document.getElementById('revision').textContent.includes('v1'));
 await page.reload();await page.waitForFunction(()=>document.body.dataset.loaded==='true');assert.equal(await page.locator('#body-part option').count(),5);
 assert.equal(await page.evaluate(()=>window.modelPreview.bodyDimensions.set('thigh',50)),false);
 assert.deepEqual(errors,[]);
 fs.writeFileSync('docs/05-validation/reports/body-dimensions-verification.json',JSON.stringify({date:new Date().toISOString(),reports,eventLengthsVerified:true,sameHeightDifferentLengthsSeparated:true,adminCategoryEnforced:true,errors},null,2));console.log(JSON.stringify({models:reports.length,cases:reports.reduce((n,r)=>n+r.cases.length,0),errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
