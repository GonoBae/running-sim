const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out='outputs/cmu-upper-center';fs.mkdirSync(out,{recursive:true});
const dest='docs/05-validation/reports/cmu-upper-center.json';
const report={testedAt:new Date().toISOString(),status:'running',errors:[],results:[]};
const save=()=>fs.writeFileSync(dest,JSON.stringify(report));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});page.on('pageerror',e=>report.errors.push(e.message));
 const archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-approach-symmetry.json'));
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=upper-center');
 for(const model of ['male','female']){
  if(model==='female')await page.selectOption('#model',model);
  await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
  const result=await page.evaluate(async old=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);
   const central=['spine_01','spine_02','spine_03','neck_01','head'],lower=['Root','pelvis',...['r','l'].flatMap(s=>['thigh','calf','foot','ball'].map(n=>n+'_'+s))];
   const names=a.plan.reference.bones.map(b=>b.name),V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
   const p=(lane,name)=>lane.group.worldToLocal(lane.model.getObjectByName(name).getWorldPosition(V()));
   const angle=(x,y)=>x.clone().normalize().angleTo(y.clone().normalize())*180/Math.PI;
   const m={baselineMm:0,modelPositionMm:0,lowerPositionMm:0,lowerRotationDeg:0,preservedLocalDeg:0,boneLengthMm:0,
    footSkinPositionMm:0,footHeightChangeMm:0,minFootSkinMm:Infinity,groundClampCount:0,maxCentralCorrectionDeg:0,
    maxShoulderHeightChangeMm:0,repeatMm:0,viewMm:0,seamMm:0,seamRotationDeg:0,seamVelocityGapMps:0,
    shoulderMirrorBeforeMm:0,shoulderMirrorAfterMm:0,headMirrorBeforeMm:0,headMirrorAfterMm:0};
   // Independent foot skin positions: all vertices with >5% foot/toe weight.
   const skins=a.lanes.map(l=>{
    const groups=[];l.model.traverse(mesh=>{
     if(!mesh.isSkinnedMesh)return;const at=mesh.geometry.attributes,ids={r:[],l:[]};
     for(let i=0;i<at.skinIndex.count;i++)for(const s of ['r','l']){
      let weight=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${s}$`).test(mesh.skeleton.bones[at.skinIndex.getComponent(i,j)].name))weight+=at.skinWeight.getComponent(i,j);
      if(weight>.05)ids[s].push(i);
     }
     groups.push({mesh,ids});
    });return groups;
   });
   const skin=laneIndex=>{
    const lane=a.lanes[laneIndex],points={r:[],l:[]},floors={r:Infinity,l:Infinity};
    for(const {mesh,ids}of skins[laneIndex]){
     mesh.skeleton.update();
     for(const s of ['r','l'])for(const id of ids[s]){
      const v=lane.group.worldToLocal(mesh.getVertexPosition(id,V()).applyMatrix4(mesh.matrixWorld));points[s].push(v);floors[s]=Math.min(floors[s],v.y);
     }
    }return {points,floors};
   };
   const centers=lane=>{
    const pelvis=p(lane,'pelvis'),shoulder=p(lane,'upperarm_r').add(p(lane,'upperarm_l')).multiplyScalar(.5);
    return {pelvis:pelvis.toArray(),shoulder:shoulder.sub(pelvis).toArray(),head:p(lane,'head').sub(pelvis).toArray(),
     feet:Object.fromEntries(['r','l'].map(s=>[s,p(lane,'foot_'+s).sub(pelvis).toArray()]))};
   };
   // Baseline is archived rendered M60, not another new algorithm.
   for(let i=0;i<365;i++){
    a.seek(i/364);for(const [name,xyz]of Object.entries(old.cycle[i].bones))
     m.baselineMm=Math.max(m.baselineMm,p(a.lanes[0],name).distanceTo(new T.Vector3(...xyz))*1000);
   }
   const rows=[];
   for(let i=0;i<=1000;i++){
    const phase=i/1000;a.seek(phase);const [b,c]=a.lanes,skinsNow=[skin(0),skin(1)];
    m.modelPositionMm=Math.max(m.modelPositionMm,b.model.position.distanceTo(c.model.position)*1000);
    for(const n of names){
     const oldBone=b.model.getObjectByName(n),bone=c.model.getObjectByName(n);
     m.boneLengthMm=Math.max(m.boneLengthMm,oldBone.position.distanceTo(bone.position)*1000);
     if(!central.includes(n))m.preservedLocalDeg=Math.max(m.preservedLocalDeg,angle(oldBone.quaternion,bone.quaternion));
     else m.maxCentralCorrectionDeg=Math.max(m.maxCentralCorrectionDeg,angle(oldBone.getWorldQuaternion(Q()),bone.getWorldQuaternion(Q())));
     if(lower.includes(n)){
      m.lowerPositionMm=Math.max(m.lowerPositionMm,p(b,n).distanceTo(p(c,n))*1000);
      m.lowerRotationDeg=Math.max(m.lowerRotationDeg,angle(oldBone.getWorldQuaternion(Q()),bone.getWorldQuaternion(Q())));
     }
    }
    for(const s of ['r','l']){
     m.minFootSkinMm=Math.min(m.minFootSkinMm,skinsNow[1].floors[s]*1000);
     m.footHeightChangeMm=Math.max(m.footHeightChangeMm,Math.abs(skinsNow[0].floors[s]-skinsNow[1].floors[s])*1000);
     skinsNow[0].points[s].forEach((v,j)=>{m.footSkinPositionMm=Math.max(m.footSkinPositionMm,v.distanceTo(skinsNow[1].points[s][j])*1000);});
    }
    if(a.diagnostic.groundLimited)m.groundClampCount++;
    const before=centers(b),after=centers(c);
    m.maxShoulderHeightChangeMm=Math.max(m.maxShoulderHeightChangeMm,Math.abs(before.shoulder[1]-after.shoulder[1])*1000);
    rows.push({phase,before,after,floors:skinsNow.map(s=>s.floors)});
   }
   const reflect=xyz=>new T.Vector3(-xyz[0],xyz[1],xyz[2]);
   for(let i=0;i<=500;i++)for(const [key,field]of [['shoulder','shoulderMirror'],['head','headMirror']])for(const mode of ['before','after']){
    const error=new T.Vector3(...rows[i][mode][key]).distanceTo(reflect(rows[i+500][mode][key]))*1000;
    const name=field+(mode==='before'?'BeforeMm':'AfterMm');m[name]=Math.max(m[name],error);
   }
   const snapshot=phase=>{a.seek(phase);return centers(a.lanes[1]);};
   const repeat=snapshot(.28);snapshot(.71);
   m.repeatMm=new T.Vector3(...repeat.shoulder).distanceTo(new T.Vector3(...snapshot(.28).shoulder))*1000;
   a.view(true);m.viewMm=new T.Vector3(...repeat.shoulder).distanceTo(new T.Vector3(...snapshot(.28).shoulder))*1000;a.view(false);
   for(const key of ['shoulder','head'])m.seamMm=Math.max(m.seamMm,new T.Vector3(...rows[0].after[key]).distanceTo(new T.Vector3(...rows[1000].after[key]))*1000);
   const at=phase=>{a.upperPlan.apply(a.lanes[1],a.probe,phase);return centers(a.lanes[1]);};
   const boundaries=[];
   for(const phase of [0,.5,1]){
    const h=1e-5,values=[-2,-1,0,1,2].map(k=>at(phase+k*h));
    for(const key of ['shoulder','head']){
     const v=values.map(x=>new T.Vector3(...x[key]));
     const vl=v[2].clone().multiplyScalar(3).addScaledVector(v[1],-4).add(v[0]).divideScalar(2*h*a.data.seconds);
     const vr=v[2].clone().multiplyScalar(-3).addScaledVector(v[3],4).addScaledVector(v[4],-1).divideScalar(2*h*a.data.seconds);
     const gap=vl.distanceTo(vr);m.seamVelocityGapMps=Math.max(m.seamVelocityGapMps,gap);boundaries.push({phase,key,gapMps:gap});
    }
   }
   a.upperPlan.apply(a.lanes[1],a.probe,0);const initial=central.map(n=>a.lanes[1].model.getObjectByName(n).getWorldQuaternion(Q()));
   a.upperPlan.apply(a.lanes[1],a.probe,1);central.forEach((n,i)=>{m.seamRotationDeg=Math.max(m.seamRotationDeg,angle(initial[i],a.lanes[1].model.getObjectByName(n).getWorldQuaternion(Q())));});
   const landing=rows.filter(r=>r.phase>=.28&&r.phase<=.56||r.phase>=.78||r.phase<=.06).map(r=>({phase:r.phase,side:r.phase>=.28&&r.phase<=.56?'r':'l',floors:r.floors}));
   const approach={};
   for(const [key,s,i,j]of [['right','r',100,280],['left','l',600,780]]){
    const sign=s==='r'?1:-1;approach[key]={};
    for(const mode of ['before','after']){
     const start=rows[i][mode],end=rows[j][mode];
     approach[key][mode]=sign*((end.feet[s][0]-end.shoulder[0])-(start.feet[s][0]-start.shoulder[0]))*1000;
    }
   }
   return {metrics:m,rows,landing,boundaries,approach,seconds:a.data.seconds,loadMs:performance.getEntriesByName('shared-gait-ready').at(-1).duration};
  },archive.results.find(r=>r.model===model));
  report.results.push({model,...result});save();console.log(model,JSON.stringify(result.metrics),JSON.stringify(result.approach));
  const m=result.metrics;
  assert(m.baselineMm<.01,'archived M60 unchanged');
  assert(m.modelPositionMm<.01&&m.lowerPositionMm<.01&&m.lowerRotationDeg<.001,'body position, pelvis, legs, ankles preserved');
  assert(m.preservedLocalDeg<.001&&m.boneLengthMm<.01,'only five central rotations change');
  assert(m.footSkinPositionMm<.01&&m.footHeightChangeMm<.01&&m.minFootSkinMm>=-.01,'independent foot skin and contact');
  assert(m.shoulderMirrorAfterMm<.01&&m.headMirrorAfterMm<.01,'whole-cycle central half correspondence');
  assert(m.seamMm<.01&&m.seamRotationDeg<.001&&m.seamVelocityGapMps<.001,'periodic pose and velocity');
  assert(m.repeatMm<.01&&m.viewMm<.01,'reseek and view');
  assert(result.landing.every(r=>r.floors[1][r.side]>=-.00001&&r.floors[1][r.side]<.001),'landing remains within 1mm');
  for(const view of ['front','side'])for(const phase of [.10,.18,.28,.60,.68,.78]){
   await page.click('#'+view);await page.evaluate(t=>window.sharedGaitReview.seek(t),phase);
   await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*100)}.png`});
  }
 }
 report.previousRoutes=[];
 for(const query of ['body-height','']){
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html'+(query?'?compare='+query:''));
  await page.waitForFunction(()=>window.sharedGaitReview?.ready);
  const expected=query?archive.results[0].cycle:JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-whole-body-audit.json')).results[0].rows;
  const error=await page.evaluate(async expected=>{
   const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');a.renderer.setAnimationLoop(null);let maximum=0;
   for(let i=0;i<365;i++){a.seek(i/364);const lane=a.lanes[1];for(const [n,xyz]of Object.entries(expected[i].bones))maximum=Math.max(maximum,lane.group.worldToLocal(lane.model.getObjectByName(n).getWorldPosition(new T.Vector3())).distanceTo(new T.Vector3(...xyz))*1000);}
   return maximum;
  },expected);assert(error<.01,'previous route preserved');report.previousRoutes.push({query,maxMm:error});
 }
 await page.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=upper-center');await page.waitForFunction(()=>window.sharedGaitReview?.ready);
 await page.click('#play');await page.waitForTimeout(3300);assert.equal(await page.textContent('#play'),'일시정지');await page.click('#play');
 await page.uncheck('#repeat');await page.evaluate(()=>window.sharedGaitReview.seek(.99));await page.click('#play');
 await page.waitForFunction(()=>document.querySelector('#play').textContent==='처음부터 재생');
 report.playback={repeat:true,singleCycleStop:true};assert.deepEqual(report.errors,[]);
 report.hashes=Object.fromEntries(['upper-center.js','shared-gait-view.js','shared-gait.js','body-height.js'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+n)).digest('hex')]));
 report.status='passed';save();console.log('PASS: upper center, preserved legs/height/skin, previous routes and playback');
}finally{await browser.close();}})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1;});
