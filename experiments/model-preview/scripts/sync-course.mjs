import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {transformWithOxc} from 'vite';

// Reuse the app calculation on every supported Node version, including Node 20.
const courseSource=fs.readFileSync(new URL('../src/course.ts',import.meta.url),'utf8');
const {code:courseJS}=await transformWithOxc(courseSource,fileURLToPath(new URL('../src/course.ts',import.meta.url)));
const {createCourse}=await import('data:text/javascript;base64,'+Buffer.from(courseJS).toString('base64'));

const root=fileURLToPath(new URL('../../../',import.meta.url));
const reportPath=path.join(root,'docs/05-validation/reports');
const assetPath=path.join(root,'experiments/model-preview/public/courses/lotte-garden-c-v1.json');
const contractPath=fileURLToPath(new URL('./course-route.json',import.meta.url));
const cachePath=path.join(reportPath,'course-automation-source.json');
export const endpoint='https://overpass-api.de/api/interpreter';
export const geometryHash=geometry=>createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
const check=(condition,message)=>{if(!condition)throw Error(message);};
export const queryFor=contract=>`[out:json][timeout:25];way(id:${contract.wayIds.join(',')});out meta geom;`;
export async function fetchOriginal(contract,fetcher=fetch){
 const read=async url=>{const response=await fetcher(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'RunningSim-CourseCheck/1.0','Accept':'application/json'}});check(response.ok,`원본 서버 응답 ${response.status}`);return response.json();};
 try{return await read(endpoint+'?'+new URLSearchParams({data:queryFor(contract)}));}
 catch(overpassError){
  // Official OSM API fallback: two bounded read-only bulk requests, no map editing.
  const base='https://api.openstreetmap.org/api/0.6/';
  const ways=await read(base+'ways.json?ways='+contract.wayIds.join(','));
  const selected=ways.elements?.filter(e=>e.type==='way')||[];
  check(selected.length===contract.wayIds.length,'공식 API 경로 누락');
  const ids=[...new Set(selected.flatMap(e=>e.nodes))];
  check(ids.length>0&&ids.length<1000,'공식 API 좌표 개수 범위 초과');
  const nodes=await read(base+'nodes.json?nodes='+ids.join(',')),byId=new Map((nodes.elements||[]).map(e=>[e.id,e]));
  return {source:{endpoint:base,retrievedAtUTC:new Date().toISOString(),snapshotTimeUnavailable:true,overpassError:overpassError.message},
   elements:selected.map(e=>({...e,geometry:e.nodes.map(id=>{const p=byId.get(id);check(p?.type==='node',`노드 ${id} 누락`);return {lat:p.lat,lon:p.lon};})}))};
 }
}

/** Rebuild the agreed node chain from source ways; never scale to user anecdotes. */
export function verifySource(raw,contract,asset){
 check(!raw.remark,'원본 서버가 불완전한 응답을 반환했습니다.');
 const sourceTime=raw.osm3s?.timestamp_osm_base||raw.source?.retrievedAtUTC;
 check(sourceTime&&!Number.isNaN(Date.parse(sourceTime)),'원본 시각이 없습니다.');
 check(asset.id===contract.id&&asset.revision===contract.revision,'선택 경로 버전이 다릅니다.');
 check(geometryHash(asset.geometry)===contract.geometrySha256,'앱 경로가 확인한 좌표에서 변경되었습니다.');
 const nodes=new Map(),edges=new Set(),versions=[];
 for(const id of contract.wayIds){
  const found=raw.elements?.filter(e=>e.type==='way'&&e.id===id)||[];
  check(found.length===1,`원본 길 ${id} 누락 또는 중복`);
  const way=found[0],tags=way.tags||{};
  check(['footway','path','pedestrian'].includes(tags.highway)&&tags.area!=='yes'&&!['private','no'].includes(tags.foot)&&!(tags.access==='no'&&tags.foot!=='yes'),`길 ${id} 보행 조건 변경`);
  check(Number.isInteger(way.version)&&way.timestamp,`길 ${id} 출처 버전 누락`);
  check(Array.isArray(way.nodes)&&way.nodes.length===way.geometry?.length&&way.nodes.length>1,`길 ${id} 좌표 누락`);
  for(let i=0;i<way.nodes.length;i++){
   const p=way.geometry[i],n=way.nodes[i],point=[p.lon,p.lat];
   check(point.every(Number.isFinite)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90,`길 ${id} 잘못된 좌표`);
   check(!nodes.has(n)||JSON.stringify(nodes.get(n))===JSON.stringify(point),`노드 ${n} 좌표 불일치`);
   nodes.set(n,point);
   if(i)edges.add([way.nodes[i-1],n].sort((a,b)=>a-b).join(':'));
  }
  versions.push({id,version:way.version,timestamp:way.timestamp});
 }
 const chain=contract.orderedNodeIds;
 check(chain.length>=4&&chain[0]===chain.at(-1),'확인한 경로가 닫혀 있지 않습니다.');
 check(new Set(chain.slice(0,-1)).size===chain.length-1,'확인한 경로에 중복 노드가 있습니다.');
 for(let i=1;i<chain.length;i++)check(edges.has([chain[i-1],chain[i]].sort((a,b)=>a-b).join(':')),`원본에서 연결 ${chain[i-1]} → ${chain[i]}을 찾을 수 없습니다.`);
 const geometry={type:'LineString',coordinates:chain.map(id=>nodes.get(id))};
 check(geometryHash(geometry)===contract.geometrySha256,'원본 좌표가 변경되었습니다. 기존 코스는 보존하고 변경 경로와 출발점 이전을 검토해야 합니다.');
 const course=createCourse({...asset,geometry});
 // Independent great-circle central angle, instead of the app's Haversine.
 const unit=([lon,lat])=>{const a=lon*Math.PI/180,b=lat*Math.PI/180;return [Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a),Math.sin(b)];};
 let independentM=0;
 for(let i=1;i<geometry.coordinates.length;i++){
  const a=unit(geometry.coordinates[i-1]),b=unit(geometry.coordinates[i]);
  const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  independentM+=6371008.8*Math.atan2(Math.hypot(...cross),a.reduce((s,v,j)=>s+v*b[j],0));
 }
 check(Math.abs(independentM-course.lengthM)<1e-5,'거리 검산 불일치');
 return {method:'osm-node-chain-v1',geometrySha256:geometryHash(geometry),snapshotTimeUTC:raw.osm3s?.timestamp_osm_base??null,sourceEndpoint:raw.source?.endpoint||endpoint,
  wayCount:versions.length,segments:chain.length-1,versions,lapLengthM:course.lengthM,independentM,
  arithmeticErrorM:Math.abs(independentM-course.lengthM),distanceScale:1,fieldAccuracyVerified:false};
}

function atomicJSON(file,value){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file);}
export async function syncCourse({fetchSource=false,fetcher=fetch,assetFile=assetPath,cacheFile=cachePath,contractFile=contractPath,reportFile=path.join(reportPath,fetchSource?'course-automation-live.json':'course-automation-build.json')}={}){
 const asset=JSON.parse(fs.readFileSync(assetFile,'utf8')),contract=JSON.parse(fs.readFileSync(contractFile,'utf8'));
 const report={status:'running',mode:fetchSource?'live-source':'cached-source',checkedAtUTC:new Date().toISOString(),assetChanged:false};
 try{
  let raw;
  if(fetchSource){
   raw=await fetchOriginal(contract,fetcher);
  }else raw=JSON.parse(fs.readFileSync(cacheFile,'utf8'));
  const verification=verifySource(raw,contract,asset);
  if(!fetchSource){
   check(asset.source.verification?.geometrySha256===verification.geometrySha256,'앱 검증 정보 누락 또는 불일치');
   check(asset.source.verification?.snapshotTimeUTC===verification.snapshotTimeUTC,'앱과 저장 원본의 시각이 다릅니다.');
  }
  // Only publish verified metadata. Geometry/revision/start coordinates never silently change.
  if(fetchSource){
   atomicJSON(cacheFile,raw);
   const next={...asset,source:{...asset.source,verification:{...verification,fetchedAtUTC:report.checkedAtUTC}}};
   atomicJSON(assetFile,next);report.assetChanged=true;
  }
  Object.assign(report,{status:'passed',...verification,geometryChanged:false});
 }catch(e){report.status='failed';report.error=e.message;}
 atomicJSON(reportFile,report);return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await syncCourse({fetchSource:process.argv.includes('--fetch')});
 console.log(JSON.stringify(result));if(result.status!=='passed')process.exitCode=1;
}
