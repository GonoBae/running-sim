const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const out='outputs/cmu-toe-slip-path';fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:940}});await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=toe-slip-path');await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:120000});
 for(const [side,phase]of [['r',.505],['l',.005]])for(const view of ['front','side'])for(const laneIndex of [0,1]){
  const png=await page.evaluate(async({side,phase,view,laneIndex})=>{
   const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.renderer.setAnimationLoop(null);a.seek(phase*a.cycle.period);
   const lane=a.comparison.lanes[laneIndex],baseline=a.comparison.lanes[0],pos=b=>b.getWorldPosition(new T.Vector3());
   // Shared framing: center on the BASELINE ankle, translated to this lane.
   // The corrected ankle is allowed to move and is never recentered separately.
   const center=baseline.group.worldToLocal(pos(baseline.bones.find(b=>b.name==='foot_'+side)));lane.group.localToWorld(center);center.z+=.045;center.y=.18;
   const line=new T.Line(new T.BufferGeometry().setFromPoints(['calf','foot','ball'].map(n=>pos(lane.bones.find(b=>b.name===n+'_'+side)))),new T.LineBasicMaterial({color:side==='r'?'#bc6444':'#1687ad',depthTest:false}));line.renderOrder=10;a.scene.add(line);
   const markers=[];
   for(const [p,color] of [[lane.readSole(side).points.toe,0x16866d],[lane.contactPlans.find(p=>p.window.side===side).patch.read(),0xc87515]]){
    const marker=new T.Mesh(new T.SphereGeometry(.004,12,8),new T.MeshBasicMaterial({color,depthTest:false}));marker.position.copy(p);marker.renderOrder=11;a.scene.add(marker);markers.push(marker);
   }
   a.renderer.setSize(480,520);Object.assign(a.camera,{left:-.205,right:.205,top:.222,bottom:-.222});a.camera.updateProjectionMatrix();a.camera.position.copy(center).add(new T.Vector3(view==='side'?10:0,0,view==='front'?10:0));a.camera.lookAt(center);a.renderer.render(a.scene,a.camera);
   const result=a.renderer.domElement.toDataURL('image/png').split(',')[1];line.removeFromParent();line.geometry.dispose();line.material.dispose();for(const m of markers){m.removeFromParent();m.geometry.dispose();m.material.dispose();}return result;
  },{side,phase,view,laneIndex});fs.writeFileSync(`${out}/close-${side}-${view}-${laneIndex}.png`,Buffer.from(png,'base64'));
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
