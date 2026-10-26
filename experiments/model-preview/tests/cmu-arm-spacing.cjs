const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1240,height:980}}),results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
  for(const model of ['male','female']){
   await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
   for(const clip of ['0','1']){
    await page.selectOption('#clip',clip);
    const result=await page.evaluate(async()=>{
     const {Vector3,Quaternion,Triangle,Box3}=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;
     const checkbox=document.getElementById('arm-spacing'),by=n=>a.bones.find(b=>b.name===n),p=b=>b.getWorldPosition(new Vector3()),q=b=>b.getWorldQuaternion(new Quaternion()).normalize();
     const frame=()=>{const x=p(by('upperarm_l')).sub(p(by('upperarm_r'))).normalize(),y=p(by('neck_01')).sub(p(by('pelvis'))).normalize(),z=x.clone().cross(y).normalize();return {x,y:z.clone().cross(x).normalize(),z};};
     const swing=(side,axes)=>{const d=p(by('lowerarm_'+side)).sub(p(by('upperarm_'+side)));return Math.atan2(d.dot(axes.z),-d.dot(axes.y));};
     const untouched=a.bones.filter(b=>!/(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/.test(b.name));
     let maxShoulderShift=0,maxSwingError=0,maxForearmRotationError=0,maxUntouchedPositionError=0,maxBoneLengthError=0;
     const lengths=a.bones.map(b=>b.position.length());
     for(let f=0;f<=a.cycle.period;f+=.5){
      checkbox.checked=false;a.seek(f);const axes=frame(),shoulders=['l','r'].map(s=>p(by('upperarm_'+s))),angles=['l','r'].map(s=>swing(s,axes));
      const rotations=['lowerarm_l','lowerarm_r','hand_l','hand_r'].map(n=>q(by(n))),positions=untouched.map(p);
      checkbox.checked=true;a.seek(f);
      ['l','r'].forEach((s,i)=>{maxShoulderShift=Math.max(maxShoulderShift,shoulders[i].distanceTo(p(by('upperarm_'+s))));const d=swing(s,frame())-angles[i];maxSwingError=Math.max(maxSwingError,Math.abs(Math.atan2(Math.sin(d),Math.cos(d))));});
      ['lowerarm_l','lowerarm_r','hand_l','hand_r'].forEach((n,i)=>maxForearmRotationError=Math.max(maxForearmRotationError,q(by(n)).angleTo(rotations[i])));
      untouched.forEach((b,i)=>maxUntouchedPositionError=Math.max(maxUntouchedPositionError,p(b).distanceTo(positions[i])));
      a.bones.forEach((b,i)=>maxBoneLengthError=Math.max(maxBoneLengthError,Math.abs(b.position.length()-lengths[i])));
     }
     const surfaces=[];
     a.model.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;const at=mesh.geometry.attributes,torso=[],arms=[];
      for(let i=0;i<at.position.count;i++){let body=0,arm=0;for(let j=0;j<4;j++){
       const n=mesh.skeleton.bones[at.skinIndex.getComponent(i,j)].name,w=at.skinWeight.getComponent(i,j);
       if(/^(pelvis|spine_\d+)$/.test(n))body+=w;if(/^(lowerarm|hand)_[lr]$/.test(n))arm+=w;
      }torso.push(body>.6);if(arm>.65&&i%3===0)arms.push(i);}
      const index=mesh.geometry.index,triangles=[];for(let k=0;k<(index?.count||at.position.count);k+=3){const ids=[0,1,2].map(j=>index?index.getX(k+j):k+j);if(ids.every(i=>torso[i]))triangles.push(ids);}
      surfaces.push({mesh,arms,triangles});
     });
     const proximity=[];
     for(const enabled of [false,true]){
      checkbox.checked=enabled;let minimum=Infinity;const phases=[];
      for(let k=0;k<48;k++){
       a.seek(a.cycle.period*k/48);let distance=Infinity;const target=new Vector3();
       for(const {mesh,arms,triangles} of surfaces){mesh.skeleton.update();const cache=new Map(),vertex=i=>{if(!cache.has(i))cache.set(i,mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));return cache.get(i);};
        const ts=triangles.map(ids=>{const v=ids.map(vertex);return {triangle:new Triangle(...v),box:new Box3().setFromPoints(v)};});
        for(const i of arms){const v=vertex(i);for(const {triangle,box} of ts){if(box.distanceToPoint(v)>=distance)continue;triangle.closestPointToPoint(v,target);distance=Math.min(distance,v.distanceTo(target));}}
       }
       minimum=Math.min(minimum,distance);phases.push({phase:k/48,distance});
      }proximity.push({enabled,minimum,phases});
     }
     const at=f=>{a.seek(f);return a.bones.map(p);},n=a.cycle.period,e=.001,zero=at(0),end=at(n),before=at(n-e),after=at(e);
     const seamGap=Math.max(...zero.map((p,i)=>p.distanceTo(end[i]))),dt=e/a.clip.fps;
     const seamVelocityError=Math.max(...zero.map((p,i)=>p.clone().sub(before[i]).divideScalar(dt).distanceTo(after[i].clone().sub(p).divideScalar(dt))));
     return {clip:a.clip.id,poseSamples:2*n+1,maxShoulderShift,maxSwingError,maxForearmRotationError,maxUntouchedPositionError,maxBoneLengthError,proximity,seamGap,seamVelocityError};
    });
    results.push({model,...result});console.log(model,JSON.stringify({...result,proximity:result.proximity.map(({phases,...r})=>r)}));
    assert(result.maxShoulderShift<1e-6);assert(result.maxSwingError<1e-6);assert(result.maxForearmRotationError<1e-6);assert(result.maxUntouchedPositionError<1e-6);assert(result.maxBoneLengthError<1e-8);
    assert(result.proximity[1].minimum>.005,'at least 5mm sampled surface clearance');assert(result.proximity[1].minimum>result.proximity[0].minimum);
    assert(result.seamGap<1e-8&&result.seamVelocityError<.02);
   }
  }
  await page.uncheck('#arm-spacing');assert.equal(await page.evaluate(()=>window.mocapReview.armSpacing),null);
  await page.check('#arm-spacing');assert(await page.evaluate(()=>!!window.mocapReview.armSpacing));
  await page.selectOption('#mode','raw');assert(await page.isDisabled('#arm-spacing'));assert.equal(await page.evaluate(()=>window.mocapReview.armSpacing),null);
  await page.selectOption('#mode','loop');assert(await page.isEnabled('#arm-spacing'));assert(await page.evaluate(()=>!!window.mocapReview.armSpacing));
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(errors,[]);
  results.push({test:'toggle, raw bypass, loop restore, no storage writes',passed:true});
 }finally{fs.writeFileSync('docs/05-validation/reports/cmu-arm-spacing.json',JSON.stringify({testedAt:new Date().toISOString(),scope:'Default rigs. Sagittal upper-arm swing and shoulder/forearm preservation. Unsigned sampled forearm/hand-to-torso distance; excludes upper-arm attachment, not full intersection certification.',results,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
