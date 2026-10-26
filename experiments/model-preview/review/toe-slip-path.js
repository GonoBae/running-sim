import {Vector3,Quaternion} from 'three';
import {stanceContactWindows} from './stance-contact.js';
import {lateStanceProgress} from './late-stance-sole.js';
import {solve} from './stance-chain.js';

// A small, phase-based horizontal fairing of the existing M54 material path.
// No temporary hold: the original contact/recovery endpoints remain unchanged.
export const toePathSettings={start:.5,end:1,fade:.1,radius:.12,step:.005};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export function toePathWeight(u){const s=toePathSettings;return smooth((u-s.start)/s.fade)*smooth((s.end-u)/s.fade);}

// Adjacent intervals share value, first and second derivative (C2).
function quinticTable(values,h){
 const n=values.length-1;
 const v=values.map((p,i)=>values[Math.min(n,i+1)].clone().sub(values[Math.max(0,i-1)]).divideScalar((i===0||i===n?1:2)*h));
 const a=values.map((p,i)=>i===0||i===n?new Vector3():values[i+1].clone().add(values[i-1]).addScaledVector(p,-2).divideScalar(h*h));
 return t=>{
  const k=Math.min(n-1,Math.floor(Math.max(0,Math.min(n,t)))),u=Math.max(0,Math.min(1,t-k));
  const d=values[k+1].clone().sub(values[k]);
  return values[k].clone().addScaledVector(v[k],h*u).addScaledVector(a[k],.5*h*h*u*u)
   .addScaledVector(d,10*u**3-15*u**4+6*u**5)
   .addScaledVector(v[k],h*(-6*u**3+8*u**4-3*u**5)).addScaledVector(v[k+1],h*(-4*u**3+7*u**4-3*u**5))
   .addScaledVector(a[k],h*h*(-1.5*u**3+1.5*u**4-.5*u**5)).addScaledVector(a[k+1],h*h*(.5*u**3-u**4+.5*u**5));
 };
}

// sample(u) returns the UNWRAPPED M54 toe position in lane-local world units.
// Cache it once; never integrate frame deltas or smooth a moving camera trace.
export function createToeSlipPath(sample){
 const {start,end,radius,step}=toePathSettings,pad=Math.round(radius/step),count=Math.round((end-start)/step);
 const raw=Array.from({length:count+2*pad+1},(_,i)=>sample(start+(i-pad)*step));
 const kernel=Array.from({length:2*pad+1},(_,i)=>(1-((i-pad)/pad)**2)**2),mass=kernel.reduce((a,b)=>a+b,0);
 const deltas=Array.from({length:count+1},(_,i)=>{
  const mean=new Vector3();for(let j=0;j<kernel.length;j++)mean.addScaledVector(raw[i+j],kernel[j]/mass);
  mean.sub(raw[i+pad]);mean.y=0;return mean;
 });
 const read=quinticTable(deltas,step);
 return {deltas,read(u){const weight=toePathWeight(u);return weight?read((u-start)/step).multiplyScalar(weight):new Vector3();}};
}

const pos=b=>b.getWorldPosition(new Vector3());
const rot=b=>b.getWorldQuaternion(new Quaternion()).normalize();
export function applyToeSlipPath(lane,phase,plans){
 const diagnostics=[];
 for(const w of stanceContactWindows){
  const side=w.side,u=lateStanceProgress(phase,w),weight=toePathWeight(u);
  if(!weight){diagnostics.push({side,u,weight:0});continue;}
  const correction=plans[side].read(u),target=lane.readSole(side).points.toe.add(correction);
  const by=n=>lane.bones.find(b=>b.name===n+'_'+side),hip=by('thigh'),knee=by('calf'),foot=by('foot'),toe=by('ball');
  const goal=pos(foot),footQ=rot(foot),toeQ=rot(toe),upper=pos(knee).sub(pos(hip)),kneeX=pos(knee).x,floor=lane.readSurface(side).min;
  let residual=Infinity,kneeClamp=0,iterations=0;
  for(let i=0;i<10;i++){
   const p=lane.readSole(side).points.toe;goal.add(new Vector3(target.x-p.x,floor-lane.readSurface(side).min,target.z-p.z));
   const solved=solve(lane.model,hip,knee,foot,goal,footQ,0,upper,kneeX);kneeClamp=Math.max(kneeClamp,Math.abs(solved.kneeClamp));
   toe.quaternion.copy(rot(toe.parent).invert().multiply(toeQ));lane.model.updateMatrixWorld(true);
   const now=lane.readSole(side).points.toe;residual=Math.hypot(target.x-now.x,target.z-now.z,floor-lane.readSurface(side).min);iterations=i+1;
   if(residual<1e-8)break;
  }
  diagnostics.push({side,u,weight,correction:correction.toArray(),residual,kneeClamp,iterations});
 }
 return diagnostics;
}
