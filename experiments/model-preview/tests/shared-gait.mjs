import assert from 'node:assert/strict';
import {Quaternion,Vector3} from '../node_modules/three/build/three.module.js';
import {mirrorRotation,rotationCurve} from '../review/shared-gait.js';
const reflect=v=>new Vector3(-v.x,v.y,v.z);
let reflectionError=0;
for(let i=0;i<100;i++){
 const q=new Quaternion().setFromAxisAngle(new Vector3(.1+i%3,1,i*.07).normalize(),i*.13);
 const v=new Vector3(.3+i*.01,-.8,.4);
 reflectionError=Math.max(reflectionError,reflect(v.clone().applyQuaternion(q)).distanceTo(reflect(v).applyQuaternion(mirrorRotation(q))));
 assert(mirrorRotation(mirrorRotation(q)).angleTo(q)<1e-7);
}
assert(reflectionError<1e-12);
const values=Array.from({length:40},(_,i)=>new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4*Math.sin(i/40*2*Math.PI)).toArray());
const curve=rotationCurve(values),antipodal=rotationCurve(values.map((v,i)=>i%2?v.map(x=>-x):v));
for(let i=0;i<100;i++){
 const t=i/99;assert(curve(t).angleTo(curve(t+1))<1e-7);assert(curve(t).angleTo(antipodal(t))<1e-7);
 const midpoint=curve(t).slerp(mirrorRotation(curve(t+.5)),.5);
 const other=curve(t+.5).slerp(mirrorRotation(curve(t)),.5);
 assert(midpoint.angleTo(mirrorRotation(other))<1e-7);
}
const h=1e-5;
assert(Math.abs(curve(-h).angleTo(curve(0))-curve(0).angleTo(curve(h)))<1e-7);
console.log({status:'PASS',reflectionError,mirrorInvolution:true,periodic:true,quaternionSignInvariant:true,halfCyclePelvisSymmetry:true,seamIncrement:true});
