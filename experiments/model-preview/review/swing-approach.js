import {Vector3,Quaternion} from 'three';
import {solve} from './stance-chain.js';
import {contactRotation} from './stance-contact.js';

const smooth=u=>u*u*u*(10+u*(-15+6*u));
// A nondecreasing Bezier control polygon cannot overshoot or reverse. Use a
// higher degree when necessary to retain the measured entry acceleration.
function boundedCurve(x0,x1,acceleration,duration){
 const delta=x1-x0;
 if(Math.abs(delta)<1e-8)return ()=>x1;
 let degree=5;
 while(degree<128&&acceleration*duration*duration/delta/(degree*(degree-1))>.8)degree++;
 const second=acceleration*duration*duration/(degree*(degree-1));
 if(second/delta<0||second/delta>1)throw Error('Invalid approach curvature');
 const p=[x0,x0,x0+second];
 for(let i=3;i<degree-2;i++)p.push(p[2]+(x1-p[2])*(i-2)/(degree-4));
 p.push(x1,x1,x1);
 return u=>{const work=p.slice();for(let level=degree;level>0;level--)for(let i=0;i<level;i++)work[i]+=(work[i+1]-work[i])*u;return work[0];};
}

export function createSwingApproach(sample,window,anchorX,cycleTravelX){
 const side=window.side,sign=side==='r'?-1:1;
 const lo=side==='r'?.70:.21,hi=window.approach+(side==='r'?1:0),end=window.start+(side==='r'?1:0);
 const read=t=>{const cycle=Math.floor(t),phase=t-cycle,value=sample(phase);return {...value,x:value.x+cycle*cycleTravelX,kneeX:value.kneeX+cycle*cycleTravelX};};
 const steps=48,step=(hi-lo)/steps,samples=Array.from({length:steps+1},(_,i)=>read(lo+i*step));
 function peak(key){
  let best=0,score=-Infinity;
  for(let i=0;i<=steps;i++){const value=sign*samples[i][key];if(value>score){score=value;best=i;}}
  if(best===0||best===steps)throw Error('No interior swing turning point '+key);
  let a=lo+(best-1)*step,b=lo+(best+1)*step;
  for(let i=0;i<28;i++){const l=a+(b-a)/3,r=b-(b-a)/3;if(sign*read(l)[key]<sign*read(r)[key])a=l;else b=r;}
  const start=(a+b)/2,entry=read(start),e=.0001,acceleration=(read(start+e)[key]+read(start-e)[key]-2*entry[key])/(e*e);
  return {start,entry,acceleration};
 }
 const foot=peak('x'),knee=peak('kneeX'),start=foot.start,entry=foot.entry;
 const target=anchorX+(side==='r'?cycleTravelX:0),curve=boundedCurve(entry.x,target,foot.acceleration,end-start);
 const kneeTarget=read(end).kneeX,kneeCurve=boundedCurve(knee.entry.kneeX,kneeTarget,knee.acceleration,end-knee.start);
 return {side,start,end,kneeStart:knee.start,kneeTarget,entryX:entry.x,targetX:target,upper:entry.upper,curve,
  at(phase){const shift=side==='r'&&phase<start?1:0,p=phase+shift;if(p<=start||p>=end)return null;
   const u=(p-start)/(end-start);return {x:curve(u)-shift*cycleTravelX,u,kneeX:p>=knee.start?kneeCurve((p-knee.start)/(end-knee.start))-shift*cycleTravelX:null};}};
}

// Fresh M47 pose in; no accumulated render-time deltas. Stance is untouched.
export function applySwingApproach(lane,phase,plans){
 const diagnostics=[];
 for(const plan of plans){
  const path=plan.swing,value=path?.at(phase);if(!value)continue;
  const side=path.side,by=n=>lane.bones.find(b=>b.name===n+'_'+side),hip=by('thigh'),knee=by('calf'),foot=by('foot'),toe=by('ball');
  const pos=b=>b.getWorldPosition(new Vector3()),blend=smooth(value.u);
  const q=contactRotation(foot.getWorldQuaternion(new Quaternion()),plan.footQ,blend),tq=contactRotation(toe.getWorldQuaternion(new Quaternion()),plan.toeQ,blend);
  const floor=lane.readSurface(side).min,goal=pos(foot),targetX=lane.group.position.x+value.x,upper=pos(knee).sub(pos(hip)).lerp(new Vector3(...path.upper),blend),kneeTargetX=value.kneeX===null?pos(knee).x:lane.group.position.x+value.kneeX;
  for(let i=0;i<7;i++){
   goal.x+=targetX-plan.patch.read().x;goal.y+=floor-lane.readSurface(side).min;
   solve(lane.model,hip,knee,foot,goal,q,blend,upper,kneeTargetX);
   toe.quaternion.copy(toe.parent.getWorldQuaternion(new Quaternion()).invert().multiply(tq));lane.model.updateMatrixWorld(true);
   if(Math.hypot(targetX-plan.patch.read().x,floor-lane.readSurface(side).min)<1e-7)break;
  }
  diagnostics.push({side,u:value.u,targetX:value.x,kneeError:pos(knee).x-kneeTargetX,patch:lane.group.worldToLocal(plan.patch.read()).toArray()});
 }
 return diagnostics;
}
