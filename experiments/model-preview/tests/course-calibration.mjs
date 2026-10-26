import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCourse,totalDistanceM,migrateCourseDraft} from '../src/course.ts';
import {courseCalibration,createCalibratedCourse,FIELD_REFERENCE} from '../src/course-calibration.ts';
import {createCoursePlayback} from '../src/course-playback.ts';
const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json'));
const evidence=JSON.parse(fs.readFileSync('docs/05-validation/reports/course-route-c.json'));
const raw=createCourse(asset),c=createCalibratedCourse(asset),cal=courseCalibration(asset),checks=[],near=(a,b,t=1e-7)=>assert(Math.abs(a-b)<t,`${a} != ${b}`),vec=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
const base={id:asset.id,revision:asset.revision,startDistanceM:FIELD_REFERENCE.startDistanceM,direction:'reverse',laps:6,goal:{type:'distance',distanceM:5000},paceSecondsPerKm:360};
assert.deepEqual(asset.geometry,evidence.geometry);assert.deepEqual(raw.local,c.local);assert.deepEqual(raw.cumulative,c.cumulative);near(c.mapLengthM,raw.lengthM);
vec(c.atTravel(base,4000),raw.pointAt((cal.bMapDistanceM+cal.cMapDistanceM)/2));assert(cal.threeKmAfterBM>0&&cal.threeKmAfterBM<50);near(cal.threeKmAfterBM,37.739667898513744);
checks.push('4 km lands at C→B route midpoint; single distance scale puts 3 km 37.74 map metres beyond B; original geometry/cumulative coordinate basis unchanged');
assert.throws(()=>createCalibratedCourse({...asset,revision:'new-route'}));for(const s of [0,-1,NaN,Infinity])assert.throws(()=>createCourse(asset,{distanceScale:s}));
const highStart={...base,startDistanceM:(c.lengthM+raw.lengthM)/2};assert.equal(c.issue(highStart),'');vec(c.atTravel(highStart,0),raw.atTravel(highStart,0));
let routeCases=0,clockCases=0;
for(let i=0;i<500;i++)for(const direction of ['forward','reverse']){
 const d={...base,startDistanceM:raw.lengthM*i/500,direction};assert.equal(c.issue(d),'');vec(c.atTravel(d,0),raw.atTravel(d,0));vec(c.atTravel(d,c.lengthM),raw.atTravel(d,0));
 for(const m of [-.01,0,10,1000,3000,4000,5000,100000])vec(c.atTravel(d,m),raw.atTravel(d,m/c.distanceScale));
 assert(Math.hypot(...c.atTravel(d,c.lengthM-.001).map((n,j)=>n-c.atTravel(d,c.lengthM+.001)[j]))<.003);routeCases++;
}
checks.push('1,000 starts/directions: start preserved, one-lap return, continuous seam and negative/large distances use one calibrated distance metric');
for(const direction of ['forward','reverse'])for(const goal of [undefined,{type:'distance',distanceM:10},{type:'distance',distanceM:3000},{type:'distance',distanceM:4000},{type:'distance',distanceM:5000}])for(const paceSecondsPerKm of [undefined,300,360,390]){
 const d={...base,direction,goal,paceSecondsPerKm},snapshot=JSON.stringify(d),cy={seconds:.8,distanceM:2.8},run=createCoursePlayback(c,d,cy),original=createCoursePlayback(raw,d,cy);
 const total=totalDistanceM(c,d);near(run.frame().totalM,total);if(goal)near(run.frame().duration,original.frame().duration);else near(total,c.lengthM*d.laps);
 for(const progress of [0,.2,.6,.8,1]){run.seek(run.frame().duration*progress);const f=run.frame();vec(f.position,c.atTravel(d,total*progress));near(f.distanceM,total*progress);near(f.phase,(f.elapsed/f.cycleSeconds)%1);}
 assert(run.frame().complete);assert.equal(run.frame().completedLaps,goal?Math.floor(total/c.lengthM):d.laps);assert.equal(JSON.stringify(d),snapshot);clockCases++;
}
checks.push('40 direction/goal/pace playback cases: correct calibrated finish/laps; km-goal time and gait timing unchanged; lap-goal total/time recalculated; settings immutable');
const old=createCourse(JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-b-v1.json')));
const oldD={...base,revision:old.asset.revision,startDistanceM:900},migrated=migrateCourseDraft(c,oldD);assert(migrated);vec(c.pointAt(migrated.startDistanceM),old.pointAt(900));assert.deepEqual({...migrated,revision:null,startDistanceM:null},{...oldD,revision:null,startDistanceM:null});
checks.push('Legacy B→C start migration still preserves the physical point and every other preference');
const milestones=[1,2,3,4,5].map(km=>({km,before:raw.atTravel(base,1000*km),after:c.atTravel(base,1000*km),extraMapTravelM:1000*km/c.distanceScale-1000*km}));
const report={status:'passed',milestone:'M91',calibration:cal,referenceDraft:base,checks,routeCases,clockCases,milestones,limits:['User-described locations, not surveyed GPS','4km midpoint is interpreted along C→B route','Other field distances/start/directions unverified']};
fs.writeFileSync('docs/05-validation/reports/course-calibration-unit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
