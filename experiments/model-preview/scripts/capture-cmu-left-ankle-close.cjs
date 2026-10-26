const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:940}});
  await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=left-ankle-direction');
  await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
  for(const phase of [.75,.92])for(const view of ['front','side'])for(const laneIndex of [0,1]){
   const png=await page.evaluate(async({phase,view,laneIndex})=>{
    const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);a.seek(phase*a.cycle.period);
    const l=a.comparison.lanes[laneIndex],by=n=>l.bones.find(b=>b.name===n+'_l'),pos=b=>b.getWorldPosition(new T.Vector3()),center=pos(by('foot')).add(new T.Vector3(0,.05,.04));
    const line=new T.Line(new T.BufferGeometry().setFromPoints(['calf','foot','ball'].map(n=>pos(by(n)))),new T.LineBasicMaterial({color:'#1687ad',depthTest:false}));line.renderOrder=10;a.scene.add(line);
    a.renderer.setSize(500,500);Object.assign(a.camera,{left:-.22,right:.22,top:.22,bottom:-.22});a.camera.updateProjectionMatrix();
    a.camera.position.copy(center).add(new T.Vector3(view==='side'?10:0,0,view==='front'?10:0));a.camera.lookAt(center);a.renderer.render(a.scene,a.camera);
    const result=a.renderer.domElement.toDataURL('image/png').split(',')[1];line.removeFromParent();line.geometry.dispose();line.material.dispose();return result;
   },{phase,view,laneIndex});
   fs.writeFileSync(`outputs/cmu-left-ankle-direction/close-${Math.round(phase*100)}-${view}-${laneIndex}.png`,Buffer.from(png,'base64'));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
