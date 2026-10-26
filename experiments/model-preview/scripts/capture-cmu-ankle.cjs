const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const fs=require('node:fs');
(async()=>{fs.mkdirSync('outputs/cmu-ankle',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1240,height:980}});await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);await page.click('#front');
 await page.evaluate(()=>window.mocapReview.renderer.setAnimationLoop(null));
 for(const test of [{name:'overview',clip:'0',phase:.25},{name:'skin',clip:'1',phase:23/75}]){
  await page.selectOption('#clip',test.clip);
  for(const state of ['before','after','neutral']){
   await page.locator('#ankle-relative').setChecked(state!=='before');
   for(const overlay of [false,true]){
    await page.evaluate(async({test,state,overlay})=>{
     const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const a=window.mocapReview;
     if(window.ankleOverlay){a.scene.remove(window.ankleOverlay);window.ankleOverlay.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
     a.seek(a.cycle.period*test.phase);
     if(state==='neutral'){const n=(await new GLTFLoader().loadAsync('/models/runner-male.glb')).scene;for(const s of ['l','r'])a.bones.find(b=>b.name==='foot_'+s).quaternion.copy(n.getObjectByName('foot_'+s).quaternion);a.model.updateMatrixWorld(true);}
     const p=name=>a.bones.find(b=>b.name===name).getWorldPosition(new T.Vector3());
     if(test.name==='overview'){a.camera.position.set(1,.65,2.5);a.camera.lookAt(1,.35,0);}
     else {const ankle=p('foot_r');a.camera.position.copy(ankle).add(new T.Vector3(.58,.25,1));a.camera.lookAt(ankle);}
     if(overlay){const group=new T.Group();window.ankleOverlay=group;a.scene.add(group);
      for(const s of test.name==='overview'?['l','r']:['r'])for(const [from,to,color] of [[`calf_${s}`,`foot_${s}`,0x187d9a],[`foot_${s}`,`ball_${s}`,0xd25b3f]]){
       const start=p(from),end=p(to),line=new T.Line(new T.BufferGeometry().setFromPoints([start,end]),new T.LineBasicMaterial({color,depthTest:false}));line.renderOrder=100;group.add(line);
       const dot=new T.Mesh(new T.SphereGeometry(.006,10,8),new T.MeshBasicMaterial({color,depthTest:false}));dot.position.copy(end);dot.renderOrder=101;group.add(dot);
      }
     }
     a.renderer.render(a.scene,a.camera);
    },{test,state,overlay});
    await page.locator('#view canvas').screenshot({path:`docs/assets/images/cmu-ankle-${test.name}-${state}${overlay?'-bones':''}.png`});
   }
  }
 }
 await page.selectOption('#clip','0');await page.check('#ankle-relative');await page.click('#side');
 await page.evaluate(()=>{const a=window.mocapReview;if(window.ankleOverlay)a.scene.remove(window.ankleOverlay);});
 for(let i=0;i<24;i++){await page.evaluate(i=>window.mocapReview.seek(window.mocapReview.cycle.period*i/24),i);await page.screenshot({path:`outputs/cmu-ankle/frame-${String(i).padStart(2,'0')}.png`,clip:{x:0,y:0,width:1240,height:900}});}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
