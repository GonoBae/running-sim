const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const runtime=process.env.NODE_MODULES_DIR;
if(!runtime)throw new Error('Set NODE_MODULES_DIR to the directory containing playwright and marked');
const {chromium} = require(runtime+'/playwright');
const root=process.cwd();
const output=path.join(root,'outputs/document-review');
fs.mkdirSync(output,{recursive:true});
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const candidateB=process.argv.includes('candidate-b');
const settingsMode=process.argv.includes('settings');
const runningMode=process.argv.includes('running');
const goalMode=process.argv.includes('goal');
const paceMode=process.argv.includes('pace');
const calibrationMode=process.argv.includes('calibration');
const automationMode=process.argv.includes('automation');
const imageryMode=process.argv.includes('imagery');
const candidateMode=process.argv.includes('candidate')||candidateB;
const candidateStem=candidateB?'course-candidate-b':'course-candidate';
const docs=["docs/05-validation/COURSE_FEASIBILITY.md", "docs/03-screens/COURSE_SCREEN.md", "docs/04-technical/COURSE_PIPELINE.md", "docs/02-requirements/REQUIREMENTS.md", "docs/01-planning/SERVICE_PLAN.md", "docs/01-planning/DEVELOPMENT_PLAN.md", "docs/03-screens/SCREEN_SPEC.md", "docs/04-technical/TECH_SPEC.md", "docs/04-technical/DATA_DESIGN.md", "docs/07-references/REFERENCES.md", "docs/README.md", "docs/assets/README.md", "README.md"];
if(candidateMode)docs.splice(0,docs.length,'docs/05-validation/COURSE_CANDIDATE.md','docs/05-validation/COURSE_FEASIBILITY.md','docs/03-screens/COURSE_SCREEN.md','docs/02-requirements/REQUIREMENTS.md','docs/01-planning/DEVELOPMENT_PLAN.md','docs/README.md','docs/assets/README.md');
if(settingsMode){docs.unshift('docs/05-validation/COURSE_SETTINGS.md','docs/05-validation/COURSE_CANDIDATE.md');docs.push('experiments/model-preview/README.md');}
if(runningMode){docs.unshift('docs/05-validation/COURSE_RUNNING.md','docs/05-validation/COURSE_SETTINGS.md');docs.push('experiments/model-preview/README.md');}
if(goalMode){docs.unshift('docs/05-validation/COURSE_GOAL.md','docs/05-validation/COURSE_RUNNING.md','docs/05-validation/COURSE_SETTINGS.md');docs.push('experiments/model-preview/README.md');}
if(paceMode){docs.unshift('docs/05-validation/COURSE_PACE.md','docs/05-validation/COURSE_GOAL.md','docs/05-validation/COURSE_RUNNING.md');docs.push('experiments/model-preview/README.md');}
if(calibrationMode){docs.unshift('docs/05-validation/COURSE_CALIBRATION.md','docs/05-validation/COURSE_PACE.md');docs.push('experiments/model-preview/README.md');}
if(automationMode){docs.unshift('docs/05-validation/COURSE_AUTOMATION.md','docs/05-validation/COURSE_CALIBRATION.md');docs.push('experiments/model-preview/README.md');}
if(imageryMode){docs.unshift('docs/05-validation/COURSE_IMAGERY.md','docs/05-validation/COURSE_AUTOMATION.md');docs.push('experiments/model-preview/README.md');}
(async()=>{
 const {marked}=await import(pathToFileURL(runtime+'/marked/lib/marked.esm.js'));
 const report={status:'running',date:'2026-10-22',scope:'M85 source geometry and documentation; no application implementation or gait tests',documents:docs.length,links:0,images:0,broken:[],unbalanced:[],overflow:[],renderErrors:[]};
 if(candidateMode)report.scope='M86 candidate map and documentation; user confirmation pending; no application implementation';
 if(settingsMode)report.scope='M87 implemented course settings documentation, screenshots, SVG and links';
 if(runningMode)report.scope='M88 course playback documentation, actual screenshots, SVG and links';
 if(goalMode)report.scope='M89 distance goal, finish markers and northeast shortcut: actual screenshots, diagrams and links';
 if(paceMode)report.scope='M90 target pace and elapsed/total time, confirmed B/C field mismatch: actual screenshots, diagrams and links';
 if(calibrationMode)report.scope='M91 user-described B/C distance calibration: actual before/after map, settings preservation and shared distance metric; not field-surveyed';
 if(automationMode)report.scope='M92 source verification automation, manual scale withdrawn, actual screen and preserved settings; not field-surveyed';
 if(imageryMode)report.scope='M93 independent aerial imagery comparison, local geometry correction and actual before/after screen; remaining field endpoint differences unresolved';
 const reportPath=path.join(root,'docs/05-validation/reports/'+(imageryMode?'course-imagery-docs.json':automationMode?'course-automation-docs.json':calibrationMode?'course-calibration-docs.json':paceMode?'course-pace-docs.json':goalMode?'course-goal-docs.json':runningMode?'course-running-docs.json':settingsMode?'course-settings-docs.json':candidateMode?candidateStem+'-docs.json':'course-docs.json'));
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 const source=JSON.parse(fs.readFileSync('docs/05-validation/reports/course-source.json','utf8'));
 report.sourceGeometry=source.validation;
 report.sourceCounts=source.counts;
 if(settingsMode||runningMode||goalMode||paceMode||calibrationMode||automationMode){
  report.historicalSourceSurveyGeometry=report.sourceGeometry;delete report.sourceGeometry;
  const verified=JSON.parse(fs.readFileSync('docs/05-validation/reports/course-settings-unit.json','utf8'));
  report.currentCourse={id:'gimhae-lotte-garden-b',revision:'c-3471370ec877',geometryMatchesRequestedC:verified.geometryMatchesRequestedC,computedLengthM:verified.lengthM,surveyedLengthM:null};
  if(calibrationMode){const cal=JSON.parse(fs.readFileSync('docs/05-validation/reports/course-calibration-unit.json','utf8')).calibration;report.currentCourse.calibrationId=cal.id;report.currentCourse.distanceScale=cal.distanceScale;report.currentCourse.calibratedLengthM=cal.calibratedLapM;}
 }
 if(candidateMode){const c=JSON.parse(fs.readFileSync('docs/05-validation/reports/'+candidateStem+'.json','utf8'));report.candidateGeometry=c.geometryChecks;report.candidateLengthM=c.computedSphericalLengthM;report.candidateId=c.candidateId;}
 if(imageryMode){
  report.historicalSourceSurveyGeometry=report.sourceGeometry;delete report.sourceGeometry;
  const verified=JSON.parse(fs.readFileSync('docs/05-validation/reports/course-imagery-unit.json','utf8'));
  report.currentCourse={id:'gimhae-lotte-garden-b',revision:verified.revision,computedLengthM:verified.correction.afterLengthM,distanceScale:1,surveyedLengthM:null,fieldEndpointMatchVerified:false};
 }
 for(const file of [...new Set([...docs,...walk('docs').filter(f=>f.endsWith('.md'))])]){
  const content=fs.readFileSync(file,'utf8');
  if((content.match(/^```/gm)||[]).length%2)report.unbalanced.push(file);
  report.images+=(content.match(/!\[/g)||[]).length;
  for(const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
   const ref=match[1];report.links++;
   if(/^(https?:|#)/.test(ref))continue;
   const target=path.resolve(path.dirname(file),ref.split('#')[0]);
   if(!fs.existsSync(target))report.broken.push({file,ref});
  }
 }
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>report.renderErrors.push(e.message));
  const svgs=imageryMode?[]:automationMode?['course-automation.svg']:calibrationMode?['course-calibration.svg']:paceMode?['course-pace.svg','course-distance-audit.svg']:goalMode?['course-goal.svg','course-shortcut.svg']:runningMode?['course-running.svg']:settingsMode?['course-settings.svg']:candidateMode?[candidateStem+'.svg']:['course-evidence.svg','course-screen-v2.svg','course-handoff.svg','course-pipeline.svg','course-scope.svg'];
  for(const file of svgs){
   await page.goto(pathToFileURL(path.join(root,'docs/assets/diagrams',file)).href);
   await page.evaluate(()=>document.fonts.ready);
   const errors=await page.evaluate(()=>{
    const svg=document.querySelector('svg');
    const width=svg.viewBox.baseVal.width,height=svg.viewBox.baseVal.height;
    return [...document.querySelectorAll('text')].flatMap(el=>{
     const b=el.getBBox(),p=el.parentElement;
     const rect=p.tagName==='g'&&p.firstElementChild?.tagName==='rect'?p.firstElementChild:null;
     const inside=rect?{x:+rect.getAttribute('x'),y:+rect.getAttribute('y'),w:+rect.getAttribute('width'),h:+rect.getAttribute('height')}:{x:0,y:0,w:width,h:height};
     return b.x<inside.x||b.y<inside.y||b.x+b.width>inside.x+inside.w||b.y+b.height>inside.y+inside.h?[el.textContent]:[];
    });
   });
   if(errors.length)report.overflow.push({file,errors});
   await page.locator('svg').screenshot({path:path.join(output,file.replace('.svg','.png'))});
  }
  for(const file of docs){
   const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="'+pathToFileURL(path.dirname(path.join(root,file))+path.sep).href+'"><style>body{max-width:1120px;margin:32px auto;padding:0 24px;color:#27313b;font:16px/1.65 "Malgun Gothic",sans-serif}h1{font-size:32px}h2{margin-top:36px;font-size:24px}img{width:100%;height:auto;border-radius:16px}table{border-collapse:collapse;width:100%;margin:20px 0;font-size:15px}td,th{padding:12px;text-align:left;border:1px solid #dde3e9}th{background:#f4f6f8}a{color:#365fa2}pre{overflow:auto;background:#f4f6f8;padding:20px}blockquote{border-left:4px solid #e78b68;padding-left:16px;color:#63717d}</style></head><body>'+marked(fs.readFileSync(file,'utf8'))+'</body></html>';
   const name=file.replaceAll('/','_').replace('.md','');
   const dest=path.join(output,name+'.html');fs.writeFileSync(dest,html);
   await page.goto(pathToFileURL(dest).href);
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
   const failed=await page.evaluate(()=>[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src));
   report.renderErrors.push(...failed);
   await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  }
  report.status=report.broken.length||report.unbalanced.length||report.overflow.length||report.renderErrors.length?'failed':'passed';
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));if(report.broken.length||report.unbalanced.length||report.overflow.length||report.renderErrors.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});











