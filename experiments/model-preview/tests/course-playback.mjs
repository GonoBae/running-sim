import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCourse} from '../src/course.ts';
import {createCoursePlayback} from '../src/course-playback.ts';
const asset=JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json'));
const course=createCourse(asset),cycle={seconds:.8,distanceM:2.8},checks=[];
const draft={id:asset.id,revision:asset.revision,startDistanceM:0,direction:'forward',laps:1};
const near=(a,b,tol=1e-7)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const vector=(a,b)=>a.forEach((n,i)=>near(n,b[i]));
for(const direction of ['forward','reverse'])for(const laps of [1,3,100])for(let start=0;start<20;start++){
 const d={...draft,direction,laps,startDistanceM:course.lengthM*start/20},r=createCoursePlayback(course,d,cycle),initial=r.frame();
 vector(initial.position,course.pointAt(d.startDistanceM));assert(!initial.playing);assert.equal(initial.completedLaps,0);
 for(const fraction of [0,.001,.1,.499,.5,.999,1]){
  r.seek(initial.duration*fraction);const f=r.frame();near(f.distanceM,f.totalM*fraction);vector(f.position,course.atTravel(d,f.distanceM));assert(Number.isFinite(f.heading));
  near(f.phase,(f.elapsed/cycle.seconds)%1);assert.equal(f.complete,fraction===1);
 }
 const finish=r.frame();assert.equal(finish.completedLaps,laps);vector(finish.position,initial.position);
 r.play();assert.equal(r.frame().elapsed,0);r.tick(initial.duration+100);assert.equal(r.frame().distanceM,initial.totalM);assert(!r.frame().playing);r.tick(50);assert.equal(r.frame().distanceM,initial.totalM);
}
checks.push('120 combinations of start/direction/1,3,100 laps: exact path, initial point, completion and restart; seven positions each');
const a=createCoursePlayback(course,{...draft,laps:3},cycle),b=createCoursePlayback(course,{...draft,laps:3},cycle);a.play();b.play();
for(let i=0;i<600;i++)a.tick(1/60);for(let i=0;i<300;i++)b.tick(1/30);near(a.frame().elapsed,b.frame().elapsed);near(a.frame().distanceM,35);
a.pause();const frozen=a.frame();a.tick(2);assert.deepEqual(a.frame(),frozen);a.play();a.setRate(4);a.tick(1);near(a.frame().distanceM,49);a.reset();assert.equal(a.frame().elapsed,0);assert(!a.frame().playing);
checks.push('30/60fps same displacement; pause freezes, resume and 4x rate advance one shared clock; reset pauses');
for(const direction of ['forward','reverse']){
 const r=createCoursePlayback(course,{...draft,direction,laps:3},cycle),boundary=course.lengthM/r.frame().speedMps;
 r.seek(boundary-1e-6);const before=r.frame();r.seek(boundary+1e-6);const after=r.frame();assert(Math.hypot(...before.position.map((n,i)=>n-after.position[i]))<.00001);near(after.elapsed-before.elapsed,2e-6);near(after.phase-before.phase,2e-6/cycle.seconds);assert.equal(before.completedLaps,0);assert.equal(after.completedLaps,1);
}
checks.push('Lap seam continuity in both directions; gait phase does not reset at a lap');
for(const n of [NaN,Infinity,-1]){assert.throws(()=>a.seek(n));assert.throws(()=>a.tick(n));}assert.throws(()=>a.setRate(3));assert.throws(()=>createCoursePlayback(course,{...draft,revision:'stale'},cycle));assert.throws(()=>createCoursePlayback(course,draft,{seconds:0,distanceM:2}));
checks.push('Invalid clock values, unsupported rate, invalid course and zero cycle time rejected');
const report={status:'passed',checks,routeCases:120,positions:840};fs.writeFileSync('docs/05-validation/reports/course-running-unit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
