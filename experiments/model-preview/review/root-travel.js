import {Vector3} from 'three';

const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));

// Restore only captured horizontal translation. Existing cyclic rotations and
// grounded Y remain unchanged so the comparison has a single independent input.
// This is a finite source segment, deliberately not a periodic trajectory.
export function sourceRootTravel(clip,cycle,frame,heading,scale){
  const f=cycle.start+Math.max(0,Math.min(cycle.period,frame));
  const i=Math.floor(f),t=f-i,start=clip.frames[cycle.start].p[0];
  const samples=[-1,0,1,2].map(d=>clip.frames[Math.max(0,Math.min(clip.frames.length-1,i+d))].p[0]);
  return new Vector3(
    cubic(...samples.map(p=>p[0]),t)-start[0],0,
    cubic(...samples.map(p=>p[2]),t)-start[2],
  ).applyQuaternion(heading).multiplyScalar(scale);
}
