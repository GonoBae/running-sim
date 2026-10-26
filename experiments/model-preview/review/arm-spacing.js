import {Quaternion,Vector3,MathUtils} from 'three';

// Visual spacing setting for the default rigs, not a recommended running angle.
export const minimumOutwardDegrees=14;
export function separateArms(model,bones){
  const by=name=>bones.find(b=>b.name===name),p=b=>b.getWorldPosition(new Vector3());
  const left=by('upperarm_l'),right=by('upperarm_r');
  const lateral=p(left).sub(p(right)).normalize();
  const up=p(by('neck_01')).sub(p(by('pelvis'))).normalize();
  const forward=lateral.clone().cross(up).normalize();
  const chestUp=forward.clone().cross(lateral).normalize();
  const setWorld=(b,q)=>{b.quaternion.copy(b.parent.getWorldQuaternion(new Quaternion()).invert().multiply(q));model.updateMatrixWorld(true);};
  const results=[];
  for(const side of ['l','r']){
    const upper=by('upperarm_'+side),lower=by('lowerarm_'+side),hand=by('hand_'+side);
    const direction=p(lower).sub(p(upper)).normalize(),outward=lateral.clone().multiplyScalar(side==='l'?1:-1);
    const sideways=direction.dot(outward),sagittal=direction.clone().addScaledVector(outward,-sideways);
    if(sagittal.lengthSq()<1e-8)continue;
    const angle=Math.asin(MathUtils.clamp(sideways,-1,1)),minimum=MathUtils.degToRad(minimumOutwardDegrees);
    // Smooth lower bound: retain already-wide motion, avoid a derivative corner.
    const d=angle-minimum,next=minimum+.5*(d+Math.sqrt(d*d+.01**2));
    const target=sagittal.normalize().multiplyScalar(Math.cos(next)).addScaledVector(outward,Math.sin(next));
    const lowerRotation=lower.getWorldQuaternion(new Quaternion()),handRotation=hand.getWorldQuaternion(new Quaternion());
    const rotation=new Quaternion().setFromUnitVectors(direction,target).multiply(upper.getWorldQuaternion(new Quaternion()));
    setWorld(upper,rotation);setWorld(lower,lowerRotation);setWorld(hand,handRotation);
    results.push({side,beforeDegrees:MathUtils.radToDeg(angle),afterDegrees:MathUtils.radToDeg(next)});
  }
  return {results,lateral:lateral.toArray(),up:chestUp.toArray(),forward:forward.toArray()};
}
