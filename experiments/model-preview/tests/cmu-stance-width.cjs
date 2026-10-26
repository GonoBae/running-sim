const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const errors=[],results=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);
 for(const model of ['male','female']){
  await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);await page.uncheck('#stance-width');
  const sample=async()=>page.evaluate(async()=>{
   const T=await import('/node_modules/three/build/three.module.js'),{footSurfaceReader}=await import('/review/ground-contact.js');
   const a=window.mocapReview,by=n=>a.bones.find(b=>b.name===n),p=n=>by(n).getWorldPosition(new T.Vector3()),read=footSurfaceReader(a.model),rows=[];
   const frames=Array.from({length:a.cycle.period*2},(_,i)=>i*.5+.125).concat([0,.001,a.cycle.period-.001,a.cycle.period]);
   for(const f of frames){a.seek(f);const center=p('thigh_l').add(p('thigh_r')).multiplyScalar(.5),surface=read(),hipAxis=p('thigh_l').sub(p('thigh_r'));const data={};
    for(const side of ['l','r']){const foot=by('foot_'+side),hip=p('thigh_'+side),knee=p('calf_'+side),ankle=p('foot_'+side),ball=p('ball_'+side);data[side]={hip:hip.clone().sub(center).toArray(),knee:knee.clone().sub(center).toArray(),ankle:ankle.clone().sub(center).toArray(),ball:ball.clone().sub(center).toArray(),footQ:foot.getWorldQuaternion(new T.Quaternion()).toArray(),kneeQ:by('calf_'+side).quaternion.toArray(),lengths:[hip.distanceTo(knee),knee.distanceTo(ankle)],tilt:Math.atan2(ankle.x-knee.x,knee.y-ankle.y)*180/Math.PI};}
    rows.push({frame:f,support:a.contact?.support,minY:Math.min(surface.l,surface.r),footY:{l:surface.l,r:surface.r},position:a.model.position.toArray(),pelvisQ:by('pelvis').quaternion.toArray(),hipRoll:Math.atan2(hipAxis.y,hipAxis.x)*180/Math.PI,data});
   }
   return {plan:a.stancePlan,rows};
  });
  const before=await sample();await page.check('#stance-width');const after=await sample();
  const max={lengthError:0,kneeRotationError:0,footDirectionError:0,pelvisRotationError:0,pelvisXZError:0,footForwardError:0,heightChange:0,supportGap:0,ownSupportGapBefore:0,ownSupportGapAfter:0};let minY=Infinity;
  const sideMetrics={};
  for(const side of ['l','r']){const sign=side==='l'?1:-1;sideMetrics[side]={beforeMin:Infinity,afterMin:Infinity,beforeCrossings:0,afterCrossings:0,supportSamples:0};
   for(let i=0;i<before.rows.length;i++){
    const b=before.rows[i],a=after.rows[i],bd=b.data[side],ad=a.data[side];
    for(const [field,key] of [['lengths','lengthError'],['kneeQ','kneeRotationError'],['footQ','footDirectionError']]){const d=sign=>Math.max(...bd[field].map((v,k)=>Math.abs(v-sign*ad[field][k])));max[key]=Math.max(max[key],field==='lengths'?d(1):Math.min(d(1),d(-1)));}
    max.pelvisRotationError=Math.max(max.pelvisRotationError,...b.pelvisQ.map((v,k)=>Math.abs(v-a.pelvisQ[k])));
    max.pelvisXZError=Math.max(max.pelvisXZError,...[0,2].map(k=>Math.abs(b.position[k]-a.position[k])));
    max.footForwardError=Math.max(max.footForwardError,Math.abs(bd.ankle[2]-ad.ankle[2]),Math.abs(bd.ball[2]-ad.ball[2]));
    max.heightChange=Math.max(max.heightChange,Math.abs(b.position[1]-a.position[1]));minY=Math.min(minY,a.minY);
    if(a.support){max.supportGap=Math.max(max.supportGap,a.minY);max.ownSupportGapBefore=Math.max(max.ownSupportGapBefore,b.footY[b.support]);max.ownSupportGapAfter=Math.max(max.ownSupportGapAfter,a.footY[a.support]);}
    if(a.support===side){const bmin=Math.min(sign*bd.ankle[0],sign*bd.ball[0]),amin=Math.min(sign*ad.ankle[0],sign*ad.ball[0]),m=sideMetrics[side];m.beforeMin=Math.min(m.beforeMin,bmin);m.afterMin=Math.min(m.afterMin,amin);m.beforeCrossings+=bmin<0;m.afterCrossings+=amin<0;m.supportSamples++;}
   }
  }
  for(const k of ['lengthError','kneeRotationError','footDirectionError','pelvisRotationError','pelvisXZError','footForwardError'])assert(max[k]<(k==='footDirectionError'?1e-6:k==='footForwardError'?1e-7:1e-8),k);
  assert(minY>=-1e-6);assert(max.supportGap<.001);assert(max.ownSupportGapAfter<.001);assert(max.heightChange<.04);
  for(const side of ['l','r']){assert(!after.plan.diagnostics[side].limited);assert(sideMetrics[side].afterMin>=after.plan.clearance-1e-5);assert.equal(sideMetrics[side].afterCrossings,0);}
  const ends=after.rows.slice(-4);let seam=0,velocitySeam=0;
  for(const side of ['l','r'])for(const key of ['hip','knee','ankle','ball'])for(let k=0;k<3;k++){
   const x=ends.map(r=>r.data[side][key][k]);seam=Math.max(seam,Math.abs(x[0]-x[3]));velocitySeam=Math.max(velocitySeam,Math.abs((x[1]-x[0])/.001-(x[3]-x[2])/.001)*120);
  }
  assert(seam<1e-8);assert(velocitySeam<.01);
  await page.uncheck('#stance-width');const restored=await sample();assert.deepEqual(restored.rows,before.rows);await page.check('#stance-width');
  results.push({model,plan:after.plan,max,minY,seam,velocitySeam,sideMetrics,sampledPoses:after.rows.length,before:before.rows,after:after.rows});
  console.log(JSON.stringify({...results.at(-1),before:undefined,after:undefined}));
 }
 // Reconfiguration must preserve phase and recalibrate for a changed foot frame.
 await page.evaluate(()=>{const a=window.mocapReview;a.seek(a.cycle.period*.4);});
 const phase=await page.inputValue('#phase');
 await page.uncheck('#stance-width');await page.check('#stance-width');assert.equal(await page.inputValue('#phase'),phase);
 await page.uncheck('#ankle-relative');
 const alternate=await page.evaluate(async()=>{
  const {readStance}=await import('/review/stance-width.js'),a=window.mocapReview;let min=Infinity;
  for(let f=.125;f<a.cycle.period;f+=.5){a.seek(f);const side=a.contact?.support;if(side){const pose=readStance(a.bones)[side],sign=side==='l'?1:-1;min=Math.min(min,pose.foot.x*sign,pose.ball.x*sign);}}
  return {min,clearance:a.stancePlan.clearance};
 });assert(alternate.min>=alternate.clearance-1e-5);await page.check('#ankle-relative');
 await page.selectOption('#mode','raw');assert(await page.isDisabled('#stance-width'));assert.equal(await page.evaluate(()=>window.mocapReview.stancePlan),null);
 await page.selectOption('#mode','loop');assert(await page.isEnabled('#stance-width'));
 // Actual same-phase, same-camera captures. Overlay only the diagnostic hip/leg guides.
 await page.selectOption('#model','male');await page.waitForFunction(()=>window.mocapReview.ready);await page.click('#front');
 for(const on of [false,true]){
  await page.setChecked('#stance-width',on);
  await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),a=window.mocapReview;a.seek(a.cycle.period*.375);a.renderer.setAnimationLoop(null);
   a.scene.getObjectByName('stance-guide')?.removeFromParent();const group=new T.Group();group.name='stance-guide';const p=n=>a.bones.find(b=>b.name===n).getWorldPosition(new T.Vector3());const center=p('thigh_l').add(p('thigh_r')).multiplyScalar(.5);
   const line=(points,color)=>new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,depthTest:false}));group.add(line([new T.Vector3(center.x,0,center.z),new T.Vector3(center.x,1.7,center.z)],'#b47808'));
   for(const side of ['l','r'])group.add(line(['thigh','calf','foot','ball'].map(n=>p(n+'_'+side)),side==='l'?'#007fba':'#c04381'));
   group.traverse(o=>o.renderOrder=5);a.scene.add(group);
   const camera=new T.OrthographicCamera(-1.05*a.camera.aspect,1.05*a.camera.aspect,1.05,-1.05,.01,50);
   camera.position.set(center.x,.95,center.z+10);camera.lookAt(center.x,.95,center.z);camera.updateProjectionMatrix();a.renderer.render(a.scene,camera);
  });
  const rect=await page.locator('#view').boundingBox();await page.screenshot({path:`docs/assets/images/cmu-stance-${on?'after':'before'}.png`,clip:{x:rect.x+rect.width/4,y:rect.y,width:rect.width/2,height:rect.height}});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/05-validation/reports/cmu-stance-width.json',JSON.stringify({testedAt:new Date().toISOString(),checks:['phase retained on toggle','alternate foot frame recalibrated','raw bypass / loop enabled'],scope:'35_17 fixed hip abduction experiment. Independent .125-offset frames. Estimated support only, not biomechanical stability validation.',results,errors},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
