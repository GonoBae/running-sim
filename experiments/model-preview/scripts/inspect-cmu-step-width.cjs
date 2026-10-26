const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=slip');await page.waitForFunction(()=>window.mocapReview?.ready);
  assert.equal(await page.inputValue('#clip'),'1');
  assert.equal(await page.evaluate(()=>window.mocapReview.clip.id),'127_06');
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3}=await import('/node_modules/three/build/three.module.js');
     const a=window.mocapReview,c=a.comparison,p=b=>b.getWorldPosition(new Vector3());
     const read=bones=>{
      const by=name=>bones.find(b=>b.name===name);
      const center=p(by('thigh_l')).add(p(by('thigh_r'))).multiplyScalar(.5);
      return {center,ankle:{l:p(by('foot_l')).sub(center),r:p(by('foot_r')).sub(center)},ball:{l:p(by('ball_l')).sub(center),r:p(by('ball_r')).sub(center)}};
     };
     const samples=[];let correctionRelativeError=0,maxLateralCorrection=0;
     for(let frame=0;frame<=a.cycle.period;frame+=.5){
      a.seek(frame);const before=read(c.fixedBones),after=read(a.bones);
      const side=a.contact?.support;
      maxLateralCorrection=Math.max(maxLateralCorrection,Math.abs(c.slipPlan.sample(frame).x));
      for(const side of ['l','r'])correctionRelativeError=Math.max(correctionRelativeError,before.ankle[side].distanceTo(after.ankle[side]),before.ball[side].distanceTo(after.ball[side]));
      const source=a.points.map(p=>new Vector3(...p)),src=name=>source[a.clip.names.indexOf(name)];
      const center=src('lhipjoint').clone().add(src('rhipjoint')).multiplyScalar(.5);
      samples.push({phase:frame/a.cycle.period,side,
       ankle:{l:after.ankle.l.toArray(),r:after.ankle.r.toArray()},ball:{l:after.ball.l.toArray(),r:after.ball.r.toArray()},
       sourceAnkle:{l:src('ltibia').clone().sub(center).multiplyScalar(a.scale).toArray(),r:src('rtibia').clone().sub(center).multiplyScalar(a.scale).toArray()}});
     }
     const sides={};
     for(const side of ['l','r']){
      const support=samples.filter(s=>s.side===side),sign=side==='l'?1:-1;
      sides[side]={supportSamples:support.length};
      for(const field of ['ankle','ball','sourceAnkle']){
       const xs=support.map(s=>s[field][side][0]*sign);
       sides[side][field]={ownSideMin:Math.min(...xs),ownSideMax:Math.max(...xs),crossedSamples:xs.filter(x=>x<0).length};
      }
     }
     return {clip:a.clip.id,sides,correctionRelativeError,maxLateralCorrection,samples};
    });
    assert(result.correctionRelativeError<1e-8);
    if(clip==='1')for(const side of ['l','r'])assert(result.sides[side].ankle.ownSideMin>0,'candidate ankle stays on its own side');
    results.push({model,...result});console.log(model,{...result,samples:undefined});
   }
  }
  await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);
  for(const [clip,phase] of [['0',.43],['1',.33]]){
   await page.selectOption('#clip',clip);await page.click('#front');
   await page.evaluate(async phase=>{
    const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
    a.renderer.setAnimationLoop(null);a.seek(a.cycle.period*phase);
    const bone=name=>a.bones.find(b=>b.name===name).getWorldPosition(new T.Vector3());
    const center=bone('thigh_l').add(bone('thigh_r')).multiplyScalar(.5);
    a.comparison.fixed.parent.visible=false;
    a.scene.getObjectByName('width-guide')?.removeFromParent();
    const group=new T.Group();group.name='width-guide';
    const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(center.x,0,center.z),new T.Vector3(center.x,1.8,center.z)]),new T.LineDashedMaterial({color:'#a36f10',dashSize:.04,gapSize:.03,depthTest:false}));line.computeLineDistances();line.renderOrder=3;group.add(line);
    for(const side of ['l','r']){
     const points=['thigh','calf','foot','ball'].map(n=>bone(n+'_'+side));
     const chain=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:side==='l'?'#007fba':'#c04381',depthTest:false}));chain.renderOrder=3;group.add(chain);
    }
    a.scene.add(group);
    a.camera.left=-1.05*a.camera.aspect;a.camera.right=1.05*a.camera.aspect;a.camera.top=1.05;a.camera.bottom=-1.05;
    a.camera.position.set(center.x,.9,center.z+10);a.camera.lookAt(center.x,.9,center.z);a.camera.updateProjectionMatrix();a.renderer.render(a.scene,a.camera);
   },phase);
   const rect=await page.locator('#view').boundingBox();
   await page.screenshot({path:`docs/assets/images/cmu-step-width-${clip==='0'?'35':'127'}.png`,clip:{x:rect.x+rect.width/4,y:rect.y,width:rect.width/2,height:rect.height}});
   await page.evaluate(()=>{const a=window.mocapReview;a.comparison.fixed.parent.visible=true;a.scene.getObjectByName('width-guide')?.removeFromParent();});
  }
  for(const url of ['http://127.0.0.1:5173/review/mocap.html','http://127.0.0.1:5173/review/mocap.html?compare=travel']){
   await page.goto(url);await page.waitForFunction(()=>window.mocapReview?.ready);
   assert.equal(await page.inputValue('#clip'),'1');assert.equal(await page.evaluate(()=>window.mocapReview.clip.id),'127_06');
   await page.selectOption('#clip','0');assert.equal(await page.evaluate(()=>window.mocapReview.clip.id),'35_17');
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/05-validation/reports/cmu-step-width.json',JSON.stringify({scope:'Forward-axis lateral ankle/ball offset relative to hip midpoint during authored support. Positive means own side, not a clinical normal-width test. Same source reconstruction, no independent motion capture validation.',results,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
