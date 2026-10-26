import {Quaternion,Vector3} from 'three';

// These brackets locate the two existing turns of the shared right-leg curve.
// They are clip-specific review settings, not anatomical angle limits.
export const APPROACH_BRACKETS=Object.freeze({start:[.84,.89],end:[1.24,1.28]});

export function monotoneBridge(x0,x1,a0,a1,length){
 const delta=x1-x0;
 if(!(delta>0&&a0>=0&&a1<=0&&length>0))throw Error('Invalid approach boundary curvature.');
 let degree=5;
 while((a0-a1)*length*length/(degree*(degree-1))>delta*.8&&degree<256)degree++;
 const first=x0+a0*length*length/(degree*(degree-1));
 const last=x1+a1*length*length/(degree*(degree-1));
 if(first>last)throw Error('Approach cannot retain monotone boundary curvature.');
 const points=[x0,x0,first];
 for(let i=3;i<=degree-2;i++)points.push(first+(last-first)*(i-2)/(degree-4));
 points.push(x1,x1);
 return {degree,read(u){
  const p=points.slice();
  for(let n=degree;n>0;n--)for(let i=0;i<n;i++)p[i]+=(p[i+1]-p[i])*u;
  return p[0];
 }};
}

function turningPoint(sample,[lo,hi],maximum){
 for(let i=0;i<42;i++){
  const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;
  if((sample(a)<sample(b))===maximum)lo=a;else hi=b;
 }
 return (lo+hi)/2;
}

export function createSharedApproach(baseline,lane,probe){
 const pos=(l,n)=>l.model.getObjectByName(n).getWorldPosition(new Vector3());
 const sample=t=>{baseline.apply(lane,probe,t);return pos(lane,'foot_r').x-pos(lane,'thigh_r').x;};
 const start=turningPoint(sample,APPROACH_BRACKETS.start,false);
 const end=turningPoint(sample,APPROACH_BRACKETS.end,true),h=1e-4;
 const acceleration=t=>(sample(t-h)-2*sample(t)+sample(t+h))/(h*h);
 const x0=sample(start),x1=sample(end);
 const bridge=monotoneBridge(x0,x1,acceleration(start),acceleration(end),end-start);
 function at(phase){
  const p=((phase%1)+1)%1,t=p<start?p+1:p;
  return t>start&&t<end?{t,x:bridge.read((t-start)/(end-start))}:null;
 }
 function apply(target,mirrorProbe,phase){
  const result=baseline.apply(target,mirrorProbe,phase),corrections=[];
  for(const side of ['r','l']){
   const value=at(phase+(side==='l'?.5:0));if(!value)continue;
   const model=target.model,by=n=>model.getObjectByName(n+'_'+side);
   const hip=by('thigh'),knee=by('calf'),foot=by('foot'),H=pos(target,hip.name);
   const upper=pos(target,knee.name).sub(H),ankle=pos(target,foot.name);
   const hipLocal=hip.quaternion.clone(),calfLocal=knee.quaternion.clone();
   const goal=upper.clone(),targetX=(side==='r'?1:-1)*value.x;
   goal.x+=targetX-(ankle.x-H.x);
   const zSquared=upper.lengthSq()-goal.x*goal.x-goal.y*goal.y;
   if(zSquared<=0||upper.z<=0)throw Error('Approach target is outside the preserved-height leg arc.');
   goal.z=Math.sqrt(zSquared);
   // Move knee and ankle together on the thigh's constant-height arc.
   // Restoring calf WORLD rotation retains both world foot direction and
   // calf-relative ankle rotation, without translating the pelvis or bones.
   const swing=new Quaternion().setFromUnitVectors(upper.clone().normalize(),goal.clone().normalize());
   const parent=hip.parent.getWorldQuaternion(new Quaternion()).normalize();
   hip.quaternion.copy(parent.clone().invert().multiply(swing).multiply(parent).multiply(hipLocal).normalize());
   model.updateMatrixWorld(true);
   // Compensate in the actual parent/child quaternions. Reconstructing absolute
   // world rotations here introduced tiny boundary offsets amplified by
   // velocity checks, even when the requested swing was nearly identity.
   knee.quaternion.copy(hip.quaternion.clone().invert().multiply(hipLocal).multiply(calfLocal).normalize());
   model.updateMatrixWorld(true);
   corrections.push({side,phase:value.t,targetX,deltaX:goal.x-upper.x,deltaZ:goal.z-upper.z,
    error:pos(target,foot.name).x-pos(target,hip.name).x-targetX});
  }
  return {...result,approach:corrections};
 }
 return {apply,at,window:{start,end,x0,x1,degree:bridge.degree},baseline};
}
