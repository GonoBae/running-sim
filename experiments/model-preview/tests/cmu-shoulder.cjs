const{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const baseline=process.argv.includes('--baseline');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const results=[],snapshots=[];
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/review/mocap.html');await page.waitForFunction(()=>window.mocapReview?.ready);await page.selectOption('#mode','raw');
for(const model of ['male','female']){await page.selectOption('#model',model);await page.waitForFunction(()=>window.mocapReview.ready);
for(const clip of ['0','1']){await page.selectOption('#clip',clip);
const result=await page.evaluate(async(model)=>{
 const a=window.mocapReview,{Vector3,Quaternion}=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 const neutral=(await new GLTFLoader().loadAsync('/models/runner-'+model+'.glb')).scene;neutral.updateMatrixWorld(true);
 const p=b=>b.getWorldPosition(new Vector3()),by=n=>a.bones.find(b=>b.name===n);
 const sides=['l','r'].map(side=>{const b=neutral.getObjectByName('clavicle_'+side),child=neutral.getObjectByName('upperarm_'+side);return {side,rest:b.quaternion.clone(),neutralElevation:Math.asin(p(child).sub(p(b)).normalize().y)*180/Math.PI,maxSourceDelta:0,maxRestDeviation:0,shoulderY:[]};});
 const untouched=['pelvis','spine_01','spine_02','spine_03','neck_01','head','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r'];const positions=[];
 for(let f=0;f<a.clip.frames.length;f++){a.seek(f);positions.push(untouched.flatMap(n=>p(by(n)).toArray()));
  for(const r of sides){const i=a.clip.names.indexOf(r.side+'clavicle'),parent=a.clip.parents[i],frame=a.clip.frames[f];
   const delta=new Quaternion(...frame.q[parent]).invert().multiply(new Quaternion(...frame.q[i]));r.maxSourceDelta=Math.max(r.maxSourceDelta,delta.angleTo(new Quaternion())*180/Math.PI);
   r.maxRestDeviation=Math.max(r.maxRestDeviation,by('clavicle_'+r.side).quaternion.angleTo(r.rest)*180/Math.PI);
   r.shoulderY.push(p(by('upperarm_'+r.side)).y-p(by('neck_01')).y);
  }
 }
 neutral.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [o.material].flat())m.dispose();}});
 return {clip:a.clip.id,frames:a.clip.frames.length,positions,sides:sides.map(({rest,shoulderY,...s})=>({...s,meanShoulderRelativeToNeck:shoulderY.reduce((a,b)=>a+b,0)/shoulderY.length}))};
},model);
const {positions,...summary}=result;snapshots.push({model,clip:result.clip,positions});results.push({model,...summary});console.log(model,JSON.stringify(summary));
if(!baseline)for(const s of result.sides){assert(s.maxSourceDelta<.0001,'these two source clips have no clavicle motion');assert(s.maxRestDeviation<.0001,'neutral target clavicle must be preserved');}
}}
let maxUntouchedRelativeError,maxRootHeightShift;
if(baseline){fs.mkdirSync('work/cmu-shoulder',{recursive:true});fs.writeFileSync('work/cmu-shoulder/before-positions.json',JSON.stringify(snapshots));}
else if(fs.existsSync('work/cmu-shoulder/before-positions.json')){
 // M20 recalibrates the constant floor offset after correcting foot surfaces.
 // Compare the preserved posture in the pelvis frame, and report global shift.
 const old=JSON.parse(fs.readFileSync('work/cmu-shoulder/before-positions.json'));maxUntouchedRelativeError=0;maxRootHeightShift=0;
 snapshots.forEach((s,i)=>s.positions.forEach((p,f)=>{
  const before=old[i].positions[f];
  p.forEach((v,k)=>maxUntouchedRelativeError=Math.max(maxUntouchedRelativeError,Math.abs((v-p[k%3])-(before[k]-before[k%3]))));
  maxRootHeightShift=Math.max(maxRootHeightShift,Math.abs(p[1]-before[1]));
 }));
 assert(maxUntouchedRelativeError<1e-6,'pelvis-relative torso, head and leg positions must be preserved');
}
fs.writeFileSync(`docs/05-validation/reports/cmu-shoulder-${baseline?'before':'after'}.json`,JSON.stringify({testedAt:new Date().toISOString(),scope:'Default male/female, two CMU clips. Neutral clavicle and pelvis-relative posture preservation. M20 constant floor recalibration reported separately. No clinical posture judgement.',maxUntouchedRelativeError,maxRootHeightShift,results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
