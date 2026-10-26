const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const output='outputs/leg-lift';fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  const page=await context.newPage(),cases=[],errors=[],measurements=[];
  page.on('pageerror',e=>errors.push(e.message));
  const bodyStep=async()=>{if(await page.locator('#previous-body').isVisible())await page.click('#previous-body');};
  const poseStep=async()=>{if(await page.locator('#next-pose').isVisible()&&!(await page.locator('#next-pose').isDisabled()))await page.click('#next-pose');};
  const ready=async()=>{await page.waitForFunction(()=>document.body.dataset.loaded==='true');await poseStep();};
  const state=()=>page.evaluate(()=>{
    const a=window.modelPreview;
    return {values:{...a.runningPose.values},rotations:a.bones.map(b=>b.quaternion.toArray()),playing:a.legLiftControls.playing};
  });
  const test=async(name,fn)=>{console.log(name);try{await fn();cases.push({name,passed:true});}catch(e){cases.push({name,passed:false,error:String(e.stack)});throw e;}};
  const angle=async value=>{await page.locator('#lift-number').fill(String(value));await page.locator('#lift-number').dispatchEvent('change');};
  const select=async type=>{await bodyStep();await page.click(`[data-model-type=${type}]`);await ready();await page.waitForFunction(t=>document.querySelector(`[data-model-type=${t}]`).getAttribute('aria-pressed')==='true',type);};
  const playing=()=>page.waitForFunction(()=>window.modelPreview.legLiftControls.playing);
  try{
    await page.goto('http://127.0.0.1:5173');await ready();
    for(const type of ['male','female']){
      await select(type);
      await test(`${type}: physical angles, peak targets, full cycle, boundaries and editing independence`,async()=>{
        const result=await page.evaluate(async()=>{
          const {createLegLiftMotion}=await import('/src/leg-lift-motion.ts');
          const a=window.modelPreview,p=a.runningPose;
          p.set('thigh_l',12);p.set('calf_l',70);p.set('calf_r',40);p.set('upperarm_l',20);
          const original=JSON.stringify(p.values),originalRotations=JSON.stringify(a.bones.map(b=>b.quaternion.toArray()));
          const motion=createLegLiftMotion(p),position=name=>a.bones.find(b=>b.name===name).getWorldPosition(a.camera.position.clone());
          function measure(){
            const angles={};
            for(const side of ['l','r']){
              const leg=position('calf_'+side).sub(position('thigh_'+side)).normalize();
              const shin=position('foot_'+side).sub(position('calf_'+side)).normalize();
              const arm=position('lowerarm_'+side).sub(position('upperarm_'+side)).normalize();
              const fore=position('hand_'+side).sub(position('lowerarm_'+side)).normalize();
              angles['thigh_'+side]=Math.atan2(leg.z,-leg.y)*180/Math.PI;
              angles['calf_'+side]=leg.angleTo(shin)*180/Math.PI;
              angles['upperarm_'+side]=Math.atan2(arm.z,-arm.y)*180/Math.PI;
              angles['lowerarm_'+side]=arm.angleTo(fore)*180/Math.PI;
            }
            return angles;
          }
          let maxError=0,boundaryError=0,independent=true;const peaks=[];
          for(const target of [0,20,50,65]){
            motion.start(target,1000);let l=0,r=0,min=0,max=0;
            for(let t=0;t<=1200;t+=10){
              motion.tick(1000+t);const actual=measure(),frame=motion.frame;
              for(const key of Object.keys(frame))maxError=Math.max(maxError,Math.abs(actual[key]-frame[key]));
              independent&&=JSON.stringify(p.values)===original;
              l=Math.max(l,actual.thigh_l);r=Math.max(r,actual.thigh_r);
              min=Math.min(min,actual.thigh_l,actual.thigh_r);max=Math.max(max,actual.thigh_l,actual.thigh_r);
            }
            motion.tick(2199);const before=measure();motion.tick(2201);const after=measure();
            boundaryError=Math.max(boundaryError,Math.abs(before.thigh_l-after.thigh_l),Math.abs(before.thigh_r-after.thigh_r));
            peaks.push({target,left:l,right:r,min,max});motion.stop();
          }
          return {maxError,boundaryError,independent,restored:JSON.stringify(a.bones.map(b=>b.quaternion.toArray()))===originalRotations,peaks};
        });
        assert(result.maxError<.0001);assert(result.boundaryError<.01);assert(result.independent&&result.restored);
        for(const peak of result.peaks){assert(Math.abs(peak.left-peak.target)<.0001);assert(Math.abs(peak.right-peak.target)<.0001);assert(peak.min>-.0001&&peak.max<=peak.target+.0001);}
        measurements.push({model:type,...result});
      });
      await test(`${type}: UI live playback, stop, snapshot and telemetry isolation`,async()=>{
        await page.click('#save-pose');const before=await state();await angle(50);await page.click('#play-lift');await playing();
        const live=await page.evaluate(()=>new Promise(resolve=>{
          const a=window.modelPreview,samples=[],start=performance.now();
          const capture=()=>{samples.push(a.bones.find(b=>b.name==='thigh_l').quaternion.toArray());if(performance.now()-start<1300)requestAnimationFrame(capture);else resolve(samples);};requestAnimationFrame(capture);
        }));
        assert(new Set(live.map(v=>JSON.stringify(v))).size>5);assert.deepEqual((await state()).values,before.values);
        await page.click('#stop-lift');const after=await state();assert(!after.playing);assert.deepEqual(after.rotations,before.rotations);
        await page.click('#load-pose');assert.deepEqual((await state()).values,before.values);
        assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).map(k=>JSON.parse(localStorage[k])).filter(e=>e.kind==='configuration_applied').length),0);
      });
    }
    await test('continuous frames reject invalid values, preserve integer snapshot contract, and roll back exceptions',async()=>{
      const r=await page.evaluate(()=>{
        const a=window.modelPreview,p=a.runningPose,values={...p.values},q=()=>JSON.stringify(a.bones.map(b=>b.quaternion.toArray()));
        const original=q();const fractional={...values,thigh_l:20.25};
        const smooth=p.applyFrame(fractional).ok,restoreReject=!p.restore(fractional).ok;p.apply();
        const bad=[{...values,thigh_l:NaN},{...values,thigh_l:66},{...values,extra:0}].every(v=>!p.applyFrame(v).ok&&q()===original);
        const update=a.model.updateMatrixWorld;a.model.updateMatrixWorld=()=>{throw Error('injected');};
        let rollback;try{rollback=!p.applyFrame(fractional).ok&&q()===original;}finally{a.model.updateMatrixWorld=update;}
        return {smooth,restoreReject,bad,rollback,unchanged:JSON.stringify(p.values)===JSON.stringify(values)};
      });assert(Object.values(r).every(Boolean));
    });
    await test('invalid maximum angles never start playback',async()=>{
      for(const value of ['',-1,66,20.5]){await angle(value);await page.click('#play-lift');assert(!(await state()).playing);assert.match(await page.locator('#lift-message').innerText(),/정수/);}
      await angle(30);
    });
    await test('editing, saving, restoring and applying stop before existing action',async()=>{
      for(const id of ['save-pose','load-pose','reset-pose','apply-settings']){
        await page.click('#play-lift');await playing();await page.click('#'+id);assert(!(await state()).playing);
      }
      await page.click('#play-lift');await page.locator('#pose-number').fill('10');await page.locator('#pose-number').dispatchEvent('change');assert(!(await state()).playing);
    });
    await test('body length edit stops and regenerated angles remain correct',async()=>{
      await page.click('#play-lift');await playing();await bodyStep();await page.selectOption('#body-part','2');
      const cm=Number(await page.locator('#part-number').inputValue());await page.locator('#part-number').fill((cm*1.05).toFixed(1));await page.locator('#part-number').dispatchEvent('change');assert(!(await state()).playing);
      const error=await page.evaluate(async()=>{
        const {createLegLiftMotion}=await import('/src/leg-lift-motion.ts');const a=window.modelPreview,m=createLegLiftMotion(a.runningPose);
        m.start(50,0);m.tick(300);const p=n=>a.bones.find(b=>b.name===n).getWorldPosition(a.camera.position.clone()),v=p('calf_l').sub(p('thigh_l'));
        const error=Math.abs(Math.atan2(v.z,-v.y)*180/Math.PI-50);m.stop();return error;
      });assert(error<.0001);await poseStep();
    });
    await test('model load stops playback and disables play until ready',async()=>{
      await page.click('#play-lift');let release,seen;const gate=new Promise(r=>release=r),started=new Promise(r=>seen=r);
      await page.route('**/models/runner-male.glb',async route=>{seen();await gate;await route.continue();});
      await bodyStep();await page.click('[data-model-type=male]');await started;
      try{assert(await page.locator('#play-lift').isDisabled());assert(!(await state()).playing);}finally{release();}
      await ready();await page.unroute('**/models/runner-male.glb');assert(!(await page.locator('#play-lift').isDisabled()));
    });
    await test('failed model load prevents playback and recovery stays stopped',async()=>{
      await page.click('#play-lift');await page.route('**/models/runner-female.glb',route=>route.abort());await bodyStep();await page.click('[data-model-type=female]');
      await page.waitForFunction(()=>document.body.dataset.loaded==='error');assert(await page.locator('#play-lift').isDisabled());
      await page.unroute('**/models/runner-female.glb');await select('female');assert(!(await state()).playing);
    });
    await test('hidden tab stops without automatic resume',async()=>{
      await page.click('#play-lift');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
      assert(!(await state()).playing);assert.match(await page.locator('#lift-message').innerText(),/탭이 숨겨져/);
    });
    await page.click('[data-view=side]');await angle(50);await page.locator('#lift-section').scrollIntoViewIfNeeded();await page.click('#play-lift');
    await page.waitForFunction(()=>window.modelPreview.legLiftControls.frame?.thigh_l>45);
    await page.screenshot({path:output+'/leg-lift-desktop.png'});await page.click('#stop-lift');
    await page.locator('#lift-section').screenshot({path:output+'/leg-lift-controls.png'});
    await test('390px viewport and keyboard controls',async()=>{
      await page.setViewportSize({width:390,height:844});await page.locator('#play-lift').focus();await page.keyboard.press('Enter');await playing();
      await page.locator('#stop-lift').focus();await page.keyboard.press('Enter');assert(!(await state()).playing);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.locator('#lift-section').screenshot({path:output+'/leg-lift-narrow.png'});
    });
    await test('changed settings stop playing, stale policy blocks restart',async()=>{
      await page.click('#play-lift');await page.evaluate(async()=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.thigh.max=40;s.saveSettings(v);});
      await page.waitForFunction(()=>document.getElementById('play-lift').disabled&&!window.modelPreview.legLiftControls.playing);
    });
    await test('hidden thigh and policy excluding zero both block motion',async()=>{
      for(const variant of ['hidden','no-zero']){
        await page.evaluate(async variant=>{const s=await import('/src/settings.ts'),v=s.readSettings();v.categories.thigh.enabled=variant!=='hidden';v.categories.thigh.min=variant==='no-zero'?5:-15;v.categories.thigh.initial=variant==='no-zero'?5:0;s.saveSettings(v);},variant);
        await page.reload();await ready();assert(await page.locator('#play-lift').isDisabled());
      }
    });
    await test('unreadable settings block playback on click',async()=>{
      await page.evaluate(()=>localStorage.removeItem('running-sim.lab.settings.v1'));await page.reload();await ready();
      await page.evaluate(()=>localStorage.setItem('running-sim.lab.settings.v1','{'));await page.click('#play-lift');assert(!(await state()).playing);assert(await page.locator('#play-lift').isDisabled());
    });
    assert.deepEqual(errors,[]);
  }finally{
    const report={testedAt:new Date().toISOString(),browser:await browser.version(),scope:'M06 real male/female GLB; fixed 1.2s lift experiment, no contact validation; hidden-tab event simulated; 390px desktop viewport, not real mobile',measurements,cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};
    fs.writeFileSync('docs/05-validation/reports/leg-lift.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
