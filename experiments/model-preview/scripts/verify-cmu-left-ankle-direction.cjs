const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const out = 'outputs/cmu-left-ankle-direction';
fs.mkdirSync(out, {recursive: true});
const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
const angle = (a,b) => 2*Math.acos(Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))))*180/Math.PI;

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:true, args:['--enable-unsafe-swiftshader']});
  const errors=[], results=[];
  try {
    const page=await browser.newPage({viewport:{width:1280,height:940}});
    page.on('pageerror',e=>errors.push(e.message));
    for (const model of ['male','female']) {
      await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=left-ankle-direction');
      await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});
      if(model==='female') {await page.selectOption('#model',model); await page.waitForFunction(()=>window.mocapReview?.ready,null,{timeout:60000});}
      const data=await page.evaluate(async()=>{
        const T=await import('/node_modules/three/build/three.module.js'), a=window.mocapReview;
        a.renderer.setAnimationLoop(null);
        const snapshot=phase=>{
          a.seek(phase*a.cycle.period);
          const lanes=a.comparison.lanes.map(l=>{
            const bones=Object.fromEntries(l.bones.map(b=>[b.name,{p:l.group.worldToLocal(b.getWorldPosition(new T.Vector3())).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).normalize().toArray()}]));
            const feet=Object.fromEntries(l.contactPlans.map(p=>[p.window.side,{patch:l.group.worldToLocal(p.patch.read()).toArray(),floor:l.readSurface(p.window.side).min}]));
            const foot=l.bones.find(b=>b.name==='foot_l'),calf=l.bones.find(b=>b.name==='calf_l'),q=foot.getWorldQuaternion(new T.Quaternion()).normalize(),axes=a.comparison.ankleDirectionPlan.axes;
            const f=axes.forward.clone().applyQuaternion(q),lat=axes.lateral.clone().applyQuaternion(q);
            const relative=calf.getWorldQuaternion(new T.Quaternion()).invert().multiply(q).normalize();
            return {bones,feet,relativeQ:relative.toArray(),yaw:Math.atan2(f.x,f.z)*180/Math.PI,pitch:Math.atan2(f.y,Math.hypot(f.x,f.z))*180/Math.PI,tilt:Math.atan2(lat.y,Math.hypot(lat.x,lat.z))*180/Math.PI};
          });
          return {phase,lanes,diagnostic:a.comparison.diagnostics[1]?.ankleDirection};
        };
        const rows=Array.from({length:365},(_,i)=>snapshot(i/364));
        const landmarks=[.63,.69,.75,.83,.92,.09,.15,.21,.43].map(snapshot);
        const boundaries=[.63,.75,.09,.21].map(t=>({phase:t,samples:[-.0002,-.0001,0,.0001,.0002].map(d=>snapshot(t+d))}));
        const first=snapshot(.83);snapshot(.3);const repeat=snapshot(.83);
        a.comparison.view(true);const side=snapshot(.83);a.comparison.view(false);
        return {rows,landmarks,boundaries,first,repeat,side,anchorYaw:a.comparison.ankleDirectionPlan.anchorYaw};
      });
      const metrics={headingCorrectionErrorDeg:0,touchdownYawDeg:0,midSupportYawDeg:0,baselineMm:0,baselineDeg:0,pelvisMm:0,pelvisDeg:0,rightMm:0,rightDeg:0,recoveryMm:0,recoveryDeg:0,patchXZmm:0,floorMm:0,lengthMm:0,kneeXmm:0,kneeClampMm:0,maxResidualMm:0,supportYawDeg:0,supportTiltDeg:0,tiltChangeDeg:0,pitchChangeDeg:0,supportPitchChangeDeg:0,repeatMm:0,viewMm:0,boundarySecondMm:0,boundaryRotationSecondDeg:0};
      const archived=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-swing-approach.json')).results.find(r=>r.model===model);
      for(const row of data.rows){
        const [B,C]=row.lanes,old=archived.rows.find(r=>Math.abs(r.phase-row.phase)<1e-9).lanes[1];
        for(const name of Object.keys(old.bones)){
          metrics.baselineMm=Math.max(metrics.baselineMm,distance(B.bones[name].p,old.bones[name].p)*1000);
          metrics.baselineDeg=Math.max(metrics.baselineDeg,angle(B.bones[name].q,old.bones[name].q));
        }
        for(const name of Object.keys(B.bones)){
          const mm=distance(B.bones[name].p,C.bones[name].p)*1000,deg=angle(B.bones[name].q,C.bones[name].q);
          if(!/^(thigh|calf|foot|ball)_l$/.test(name)){metrics.pelvisMm=Math.max(metrics.pelvisMm,mm);metrics.pelvisDeg=Math.max(metrics.pelvisDeg,deg);}
          if(name.endsWith('_r')){metrics.rightMm=Math.max(metrics.rightMm,mm);metrics.rightDeg=Math.max(metrics.rightDeg,deg);}
          if(row.phase>=.21&&row.phase<=.63){metrics.recoveryMm=Math.max(metrics.recoveryMm,mm);metrics.recoveryDeg=Math.max(metrics.recoveryDeg,deg);}
        }
        metrics.patchXZmm=Math.max(metrics.patchXZmm,Math.hypot(B.feet.l.patch[0]-C.feet.l.patch[0],B.feet.l.patch[2]-C.feet.l.patch[2])*1000);
        metrics.floorMm=Math.max(metrics.floorMm,Math.abs(B.feet.l.floor-C.feet.l.floor)*1000);
        const expectedHeading=B.yaw-(row.diagnostic?.weight||0)*data.anchorYaw*180/Math.PI;
        const headingError=(C.yaw-expectedHeading)*Math.PI/180;
        metrics.headingCorrectionErrorDeg=Math.max(metrics.headingCorrectionErrorDeg,Math.abs(Math.atan2(Math.sin(headingError),Math.cos(headingError)))*180/Math.PI);
        metrics.tiltChangeDeg=Math.max(metrics.tiltChangeDeg,Math.abs(C.tilt-B.tilt));
        metrics.pitchChangeDeg=Math.max(metrics.pitchChangeDeg,Math.abs(C.pitch-B.pitch));
        metrics.kneeXmm=Math.max(metrics.kneeXmm,Math.abs(B.bones.calf_l.p[0]-C.bones.calf_l.p[0])*1000);
        for(const [x,y] of [['thigh_l','calf_l'],['calf_l','foot_l']])metrics.lengthMm=Math.max(metrics.lengthMm,Math.abs(distance(B.bones[x].p,B.bones[y].p)-distance(C.bones[x].p,C.bones[y].p))*1000);
        metrics.kneeClampMm=Math.max(metrics.kneeClampMm,(row.diagnostic?.kneeClamp||0)*1000);
        metrics.maxResidualMm=Math.max(metrics.maxResidualMm,(row.diagnostic?.residual||0)*1000);
        if(row.phase>=.75||row.phase<=.09){metrics.supportYawDeg=Math.max(metrics.supportYawDeg,Math.abs(C.yaw));metrics.supportTiltDeg=Math.max(metrics.supportTiltDeg,Math.abs(C.tilt));metrics.supportPitchChangeDeg=Math.max(metrics.supportPitchChangeDeg,Math.abs(C.pitch-B.pitch));}
      }
      for(const n of Object.keys(data.first.lanes[1].bones)){
        metrics.repeatMm=Math.max(metrics.repeatMm,distance(data.first.lanes[1].bones[n].p,data.repeat.lanes[1].bones[n].p)*1000);
        metrics.viewMm=Math.max(metrics.viewMm,distance(data.first.lanes[1].bones[n].p,data.side.lanes[1].bones[n].p)*1000);
      }
      for(const boundary of data.boundaries){
        const [lo,at,hi]=boundary.samples.slice(1,4).map(r=>r.lanes[1]);
        for(const n of Object.keys(at.bones)){
          metrics.boundarySecondMm=Math.max(metrics.boundarySecondMm,Math.hypot(...at.bones[n].p.map((v,j)=>lo.bones[n].p[j]+hi.bones[n].p[j]-2*v))*1000);
          // Differences of adjacent small rotation magnitudes catch boundary speed jumps.
          metrics.boundaryRotationSecondDeg=Math.max(metrics.boundaryRotationSecondDeg,Math.abs(angle(lo.bones[n].q,at.bones[n].q)-angle(at.bones[n].q,hi.bones[n].q)));
        }
      }
      metrics.touchdownYawDeg=Math.abs(data.landmarks.find(r=>r.phase===.75).lanes[1].yaw);
      metrics.midSupportYawDeg=Math.abs(data.landmarks.find(r=>r.phase===.92).lanes[1].yaw);
      console.log(model,metrics);
      results.push({model,metrics,...data});
      for(const view of ['front','side']){
        await page.click('#'+view);
        for(const phase of [.28,.43,.75,.83,.92,.09]){
          await page.evaluate(p=>window.mocapReview.seek(p*window.mocapReview.cycle.period),phase);
          await page.locator('#view canvas').screenshot({path:`${out}/${model}-${view}-${Math.round(phase*100)}.png`});
        }
      }
    }
    const files=['left-ankle-direction.js','landing-width-comparison.js','mocap.js'];
    const hashes=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('experiments/model-preview/review/'+f)).digest('hex')]));
    fs.writeFileSync('docs/05-validation/reports/cmu-left-ankle-direction.json',JSON.stringify({testedAt:new Date().toISOString(),errors,hashes,results},null,2));
    assert.deepEqual(errors,[]);
    for(const {metrics:m} of results){
      for(const k of ['baselineMm','pelvisMm','rightMm','recoveryMm','patchXZmm','floorMm','lengthMm','kneeXmm','kneeClampMm','maxResidualMm','repeatMm','viewMm'])assert(m[k]<.01,k+' '+m[k]);
      for(const k of ['baselineDeg','pelvisDeg','rightDeg','recoveryDeg'])assert(m[k]<.001,k+' '+m[k]);
      assert(m.headingCorrectionErrorDeg<.001);assert(m.touchdownYawDeg<.001);assert(m.midSupportYawDeg<3);assert(m.tiltChangeDeg<.001);assert(m.pitchChangeDeg<.001);assert(m.supportPitchChangeDeg<.001);
      assert(m.boundarySecondMm<.05);assert(m.boundaryRotationSecondDeg<.01);
    }
    console.log('PASS: M48 baseline, both models, left direction and contact preservation, right/pelvis/recovery, boundaries, deterministic seeking and views');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
