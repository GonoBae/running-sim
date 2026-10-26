import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCourse,migrateCourseDraft,COURSE_ID,COURSE_REVISION,COURSE_URL,totalDistanceM} from '../src/course.ts';
import {createCoursePlayback} from '../src/course-playback.ts';
import {correctCourse,buildCorrectedCourse} from '../scripts/correct-course.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),folder='experiments/model-preview/public/courses/';
const a=read(folder+'lotte-garden-c-v1.json'),asset=read(folder+'lotte-garden-d-v1.json'),old=createCourse(a),c=createCourse(asset),b=createCourse(read(folder+'lotte-garden-b-v1.json'));
assert.deepEqual(asset,correctCourse(a));assert.equal(asset.id,COURSE_ID);assert.equal(asset.revision,COURSE_REVISION);assert.equal(COURSE_URL,'/courses/lotte-garden-d-v1.json');
assert.deepEqual(asset.geometry.coordinates,a.geometry.coordinates.filter((_,i)=>i!==29));assert.equal(c.distanceScale,1);buildCorrectedCourse({checkOnly:true});
const changed=structuredClone(a);changed.geometry.coordinates[29][0]+=.0001;assert.throws(()=>correctCourse(changed));
const near=(x,y)=>assert(Math.abs(x-y)<1e-7,`${x} != ${y}`),vec=(x,y)=>x.forEach((v,i)=>near(v,y[i]));
near(old.lengthM-c.lengthM,5.15493412764177);
const observed={id:a.id,revision:a.revision,startDistanceM:1121.8640021884382,direction:'reverse',laps:6,goal:{type:'distance',distanceM:5000},paceSecondsPerKm:360};
const migrated=migrateCourseDraft(c,observed);assert(migrated);vec(c.pointAt(migrated.startDistanceM),old.pointAt(observed.startDistanceM));assert.deepEqual({...migrated,revision:null,startDistanceM:null},{...observed,revision:null,startDistanceM:null});
let exact=0,snapped=0,maxSnapM=0;
for(let i=0;i<2000;i++){
 const d={...observed,startDistanceM:old.lengthM*i/2000},next=migrateCourseDraft(c,d);assert(next);assert.equal(c.issue(next),'');
 const before=old.pointAt(d.startDistanceM),after=c.pointAt(next.startDistanceM),shift=Math.hypot(before[0]-after[0],before[1]-after[1]);maxSnapM=Math.max(maxSnapM,shift);
 const [from,to]=asset.source.correction.oldRangeM;
 if(d.startDistanceM<from||d.startDistanceM>to){assert(shift<1e-7);exact++;}else{assert(shift<=asset.source.correction.maxStartSnapM);snapped++;}
 assert.deepEqual({...next,revision:null,startDistanceM:null},{...d,revision:null,startDistanceM:null});
 assert.equal(migrateCourseDraft(c,next),null);
}
let bMigrated=0,bRefused=0;
for(let i=0;i<1000;i++){
 const d={...observed,revision:b.asset.revision,startDistanceM:b.lengthM*i/1000},next=migrateCourseDraft(c,d);
 if(next){assert.equal(c.issue(next),'');bMigrated++;}else bRefused++;
}
assert(bRefused>0&&bMigrated>900);assert.equal(migrateCourseDraft(c,{...observed,revision:'unknown'}),null);
let positions=0;
for(const direction of ['forward','reverse'])for(const startDistanceM of [0,migrated.startDistanceM,c.lengthM-.001])for(const distanceM of [10,1000,3000,4000,5000,100000]){
 const d={...migrated,direction,startDistanceM,goal:{type:'distance',distanceM}},run=createCoursePlayback(c,d,{seconds:.8,distanceM:2.8});
 near(run.frame().duration,distanceM*.36);
 for(const fraction of [0,.1,.6,.8,1]){run.seek(run.frame().duration*fraction);vec(run.frame().position,c.atTravel(d,distanceM*fraction));positions++;}
 assert(run.frame().complete);near(run.frame().distanceM,distanceM);
}
const milestones=[1,2,3,4,5].map(km=>({km,before:old.atTravel(observed,km*1000),after:c.atTravel(migrated,km*1000),positionShiftM:Math.hypot(...old.atTravel(observed,km*1000).map((x,i)=>x-c.atTravel(migrated,km*1000)[i]))}));
const landmarkReport=[{km:3,i:1,laps:2},{km:4,i:2,laps:3}].map(({km,i,laps})=>{
 const oldS=old.nearest(old.project(a.landmarks[i].coordinate)).startDistanceM,newS=c.nearest(c.project(asset.landmarks[i].coordinate)).startDistanceM;
 return {km,corner:i===1?'B':'C',beforeDistanceToCornerM:observed.startDistanceM-oldS+laps*old.lengthM,afterDistanceToCornerM:migrated.startDistanceM-newS+laps*c.lengthM};
});
const report={status:'passed',correction:asset.source.correction,revision:asset.revision,observedStartBeforeM:observed.startDistanceM,observedStartAfterM:migrated.startDistanceM,physicalStartUnchanged:true,
 migration:{samples:2000,exact,snapped,maxSnapM,legacyB:{migrated:bMigrated,refused:bRefused}},playbackPositions:positions,milestones,landmarkReport,
 fieldEndpointMatchVerified:false,remaining:'3km is still before B; the local 5.155m fix does not explain all reported endpoint differences.'};
fs.writeFileSync('docs/05-validation/reports/course-imagery-unit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
