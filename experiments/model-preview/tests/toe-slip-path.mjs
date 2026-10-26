import assert from 'node:assert/strict';
import {Vector3} from '../node_modules/three/build/three.module.js';
import {createToeSlipPath,toePathWeight,toePathSettings as s} from '../review/toe-slip-path.js';
const line=createToeSlipPath(u=>new Vector3(2*u+5,4*u-1,-3*u+10));
for(let i=0;i<=200;i++)assert(line.read(i/200).length()<1e-12,'linear translation must introduce no correction');
const sample=u=>new Vector3(Math.sin(17*u)*.02,u*u,Math.cos(23*u)*.03);
const a=createToeSlipPath(sample),b=createToeSlipPath(u=>sample(u).add(new Vector3(100,5,-200)));
for(let i=0;i<=200;i++){const u=i/200;assert(a.read(u).distanceTo(b.read(u))<1e-12,'lane/world translation must not change correction');assert.equal(a.read(u).y,0);if(u<=.5||u>=1){assert.equal(toePathWeight(u),0);assert.equal(a.read(u).length(),0);}}
// Difference between one-sided velocity/acceleration tends to zero at each
// lookup knot, including the fade boundaries and the untouched recovery.
let velocityJump=0,accelerationJump=0;const h=1e-6;
for(let i=0;i<=100;i++){
 const u=s.start+i*s.step,p=a.read(u),lo=a.read(u-h),hi=a.read(u+h),ll=a.read(u-2*h),hh=a.read(u+2*h);
 velocityJump=Math.max(velocityJump,p.clone().sub(lo).divideScalar(h).distanceTo(hi.clone().sub(p).divideScalar(h)));
 accelerationJump=Math.max(accelerationJump,p.clone().add(ll).addScaledVector(lo,-2).divideScalar(h*h).distanceTo(hh.clone().add(p).addScaledVector(hi,-2).divideScalar(h*h)));
}
assert(velocityJump<.001);assert(accelerationJump<.01);
console.log({result:'PASS',linearInvariant:true,translationInvariant:true,verticalCorrectionZero:true,knots:101,velocityJump,accelerationJump});
