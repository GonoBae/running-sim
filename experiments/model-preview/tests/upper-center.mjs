import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Quaternion} from '../node_modules/three/build/three.module.js';
import {CENTER_BONES,createCenterRotations} from '../review/upper-center.js';
import {mirrorRotation} from '../review/shared-gait.js';
const source=JSON.parse(fs.readFileSync(new URL('../public/review-data/shared-gait-reference.json',import.meta.url)));
const angle=(a,b)=>a.clone().normalize().angleTo(b.clone().normalize());
let maxMirror=0,maxPeriod=0,maxSign=0;
for(const reference of Object.values(source.models)){
 const before=JSON.stringify(reference),read=createCenterRotations(reference);
 const flipped=structuredClone(reference);
 flipped.frames.forEach((f,i)=>{if(i%2)f.q=f.q.map(q=>q.map(v=>-v));});
 const readFlipped=createCenterRotations(flipped);
 const rest=CENTER_BONES.map(n=>new Quaternion(...reference.bones.find(b=>b.name===n).worldQ).normalize());
 for(let i=0;i<120;i++){
  const t=-.25+i/119,now=read(t),half=read(t+.5),next=read(t+1),sign=readFlipped(t);
  for(let j=0;j<CENTER_BONES.length;j++){
   const delta=now[j].clone().multiply(rest[j].clone().invert());
   const other=half[j].clone().multiply(rest[j].clone().invert());
   maxMirror=Math.max(maxMirror,angle(delta,mirrorRotation(other)));
   maxPeriod=Math.max(maxPeriod,angle(now[j],next[j]));
   maxSign=Math.max(maxSign,angle(now[j],sign[j]));
   assert(Math.abs(now[j].length()-1)<1e-12);
  }
 }
 assert.equal(JSON.stringify(reference),before,'reference is immutable');
 // A neutral pose that already mirrors itself must stay neutral.
 const neutral=structuredClone(reference);
 neutral.frames.forEach(f=>{f.q=neutral.bones.map(b=>b.localQ);});
 const still=createCenterRotations(neutral);
 for(let i=0;i<5;i++)still(i/4).forEach((q,j)=>assert(angle(q,rest[j])<1e-6));
}
assert(maxMirror<1e-6&&maxPeriod<1e-6&&maxSign<1e-6);
console.log({status:'PASS',halfCycleRadians:maxMirror,periodicRadians:maxPeriod,quaternionSignRadians:maxSign,neutralUnchanged:true,sourceImmutable:true});
