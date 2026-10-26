import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {verifySource,syncCourse,fetchOriginal} from '../scripts/sync-course.mjs';
import {createCourse} from '../src/course.ts';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const source=read('docs/05-validation/reports/course-automation-source.json'),contract=read('experiments/model-preview/scripts/course-route.json'),asset=read('experiments/model-preview/public/courses/lotte-garden-c-v1.json');
const result=verifySource(source,contract,asset),c=createCourse(asset),cases=[];
assert.equal(result.distanceScale,1);assert.equal(result.fieldAccuracyVerified,false);assert.equal(result.segments,79);
assert.equal(result.lapLengthM,c.lengthM);
function rejected(name,edit){const raw=structuredClone(source),a=structuredClone(asset),config=structuredClone(contract);edit(raw,a,config);assert.throws(()=>verifySource(raw,config,a));cases.push(name);}
rejected('missing way',r=>r.elements.pop());
rejected('duplicate way',r=>r.elements.push(r.elements[0]));
rejected('truncated geometry',r=>r.elements[0].geometry.pop());
const moveSelectedNode=r=>r.elements.forEach(e=>e.nodes.forEach((n,i)=>{if(n===contract.orderedNodeIds[0])e.geometry[i].lat+=.00001;}));
rejected('changed source coordinate',moveSelectedNode);
rejected('invalid coordinate',r=>r.elements[0].geometry[0].lat=NaN);
rejected('server partial response',r=>r.remark='timeout');
rejected('missing provenance time',r=>{delete r.osm3s;delete r.source;});
rejected('missing source version',r=>delete r.elements[0].version);
rejected('closed pedestrian access',r=>r.elements[0].tags.foot='no');
rejected('wrong feature type',r=>r.elements[0].tags.highway='motorway');
rejected('disconnected node chain',(r,a,k)=>k.orderedNodeIds[3]=123);
rejected('unclosed route',(r,a,k)=>k.orderedNodeIds.pop());
rejected('duplicate route node',(r,a,k)=>k.orderedNodeIds[3]=k.orderedNodeIds[2]);
rejected('unconfirmed asset geometry',(r,a)=>a.geometry.coordinates[0][0]+=.0001);
rejected('wrong revision',(r,a)=>a.revision='unknown');
let samples=0;
for(const direction of ['forward','reverse'])for(let i=0;i<100;i++)for(const m of [10,1000,3000,4000,5000,100000]){
 const d={id:asset.id,revision:asset.revision,startDistanceM:c.lengthM*i/100,direction,laps:1};
 assert.deepEqual(c.atTravel(d,m),c.pointAt(d.startDistanceM+(direction==='forward'?m:-m)));
 const a=c.atTravel(d,c.lengthM),b=c.atTravel(d,c.lengthM*2);assert(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8);samples++;
}
const scratch=path.join(root,'outputs/course-automation/unit-'+Date.now());fs.mkdirSync(scratch,{recursive:true});
const files={assetFile:path.join(scratch,'asset.json'),cacheFile:path.join(scratch,'cache.json'),contractFile:path.join(scratch,'contract.json'),reportFile:path.join(scratch,'result.json')};
for(const [file,value] of [[files.assetFile,asset],[files.cacheFile,source],[files.contractFile,contract]])fs.writeFileSync(file,JSON.stringify(value));
const originalAsset=fs.readFileSync(files.assetFile,'utf8'),originalCache=fs.readFileSync(files.cacheFile,'utf8');
const fail=await syncCourse({...files,fetchSource:true,fetcher:async()=>{throw Error('offline');}});
assert.equal(fail.status,'failed');assert.equal(fs.readFileSync(files.assetFile,'utf8'),originalAsset);assert.equal(fs.readFileSync(files.cacheFile,'utf8'),originalCache);
const changed=structuredClone(source);moveSelectedNode(changed);
assert.equal((await syncCourse({...files,fetchSource:true,fetcher:async()=>({ok:true,json:async()=>changed})})).status,'failed');assert.equal(fs.readFileSync(files.assetFile,'utf8'),originalAsset);assert.equal(fs.readFileSync(files.cacheFile,'utf8'),originalCache);
assert.equal((await syncCourse({...files,fetchSource:true,fetcher:async()=>({ok:true,json:async()=>source})})).status,'passed');
const published=JSON.parse(fs.readFileSync(files.assetFile));assert.deepEqual({...published,source:null},{...asset,source:null});
assert.equal((await syncCourse(files)).status,'passed');
// Exercise the official-API fallback and verify its output, without live requests.
let calls=0;const nodes=new Map();source.elements.forEach(e=>e.nodes.forEach((n,i)=>nodes.set(n,{type:'node',id:n,...e.geometry[i]})));
const fallback=await fetchOriginal(contract,async url=>{calls++;if(url.includes('overpass-api'))throw Error('timeout');return {ok:true,json:async()=>({elements:url.includes('ways.json')?source.elements.map(({geometry,...way})=>way):[...nodes.values()]})};});
assert.equal(calls,3);assert.equal(verifySource(fallback,contract,asset).lapLengthM,c.lengthM);
const report={status:'passed',rejections:cases,endpointSamples:samples,lapLengthM:c.lengthM,arithmeticErrorM:result.arithmeticErrorM,
 checks:['network failure preserves asset/cache','changed coordinates preserve asset/cache','successful publish changes source metadata only','offline build validates published source','official API fallback verified'],fieldAccuracyVerified:false};
fs.writeFileSync(path.join(root,'docs/05-validation/reports/course-automation-unit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
