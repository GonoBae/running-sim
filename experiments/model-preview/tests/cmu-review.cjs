const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1240,height:920}}),results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);await page.selectOption('#mode','raw');
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const r=await page.evaluate(async()=>{
     const a=window.mocapReview,{Vector3}=await import('/node_modules/three/build/three.module.js');
     const p=b=>b.getWorldPosition(new Vector3());
     const lengths=a.bones.map(b=>b.parent?.isBone?p(b).distanceTo(p(b.parent)):0);
     let maxLengthError=0,maxDirectionError=0,minFoot=Infinity,maxSourceLengthError=0;
     const samples=[];a.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const skin=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight,indices=[];
      for(let i=0;i<skin.count;i++){let sum=0;for(let j=0;j<4;j++)if(/^(foot|ball)_[lr]$/.test(mesh.skeleton.bones[skin.getComponent(i,j)].name))sum+=w.getComponent(i,j);if(sum>.15)indices.push(i);}
      samples.push({mesh,indices});
     });
     const v=new Vector3();const bonePositions=[];
     for(let f=0;f<a.clip.frames.length;f++){
      a.seek(f);const points=a.points.map(v=>new Vector3(...v));
      // Clavicles now preserve target neutral anatomy; their relative motion is
      // checked separately in cmu-shoulder.cjs, not against source bone slope.
      for(const m of a.mapping.filter(m=>m.child&&!m.relative)){
       const source=points[m.index].clone().sub(points[a.clip.parents[m.index]]).normalize();
       const target=p(m.child).sub(p(m.bone)).normalize();maxDirectionError=Math.max(maxDirectionError,source.angleTo(target)*180/Math.PI);
      }
      a.bones.forEach((b,i)=>{if(b.parent?.isBone)maxLengthError=Math.max(maxLengthError,Math.abs(p(b).distanceTo(p(b.parent))-lengths[i]));});
      a.clip.bones.forEach((b,i)=>{const measured=points[i+1].distanceTo(points[a.clip.parents[i+1]]);maxSourceLengthError=Math.max(maxSourceLengthError,Math.abs(measured-b.length));});
      for(const{mesh,indices}of samples){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);minFoot=Math.min(minFoot,v.y);}}
      if(f===0||f===a.clip.frames.length-1)bonePositions.push(a.bones.map(b=>p(b).toArray()));
     }
     const loopGap=Math.max(...bonePositions[0].map((p,i)=>new Vector3(...p).distanceTo(new Vector3(...bonePositions[1][i]))));
     return {clip:a.clip.id,frames:a.clip.frames.length,mappedBones:a.mapping.length,targetBones:a.bones.length,maxDirectionError,maxLengthError,maxSourceLengthError,minFoot,loopGap,asfSha256:a.clip.asfSha256,amcSha256:a.clip.amcSha256};
    });
    results.push({model,...r});console.log(model,JSON.stringify(r));
    assert(r.mappedBones===20);assert(r.maxDirectionError<.001);assert(r.maxLengthError<1e-6);assert(r.maxSourceLengthError<1e-5);
   }
  }
  await page.click('#play');
  const start=await page.inputValue('#phase');await page.waitForTimeout(100);
  assert.notEqual(await page.inputValue('#phase'),start,'playback advances');
  await page.click('#play');const paused=await page.inputValue('#phase');await page.waitForTimeout(80);assert.equal(await page.inputValue('#phase'),paused);
  await page.click('#front');await page.click('#side');assert.equal(await page.inputValue('#phase'),paused,'view controls preserve paused frame');
  assert.equal(await page.evaluate(()=>localStorage.length),0,'isolated review does not write app settings');
  results.push({test:'play/pause, view changes and no app storage writes',passed:true});
  assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync('docs/05-validation/reports/cmu-review.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'Isolated full-body transfer feasibility. No foot IK, looping, user settings, policy limits or biomechanical validation. ASF parser visual verification only; not independently compared with C3D.',results,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
