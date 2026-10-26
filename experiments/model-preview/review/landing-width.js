import {Vector3,Quaternion} from 'three';
import {supportWindows} from './ground-contact.js';

// M33 isolated experiment: no constant abduction, no pelvis translation.
export const landingWidthSettings={start:.28,end:.58,fade:.06,amounts:[0,.02,.04]};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export function landingWeight(phase,side='r'){
 const {start,end}=supportWindows['35_17'].find(w=>w.side===side),{fade}=landingWidthSettings;
 phase=((phase%1)+1)%1;
 if(end>1&&phase<start)phase+=1;
 if(phase<=start||phase>=end)return 0;
 return smooth((phase-start)/fade)*smooth((end-phase)/fade);
}
const position=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion());
function setWorld(b,q,model){b.quaternion.copy(rotation(b.parent).invert().multiply(q));model.updateMatrixWorld(true);}

// Call on a fresh baseline pose on every evaluation. Keep the original knee
// bend plane, solve the two segment lengths, then retain the foot's world frame.
export function applyLandingWidth(model,bones,phase,amount,side='r'){
 const weight=landingWeight(phase,side),distance=weight*amount,sign=side==='r'?-1:1;
 if(!distance)return {weight,requested:0,applied:0,limited:false};
 const by=n=>bones.find(b=>b.name===n),hip=by('thigh_'+side),knee=by('calf_'+side),foot=by('foot_'+side);
 const H=position(hip),K=position(knee),A=position(foot),footWorld=rotation(foot);
 const a=H.distanceTo(K),b=K.distanceTo(A),goal=A.clone().add(new Vector3(sign*distance,0,0));
 const axis=goal.clone().sub(H),requestedLength=axis.length();axis.normalize();
 const length=Math.max(Math.abs(a-b)+1e-7,Math.min(a+b-1e-7,requestedLength));
 const limited=Math.abs(length-requestedLength)>1e-8;
 if(limited)goal.copy(H).addScaledVector(axis,length);
 const bend=K.clone().sub(H).addScaledVector(axis,-K.clone().sub(H).dot(axis));
 if(bend.lengthSq()<1e-12){bend.set(0,0,1).addScaledVector(axis,-axis.z);if(bend.lengthSq()<1e-12)bend.set(1,0,0).addScaledVector(axis,-axis.x);}
 bend.normalize();
 const along=(a*a-b*b+length*length)/(2*length),height=Math.sqrt(Math.max(0,a*a-along*along));
 const targetKnee=H.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 const hipDelta=new Quaternion().setFromUnitVectors(K.clone().sub(H).normalize(),targetKnee.clone().sub(H).normalize());
 setWorld(hip,hipDelta.multiply(rotation(hip)),model);
 const currentK=position(knee),currentA=position(foot);
 const kneeDelta=new Quaternion().setFromUnitVectors(currentA.sub(currentK).normalize(),goal.clone().sub(currentK).normalize());
 setWorld(knee,kneeDelta.multiply(rotation(knee)),model);
 setWorld(foot,footWorld,model);
 return {weight,requested:distance,applied:sign*(position(foot).x-A.x),limited,target:goal.toArray(),error:position(foot).distanceTo(goal)};
}
