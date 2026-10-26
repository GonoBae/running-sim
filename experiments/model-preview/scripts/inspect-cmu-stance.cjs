const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/review/mocap.html?compare=travel');await page.waitForFunction(()=>window.mocapReview?.ready);
 await page.uncheck('#stance-width');
 const results=[];
 for(const model of ['male','female']){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
 const result=await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js');const a=window.mocapReview,by=n=>a.bones.find(b=>b.name===n),p=n=>by(n).getWorldPosition(new T.Vector3());const rows=[];
 for(let f=0;f<a.cycle.period;f+=.5){a.seek(f);const center=p('thigh_l').add(p('thigh_r')).multiplyScalar(.5);const source=a.points.map(p=>new T.Vector3(...p)),sp=n=>source[a.clip.names.indexOf(n)],sc=sp('lhipjoint').clone().add(sp('rhipjoint')).multiplyScalar(.5);const up=new T.Vector3(0,1,0).applyQuaternion(new T.Quaternion(...a.sampledFrame.q[0])).applyQuaternion(a.heading);
 for(const side of ['l','r']){const sign=side==='l'?1:-1,hip=p('thigh_'+side),knee=p('calf_'+side),foot=p('foot_'+side),ball=p('ball_'+side);rows.push({phase:f/a.cycle.period,side,support:a.contact?.support===side,hip:sign*(hip.x-center.x),thigh:sign*(knee.x-hip.x),calf:sign*(foot.x-knee.x),ankle:sign*(foot.x-center.x),ball:sign*(ball.x-center.x),sourceAnkle:sign*(sp(side+'tibia').x-sc.x)*a.scale,rootRollDegrees:Math.atan2(up.x,up.y)*180/Math.PI});}}
 return {rows};});results.push({model,...result});
 const support=result.rows.filter(r=>r.support);for(const side of ['l','r']){const rows=support.filter(r=>r.side===side),worst=rows.reduce((a,b)=>a.ankle<b.ankle?a:b);console.log(model,side,JSON.stringify(worst));}console.log('rootRoll range',Math.min(...support.map(r=>r.rootRollDegrees)),Math.max(...support.map(r=>r.rootRollDegrees)));
 }
 fs.writeFileSync('docs/05-validation/reports/cmu-stance-audit.json',JSON.stringify({scope:'35_17 before M28 correction. Lateral decomposition relative to hip midpoint; estimated support only. Source reconstruction not independently validated.',results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
