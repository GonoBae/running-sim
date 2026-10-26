// Surface sampling is an unsigned proximity check, not collision certification.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('outputs/cmu-loop',{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1240,height:920}}),results=[];
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);await page.uncheck('#arm-spacing');
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3,Triangle,Box3}=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
     const surfaces=[];
     a.model.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      const attrs=mesh.geometry.attributes,torso=[],arms=[];
      for(let i=0;i<attrs.position.count;i++){
       let body=0,arm=0;
       for(let j=0;j<4;j++){
        const name=mesh.skeleton.bones[attrs.skinIndex.getComponent(i,j)].name,w=attrs.skinWeight.getComponent(i,j);
        if(/^(pelvis|spine_\d+)$/.test(name))body+=w;
        if(/^(lowerarm|hand)_[lr]$/.test(name))arm+=w;
       }
       torso.push(body>.6);if(arm>.65&&i%6===0)arms.push(i);
      }
      const index=mesh.geometry.index,triangles=[];
      for(let k=0;k<(index?.count||attrs.position.count);k+=3){const ids=[0,1,2].map(j=>index?index.getX(k+j):k+j);if(ids.every(i=>torso[i]))triangles.push(ids);}
      surfaces.push({mesh,triangles,arms});
     });
     const frames=[];
     for(let phase=0;phase<12;phase++){
      a.seek(a.cycle.period*phase/12);let min=Infinity,count=0;
      const target=new Vector3();
      for(const {mesh,triangles,arms} of surfaces){
       mesh.skeleton.update();
       const positions=new Map(),vertex=i=>{if(!positions.has(i))positions.set(i,mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));return positions.get(i);};
       const ts=triangles.map(ids=>{const points=ids.map(vertex);return {t:new Triangle(...points),box:new Box3().setFromPoints(points)};});
       for(const i of arms){const p=vertex(i);count++;for(const {t,box} of ts){if(box.distanceToPoint(p)>=min)continue;t.closestPointToPoint(p,target);min=Math.min(min,target.distanceTo(p));}}
      }
      frames.push({phase:phase/12,minSampleDistance:min,samplePoints:count});
     }
     return {clip:a.clip.id,frames,minSampleDistance:Math.min(...frames.map(f=>f.minSampleDistance))};
    });
    results.push({model,...result});console.log(model,result.clip,result.minSampleDistance);
    if(clip==='0')for(const view of ['front','side']){
     await page.click('#'+view);
     for(let k=0;k<4;k++){await page.evaluate(k=>window.mocapReview.seek(window.mocapReview.cycle.period*k/4),k);await page.screenshot({path:`outputs/cmu-loop/${model}-${view}-${k}.png`});}
    }
   }
  }
  await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);await page.selectOption('#clip','0');await page.click('#side');
  for(let k=0;k<24;k++){await page.evaluate(k=>window.mocapReview.seek(window.mocapReview.cycle.period*k/24),k);await page.screenshot({path:`outputs/cmu-loop/loop-${String(k).padStart(2,'0')}.png`,clip:{x:0,y:0,width:1240,height:760}});}
 }finally{
  fs.writeFileSync('docs/05-validation/reports/cmu-arm-proximity.json',JSON.stringify({testedAt:new Date().toISOString(),method:'12 phases per model/clip; every sixth vertex with >0.65 forearm/hand skin weight against torso triangles whose three vertices each have >0.6 pelvis/spine weight. Unsigned sampled surface distance; excludes upper-arm attachment. Not full intersection/penetration test; unsampled points can be closer.',results},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
