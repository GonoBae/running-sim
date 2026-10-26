// Decode saved videos and verify the accepted lower-body/height source hashes.
const {chromium}=require('C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await b.newPage({viewport:{width:1280,height:780}}),result=[];
 for(const model of ['male','female'])for(const view of ['front','side']){
  const file=path.resolve(`outputs/cmu-elbow-bend/${model}-${view}.webm`);
  await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  const hashes=[];
  for(const time of [.3,1,1.7]){
   await page.evaluate(async time=>{const v=document.querySelector('video');v.pause();await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=time;});},time);
   const capture=`outputs/cmu-elbow-bend/${model}-${view}-video-${time}.png`;
   await page.locator('video').screenshot({path:capture});
   hashes.push(crypto.createHash('sha256').update(fs.readFileSync(capture)).digest('hex'));
  }
  const info=await page.evaluate(()=>{const v=document.querySelector('video');return {width:v.videoWidth,height:v.videoHeight,error:v.error?.message||null};});
  assert.equal(info.error,null);assert(info.width>0&&info.height>0);assert.equal(new Set(hashes).size,3);
  result.push({model,view,...info,decodedDifferentFrames:3,bytes:fs.statSync(file).size});
 }
 const archived=JSON.parse(fs.readFileSync('docs/05-validation/reports/cmu-approach-symmetry.json'));
 const unchanged={};
 for(const name of ['shared-gait.js','body-height.js']){
  const file='experiments/model-preview/review/'+name;
  unchanged[name]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===archived.hashes[file];assert(unchanged[name]);
 }
 const report={status:'passed',videos:result,unchangedAcceptedModules:unchanged};
 fs.writeFileSync('docs/05-validation/reports/cmu-elbow-bend-media-check.json',JSON.stringify(report,null,2));console.log(report);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


