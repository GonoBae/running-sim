import {Quaternion, Vector3} from 'three';

// Selected by matching full-body rotations across a nine-frame neighbourhood.
// Zero-based source frames; these are authored loop choices, not measured contacts.
export const cycleWindows = {
  '35_17': {start:54, period:91, blend:8},
  '127_06': {start:18, period:75, blend:8},
};
const wrap=(x,n)=>((x%n)+n)%n;
const smooth=x=>x*x*(3-2*x);
const quat=a=>new Quaternion(...a);
const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));

// Hemisphere-aligned normalized cubic interpolation. Periodic neighbours give
// the seam the same position and first derivative as every interior knot.
function cubicRotation(values,t){
  const anchor=quat(values[1]);
  const aligned=values.map(v=>{const q=quat(v);return q.dot(anchor)<0?v.map(x=>-x):v;});
  return new Quaternion(...[0,1,2,3].map(k=>cubic(...aligned.map(a=>a[k]),t))).normalize();
}

export function createCycle(clip){
  const window=cycleWindows[clip.id];
  if(!window)throw new Error('No reviewed cycle for '+clip.id);
  const {start,period,blend}=window;
  if(start-blend<0||start+period+blend>=clip.frames.length)throw new Error('Cycle needs overlap frames');
  const local=clip.frames.map(f=>f.q.map((v,i)=>i===0?quat(v):quat(f.q[clip.parents[i]]).invert().multiply(quat(v))));
  const keys=Array.from({length:period},(_,k)=>{
    const source=start+k;
    let other=source,weight=0;
    if(k<blend){other=source+period;weight=.5*(1-smooth(k/blend));}
    else if(k>period-blend){other=source-period;weight=.5*(1-smooth((period-k)/blend));}
    return {
      q:local[source].map((q,i)=>q.clone().slerp(local[other][i],weight).toArray()),
      y:clip.frames[source].p[0][1]*(1-weight)+clip.frames[other].p[0][1]*weight,
    };
  });
  function sample(frame){
    const f=wrap(frame,period),i=Math.floor(f),t=f-i;
    const neighbours=[-1,0,1,2].map(d=>keys[wrap(i+d,period)]);
    const rotations=clip.names.map((_,j)=>cubicRotation(neighbours.map(k=>k.q[j]),t));
    const p=[],q=[];
    p[0]=new Vector3(0,cubic(...neighbours.map(k=>k.y),t),0);q[0]=rotations[0];
    function solve(i){
      if(p[i])return;
      const parent=clip.parents[i];solve(parent);
      q[i]=q[parent].clone().multiply(rotations[i]);
      const bone=clip.bones[i-1];
      p[i]=p[parent].clone().add(new Vector3(...bone.direction).multiplyScalar(bone.length).applyQuaternion(q[i]));
    }
    clip.names.forEach((_,i)=>solve(i));
    return {p:p.map(v=>v.toArray()),q:q.map(v=>v.toArray())};
  }
  return {...window,seconds:period/clip.fps,sample};
}
