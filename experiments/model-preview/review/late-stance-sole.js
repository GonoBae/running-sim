import {Quaternion, Vector3} from 'three';
import {stanceContactWindows} from './stance-contact.js';
import {solve} from './stance-chain.js';

const position=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const smooth=x=>{x=Math.max(0,Math.min(1,x));return Math.max(0,Math.min(1,x*x*x*(10+x*(-15+6*x))));};
const wrap=p=>((p%1)+1)%1;
export const lateStanceSettings={start:.25,release:.65,end:1,samples:96};

export function lateStanceProgress(phase,window){
 let p=wrap(phase);if(window.end>1&&p<window.start)p+=1;
 return (p-window.start)/(window.end-window.start);
}
export function lateStanceWeight(u){
 if(u<=lateStanceSettings.start||u>=1)return 0;
 return smooth((1-u)/(1-lateStanceSettings.release));
}
export function soleAngles(frame){
 const forward=new Vector3(0,0,1).applyQuaternion(frame),right=new Vector3(1,0,0).applyQuaternion(frame);
 const yaw=Math.atan2(forward.x,forward.z),horizontal=new Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 return {yaw,pitch:Math.atan2(forward.y,Math.hypot(forward.x,forward.z)),bank:Math.atan2(right.dot(forward.clone().cross(horizontal)),right.dot(horizontal))};
}
function frameOf({yaw,pitch,bank}){
 return new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw)
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-pitch))
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),bank));
}

// Both inputs are the measured M53 sole pitch at the same support progress.
// A C2 piecewise quintic avoids lookup-knot velocity jumps. At 25% M53 is
// already level with zero blend derivatives, so that endpoint is pinned.
export function createLateStanceReference(sample){
 const {start,end,samples}=lateStanceSettings,h=(end-start)/samples;
 const values=Array.from({length:samples+1},(_,i)=>{
  const u=start+i*h;
  return stanceContactWindows.reduce((sum,w)=>sum+sample(w.side,wrap(w.start+u*(w.end-w.start))),0)/2;
 });
 values[0]=0;
 const derivative=values.map((v,i)=>i===0?0:i===samples?(v-values[i-1])/h:(values[i+1]-values[i-1])/(2*h));
 const second=values.map((v,i)=>i===0||i===samples?0:(values[i+1]-2*v+values[i-1])/(h*h));
 const read=u=>{
  const t=Math.max(0,Math.min(samples,(u-start)/h)),i=Math.min(samples-1,Math.floor(t)),s=t-i;
  const a=values[i],d=values[i+1]-a,v=derivative[i]*h,w=derivative[i+1]*h,A=second[i]*h*h,B=second[i+1]*h*h;
  return a+v*s+.5*A*s*s+d*(10*s**3-15*s**4+6*s**5)+v*(-6*s**3+8*s**4-3*s**5)+w*(-4*s**3+7*s**4-3*s**5)+A*(-1.5*s**3+1.5*s**4-.5*s**5)+B*(.5*s**3-s**4+.5*s**5);
 };
 return {values,read};
}

export function applyLateStanceSole(lane,phase,reference){
 const diagnostics=[];
 for(const window of stanceContactWindows){
  const side=window.side,u=lateStanceProgress(phase,window),weight=lateStanceWeight(u);
  if(!weight){diagnostics.push({side,u,weight:0});continue;}
  const by=n=>lane.bones.find(b=>b.name===n+'_'+side),hip=by('thigh'),knee=by('calf'),foot=by('foot'),toe=by('ball');
  const patch=lane.contactPlans.find(p=>p.window.side===side).patch;
  const targetPoint=patch.read(),floor=lane.readSurface(side).min,original=soleAngles(lane.readSole(side).frame),pitch=reference.read(u);
  // Keep each foot's heading. Level the sole about its own forward axis,
  // while retaining the measured heel-rise curve rather than flattening it.
  const desired=frameOf({yaw:original.yaw,pitch:original.pitch+(pitch-original.pitch)*weight,bank:original.bank*(1-weight)});
  const upper=position(knee).sub(position(hip)),kneeX=position(knee).x,goal=position(foot);
  let footQ=rotation(foot),toeQ=rotation(toe),residual=Infinity,angleError=Infinity,kneeClamp=0,iterations=0;
  for(let i=0;i<14;i++){
   const delta=desired.clone().multiply(lane.readSole(side).frame.invert());footQ.premultiply(delta).normalize();toeQ.premultiply(delta).normalize();
   const result=solve(lane.model,hip,knee,foot,goal,footQ,0,upper,kneeX);kneeClamp=Math.max(kneeClamp,Math.abs(result.kneeClamp));
   toe.quaternion.copy(rotation(toe.parent).invert().multiply(toeQ));lane.model.updateMatrixWorld(true);
   const p=patch.read(),offset=new Vector3(targetPoint.x-p.x,floor-lane.readSurface(side).min,targetPoint.z-p.z);
   residual=offset.length();angleError=desired.angleTo(lane.readSole(side).frame);iterations=i+1;
   if(residual<1e-8&&angleError<1e-7)break;goal.add(offset);
  }
  diagnostics.push({side,u,weight,referencePitch:pitch,original,residual,angleError,kneeClamp,iterations});
 }
 return diagnostics;
}
