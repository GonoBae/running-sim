import {Vector3} from 'three';
import {solveSupportLeg,supportBridge} from './shared-support.js';

// M68: only the connection AFTER the M67 hold. At .60 the old knee is more
// extended than at .55; matching that early endpoint necessarily makes a
// bend/extend/bend detour. Rejoin the established recovery at .68 instead.
export const RELEASE_WINDOW=Object.freeze({start:.55,end:.68});
const wrap=t=>((t%1)+1)%1;
function kneeBasis(axis){
 const forward=new Vector3(0,0,1).addScaledVector(axis,-axis.z);
 if(forward.lengthSq()<1e-8)throw Error('Release knee reference axis is undefined.');
 forward.normalize();
 return {forward,lateral:axis.clone().cross(forward)};
}

// Ordered Bezier controls guarantee no interior reversal, while retaining
// position, velocity and acceleration at each end. Degree is selected once.
export function monotoneRelease(A,B,length){
 if(!(B.p>A.p&&A.v>=0&&B.v>=0&&length>0))throw Error('Release knee boundaries are not increasing.');
 let controls;
 for(let n=5;n<=256;n++){
  const first=[A.p,A.p+A.v*length/n,A.p+2*A.v*length/n+A.a*length*length/(n*(n-1))];
  const last=[B.p-2*B.v*length/n+B.a*length*length/(n*(n-1)),B.p-B.v*length/n,B.p];
  const edges=[...first,...last];
  if(edges.some((v,i)=>i&&v<edges[i-1]))continue;
  controls=[...first];
  for(let i=3;i<=n-3;i++)controls.push(first[2]+(last[0]-first[2])*(i-2)/(n-4));
  controls.push(...last);
  break;
 }
 if(!controls)throw Error('Cannot connect release knee without reversal.');
 return {degree:controls.length-1,read(u){
  const p=controls.slice();
  for(let n=p.length-1;n>0;n--)for(let i=0;i<n;i++)p[i]+=(p[i+1]-p[i])*u;
  return p[0];
 }};
}

export function createSharedRelease(baseline,lane,probe,travel,options=RELEASE_WINDOW){
 const {start,end}=options;
 const pos=(l,n)=>l.model.getObjectByName(n).getWorldPosition(new Vector3());
 const curves={};
 for(const side of ['r','l']){
  const shift=side==='l'?.5:0;
  const sample=t=>{
   baseline.apply(lane,probe,t+shift);
   const H=lane.group.worldToLocal(pos(lane,'thigh_'+side)),K=lane.group.worldToLocal(pos(lane,'calf_'+side)),A=lane.group.worldToLocal(pos(lane,'foot_'+side));
   const flex=Math.PI-H.clone().sub(K).angleTo(A.clone().sub(K));
   const axis=A.clone().sub(H).normalize(),{forward,lateral}=kneeBasis(axis),upper=K.clone().sub(H);
   const swivel=Math.atan2(upper.dot(lateral),upper.dot(forward));
   return new Vector3(A.x,flex,swivel);
  };
  const boundary=t=>{
   const h=1e-4,p=sample(t),lo=sample(t-h),hi=sample(t+h);
   return {p,v:hi.clone().sub(lo).divideScalar(2*h),a:hi.clone().add(lo).addScaledVector(p,-2).divideScalar(h*h)};
  };
  const A=boundary(start),B=boundary(end),component=p=>({p:p.p.y,v:p.v.y,a:p.a.y});
  curves[side]={A,B,shift,knee:monotoneRelease(component(A),component(B),end-start)};
 }
 function apply(target,mirrorProbe,phase){
  const result=baseline.apply(target,mirrorProbe,phase),changes=[];
  for(const side of ['r','l']){
   const curve=curves[side],t=wrap(phase-curve.shift);
   if(t<=start||t>=end)continue;
   const model=target.model,hip=model.getObjectByName('thigh_'+side),knee=model.getObjectByName('calf_'+side),foot=model.getObjectByName('foot_'+side);
   const H=pos(target,hip.name),K=pos(target,knee.name),A=pos(target,foot.name);
   const upper=H.distanceTo(K),lower=K.distanceTo(A);
   const u=(t-start)/(end-start),flex=curve.knee.read(u);
   const goal=target.group.worldToLocal(A.clone()),localH=target.group.worldToLocal(H.clone());
   const bridge=supportBridge(curve.A,curve.B,u,end-start);
   goal.x=bridge.x+travel.x*Math.floor(phase-curve.shift);
   // Retain ankle height and world foot orientation. The law of cosines
   // gives the hip-ankle distance for the smooth knee angle; only horizontal
   // ankle placement changes. The foot is behind the hip throughout here.
   const distance2=upper*upper+lower*lower+2*upper*lower*Math.cos(flex);
   const z2=distance2-(goal.x-localH.x)**2-(goal.y-localH.y)**2;
   if(z2<=0||goal.z>=localH.z)throw Error('Release target leaves the rear leg arc.');
   goal.z=localH.z-Math.sqrt(z2);
   // Also bridge the knee's bend-plane direction. Reusing the source pole
   // every frame keeps its lateral oscillation even with smooth ankle goals.
   const axis=goal.clone().sub(localH).normalize(),{forward,lateral}=kneeBasis(axis);
   const bend=forward.multiplyScalar(Math.cos(bridge.z)).addScaledVector(lateral,Math.sin(bridge.z));
   bend.transformDirection(target.group.matrixWorld);
   target.group.localToWorld(goal);
   solveSupportLeg(model,hip,knee,foot,goal,bend);
   changes.push({side,phase:t,kneeDeg:flex*180/Math.PI});
  }
  return {...result,release:changes};
 }
 return {apply,curves,options,baseline};
}
