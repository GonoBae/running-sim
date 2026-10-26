import {Vector3} from 'three';
import {solveSupportLeg} from './shared-support.js';

// M74: only the tail of the left-foot join. Earlier M73 contact is unchanged.
export const SUPPORT_JOIN_WINDOW=Object.freeze({start:.88,end:.93,lateralWeight:.125,forwardWeight:.1});
const smooth=u=>u*u*u*(10+u*(-15+6*u));
const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function createSupportJoin(baseline,lane,probe,travel,options=SUPPORT_JOIN_WINDOW){
 const {start,end}=options;
 const point=(target,name)=>target.group.worldToLocal(target.model.getObjectByName(name).getWorldPosition(new Vector3()));
 const sample=t=>{
  baseline.apply(lane,probe,t);
  return lane.group.worldToLocal(baseline.left.read(lane));
 };
 const first=sample(start),last=sample(end);
 let length=0,previous=first;
 for(let i=1;i<=100;i++){const p=sample(start+(end-start)*i/100);length+=horizontal(previous,p);previous=p;}
 const excessMm=(length-horizontal(first,last))*1000;
 // Do not deform an already straight path just to produce a changed result.
 const enabled=excessMm>.05;
 function apply(target,mirrorProbe,phase){
  const cycle=Math.floor(phase),t=phase-cycle;
  if(!enabled||t<=start||t>=end)return baseline.apply(target,mirrorProbe,phase);
  // Use the unchanged right leg at the corresponding half-cycle as a lateral
  // reference. Restore the current full pose before solving the left chain.
  baseline.apply(target,mirrorProbe,phase-.5);
  const right=target.group.worldToLocal(baseline.right.read(target)).sub(point(target,'thigh_r'));
  const rightKnee=point(target,'calf_r').sub(point(target,'thigh_r'));rightKnee.x*=-1;
  const result=baseline.apply(target,mirrorProbe,phase);
  const model=target.model,hip=model.getObjectByName('thigh_l'),knee=model.getObjectByName('calf_l'),foot=model.getObjectByName('foot_l');
  const before=baseline.left.read(target),goal=target.group.worldToLocal(before.clone()),h=point(target,'thigh_l');
  const u=(t-start)/(end-start),weight=64*u**3*(1-u)**3;
  goal.x+=(h.x-right.x-goal.x)*weight*options.lateralWeight;
  goal.z+=(first.z+(last.z-first.z)*smooth(u)+travel.z*cycle-goal.z)*weight*options.forwardWeight;
  const bend=point(target,'calf_l').sub(h).lerp(rightKnee,weight).transformDirection(target.group.matrixWorld);
  target.group.localToWorld(goal);
  // The correction and its first two derivatives vanish at both boundaries.
  // Retain the existing skin height and foot world orientation.
  const desired=foot.getWorldPosition(new Vector3()).add(goal.clone().sub(before));
  const saved=[hip,knee,foot].map(b=>b.quaternion.clone());
  try{
   for(let i=0;i<3;i++){
    solveSupportLeg(model,hip,knee,foot,desired,bend);
    const residual=goal.clone().sub(baseline.left.read(target));
    if(residual.length()<1e-8)break;
    desired.add(residual);
   }
  }catch(error){
   [hip,knee,foot].forEach((b,i)=>b.quaternion.copy(saved[i]));model.updateMatrixWorld(true);throw error;
  }
  const after=baseline.left.read(target);
  return {...result,join:{active:true,before:before.toArray(),after:after.toArray(),errorMm:after.distanceTo(goal)*1000}};
 }
 return {apply,baseline,options,enabled,excessMm};
}
