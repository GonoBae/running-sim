// M29 read-only motion audit. No app motion files are modified.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[],results=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
 for(const model of ['male','female']){
  await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
  for(const rejected of [false,true]){
   await page.setChecked('#stance-width',rejected);
   const data=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');const {sourceRootTravel}=await import('/review/root-travel.js');
    const a=window.mocapReview,by=n=>a.bones.find(b=>b.name===n),p=n=>by(n).getWorldPosition(new T.Vector3());const rows=[];
    const pack=(p,names,center)=>Object.fromEntries(Object.entries(names).map(([k,n])=>[k,p(n).clone().sub(center).toArray()]));
    let maxDirectionErrorDegrees=0;
    for(let frame=0;frame<=a.cycle.period;frame+=.5){
     a.seek(frame);const center=p('thigh_l').add(p('thigh_r')).multiplyScalar(.5);
     const source=a.points.map(v=>new T.Vector3(...v)),sp=n=>source[a.clip.names.indexOf(n)],sc=sp('lhipjoint').clone().add(sp('rhipjoint')).multiplyScalar(.5);
     const raw=a.clip.frames[a.cycle.start+Math.round(frame)],rp=n=>new T.Vector3(...raw.p[a.clip.names.indexOf(n)]).applyQuaternion(a.heading).multiplyScalar(a.scale),rc=rp('lhipjoint').add(rp('rhipjoint')).multiplyScalar(.5);
     const worldRoot=sourceRootTravel(a.clip,a.cycle,frame,a.heading,a.scale);
     const target={},loopSource={},rawSource={};
     for(const side of ['l','r']){
      const tn={hip:'thigh_'+side,knee:'calf_'+side,ankle:'foot_'+side,toe:'ball_'+side};
      const sn={hip:side+'hipjoint',knee:side+'femur',ankle:side+'tibia',toe:side+'foot'};
      target[side]=pack(p,tn,center);loopSource[side]=pack(n=>sp(n).clone().multiplyScalar(a.scale),sn,sc.clone().multiplyScalar(a.scale));rawSource[side]=pack(rp,sn,rc);
      for(const [from,to] of [['hip','knee'],['knee','ankle']]){
       const v=(group)=>new T.Vector3(...group[side][to]).sub(new T.Vector3(...group[side][from])).normalize();
       maxDirectionErrorDegrees=Math.max(maxDirectionErrorDegrees,T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(v(target).dot(v(loopSource)),-1,1))));
      }
     }
     const rootUp=new T.Vector3(0,1,0).applyQuaternion(new T.Quaternion(...a.sampledFrame.q[0])).applyQuaternion(a.heading);
     const pelvisAxis=p('thigh_l').sub(p('thigh_r'));
     rows.push({frame,phase:frame/a.cycle.period,rawFrame:a.cycle.start+Math.round(frame),rawExact:Number.isInteger(frame),support:a.contact?.support,target,loopSource,rawSource,
      pelvisRollDegrees:Math.atan2(rootUp.x,rootUp.y)*180/Math.PI,targetHipRollDegrees:Math.atan2(pelvisAxis.y,pelvisAxis.x)*180/Math.PI,
      worldRoot:worldRoot.toArray(),worldCenter:a.model.parent.worldToLocal(center.clone()).add(worldRoot).toArray()});
    }
    return {clip:a.clip.id,source:{url:a.clip.source,asfSha256:a.clip.asfSha256,amcSha256:a.clip.amcSha256},cycle:{start:a.cycle.start,period:a.cycle.period,blend:a.cycle.blend,seconds:a.cycle.seconds},scale:a.scale,maxDirectionErrorDegrees,rows};
   });
   assert.equal(data.clip,'35_17');assert.equal(data.rows.length,183);if(!rejected)assert(data.maxDirectionErrorDegrees<.001);
   results.push({model,rejected,...data});
  }
 }
 // Save actual target images at six phases, with a source leg skeleton overlay.
 await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);await page.uncheck('#stance-width');await page.click('#front');
 fs.mkdirSync('outputs/cmu-cycle-review',{recursive:true});
 for(const [index,phase] of [.28,.43,.58,.72,.90,.08].entries())for(const view of ['front','side']){
  await page.evaluate(async({phase,view})=>{
   const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);a.seek(a.cycle.period*phase);
   a.scene.getObjectByName('cycle-guide')?.removeFromParent();a.scene.children.filter(o=>o.isGroup&&o!==a.model.parent).forEach(o=>o.visible=false);const group=new T.Group();group.name='cycle-guide';
   const pos=n=>a.bones.find(b=>b.name===n).getWorldPosition(new T.Vector3());const center=pos('thigh_l').add(pos('thigh_r')).multiplyScalar(.5);
   const src=a.points.map(v=>new T.Vector3(...v)),sp=n=>src[a.clip.names.indexOf(n)],sc=sp('lhipjoint').clone().add(sp('rhipjoint')).multiplyScalar(.5);
   for(const side of ['l','r']){
    const points=['hipjoint','femur','tibia','foot'].map(n=>sp(side+n).clone().sub(sc).multiplyScalar(a.scale).add(center));
    const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineDashedMaterial({color:side==='r'?'#a33b75':'#1684ab',dashSize:.018,gapSize:.012,depthTest:false}));line.computeLineDistances();line.renderOrder=5;group.add(line);
   }
   a.scene.add(group);
   const camera=new T.OrthographicCamera(-1.05*a.camera.aspect,1.05*a.camera.aspect,1.05,-1.05,.01,50);
   camera.position.set(center.x+(view==='side'?10:0),.95,center.z+(view==='front'?10:0));camera.lookAt(center.x,.95,center.z);camera.updateProjectionMatrix();a.renderer.render(a.scene,camera);
  },{phase,view});
  const rect=await page.locator('#view').boundingBox(),width=view==='side'?600:360;await page.screenshot({path:`outputs/cmu-cycle-review/${view}-${index}.png`,clip:{x:rect.x+(rect.width-width)/2,y:rect.y,width,height:rect.height}});
 }
 assert.deepEqual(errors,[]);
 const hashes=Object.fromEntries(['experiments/model-preview/review/data/cmu.json','experiments/model-preview/review/cyclic-motion.js','experiments/model-preview/review/mocap.js','experiments/model-preview/review/stance-width.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
 fs.writeFileSync('docs/05-validation/reports/cmu-cycle-review.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'Read-only M29 design audit. Source means local ASF/AMC reconstruction, not independently validated capture. Raw source uses nearest integer frame; only rawExact samples used in raw-loop comparisons. M28 off/current versus on/rejected. Contact phases are authored estimates.',hashes,results,errors},null,2));
 console.log(results.map(({model,rejected,maxDirectionErrorDegrees,rows})=>({model,rejected,maxDirectionErrorDegrees,samples:rows.length})));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
