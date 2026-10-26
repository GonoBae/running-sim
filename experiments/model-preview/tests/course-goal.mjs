import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCourse,normalizeCourseDraft,totalDistanceM,migrateCourseDraft} from '../src/course.ts';
import {createCoursePlayback} from '../src/course-playback.ts';
const read=p=>JSON.parse(fs.readFileSync(p)),c=createCourse(read('experiments/model-preview/public/courses/lotte-garden-c-v1.json'));
const old=createCourse(read('experiments/model-preview/public/courses/lotte-garden-b-v1.json'));
const base={id:c.asset.id,revision:c.asset.revision,startDistanceM:0,direction:'forward',laps:3};
const checks=[],near=(a,b)=>assert(Math.abs(a-b)<1e-7),vector=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
for(const m of [10,100,290,1000,3000,99990,100000]){
 const d={...base,goal:{type:'distance',distanceM:m}};assert.deepEqual(normalizeCourseDraft(d),d);assert.equal(totalDistanceM(c,d),m);
}
for(const goal of [null,{}, {type:'laps'}, ...[0,1,9,11,100010,NaN,Infinity,'1000',100.1].map(distanceM=>({type:'distance',distanceM}))])assert.equal(normalizeCourseDraft({...base,goal}),null);
assert.deepEqual(normalizeCourseDraft(base),base);near(totalDistanceM(c,base),c.lengthM*3);
checks.push('Legacy laps preserved; distance goal 10–100000m / 10m increments; invalid/partial/nonfinite goals rejected');
let cases=0;
for(const start of [0,91.71,c.lengthM*.5,c.lengthM-.01])for(const direction of ['forward','reverse'])for(const distanceM of [10,100,290,1000,3000,100000]){
 const d={...base,startDistanceM:start,direction,goal:{type:'distance',distanceM}},r=createCoursePlayback(c,d,{seconds:.8,distanceM:2.8});
 for(const f of [0,.01,.5,.9999,1]){r.seek(r.frame().duration*f);const a=r.frame();near(a.distanceM,distanceM*f);vector(a.position,c.pointAt(start+(direction==='forward'?1:-1)*distanceM*f));}
 assert(r.frame().complete);assert.equal(r.frame().completedLaps,Math.floor(distanceM/c.lengthM));assert.equal(r.frame().totalM,distanceM);
 r.seek(r.frame().duration-.01);r.play();r.tick(1);assert(r.frame().complete&&!r.frame().playing);vector(r.frame().position,c.atTravel(d,distanceM));
 r.play();assert.equal(r.frame().elapsed,0);cases++;
}
checks.push(`${cases} starts/directions/km goals: 5 positions each, exact finish, partial laps, restart and no overshoot`);
const d={...base,revision:old.asset.revision,goal:{type:'distance',distanceM:3000}};
let migrated=0,reselected=0;
for(let i=0;i<1000;i++){
 const input={...d,startDistanceM:old.lengthM*i/1000},out=migrateCourseDraft(c,input),oldPoint=old.pointAt(input.startDistanceM),hit=c.nearest(oldPoint);
 if(hit.distance<=.01){assert(out);vector(c.pointAt(out.startDistanceM),oldPoint);assert.deepEqual(out.goal,input.goal);assert.equal(out.laps,input.laps);migrated++;}
 else{assert.equal(out,null);reselected++;}
}
assert(migrated>900&&reselected>0);assert.equal(migrateCourseDraft(c,{...d,revision:'unrecognized'}),null);
checks.push(`${migrated} old starts keep physical point; ${reselected} removed-tip starts require reselection; unknown revisions never remapped`);
const evidence=read('docs/05-validation/reports/course-route-c.json'),b=read('docs/05-validation/reports/course-candidate-b.json');
assert(evidence.geometryChecks.onlyNortheastChanged);assert(!evidence.orderedNodeIds.includes(13502643218));assert(evidence.ways.some(w=>w.id===1471465834));
assert.deepEqual(c.asset.geometry,evidence.geometry);near(old.lengthM-c.lengthM,evidence.shorterByM);assert(b.orderedNodeIds.includes(13502643218));
checks.push('Only northeast replaced with source way 1471465834; prior B asset and evidence retained; no self crossing (createCourse)');
const report={status:'passed',checks,cases,positions:cases*5,migration:{migrated,reselected},lengthM:c.lengthM,shorterByM:old.lengthM-c.lengthM};
fs.writeFileSync('docs/05-validation/reports/course-goal-unit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
