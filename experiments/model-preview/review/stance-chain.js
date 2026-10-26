import {Vector3,Quaternion,Matrix4} from 'three';
import {supportWindows} from './ground-contact.js';
export const chainMotionSettings={fade:.12};
export function chainMotionWeight(phase,side='r'){
 const {start,end}=supportWindows['35_17'].find(w=>w.side===side);
 phase=((phase%1)+1)%1;
 if(end>1&&phase<start)phase+=1;
 if(phase<=start||phase>=end)return 0;
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
 return smooth((phase-start)/chainMotionSettings.fade)*smooth((end-phase)/chainMotionSettings.fade);
}
const position=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion());
export const footPlantSettings={start:.32,holdStart:.40,holdEnd:.46,end:.58};
export function footPlantWeight(phase){
 const {start,holdStart,holdEnd,end}=footPlantSettings;
 if(phase<=start||phase>=end)return 0;
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
 return smooth((phase-start)/(holdStart-start))*smooth((end-phase)/(end-holdEnd));
}
// Endpoint-matched position path. Derivatives use phase, not render dt.
// Unlike blending toward a moving target, the release has a fixed endpoint.
export function createFootPlantPath(sample){
 const {start,holdStart,holdEnd,end}=footPlantSettings,epsilon=.001;
 const anchor=sample(holdStart),zero=new Vector3();
 const boundary=t=>{const p=sample(t),lo=sample(t-epsilon),hi=sample(t+epsilon);return {p,v:hi.clone().sub(lo).divideScalar(2*epsilon),a:hi.clone().add(lo).addScaledVector(p,-2).divideScalar(epsilon**2)};};
 const entry=boundary(start),exit=boundary(end);
 function bridge(p0,p1,v0,v1,a0,a1,u,duration){
  const d=p1.clone().sub(p0),v=v0.clone().multiplyScalar(duration),w=v1.clone().multiplyScalar(duration),a=a0.clone().multiplyScalar(duration**2),b=a1.clone().multiplyScalar(duration**2);
  return p0.clone().addScaledVector(v,u).addScaledVector(a,.5*u*u)
   .addScaledVector(d,10*u**3-15*u**4+6*u**5)
   .addScaledVector(v,-6*u**3+8*u**4-3*u**5).addScaledVector(w,-4*u**3+7*u**4-3*u**5)
   .addScaledVector(a,-1.5*u**3+1.5*u**4-.5*u**5).addScaledVector(b,.5*u**3-u**4+.5*u**5);
 }
 return phase=>phase<holdStart?bridge(entry.p,anchor,entry.v,zero,entry.a,zero,(phase-start)/(holdStart-start),holdStart-start)
  :phase<=holdEnd?anchor.clone():bridge(anchor,exit.p,zero,exit.v,zero,exit.a,(phase-holdEnd)/(end-holdEnd),end-holdEnd);
}
function world(b,q,model){b.quaternion.copy(rotation(b.parent).invert().multiply(q));model.updateMatrixWorld(true);}
function frame(direction,normal){
 const y=direction.clone().normalize(),z=normal.clone().normalize(),x=y.clone().cross(z).normalize();
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}
export function solve(model,hip,knee,foot,goal,footRotation,weight,referenceUpper,kneeX){
 const H=position(hip),K=position(knee),A=position(foot),a=H.distanceTo(K),b=K.distanceTo(A);
 const oldNormal=K.clone().sub(H).cross(A.clone().sub(K)).normalize();
 const oldHip=rotation(hip),oldKnee=rotation(knee),oldUpper=K.clone().sub(H),oldLower=A.clone().sub(K);
 const axis=goal.clone().sub(H),length=axis.length();axis.normalize();
 if(length>=a+b||length<=Math.abs(a-b))throw Error('Unreachable stance target');
 const bend=new Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize();
 if(weight<1){
  const originalBend=referenceUpper.clone().addScaledVector(axis,-referenceUpper.dot(axis)).normalize();
  const turn=new Quaternion().setFromUnitVectors(originalBend,bend);
  bend.copy(originalBend).applyQuaternion(new Quaternion().slerp(turn,weight));
 }
 const along=(a*a-b*b+length*length)/(2*length),height=Math.sqrt(Math.max(0,a*a-along*along));
 // Optional M48 constraint: select a point on the reachable knee circle by
 // frontal X. Legacy calls retain the original pole-vector behavior above.
 let kneeClamp=0;
 if(Number.isFinite(kneeX)){
  const u=new Vector3(1,0,0).addScaledVector(axis,-axis.x),span=height*u.length();u.normalize();
  const v=axis.clone().cross(u).normalize();if(v.z<0)v.negate();
  const centerX=H.x+axis.x*along,raw=(kneeX-centerX)/span,d=Math.max(-.999999,Math.min(.999999,raw));
  kneeClamp=(raw-d)*span;bend.copy(u).multiplyScalar(d).addScaledVector(v,Math.sqrt(1-d*d));
 }
 const desiredK=H.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 const upper=desiredK.clone().sub(H),lower=goal.clone().sub(desiredK),normal=upper.clone().cross(lower).normalize();
 world(hip,frame(upper,normal).multiply(frame(oldUpper,oldNormal).invert()).multiply(oldHip),model);
 world(knee,frame(lower,normal).multiply(frame(oldLower,oldNormal).invert()).multiply(oldKnee),model);
 world(foot,footRotation,model);
 return {kneeClamp};
}

// M42: evaluated from a fresh M40 pose. No render-time accumulation and no
// root translation. Freezing foot/toe orientation prevents a rotating sole
// from sliding around an otherwise stationary ankle during the short hold.
export function applyFootPlant(model,bones,anchor,weight,read){
 if(weight<=0)return {weight:0};
 const by=n=>bones.find(b=>b.name===n),hip=by('thigh_r'),knee=by('calf_r'),foot=by('foot_r'),toe=by('ball_r');
 const goal=position(foot).lerp(anchor.position,weight),floor=read('r').min*(1-weight)+anchor.floor*weight;
 goal.x=anchor.pathPosition.x;goal.z=anchor.pathPosition.z;
 const footQ=rotation(foot).slerp(anchor.rotation,weight),upper=position(knee).sub(position(hip));
 const toeQ=toe.quaternion.clone().slerp(anchor.toe,weight);
 for(let i=0;i<3;i++){
  solve(model,hip,knee,foot,goal,footQ,weight,upper);
  toe.quaternion.copy(toeQ);model.updateMatrixWorld(true);
  const residual=floor-read('r').min;
  if(Math.abs(residual)<1e-7)break;
  goal.y+=residual;
 }
 return {weight,ankle:position(foot).toArray(),target:goal.toArray()};
}

// M40: the uncorrected pelvis is the reference, never a follower of the foot.
// Only the stance leg rotates. Fixed hip/ankle positions determine knee flexion.
export function applyHipReference(model,bones,read,weight){
 if(weight<=0)return {weight:0};
 const by=n=>bones.find(b=>b.name===n),hip=by('thigh_r'),knee=by('calf_r'),foot=by('foot_r');
 const H=position(hip),K=position(knee),A=position(foot),footQ=rotation(foot),surface0=read('r');
 const targetX=surface0.center.x+weight*(H.x-surface0.center.x);
 const referenceUpper=K.clone().sub(H);
 let ankleX=A.x+targetX-surface0.center.x;
 for(let iteration=0;iteration<3;iteration++){
  solve(model,hip,knee,foot,new Vector3(ankleX,A.y,A.z),footQ,weight,referenceUpper);
  const residual=targetX-read('r').center.x;
  if(Math.abs(residual)<1e-7)break;
  ankleX+=residual;
 }
 const surface=read('r');
 return {weight,targetX,pelvisShift:[0,0,0],hip:H.toArray(),knee:position(knee).toArray(),ankle:position(foot).toArray(),surface:surface.center.toArray(),surfaceY:surface.min,alignmentError:surface.center.x-H.x};
}

// M36 uses weight=1. M37 varies the complete chain, never just the foot.
// The caller supplies a fresh baseline on every evaluation.
export function applyStanceChain(model,bones,read,weight=1,side='r',pelvisTranslationScale=1){
 if(weight<=0)return {weight:0};
 const by=n=>bones.find(b=>b.name===n),pelvis=by('pelvis'),hip=by('thigh_'+side),knee=by('calf_'+side),foot=by('foot_'+side);
 const H0=position(hip),K0=position(knee),A0=position(foot),P0=position(pelvis),footQ=rotation(foot),spineQ=rotation(by('spine_01'));
 const surface0=read(side),legLength=H0.distanceTo(A0),pelvisQ=rotation(pelvis);
 // Always right-to-left, including left support: reversing this adds 180 degrees.
 const lateral=position(by('thigh_l')).sub(position(by('thigh_r'))),roll=Math.atan2(lateral.y,lateral.x);
 world(pelvis,new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-roll*weight).multiply(pelvisQ),model);
 world(by('spine_01'),spineQ,model);
 const H1=position(hip),dx=(surface0.center.x-H1.x)*.5*weight;
 // Freeze the reviewed M38 landing target before reducing root translation.
 // Otherwise reducing pelvis sway would also move the foot target.
 const hipX=H1.x+dx;
 model.position.x+=dx*pelvisTranslationScale;model.updateMatrixWorld(true);
 const targetX=surface0.center.x+weight*(hipX-surface0.center.x);
 let ankleX=A0.x+targetX-surface0.center.x;
 const referenceUpper=position(knee).sub(position(hip));
 // Preserve the original knee flexion by keeping hip-to-ankle length. Moving
 // the foot alone would leave an incompatible knee plane/hip height.
 for(let iteration=0;iteration<3;iteration++){
  const H=position(hip),goal=new Vector3(ankleX,A0.y,A0.z);
  const verticalSquared=legLength**2-(goal.x-H.x)**2-(goal.z-H.z)**2;
  if(verticalSquared<=0)throw Error('No feasible pelvis height');
  model.position.y+=goal.y+Math.sqrt(verticalSquared)-H.y;model.updateMatrixWorld(true);
  solve(model,hip,knee,foot,goal,footQ,weight,referenceUpper);
  const residual=targetX-read(side).center.x;
  if(Math.abs(residual)<1e-7)break;
  ankleX+=residual;
 }
 const surface=read(side);
 return {weight,targetX,pelvisShift:position(pelvis).sub(P0).toArray(),rollChange:-roll*weight,hip:position(hip).toArray(),knee:position(knee).toArray(),ankle:position(foot).toArray(),surface:surface.center.toArray(),surfaceY:surface.min,alignmentError:surface.center.x-position(hip).x,original:{hip:H0.toArray(),knee:K0.toArray(),ankle:A0.toArray(),surface:surface0.center.toArray()}};
}
