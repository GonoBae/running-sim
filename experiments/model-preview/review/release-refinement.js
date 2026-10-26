import {Vector3,Quaternion} from 'three';
import {solve} from './stance-chain.js';
export const releaseRefinementSettings={start:.46,end:.58,maxLateral:.008,maxToeAngle:8*Math.PI/180,fade:.02,toeEnd:.56,toeRelease:.04};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
// Two zero-position/velocity/acceleration endpoint basis functions flatten
// lateral speed. Fit only the contact path; never move the pelvis or recovery.
export function createRefinedPath(base){
 const {start,end,maxLateral}=releaseRefinementSettings,d=end-start,e=1e-5;
 const b=(u,j)=>u**3*(1-u)**3*(j?2*u-1:1);
 const db=(u,j)=>(b(u+e,j)-b(u-e,j))/(2*e);
 let a=0,c=0,f=0,r=0,s=0;
 for(let i=1;i<200;i++){
  const u=i/200,v=(base(start+(u+e)*d).x-base(start+(u-e)*d).x)/(2*e),p=db(u,0),q=db(u,1);
  a+=p*p;c+=p*q;f+=q*q;r-=v*p;s-=v*q;
 }
 const det=a*f-c*c,co=[(r*f-s*c)/det,(s*a-r*c)/det];
 let max=0;for(let i=0;i<=200;i++)max=Math.max(max,Math.abs(co[0]*b(i/200,0)+co[1]*b(i/200,1)));
 const scale=Math.min(1,maxLateral/Math.max(max,1e-12));
 return phase=>{const p=base(phase),u=(phase-start)/d;if(u>0&&u<1)p.x+=scale*(co[0]*b(u,0)+co[1]*b(u,1));return p;};
}
export function applyReleaseRefinement(model,bones,pivot,target,phase,read){
 const {start,end,maxToeAngle,fade,toeEnd,toeRelease}=releaseRefinementSettings;
 if(phase<=start||phase>=end)return {active:false};
 const w=smooth((phase-start)/fade)*smooth((toeEnd-phase)/toeRelease),by=n=>bones.find(b=>b.name===n);
 const hip=by('thigh_r'),knee=by('calf_r'),foot=by('foot_r'),toe=by('ball_r'),pos=b=>b.getWorldPosition(new Vector3());
 const floor=read('r').min,footQ=foot.getWorldQuaternion(new Quaternion()),toeQ=toe.getWorldQuaternion(new Quaternion());
 const axis=new Vector3(0,1,0).cross(pos(toe).sub(pos(foot))).normalize();
 const parentInv=toe.parent.getWorldQuaternion(new Quaternion()).invert(),initialGap=pivot.read().y-floor;
 const setAngle=angle=>{toe.quaternion.copy(parentInv).multiply(new Quaternion().setFromAxisAngle(axis,angle)).multiply(toeQ);model.updateMatrixWorld(true);};
 // A bounded C2 envelope avoids speed kinks from per-frame angle clipping.
 const angle=maxToeAngle*w;
 setAngle(angle);
 const upper=pos(knee).sub(pos(hip)),goal=pos(foot);
 for(let i=0;i<5;i++){
  const p=pivot.read();goal.x+=target.x-p.x;goal.z+=target.z-p.z;goal.y+=floor-read('r').min;
  solve(model,hip,knee,foot,goal,footQ,0,upper);
  const after=pivot.read();if(Math.hypot(target.x-after.x,target.z-after.z,floor-read('r').min)<1e-7)break;
 }
 return {active:true,angle,weight:w,pivot:pivot.read().toArray(),target:target.toArray(),beforeGap:initialGap,gap:pivot.read().y-read('r').min};
}
