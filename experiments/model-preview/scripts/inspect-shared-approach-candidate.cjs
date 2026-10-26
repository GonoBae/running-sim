const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:1000}});await p.goto('http://127.0.0.1:5173/review/shared-gait.html?compare=shared-approach');
 await p.waitForFunction(()=>window.sharedGaitReview?.ready);
 const r=await p.evaluate(async()=>{
  const a=window.sharedGaitReview,T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  a.renderer.setAnimationLoop(null);a.lanes.forEach(l=>{l.group.position.set(0,0,0);l.group.updateMatrixWorld(true);});
  const neutral=(await new GLTFLoader().loadAsync('/models/runner-male.glb')).scene;neutral.updateMatrixWorld(true);
  const V=()=>new T.Vector3(),pos=(l,n)=>l.model.getObjectByName(n).getWorldPosition(V()),cut=pos({model:neutral},'foot_r').y-.03;
  const ids=[];neutral.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){const p=m.getVertexPosition(i,V()).applyMatrix4(m.matrixWorld);if(p.x<0&&p.y<cut)ids.push([m.name,i]);}});
  const skin=l=>{const sum=V();l.model.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});for(const [n,i]of ids){const m=l.model.getObjectByName(n);sum.add(m.getVertexPosition(i,V()).applyMatrix4(m.matrixWorld));}return sum.divideScalar(ids.length);};
  const rows=[],{start,end}=a.approachPlan.window;
  for(let i=0;i<=400;i++){const t=start+(end-start)*i/400;a.bilateralPlan.apply(a.lanes[0],a.probe,t);a.approachPlan.apply(a.lanes[1],a.probe,t);rows.push({t,...Object.fromEntries(a.lanes.map((l,j)=>[j?'after':'before',skin(l).x-pos(l,'thigh_r').x]))});}
  const excess=key=>{let d=0;for(let i=1;i<rows.length;i++)d+=Math.abs(rows[i][key]-rows[i-1][key]);return (d-Math.abs(rows.at(-1)[key]-rows[0][key]))*1000;};
  const derivatives=[];
  for(const t of [start,end,start-.5,end-.5,0,.5,1])for(const kind of ['bilateralPlan','approachPlan']){
   const h=1e-5,points=[-2,-1,0,1,2].map(k=>{a[kind].apply(a.lanes[1],a.probe,t+k*h);return pos(a.lanes[1],'foot_r').sub(pos(a.lanes[1],'pelvis'));});
   const vl=points[2].clone().multiplyScalar(3).addScaledVector(points[1],-4).add(points[0]).divideScalar(2*h*a.data.seconds);
   const vr=points[2].clone().multiplyScalar(-3).addScaledVector(points[3],4).addScaledVector(points[4],-1).divideScalar(2*h*a.data.seconds);
   derivatives.push({t,kind,gap:vl.distanceTo(vr),vl:vl.toArray(),vr:vr.toArray()});
  }
  return {ids:ids.length,beforeExcessMm:excess('before'),afterExcessMm:excess('after'),derivatives,rows};
 });
 console.log(JSON.stringify({...r,rows:undefined}));fs.writeFileSync('docs/05-validation/reports/cmu-shared-approach-candidate.json',JSON.stringify(r));
 for(const view of ['front','side']){await p.click('#'+view);await p.evaluate(()=>window.sharedGaitReview.seek(.99));await p.locator('#view canvas').screenshot({path:`outputs/cmu-shared-approach/candidate-${view}.png`});}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
