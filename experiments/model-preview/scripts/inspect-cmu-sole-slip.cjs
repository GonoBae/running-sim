const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),results=[];
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=travel');await page.waitForFunction(()=>window.mocapReview?.ready);
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3}=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
     const groups=[];a.model.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;
      for(let i=0;i<skinIndex.count;i++){
       let weight=0;for(let k=0;k<4;k++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))weight+=skinWeight.getComponent(i,k);
       if(weight>.5)ids.push(i);
      }
      groups.push({mesh,ids});
     });
     const frames=[],n=a.cycle.period,step=.25,p=new Vector3();
     for(let f=0;f<=n;f+=step){
      a.seek(f);const points=[];
      for(const {mesh,ids} of groups){mesh.skeleton.update();for(const id of ids)points.push(mesh.getVertexPosition(id,p).applyMatrix4(mesh.matrixWorld).toArray());}
      frames.push({frame:f,phase:f/n,support:a.contact?.support,points});
     }
     const samples=[];let sum2=0,count=0,maxOffset=0,offset=new Vector3();
     const supportWindow=a.clip.id==='35_17'?{start:.28,end:.58}:{start:.13,end:.53};
     const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
     for(let i=1;i<frames.length-1;i++){
      const f=frames[i],dt=step/a.clip.fps,mean=new Vector3();let weights=0,variance=0;
      f.points.forEach((p,j)=>{
       const w=smooth((.004-p[1])/.004);if(!w)return;
       const v=new Vector3(...frames[i+1].points[j]).sub(new Vector3(...frames[i-1].points[j])).divideScalar(2*dt);v.y=0;
       mean.addScaledVector(v,w);weights+=w;variance+=w*v.lengthSq();
      });
      if(weights)mean.divideScalar(weights);
      const gate=f.support==='r'?smooth((f.phase-supportWindow.start)/.04)*smooth((supportWindow.end-f.phase)/.04):0;
      if(weights&&gate>0){sum2+=variance/weights;count++;offset.addScaledVector(mean,-gate*dt);maxOffset=Math.max(maxOffset,offset.length());}
      if(f.support==='r')samples.push({frame:f.frame,phase:f.phase,minY:Math.min(...f.points.map(p=>p[1])),weights,velocity:mean.toArray(),rms:weights?Math.sqrt(variance/weights):null,gate,offset:offset.toArray()});
     }
     return {clip:a.clip.id,supportWindow,vertices:groups.reduce((s,g)=>s+g.ids.length,0),sampleCount:count,rms:Math.sqrt(sum2/count),maxOffset,endOffset:offset.toArray(),samples};
    });
    results.push({model,...result});console.log(model,{...result,samples:undefined});
   }
  }
  fs.writeFileSync('docs/05-validation/reports/cmu-sole-slip-audit.json',JSON.stringify({scope:'Uncorrected restored travel. Same material vertices below 4mm; right authored support only. Not measured physical contact.',results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

