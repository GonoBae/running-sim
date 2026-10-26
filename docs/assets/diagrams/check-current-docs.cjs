// From repo root: set NODE_MODULES_DIR to bundled dependencies; node this-file.cjs.
// Isolated browser context: never touches the user's open tab or saved settings.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const deps=process.env.NODE_MODULES_DIR;
if(!deps)throw new Error('Set NODE_MODULES_DIR (playwright, marked, sharp)');
const {chromium}=require(deps+'/playwright'),sharp=require(deps+'/sharp');
const root=process.cwd(),out=path.join(root,'outputs/documentation-sync');fs.mkdirSync(out,{recursive:true});
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const report={date:'2026-10-26',scope:'M93 documentation reconciliation; fresh isolated screen captures and Markdown rendering; no new functional regression run',status:'running',screens:[],documents:0,links:0,imageReferences:0,broken:[],renderErrors:[],overflow:[],codeChecks:[]};
const writeReport=()=>fs.writeFileSync('docs/05-validation/reports/documentation-sync.json',JSON.stringify(report,null,2)+'\n');
(async()=>{
 writeReport();
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  if(!process.argv.includes('--render-only')){
   const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-d-v1.json'));
   const seed={version:1,model:'male',scale:1,ratios:{upperArm:1,forearm:1,thigh:1,shin:1,torso:1,shoulders:1},leg:0,elbow:0,lean:0,strike:'original',course:{id:asset.id,revision:asset.revision,startDistanceM:0,direction:'forward',laps:1,goal:{type:'distance',distanceM:3000},paceSecondsPerKm:360}};
   const ctx=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});
   await ctx.addInitScript(s=>{if(!sessionStorage.getItem('running-sim.stages.v1'))sessionStorage.setItem('running-sim.stages.v1',JSON.stringify(s));},seed);
   const p=await ctx.newPage();p.on('pageerror',e=>report.renderErrors.push(e.message));
   for(const stage of ['body','pose','course','backtest']){
    await p.goto((process.env.STAGE_URL||'http://127.0.0.1:5173')+'/'+stage);
    await p.waitForFunction(()=>window.stagePreview?.ready,{},{timeout:120000});
    if(stage==='backtest')await p.waitForFunction(()=>window.courseRunPreview?.ready,{},{timeout:120000});
    if(stage==='pose')await p.evaluate(()=>window.stagePreview.seek(.12));
    if(stage==='course')await p.waitForFunction(()=>!document.querySelector('#course-start').disabled);
    await p.evaluate(()=>document.fonts.ready);
    const dest='docs/assets/images/current-'+stage+'.png';
    await p.screenshot({path:dest,fullPage:true});
    report.screens.push({stage,file:dest,title:await p.title(),actual:true});
   }
   await ctx.close();
   const tiles=[];
   for(let i=0;i<4;i++){
    const stage=['body','pose','course','backtest'][i];
    const pic=await sharp('docs/assets/images/current-'+stage+'.png').resize(696,710,{fit:'contain',background:'#f7f8f3'}).png().toBuffer();
    tiles.push({input:pic,left:24+(i%2)*720,top:72+Math.floor(i/2)*780});
   }
   const labels='<svg width="1464" height="1620" xmlns="http://www.w3.org/2000/svg"><g font-family="Malgun Gothic,sans-serif" fill="#203a32" font-size="26" font-weight="700">'+['01 신체 세팅','02 자세 세팅','03 코스 세팅','04 코스 주행'].map((s,i)=>`<text x="${24+(i%2)*720}" y="${52+Math.floor(i/2)*780}">${s}</text>`).join('')+'</g></svg>';
   await sharp({create:{width:1464,height:1620,channels:3,background:'#fafbf8'}}).composite([...tiles,{input:Buffer.from(labels),left:0,top:0}]).png().toFile('docs/assets/images/current-stages.png');
  }
  if(process.argv.includes('--capture-only')){report.status='screens-captured';writeReport();console.log(JSON.stringify(report));return;}
  if(process.argv.includes('--render-only'))report.screens=['body','pose','course','backtest'].map(stage=>({stage,file:'docs/assets/images/current-'+stage+'.png',actual:true}));
  const entry=fs.readFileSync('experiments/model-preview/src/entry.ts','utf8');
  const state=fs.readFileSync('experiments/model-preview/src/stage-state.ts','utf8');
  const course=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-d-v1.json'));
  report.codeChecks=[{name:'active entry is stages.js',passed:entry.includes("import './stages.js'")},{name:'four routes and session state key',passed:['body','pose','course','backtest','running-sim.stages.v1'].every(v=>state.includes(v))},{name:'D geometry revision matches current documentation',passed:course.revision==='d-ebb99e9a6425'}];
  const {marked}=await import(pathToFileURL(deps+'/marked/lib/marked.esm.js'));
  const docs=['README.md','experiments/model-preview/README.md',...walk('docs').filter(f=>f.endsWith('.md'))];
  const p=await browser.newPage({viewport:{width:1200,height:960}});p.on('pageerror',e=>report.renderErrors.push(e.message));
  for(const file of docs){
   const source=fs.readFileSync(file,'utf8');report.documents++;
   for(const m of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
    report.links++;if(m[0].startsWith('!'))report.imageReferences++;
    const ref=m[1];if(/^(https?:|#|mailto:)/.test(ref))continue;
    if(!fs.existsSync(path.resolve(path.dirname(file),decodeURI(ref.split('#')[0]))))report.broken.push({file,ref});
   }
   const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><base href="${pathToFileURL(path.dirname(path.resolve(file))+path.sep).href}"><style>body{max-width:1100px;margin:32px auto;padding:0 24px;color:#243b34;font:16px/1.7 'Malgun Gothic',sans-serif}h1{font-size:32px}h2{margin-top:36px}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{padding:10px;border:1px solid #dae2dd;overflow-wrap:anywhere}th{background:#edf2ed}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf2ed;padding:20px}a{overflow-wrap:anywhere;color:#386954}blockquote{border-left:4px solid #9eae9b;padding-left:16px;color:#52675c}</style>${marked(source)}</html>`;
   const stem=file.replaceAll('\\','/').replaceAll('/','_').replace('.md','');
   const dest=path.join(out,stem+'.html');fs.writeFileSync(dest,html);
   await p.goto(pathToFileURL(dest).href);await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)));});
   const failed=await p.evaluate(()=>[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src));
   if(failed.length)report.renderErrors.push({file,images:failed});
   if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))report.overflow.push(file);
   await p.screenshot({path:path.join(out,stem+'.png')});
  }
  for(const name of ['current-implementation','current-architecture']){
   await p.goto(pathToFileURL(path.join(root,'docs/assets/diagrams/'+name+'.svg')).href);await p.evaluate(()=>document.fonts.ready);
   const bad=await p.evaluate(()=>[...document.querySelectorAll('text')].filter(el=>{const b=el.getBBox(),svg=el.ownerSVGElement.viewBox.baseVal;return b.x<0||b.y<0||b.x+b.width>svg.width||b.y+b.height>svg.height;}).map(el=>el.textContent));
   if(bad.length)report.overflow.push({diagram:name,text:bad});
   await p.locator('svg').screenshot({path:path.join(out,name+'.png')});
  }
  report.status=report.broken.length||report.renderErrors.length||report.overflow.length||report.codeChecks.some(c=>!c.passed)?'failed':'passed';writeReport();
  console.log(JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.renderErrors.push(e.stack);writeReport();console.error(e);process.exitCode=1;});
