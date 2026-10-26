const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=fore-aft-release');await page.waitForFunction(()=>window.mocapReview?.ready);
 for(const model of ['male','female']){
  await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
  const result=await page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js'),{sourceRootTravel}=await import('/review/root-travel.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);
   const readers=a.comparison.lanes.map(lane=>{const groups=[];lane.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;for(let k=0;k<skinIndex.count;k++){let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(k,j)].name))w+=skinWeight.getComponent(k,j);if(w>.5)ids.push(k);}groups.push({mesh,ids});});return ()=>{const points=[];for(const {mesh,ids} of groups){mesh.skeleton.update();for(const id of ids)points.push(lane.group.worldToLocal(mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld)).toArray());}return points;};});
   const frames=[],step=.25,dt=step/a.clip.fps;
   for(let f=0;f<=a.cycle.period;f+=step){a.seek(f);frames.push({frame:f,phase:f/a.cycle.period,travel:sourceRootTravel(a.clip,a.cycle,f,a.heading,a.scale).toArray(),points:readers.map(r=>r())});}
   const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
   const lanes=[0,1].map(lane=>{
    const bands=[.001,.004,.008].map(band=>{
     const rows=[];let sx=0,sz=0,den=0;
     for(let i=1;i<frames.length-1;i++){
      const f=frames[i];if(f.phase<.28||f.phase>.58)continue;
      let wsum=0,vx=0,vz=0,x2=0,z2=0;
      for(let j=0;j<f.points[lane].length;j++){const p=f.points[lane][j],w=smooth((band-Math.max(0,p[1]))/band);if(!w)continue;const prev=frames[i-1].points[lane][j],next=frames[i+1].points[lane][j],x=(next[0]-prev[0])/(2*dt),z=(next[2]-prev[2])/(2*dt);wsum+=w;vx+=w*x;vz+=w*z;x2+=w*x*x;z2+=w*z*z;}
      if(!wsum)continue;const tx=(frames[i+1].travel[0]-frames[i-1].travel[0])/(2*dt),tz=(frames[i+1].travel[2]-frames[i-1].travel[2])/(2*dt);
      rows.push({phase:f.phase,frame:f.frame,weight:wsum,meanX:vx/wsum,meanZ:vz/wsum,rmsX:Math.sqrt(x2/wsum),rmsZ:Math.sqrt(z2/wsum),travelX:tx,travelZ:tz,relativeX:vx/wsum-tx,relativeZ:vz/wsum-tz,minY:Math.min(...f.points[lane].map(p=>p[1]))});sx+=x2;sz+=z2;den+=wsum;
     }
     const full=rows.filter(r=>r.phase>=.405&&r.phase<=.455),average=(items,key)=>items.reduce((s,r)=>s+r[key]*r.weight,0)/items.reduce((s,r)=>s+r.weight,0);
     return {band,summary:{samples:rows.length,rmsX:Math.sqrt(sx/den),rmsZ:Math.sqrt(sz/den),rms:Math.sqrt((sx+sz)/den),meanZ:average(rows,'meanZ'),fullMeanZ:average(full,'meanZ'),fullRmsX:Math.sqrt(average(full.map(r=>({...r,sq:r.rmsX**2})),'sq')),fullRmsZ:Math.sqrt(average(full.map(r=>({...r,sq:r.rmsZ**2})),'sq'))},rows};
    });
    // Follow ONE stable mesh vertex through its longest contiguous near-ground run.
    // This avoids confusing a changing lowest-point index with material sliding.
    let best={count:0};for(let j=0;j<frames[0].points[lane].length;j++){let start=0,count=0;for(let i=0;i<frames.length;i++){const f=frames[i],near=f.phase>=.28&&f.phase<=.58&&f.points[lane][j][1]>=-.001&&f.points[lane][j][1]<=.004;if(near){if(!count)start=i;count++;if(count>best.count)best={count,start,end:i,vertex:j};}else count=0;}}
    const track=frames.slice(best.start,best.end+1).map(f=>({phase:f.phase,p:f.points[lane][best.vertex]})),p0=track[0].p,p1=track.at(-1).p;
    return {name:lane===0?'M45':'M46',vertices:frames[0].points[lane].length,bands,track:{...best,duration:(best.count-1)*dt,displacementCm:p1.map((v,j)=>(v-p0[j])*100),points:track}};
   });
   return {clip:a.clip.id,period:a.cycle.period,fps:a.clip.fps,lanes};
  });
  results.push({model,...result});console.log(model,result.lanes.map(l=>({name:l.name,band4mm:l.bands[1].summary,track:{seconds:l.track.duration,displacementCm:l.track.displacementCm}})));
 }
 const files=['fore-aft-release.js','release-refinement.js','pivot-release.js','stance-chain.js','landing-width-comparison.js','mocap.js','root-travel.js'];const hashes=Object.fromEntries(files.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+n)).digest('hex')]));
 fs.writeFileSync('docs/05-validation/reports/cmu-fore-aft-release-slip.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'M44 M42/pivot release slip comparison; same material vertex velocities in ground coordinates, no correction',method:'35_17 authored support 28–58%; quarter-frame central differences; foot/ball skin weight >0.5; smooth geometric proximity weights, 1/4/8 mm bands. Not measured pressure contact.',hashes,results,errors},null,2));
 assert.deepEqual(errors,[]);for(const r of results){assert.equal(r.clip,'35_17');for(const l of r.lanes){assert(l.vertices>0);assert(l.track.count>2);for(const b of l.bands){assert(b.summary.samples>50);assert(Number.isFinite(b.summary.rms));for(const row of b.rows){assert(Math.abs(row.meanZ-row.travelZ-row.relativeZ)<1e-10);assert(row.rmsX+1e-9>=Math.abs(row.meanX));assert(row.rmsZ+1e-9>=Math.abs(row.meanZ));}}}}
 console.log('PASS: stable vertex sampling, ground-frame decomposition, 1/4/8mm sensitivity, no browser errors');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
