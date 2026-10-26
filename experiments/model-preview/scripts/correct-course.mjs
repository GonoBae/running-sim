import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {geometryHash} from './sync-course.mjs';
import {transformWithOxc} from 'vite';
const courseFile=new URL('../src/course.ts',import.meta.url);
const {code}=await transformWithOxc(fs.readFileSync(courseFile,'utf8'),fileURLToPath(courseFile));
const {createCourse}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const root=fileURLToPath(new URL('../../../',import.meta.url));
export function correctCourse(base){
 if(base.revision!=='c-3471370ec877'||geometryHash(base.geometry)!=='e110a1e080ef22ad77cb6d4d9f490872b84977d06cb4064f577305eb31b1cb43')throw Error('항공사진 대조에 사용한 원본 경로와 다릅니다.');
 // OSM node 13502643119 is inside the plaza, off the continuous running corridor.
 // Preserve both track endpoints. Replace only the two-edge inward detour.
 const removedIndex=29,points=base.geometry.coordinates;
 const geometry={...base.geometry,coordinates:points.filter((_,i)=>i!==removedIndex)};
 const revision='d-'+geometryHash(geometry).slice(0,12),before=createCourse(base);
 const candidate={...base,revision,geometry,previous:{id:base.id,revision:base.revision,geometry:base.geometry,previous:base.previous}};
 const after=createCourse(candidate),hit=after.nearest(after.project(points[removedIndex]));
 return {...candidate,source:{...base.source,correction:{id:'southeast-track-connection-v1',method:'imagery-confirmed-connector',
  baseRevision:base.revision,baseGeometrySha256:geometryHash(base.geometry),geometrySha256:geometryHash(geometry),
  removedNodeId:13502643119,removedCoordinate:points[removedIndex],from:points[28],to:points[30],
  oldRangeM:[before.cumulative[28],before.cumulative[30]],maxStartSnapM:hit.distance+.01,
  beforeLengthM:before.lengthM,afterLengthM:after.lengthM,shorterByM:before.lengthM-after.lengthM,
  evidence:'course-imagery',surveyed:false}}};
}
export function buildCorrectedCourse({checkOnly=false}={}){
 const folder=path.join(root,'experiments/model-preview/public/courses');
 const base=JSON.parse(fs.readFileSync(path.join(folder,'lotte-garden-c-v1.json'),'utf8')),asset=correctCourse(base),file=path.join(folder,'lotte-garden-d-v1.json');
 if(checkOnly){if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==JSON.stringify(asset))throw Error('항공사진 대조 경로 자산이 생성 결과와 다릅니다.');}
 else{fs.writeFileSync(file+'.tmp',JSON.stringify(asset));fs.renameSync(file+'.tmp',file);}
 return {revision:asset.revision,...asset.source.correction};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildCorrectedCourse({checkOnly:process.argv.includes('--check')})));
