// Read-only M59 audit. Sampling and camera changes occur in an isolated browser.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const out='outputs/cmu-whole-body-audit';fs.mkdirSync(out,{recursive:true});
const files=['shared-gait.js','shared-gait-view.js','shared-gait.html','hip-landing.js','ankle-weights.js'].map(n=>'experiments/model-preview/review/'+n).concat('experiments/model-preview/public/review-data/shared-gait-reference.json',...['male','female'].map(s=>'experiments/model-preview/public/models/runner-'+s+'.glb'));
const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before=hashes(),report={testedAt:new Date().toISOString(),scope:'M59 observation only; M58 poses unchanged; geometric contact candidates, not measured force',errors:[],results:[]};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/review/shared-gait.html');
  for(const model of ['male','female']){
   if(model==='female')await page.selectOption('#model',model);
   await page.waitForFunction(()=>window.sharedGaitReview?.ready&&!document.querySelector('#model').disabled);
   const data=await page.evaluate(async model=>{
    const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js');
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    a.renderer.setAnimationLoop(null);
    const rest=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;rest.updateMatrixWorld(true);
    const quantile=(v,q)=>v.slice().sort((a,b)=>a-b)[Math.floor((v.length-1)*q)],patches={};
    for(const side of ['r','l']){
     const vertices=[];
     rest.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
      const {skinIndex,skinWeight}=mesh.geometry.attributes;
      for(let id=0;id<skinIndex.count;id++){
       let weight=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(id,j)].name))weight+=skinWeight.getComponent(id,j);
       if(weight>.5)vertices.push({mesh:mesh.name,id,p:mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld).toArray()});
      }
     });
     const min=Math.min(...vertices.map(v=>v.p[1])),sole=vertices.filter(v=>v.p[1]<=min+.012);
     const low=quantile(sole.map(v=>v.p[2]),.2),high=quantile(sole.map(v=>v.p[2]),.8);
     patches[side]={heel:sole.filter(v=>v.p[2]<=low),toe:sole.filter(v=>v.p[2]>=high)};
    }
    const names=['pelvis','spine_01','spine_02','spine_03','neck_01','head',...['r','l'].flatMap(s=>['clavicle','upperarm','lowerarm','hand','thigh','calf','foot','ball'].map(n=>n+'_'+s))].filter(n=>a.lanes[1].model.getObjectByName(n));
    function snapshot(phase){
     a.seek(phase);const lane=a.lanes[1],bones=Object.fromEntries(names.map(n=>[n,lane.group.worldToLocal(lane.model.getObjectByName(n).getWorldPosition(new T.Vector3())).toArray()]));
     const feet={};
     for(const s of ['r','l']){
      feet[s]={surfaceMin:lane.readSurface(s).min};
      for(const key of ['heel','toe']){
       const ps=patches[s][key].map(v=>{const mesh=lane.model.getObjectByName(v.mesh);mesh.skeleton.update();return lane.group.worldToLocal(mesh.getVertexPosition(v.id,new T.Vector3()).applyMatrix4(mesh.matrixWorld));});
       feet[s][key]={mean:ps.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(ps.length).toArray(),minY:Math.min(...ps.map(p=>p.y))};
      }
     }
     return {phase,bones,feet,heightShift:a.diagnostic.heightShift};
    }
    const rows=Array.from({length:365},(_,i)=>snapshot(i/364)),repeat=[snapshot(.43),snapshot(.11),snapshot(.43)];
    const heightDetail=Array.from({length:241},(_,i)=>{
     const phase=.1+.06*i/240,one=snapshot(phase),half=snapshot(phase+.5);
     return {phase,y:one.bones.pelvis[1],shift:one.heightShift,halfY:half.bones.pelvis[1]};
    });
    window.bodyAuditCapture=async function({phase,view}){
     a.view(view==='side');a.seek(phase);const lane=a.lanes[1];
     a.lanes[0].group.visible=false;lane.lines.forEach(l=>l.visible=false);
     const P=lane.model.getObjectByName('pelvis').getWorldPosition(new T.Vector3());P.y=.95;
     a.renderer.setSize(540,650);Object.assign(a.camera,{left:-.88,right:.88,top:1.06,bottom:-1.06});
     a.camera.position.copy(P).add(new T.Vector3(view==='side'?10:0,0,view==='side'?0:10));a.camera.lookAt(P);a.camera.updateProjectionMatrix();
     a.renderer.render(a.scene,a.camera);
     const projected=Object.fromEntries(names.map(n=>{const p=lane.model.getObjectByName(n).getWorldPosition(new T.Vector3()).project(a.camera);return [n,[(p.x+1)*270,(1-p.y)*325]];}));
     return {projected,png:a.renderer.domElement.toDataURL('image/png').split(',')[1]};
    };
    return {rows,repeat,heightDetail,seconds:a.data.seconds,patches:Object.fromEntries(Object.entries(patches).map(([s,v])=>[s,Object.fromEntries(Object.entries(v).map(([k,vs])=>[k,vs.map(({mesh,id})=>({mesh,id}))]))]))};
   },model);
   const archive=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-shared-gait.json')).results.find(r=>r.model===model);
   let poseErrorMm=0;
   for(let i=0;i<365;i++)for(const [n,b]of Object.entries(archive.rows[i].lanes[1].bones))poseErrorMm=Math.max(poseErrorMm,Math.hypot(...b.p.map((v,j)=>v-data.rows[i].bones[n][j]))*1000);
   assert(poseErrorMm<.01);assert.deepEqual(data.repeat[0],data.repeat[2]);
   assert(Math.max(...data.heightDetail.map(r=>Math.abs(r.y-r.halfY)))*1000<.01);
   const captures=[];
   for(const view of ['front','side'])for(const phase of [.03,.14,.28,.43,.53,.64,.78,.93]){
    const result=await page.evaluate(args=>window.bodyAuditCapture(args),{phase,view});
    const path=`${out}/${model}-${view}-${Math.round(phase*100)}.png`;fs.writeFileSync(path,Buffer.from(result.png,'base64'));
    captures.push({phase,view,path,projected:result.projected});
   }
   delete data.repeat;report.results.push({model,poseErrorMm,...data,captures});
   console.log(model,'365 full-body samples; 16 front/side captures; pose error mm',poseErrorMm);
  }
  assert.deepEqual(hashes(),before);assert.deepEqual(report.errors,[]);report.runtimeHashes=before;report.status='observation-complete';
  fs.writeFileSync('docs/05-validation/reports/cmu-whole-body-audit.json',JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
