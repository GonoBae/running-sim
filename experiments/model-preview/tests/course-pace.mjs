import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCourse,normalizeCourseDraft,paceLabel,durationLabel,totalDistanceM} from '../src/course.ts';
import {createCoursePlayback,cycleDuration} from '../src/course-playback.ts';
const c=createCourse(JSON.parse(fs.readFileSync('experiments/model-preview/public/courses/lotte-garden-c-v1.json')));
const base={id:c.asset.id,revision:c.asset.revision,startDistanceM:1121.8640021884382,direction:'reverse',laps:6,goal:{type:'distance',distanceM:5000}};
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),checks=[];
assert.deepEqual(normalizeCourseDraft(base),base);
for(const pace of [60,359,360,390,1800])assert.deepEqual(normalizeCourseDraft({...base,paceSecondsPerKm:pace}),{...base,paceSecondsPerKm:pace});
for(const pace of [0,59,1801,360.5,NaN,Infinity,null,'360']){
 assert.equal(normalizeCourseDraft({...base,paceSecondsPerKm:pace}),null);
 assert.throws(()=>createCoursePlayback(c,{...base,paceSecondsPerKm:pace},{seconds:.8,distanceM:2.8}));
}
assert.equal(paceLabel(390),'6:30 /km');assert.equal(durationLabel(1800),'30:00');assert.equal(durationLabel(3600),'1:00:00');assert.equal(durationLabel(3599.6),'1:00:00');
for(let pace=60;pace<=1800;pace++)assert.equal(createCoursePlayback(c,{...base,paceSecondsPerKm:pace},{seconds:.8,distanceM:2.8}).frame().paceSecondsPerKm,pace);
checks.push('Legacy optional field preserved; 1:00–30:00 integer seconds validated; malformed inputs rejected; labels cross hour boundary');
let cases=0,positions=0;
for(const direction of ['forward','reverse'])for(const startDistanceM of [0,1121.8640021884382])for(const goal of [undefined,{type:'distance',distanceM:5000}])for(const paceSecondsPerKm of [60,300,360,390,1800])for(const cycle of [{seconds:.8,distanceM:2.8},{seconds:.95,distanceM:2.15},{seconds:.7,distanceM:3.2}]){
 const d={...base,direction,startDistanceM,goal,paceSecondsPerKm},snapshot=JSON.stringify(d),r=createCoursePlayback(c,d,cycle),total=totalDistanceM(c,d);
 near(r.frame().duration,total*paceSecondsPerKm/1000);near(r.frame().speedMps,1000/paceSecondsPerKm);near(r.frame().speedMps*r.frame().cycleSeconds,cycle.distanceM);
 const legacy=createCoursePlayback(c,{...d,paceSecondsPerKm:undefined},cycle);
 for(const distance of [0,10,123.456,total]){
  r.seek(distance*paceSecondsPerKm/1000);legacy.seek(distance/legacy.frame().speedMps);
  const a=r.frame(),b=legacy.frame();near(a.distanceM,distance);a.position.forEach((v,i)=>near(v,b.position[i]));near(a.phase,b.phase);positions++;
 }
 assert(r.frame().complete);r.play();assert.equal(r.frame().elapsed,0);r.tick(1);near(r.frame().elapsed,1);r.pause();r.tick(10);near(r.frame().elapsed,1);
 for(const rate of [1,2,4]){r.reset();r.setRate(rate);r.play();r.tick(2);near(r.frame().elapsed,2*rate);near(r.frame().duration,total*paceSecondsPerKm/1000);}
 r.seek(r.frame().duration-.01);r.play();r.tick(1);assert(r.frame().complete&&!r.frame().playing);near(r.frame().distanceM,total);assert.equal(JSON.stringify(d),snapshot);cases++;
}
checks.push(`${cases} direction/start/goal/pace/body-stride combinations: exact speed/duration, same position and gait phase per traveled distance, end clamp and immutable input`);
checks.push('Play/pause/reset/restart and 1×/2×/4× only change observation speed, not predicted duration or finish');
const legacy=createCoursePlayback(c,base,{seconds:.8,distanceM:2.8});legacy.seek(123);near(legacy.frame().phase,(123/.8)%1);near(legacy.frame().speedMps,3.5);assert.equal(cycleDuration({seconds:.8,distanceM:2.8}),.8);
const report={status:'passed',cases,positions,checks,example:{distanceM:5000,paceSecondsPerKm:360,durationSeconds:1800},fieldDistanceCalibrated:false};
fs.writeFileSync('docs/05-validation/reports/course-pace-unit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
