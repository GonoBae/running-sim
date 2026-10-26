import {Quaternion,Vector3,MathUtils} from 'three';

// M28 visual experiment, not a measured or recommended running width.
export const stanceSettings={halfHipFraction:.25,guard:.0005,maxDegrees:12,step:.5};
const p=b=>b.getWorldPosition(new Vector3());
export function readStance(bones){
 const by=n=>bones.find(b=>b.name===n);
 const center=p(by('thigh_l')).add(p(by('thigh_r'))).multiplyScalar(.5);
 return Object.fromEntries(['l','r'].map(side=>[side,Object.fromEntries(
  ['thigh','calf','foot','ball'].map(n=>[n,p(by(n+'_'+side)).sub(center)]))]));
}

// Calibrate once from uncorrected poses. A constant per-side rotation is periodic
// and introduces no frame-by-frame clamp or velocity discontinuity at contact.
export function createStancePlan(period,measure,windows,halfHipWidth){
 const samples=[];
 for(let frame=0;frame<period;frame+=stanceSettings.step){
  const phase=frame/period;
  const support=windows.find(w=>[phase,phase+1].some(p=>p>=w.start&&p<=w.end));
  if(support)samples.push({side:support.side,pose:measure(frame)[support.side]});
 }
 const clearance=halfHipWidth*stanceSettings.halfHipFraction;
 const angles={},diagnostics={};
 for(const side of ['l','r']){
  const sign=side==='l'?1:-1,poses=samples.filter(s=>s.side===side).map(s=>s.pose);
  if(!poses.length)throw Error('Missing stance samples for '+side);
  const minimum=angle=>Math.min(...poses.flatMap(({thigh,foot,ball})=>{
   const a=angle*sign;
   const x=thigh.x+Math.cos(a)*(foot.x-thigh.x)-Math.sin(a)*(foot.y-thigh.y);
   // Foot world orientation is preserved, so its ball offset stays unchanged.
   return [sign*x,sign*(x+ball.x-foot.x)];
  }));
  let lo=0,hi=MathUtils.degToRad(stanceSettings.maxDegrees);
  const goal=clearance+stanceSettings.guard,limited=minimum(hi)<goal;
  if(minimum(0)>=goal)hi=0;
  else if(!limited)for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(minimum(mid)<goal)lo=mid;else hi=mid;}
  angles[side]=hi;
  diagnostics[side]={degrees:MathUtils.radToDeg(hi),before:minimum(0),after:minimum(hi),limited};
 }
 return {angles,clearance,diagnostics};
}

export function applyStance(model,bones,plan){
 const by=n=>bones.find(b=>b.name===n),forward=new Vector3(0,0,1);
 for(const side of ['l','r']){
  const hip=by('thigh_'+side),foot=by('foot_'+side);
  const footWorld=foot.getWorldQuaternion(new Quaternion());
  const rotation=new Quaternion().setFromAxisAngle(forward,plan.angles[side]*(side==='l'?1:-1));
  const world=rotation.multiply(hip.getWorldQuaternion(new Quaternion()));
  hip.quaternion.copy(hip.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));
  model.updateMatrixWorld(true);
  foot.quaternion.copy(foot.parent.getWorldQuaternion(new Quaternion()).invert().multiply(footWorld));
  model.updateMatrixWorld(true);
 }
}
