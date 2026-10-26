const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
// Run from the repository root against the Vite server at 127.0.0.1:5173.
const output='outputs/pose-snapshot';fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  const page=await context.newPage(),cases=[],errors=[],models=[];
  page.on('pageerror',error=>errors.push(error.message));
  const test=async(name,fn)=>{console.log('TEST '+name);try{await fn();cases.push({name,passed:true});}catch(error){cases.push({name,passed:false,error:String(error.stack)});throw error;}};
  const bodyStep=async()=>{if(await page.locator('#previous-body').isVisible())await page.click('#previous-body');};
  const poseStep=async()=>{if(await page.locator('#next-pose').isVisible()&&!(await page.locator('#next-pose').isDisabled()))await page.click('#next-pose');};
  const ready=async()=>{await page.waitForFunction(()=>document.body.dataset.loaded==='true');await poseStep();};
  const select=async type=>{await bodyStep();await page.locator(`[data-model-type=${type}]`).click();await ready();await page.waitForFunction(t=>document.querySelector(`[data-model-type=${t}]`).getAttribute('aria-pressed')==='true',type);};
  const edit=async values=>{await poseStep();for(const [id,value] of Object.entries(values)){
    const index=await page.evaluate(id=>window.modelPreview.runningPose.definitions.findIndex(j=>j.id===id),id);
    await page.selectOption('#bone',String(index));await page.locator('#pose-number').fill(String(value));await page.locator('#pose-number').dispatchEvent('change');
  }};
  const measure=()=>page.evaluate(()=>{
    const a=window.modelPreview;a.model.updateMatrixWorld(true);let mesh;a.model.traverse(n=>{if(n.isSkinnedMesh)mesh=n;});mesh.skeleton.update();
    const points=[],v=a.camera.position.clone();for(let i=0;i<mesh.geometry.attributes.position.count;i+=97){mesh.getVertexPosition(i,v);mesh.localToWorld(v);points.push(...v.toArray());}
    const p=n=>a.bones.find(b=>b.name===n).getWorldPosition(v.clone());let error=0;
    for(const side of ['l','r']){
      const arm=p('lowerarm_'+side).sub(p('upperarm_'+side)).normalize(),fore=p('hand_'+side).sub(p('lowerarm_'+side)).normalize(),leg=p('calf_'+side).sub(p('thigh_'+side)).normalize(),shin=p('foot_'+side).sub(p('calf_'+side)).normalize();
      [Math.atan2(arm.z,-arm.y),arm.angleTo(fore),Math.atan2(leg.z,-leg.y),leg.angleTo(shin)].forEach((r,i)=>error=Math.max(error,Math.abs(r*180/Math.PI-a.runningPose.values[['upperarm','lowerarm','thigh','calf'][i]+'_'+side])));
    }
    return {pose:{...a.runningPose.values},points,angleError:error,lengths:a.bodyDimensions.measure(),scale:a.model.scale.toArray(),camera:a.camera.position.toArray(),height:document.getElementById('body-height').value};
  });
  const count=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('running-sim.lab.event.')).map(k=>JSON.parse(localStorage[k])).filter(e=>e.kind==='configuration_applied').length);
  const A={upperarm_l:20,lowerarm_l:90,thigh_l:35,calf_l:60,upperarm_r:-10,lowerarm_r:65,thigh_r:-5,calf_r:25};
  const B={upperarm_l:-20,lowerarm_l:55,thigh_l:5,calf_l:10,upperarm_r:30,lowerarm_r:110,thigh_r:50,calf_r:100};
  try {
    await page.goto('http://127.0.0.1:5173');await ready();
    await test('empty slot: save enabled, restore disabled, lifetime notice visible',async()=>{
      assert(!(await page.locator('#save-pose').isDisabled()));assert(await page.locator('#load-pose').isDisabled());
      assert.match(await page.locator('#snapshot-section').innerText(),/새로고침하면 사라집니다/);
    });
    for(const type of ['male','female']){
      await select(type);
      await test(`${type}: A -> B -> A through buttons, numeric inputs and skin points`,async()=>{
        await edit(A);const original=await measure(),beforeCount=await count();await page.click('#save-pose');
        assert.equal(await page.locator('#save-pose').innerText(),'저장한 자세 바꾸기');
        await edit(B);assert.match(await page.locator('#snapshot-message').innerText(),/저장한 자세는 유지/);
        await page.click('#load-pose');const restored=await measure();assert.deepEqual(restored.pose,A);
        assert.equal(await page.locator('#pose-number').inputValue(),'25');assert.equal(await page.locator('#pose-angle').inputValue(),'25');
        assert.match(await page.locator('#snapshot-message').innerText(),/불러왔습니다/);
        const pointError=Math.max(...original.points.map((v,i)=>Math.abs(v-restored.points[i])));
        assert(pointError<1e-6);assert(restored.angleError<.0001);assert.equal(await count(),beforeCount);
        models.push({type,pointError,angleError:restored.angleError});
      });
      await test(`${type}: explicit replacement and default reset keep saved B`,async()=>{
        await edit(B);await page.click('#save-pose');await page.click('#reset-pose');await page.click('#load-pose');assert.deepEqual((await measure()).pose,B);
      });
      await test(`${type}: restore preserves edited body length, height and side camera`,async()=>{
        await bodyStep();await page.selectOption('#body-part','2');const cm=Number(await page.locator('#part-number').inputValue());
        await page.locator('#part-number').fill(String((cm*1.05).toFixed(1)));await page.locator('#part-number').dispatchEvent('change');
        await page.locator('#body-height').evaluate(el=>{el.value=String(Number(el.value)*1.03);el.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.click('[data-view=side]');await edit(A);const before=await measure();await page.click('#load-pose');const after=await measure();
        assert.deepEqual(after.pose,B);assert.deepEqual(after.scale,before.scale);assert.equal(after.height,before.height);
        // OrbitControls recalculates the camera each frame; permit floating-point roundoff only.
        const cameraError=Math.max(...before.camera.map((v,i)=>Math.abs(v-after.camera[i])));assert(cameraError<1e-9);
        models.find(m=>m.type===type).cameraError=cameraError;
        for(const id of Object.keys(before.lengths))assert(Math.abs(before.lengths[id]-after.lengths[id])<.0001);
      });
    }
    await test('different model blocks restore, returning to saved model restores B',async()=>{
      await select('male');assert(await page.locator('#load-pose').isDisabled());assert(!(await page.locator('#save-pose').isDisabled()));
      assert.match(await page.locator('#snapshot-message').innerText(),/저장할 때의 모델/);
      await select('female');await page.click('#load-pose');assert.deepEqual((await measure()).pose,B);
    });
    await page.click('[data-view=side]');await page.locator('#snapshot-section').scrollIntoViewIfNeeded();
    await page.screenshot({path:output+'/snapshot-desktop.png'});
    await page.locator('#snapshot-section').screenshot({path:output+'/snapshot-controls.png'});
    await test('both buttons disabled during an in-flight model load',async()=>{
      let release,seen;const gate=new Promise(r=>release=r),started=new Promise(r=>seen=r);
      await page.route('**/models/runner-male.glb',async route=>{seen();await gate;await route.continue();});
      await bodyStep();await page.click('[data-model-type=male]');await started;
      try {assert(await page.locator('#save-pose').isDisabled());assert(await page.locator('#load-pose').isDisabled());}
      finally {release();}await ready();await page.unroute('**/models/runner-male.glb');
    });
    await test('failed model load disables operations; saved slot survives recovery',async()=>{
      await page.route('**/models/runner-female.glb',route=>route.abort());await bodyStep();await page.click('[data-model-type=female]');
      await page.waitForFunction(()=>document.body.dataset.loaded==='error');assert(await page.locator('#save-pose').isDisabled());assert(await page.locator('#load-pose').isDisabled());
      await page.unroute('**/models/runner-female.glb');await select('female');await page.click('#load-pose');assert.deepEqual((await measure()).pose,B);
    });
    await test('save/restore do not create usage events; explicit apply creates one',async()=>{
      const before=await count();await page.click('#save-pose');await page.click('#load-pose');assert.equal(await count(),before);
      await page.click('#apply-settings');assert.equal(await count(),before+1);
    });
    await test('apply failure shows rollback message and preserves current pose and saved slot',async()=>{
      await edit(A);const before=await measure();
      await page.evaluate(()=>{
        const model=window.modelPreview.model,original=model.updateMatrixWorld;let count=0;
        model.updateMatrixWorld=function(...args){if(++count>=4)throw Error('test rollback');return original.apply(this,args);};
        try{document.getElementById('load-pose').click();}finally{model.updateMatrixWorld=original;}
      });
      assert.match(await page.locator('#snapshot-message').innerText(),/이전 자세로 되돌렸습니다/);assert.deepEqual((await measure()).pose,before.pose);
      await page.click('#load-pose');assert.deepEqual((await measure()).pose,B);
    });
    await test('unsupported GLB in admin preview disables both snapshot buttons',async()=>{
      const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));await admin.goto('http://127.0.0.1:5173/?admin-preview=1');
      // Keep a valid skinned model but change its metadata/hash to an unverified asset.
      const original=fs.readFileSync('experiments/model-preview/public/models/runner-male.glb'),oldLength=original.readUInt32LE(12);
      const data=JSON.parse(original.subarray(20,20+oldLength).toString());data.asset.extras={snapshotTest:true};
      const text=Buffer.from(JSON.stringify(data)),body=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(body);
      const remainder=original.subarray(20+oldLength),glb=Buffer.alloc(20+body.length+remainder.length);
      original.copy(glb,0,0,20);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(body.length,12);body.copy(glb,20);remainder.copy(glb,20+body.length);
      await admin.locator('#file').setInputFiles({name:'unsupported.glb',mimeType:'model/gltf-binary',buffer:glb});
      await admin.waitForFunction(()=>document.body.dataset.loaded==='true');assert(await admin.locator('#save-pose').isDisabled());assert(await admin.locator('#load-pose').isDisabled());
      assert.match(await admin.locator('#snapshot-message').innerText(),/지원하는 모델/);await admin.close();
    });
    await test('another tab changes settings: immediate block, no pose mutation',async()=>{
      const before=await measure(),other=await context.newPage();await other.goto('http://127.0.0.1:5173');
      await other.evaluate(async()=>{const s=await import('/src/settings.ts');const settings=s.readSettings();settings.categories.upperarm.max=40;s.saveSettings(settings);});
      await page.waitForFunction(()=>document.getElementById('save-pose').disabled&&document.getElementById('load-pose').disabled);
      assert.match(await page.locator('#snapshot-message').innerText(),/설정이 바뀌어/);
      assert.deepEqual((await measure()).pose,before.pose);await other.close();
    });
    await test('reload removes the temporary slot and reads new policy',async()=>{
      await page.reload();await ready();assert(await page.locator('#load-pose').isDisabled());assert.equal(await page.locator('#save-pose').innerText(),'현재 자세 저장');
      assert(!(await page.locator('#save-pose').isDisabled()));assert.equal(await page.locator('#pose-number').getAttribute('max'),'40');
    });
    await test('same-tab unreadable settings fail closed on click and recover without losing slot',async()=>{
      await page.click('#save-pose');await edit(A);const before=await measure();
      const raw=await page.evaluate(()=>{const key='running-sim.lab.settings.v1',value=localStorage.getItem(key);localStorage.setItem(key,'{');return value;});
      await page.click('#load-pose');assert(await page.locator('#save-pose').isDisabled());assert.match(await page.locator('#snapshot-message').innerText(),/읽을 수 없습니다/);assert.deepEqual((await measure()).pose,before.pose);
      await page.evaluate(raw=>{localStorage.setItem('running-sim.lab.settings.v1',raw);dispatchEvent(new Event('focus'));},raw);
      assert(!(await page.locator('#load-pose').isDisabled()));
    });
    await test('narrow screen: visible controls fit, keyboard activates save/restore',async()=>{
      await page.setViewportSize({width:390,height:844});await page.locator('#snapshot-section').scrollIntoViewIfNeeded();
      await page.locator('#save-pose').focus();await page.keyboard.press('Enter');await edit(B);await page.locator('#load-pose').focus();await page.keyboard.press('Enter');assert.deepEqual((await measure()).pose,A);
      const bounds=await page.locator('#snapshot-section').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
      assert(bounds.left>=0&&bounds.right<=bounds.width&&!bounds.overflow);
      await page.locator('#snapshot-section').screenshot({path:output+'/snapshot-narrow.png'});
    });
    assert.deepEqual(errors,[]);
  } finally {
    const report={testedAt:new Date().toISOString(),browser:await browser.version(),scope:'M01-b Edge desktop UI, real male/female GLB; narrow viewport is not mobile-device coverage',models,cases,errors,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length};
    fs.writeFileSync('docs/05-validation/reports/pose-snapshot-ui.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
