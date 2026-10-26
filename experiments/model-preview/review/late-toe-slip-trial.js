import {Vector3,Quaternion} from 'three';
import {stanceContactWindows} from './stance-contact.js';
import {lateStanceProgress} from './late-stance-sole.js';
import {solve} from './stance-chain.js';

// Diagnostic counterexample only: NOT an accepted replacement for M54.
// Holding the toe while retaining the M54 rotations moves the old contact patch.
// Rejoining the unchanged recovery can also defer slip into the release.
export const toeTrialSettings={start:.5,hold:.65,release:.85,end:1,gain:.25};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export function toeTrialWeight(u){
 const s=toeTrialSettings;
 return smooth((u-s.start)/(s.hold-s.start))*smooth((s.end-u)/(s.end-s.release));
}
const pos=b=>b.getWorldPosition(new Vector3());
const rot=b=>b.getWorldQuaternion(new Quaternion()).normalize();

export function applyLateToeTrial(lane,phase,plans,travel){
 const diagnostics=[];
 for(const w of stanceContactWindows){
  const side=w.side,u=lateStanceProgress(phase,w),weight=toeTrialWeight(u);
  if(!weight){diagnostics.push({side,u,weight:0});continue;}
  const anchor=plans[side].clone();
  // phase=0 and phase=1 share the cyclic pose, but the finite source root
  // segment is one stride apart. Use the actual display phase at this boundary.
  if(w.end>1&&phase<w.start)anchor.sub(travel);
  lane.group.localToWorld(anchor);
  const before=lane.readSole(side).points.toe,target=before.clone().lerp(anchor,weight*toeTrialSettings.gain);
  const by=n=>lane.bones.find(b=>b.name===n+'_'+side),hip=by('thigh'),knee=by('calf'),foot=by('foot'),toe=by('ball');
  const goal=pos(foot),footQ=rot(foot),toeQ=rot(toe),upper=pos(knee).sub(pos(hip)),kneeX=pos(knee).x,floor=lane.readSurface(side).min;
  let residual=Infinity,kneeClamp=0,iterations=0;
  for(let i=0;i<10;i++){
   const now=lane.readSole(side).points.toe;
   goal.add(new Vector3(target.x-now.x,floor-lane.readSurface(side).min,target.z-now.z));
   const solved=solve(lane.model,hip,knee,foot,goal,footQ,0,upper,kneeX);kneeClamp=Math.max(kneeClamp,Math.abs(solved.kneeClamp));
   toe.quaternion.copy(rot(toe.parent).invert().multiply(toeQ));lane.model.updateMatrixWorld(true);
   const p=lane.readSole(side).points.toe;
   residual=Math.hypot(p.x-target.x,p.z-target.z,floor-lane.readSurface(side).min);iterations=i+1;
   if(residual<1e-8)break;
  }
  diagnostics.push({side,u,weight,residual,kneeClamp,iterations,target:lane.group.worldToLocal(target).toArray()});
 }
 return diagnostics;
}
