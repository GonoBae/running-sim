const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STAGE_URL||'http://127.0.0.1:4173',out='outputs/foot-strike';fs.mkdirSync(out,{recursive:true});
const report={status:'running',base,profiles:[],checks:[],errors:[]};
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:1030}});p.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>window.stagePreview?.ready),state=()=>p.evaluate(()=>window.stagePreview.state),seek=t=>p.evaluate(t=>window.stagePreview.seek(t),t);
 const keep=({strike,...s})=>s;
 await p.goto(base+'/body');await ready();
 for(const model of ['male','female'])for(const profile of ['base','mixed','min','max']){
  const ids=['torso','shoulders','upperArm','forearm','thigh','shin'],scale={base:1,mixed:1.1,min:.9,max:1.1}[profile];
  const ratios=Object.fromEntries(ids.map((id,i)=>[id,profile==='base'?1:profile==='min'?.85:profile==='max'?1.15:i%2?.85:1.15]));
  await p.evaluate(s=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s)),{version:1,model,scale,ratios,leg:5,elbow:10,lean:8,strike:'heel'});
  await p.goto(base+'/pose');await ready();await seek(.28);
  const metrics=await p.evaluate(()=>{
   const r=window.stagePreview,rt=r.runtime,m=rt.lane.model,bones=[];m.traverse(o=>{if(o.isBone)bones.push(o);});
   const legs={};for(const s of ['r','l']){legs[s]=new Set();m.getObjectByName('thigh_'+s).traverse(o=>{if(o.isBone)legs[s].add(o);});}
   const pos=b=>b.getWorldPosition(m.position.clone()),sample=()=>bones.map(b=>({matrix:b.matrixWorld.elements.slice(),p:pos(b),length:b.parent?.isBone?pos(b).distanceTo(pos(b.parent)):0}));
   const patch=side=>{const result={};for(const region of ['heel','forefoot']){const ids=rt.footPatches[side][region],center=m.position.clone().set(0,0,0),updated=new Set();let min=Infinity;
    for(const v of ids){const mesh=m.getObjectByName(v.mesh);if(!updated.has(mesh.skeleton)){mesh.skeleton.update();updated.add(mesh.skeleton);}const p=mesh.getVertexPosition(v.id,m.position.clone()).applyMatrix4(mesh.matrixWorld);min=Math.min(min,p.y);center.add(p);}result[region]={min,center:center.divideScalar(ids.length)};}result.anchor=result.heel.center.clone().add(result.forefoot.center).multiplyScalar(.5);return result;};
   const max={upperMatrix:0,inactiveLegMatrix:0,rootMatrix:0,lengthMm:0,floorChangeMm:0,anchorShiftMm:0,contactAboveFloorMm:0,parameterDelta:0,endpointDeltaMm:0,symmetryGapMm:0},contact=[],directions={heel:Infinity,forefoot:Infinity};let minFloor=Infinity,samples=0;
   for(const [mode,pitch] of [['heel',10],['forefoot',-10]])for(let i=0;i<=100;i++)for(const params of [[0,0,0],[10,-20,15]]){
    const phase=i/100,d0=rt.apply(phase,...params,0),old=sample(),root=m.matrixWorld.elements.slice(),before={};
    for(const s of ['r','l'])before[s]={patch:patch(s),floor:rt.lane.readSurface(s).min};
    const d=rt.apply(phase,...params,1,pitch),active=new Set(d.midfoot.map(x=>x.side));
    bones.forEach((b,j)=>{if(!b.matrixWorld.elements.every(Number.isFinite))throw Error('Non-finite bone');let key='upperMatrix';for(const s of ['r','l'])if(legs[s].has(b)){key=active.has(s)?null:'inactiveLegMatrix';break;}
     if(key)b.matrixWorld.elements.forEach((n,k)=>max[key]=Math.max(max[key],Math.abs(n-old[j].matrix[k])));if(b.parent?.isBone)max.lengthMm=Math.max(max.lengthMm,Math.abs(pos(b).distanceTo(pos(b.parent))-old[j].length)*1000);
    });m.matrixWorld.elements.forEach((n,j)=>max.rootMatrix=Math.max(max.rootMatrix,Math.abs(n-root[j])));
    for(const x of d.midfoot){const s=x.side,after=patch(s),floor=rt.lane.readSurface(s).min,t=((phase-(s==='l'?.5:0))%1+1)%1;
     max.floorChangeMm=Math.max(max.floorChangeMm,Math.abs(floor-before[s].floor)*1000);minFloor=Math.min(minFloor,floor*1000);
     max.anchorShiftMm=Math.max(max.anchorShiftMm,Math.hypot(after.anchor.x-before[s].patch.anchor.x,after.anchor.z-before[s].patch.anchor.z)*1000);
     if(t>=.28-1e-10&&t<=.34+1e-10){const gap=(after.forefoot.min-after.heel.min)*1000;directions[mode]=Math.min(directions[mode],mode==='heel'?gap:-gap);max.contactAboveFloorMm=Math.max(max.contactAboveFloorMm,(after[mode==='heel'?'heel':'forefoot'].min-floor)*1000);
      if(params[0]===0&&Math.abs(t-.28)<1e-9)contact.push({mode,side:s,phase,heelMm:after.heel.min*1000,forefootMm:after.forefoot.min*1000,floorMm:floor*1000,gapMm:gap});
     }
    }
    d.legHeight.forEach((x,j)=>max.parameterDelta=Math.max(max.parameterDelta,Math.abs(x.riseCm-d0.legHeight[j].riseCm)));d.elbowBend.forEach((x,j)=>max.parameterDelta=Math.max(max.parameterDelta,Math.abs(x.actualDeg-d0.elbowBend[j].actualDeg)));max.parameterDelta=Math.max(max.parameterDelta,Math.abs(d.upperLean.offsetDeg-d0.upperLean.offsetDeg));samples++;
   }
   for(const pitch of [-10,10])for(const t of [.16,.42,.66,.92])for(const dt of [-.0001,0,.0001]){rt.apply(t+dt,5,10,8,0);const old=sample();rt.apply(t+dt,5,10,8,1,pitch);bones.forEach((b,j)=>max.endpointDeltaMm=Math.max(max.endpointDeltaMm,pos(b).distanceTo(old[j].p)*1000));}
   for(const mode of ['heel','forefoot']){const right=contact.find(x=>x.mode===mode&&x.side==='r'),left=contact.find(x=>x.mode===mode&&x.side==='l');if(!right||!left)throw Error(JSON.stringify({mode,contact}));max.symmetryGapMm=Math.max(max.symmetryGapMm,Math.abs(right.gapMm-left.gapMm));}
   r.seek(.28);return {samples,max,minFloorMm:minFloor,minSeparationMm:directions,contact};
  });
  report.profiles.push({model,profile,scale,ratios,...metrics});console.log(model,profile,JSON.stringify(metrics.max),metrics.minSeparationMm);
  for(const key of ['upperMatrix','inactiveLegMatrix','rootMatrix','parameterDelta'])assert.equal(metrics.max[key],0,key);
  assert(metrics.max.lengthMm<.001);assert(metrics.max.floorChangeMm<.02);assert(metrics.max.anchorShiftMm<.02);assert(metrics.max.contactAboveFloorMm<2);assert(metrics.minFloorMm>-.1);assert(metrics.minSeparationMm.heel>10);assert(metrics.minSeparationMm.forefoot>10);assert(metrics.max.symmetryGapMm<.1);assert(metrics.max.endpointDeltaMm<.001);
  const saved=await state();for(const mode of ['heel','forefoot','midfoot','original']){await p.selectOption('#strike',mode);assert.equal((await state()).strike,mode);assert.deepEqual(keep(await state()),keep(saved));}
 }
 report.checks.push('3232 poses: both sexes, base/mixed/all-min/all-max body settings, two pose combinations, heel/forefoot, full cycle','Independent Three.js skin measurements: contact part, floor preservation, material anchor, symmetry and bone lengths','Root/upper body/inactive leg matrices and pose parameters unchanged; recovery boundaries approach the base pose');
 // All directed transitions, including a reversal before the previous blend finishes.
 for(const from of ['original','heel','midfoot','forefoot'])for(const to of ['original','heel','midfoot','forefoot']){
  await seek(.28);await p.selectOption('#strike',from);await p.click('#play');await p.selectOption('#strike',to);
  const target={original:[0,0],heel:[1,10],midfoot:[1,0],forefoot:[1,-10]}[to];await p.waitForFunction(([amount,pitch])=>window.stagePreview.applied.midfoot===amount&&window.stagePreview.applied.strikePitchDeg===pitch,target);await p.click('#play');
 }
 await seek(.28);await p.click('#play');for(const mode of ['heel','forefoot','heel','midfoot','original','forefoot']){await p.selectOption('#strike',mode);await p.waitForTimeout(25);}await p.waitForFunction(()=>window.stagePreview.applied.strikePitchDeg===-10);await p.click('#play');
 for(const mode of ['heel','forefoot']){
  await p.selectOption('#strike',mode);for(const [id,v]of [['leg','7'],['elbow','5'],['lean','10']])await p.locator('#'+id).fill(v);const saved=await state();await p.click('#next');assert((await p.locator('#summary').innerText()).includes(mode==='heel'?'뒤꿈치':'앞꿈치'));await p.click('#previous');await ready();assert.deepEqual(await state(),saved);await p.reload();await ready();assert.deepEqual(await state(),saved);
 }
 await p.setViewportSize({width:390,height:844});await seek(.28);await p.evaluate(()=>scrollTo(0,0));const box=await p.locator('#strike').boundingBox();assert(box.y>0&&box.y+box.height<844);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.selectOption('#strike','heel');await p.selectOption('#strike','forefoot');await p.screenshot({path:out+'/mobile.png'});
 for(const [strike,expected]of [[undefined,'original'],['invalid','original'],['heel','heel'],['midfoot','midfoot'],['forefoot','forefoot']]){await p.evaluate(strike=>sessionStorage.setItem('running-sim.stages.v1',JSON.stringify({version:1,leg:5,elbow:10,lean:8,strike})),strike);await p.goto(base+'/body');await ready();const s=await state();assert.equal(s.strike,expected);assert.equal(s.leg,5);assert.equal(s.elbow,10);assert.equal(s.lean,8);}
 report.checks.push('All 16 directed live mode transitions and rapid reversals; selection never resets body or pose settings','Both added modes survive step navigation and reload; old/invalid data retains compatibility','390px selector visible without panel scrolling; no horizontal overflow');assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync('docs/05-validation/reports/foot-strike.json',JSON.stringify(report,null,2));console.log(report.status,report.failure||'');}})();


