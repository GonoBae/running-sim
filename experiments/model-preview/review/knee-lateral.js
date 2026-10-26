import {Vector3} from 'three';
import {monotoneRelease} from './shared-release.js';
import {solveSupportLeg} from './shared-support.js';

// Begin before the inward turn, while the old lateral velocity is positive.
// Starting at .55 would inherit a negative velocity and force another dip.
export const KNEE_LATERAL_WINDOW=Object.freeze({start:.53,end:.68});
const wrap=t=>((t%1)+1)%1;

export function createKneeLateral(baseline,lane,probe,options=KNEE_LATERAL_WINDOW){
 const {start,end}=options;
 const pos=(l,n)=>l.model.getObjectByName(n).getWorldPosition(new Vector3());
 const local=(l,n)=>l.group.worldToLocal(pos(l,n));
 const curves={};
 for(const side of ['r','l']){
  const shift=side==='l'?.5:0,sign=side==='r'?1:-1;
  const sample=t=>{
   baseline.apply(lane,probe,t+shift);
   return sign*(local(lane,'calf_'+side).x-local(lane,'thigh_'+side).x);
  };
  const boundary=t=>{
   const h=1e-4,p=sample(t),lo=sample(t-h),hi=sample(t+h);
   return {p,v:(hi-lo)/(2*h),a:(hi+lo-2*p)/(h*h)};
  };
  const A=boundary(start),B=boundary(end);
  curves[side]={shift,sign,A,B,path:monotoneRelease(A,B,end-start)};
 }
 function apply(target,mirrorProbe,phase){
  const result=baseline.apply(target,mirrorProbe,phase),changes=[];
  for(const side of ['r','l']){
   const curve=curves[side],t=wrap(phase-curve.shift);
   if(t<=start||t>=end)continue;
   const model=target.model,hip=model.getObjectByName('thigh_'+side),knee=model.getObjectByName('calf_'+side),foot=model.getObjectByName('foot_'+side);
   const H=local(target,hip.name),K=local(target,knee.name),A=local(target,foot.name);
   const upper=H.distanceTo(K),lower=K.distanceTo(A),axis=A.clone().sub(H),distance=axis.length();
   axis.divideScalar(distance);
   const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
   const radius=Math.sqrt(Math.max(0,upper*upper-along*along));
   const lateral=new Vector3(1,0,0).addScaledVector(axis,-axis.x);
   const extent=lateral.length();
   if(radius<1e-8||extent<1e-8)throw Error('Knee lateral circle is undefined.');
   lateral.divideScalar(extent);
   const forward=axis.clone().cross(lateral);
   const x=curve.sign*curve.path.read((t-start)/(end-start));
   const cosine=(x-axis.x*along)/(radius*extent);
   if(Math.abs(cosine)>=1)throw Error('Knee lateral target leaves the fixed-length circle.');
   const oldPole=K.clone().sub(H).addScaledVector(axis,-along);
   const branch=oldPole.dot(forward);
   if(Math.abs(branch)<1e-8)throw Error('Knee lateral branch is ambiguous.');
   // Keep both ends of the leg fixed and move the knee along their sphere
   // intersection. Distances, hence the actual knee flexion, cannot change.
   const bend=lateral.multiplyScalar(cosine).addScaledVector(forward,Math.sign(branch)*Math.sqrt(1-cosine*cosine));
   bend.transformDirection(target.group.matrixWorld);
   solveSupportLeg(model,hip,knee,foot,pos(target,foot.name),bend);
   changes.push({side,phase:t,targetX:x});
  }
  return {...result,kneeLateral:changes};
 }
 return {apply,curves,options,baseline};
}
