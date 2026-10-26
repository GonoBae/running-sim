import * as THREE from 'three';
import data from './data/reference-leg.json';

// Isolated diagnostic playback. These are source angles, not user-editable policy limits.
export const referenceLegData=data;
const closed=(values:number[])=>{
  if(values.length!==150||values.some(v=>!Number.isFinite(v)))throw Error('Invalid reference curve');
  const result=[...values],seam=(result[0]+result.at(-1)!)/2;
  result[0]=seam;result[result.length-1]=seam;return result;
};
const thigh=closed(data.curves.thigh),knee=closed(data.curves.knee);
export const referenceClosure={thigh:Math.abs(thigh[0]-data.curves.thigh[0]),knee:Math.abs(knee[0]-data.curves.knee[0])};
export function sampleReferenceLeg(phase:number){
  if(!Number.isFinite(phase)||phase<0||phase>1)throw Error('Invalid reference phase');
  const index=phase*(thigh.length-1),i=Math.min(Math.floor(index),thigh.length-2),mix=index-i;
  return {phase,thigh:THREE.MathUtils.lerp(thigh[i],thigh[i+1],mix),knee:THREE.MathUtils.lerp(knee[i],knee[i+1],mix)};
}
export function createReferenceLegMotion(model:THREE.Group,bones:THREE.Bone[]){
  const find=(name:string)=>{const b=bones.find(b=>b.name===name);if(!b||!b.parent)throw Error('Missing reference bone: '+name);return b;};
  const hip=find('thigh_l'),calf=find('calf_l'),foot=find('foot_l');
  const base=[hip.quaternion.clone(),calf.quaternion.clone()];
  let state:'idle'|'playing'|'paused'='idle',elapsed=0,lastNow=0;
  let frame:ReturnType<typeof sampleReferenceLeg>|undefined;
  const p=(b:THREE.Bone)=>b.getWorldPosition(new THREE.Vector3());
  function restore(){hip.quaternion.copy(base[0]);calf.quaternion.copy(base[1]);model.updateMatrixWorld(true);}
  function stop(){restore();state='idle';elapsed=0;frame=undefined;}
  function aim(bone:THREE.Bone,child:THREE.Bone,direction:THREE.Vector3){
    const current=p(child).sub(p(bone));if(current.lengthSq()<1e-12)throw Error('Zero reference segment');
    const world=bone.getWorldQuaternion(new THREE.Quaternion()),parent=bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    const delta=new THREE.Quaternion().setFromUnitVectors(current.normalize(),direction);
    bone.quaternion.copy(parent.invert().multiply(delta).multiply(world)).normalize();model.updateMatrixWorld(true);
  }
  function render(phase:number){
    try{
      const next=sampleReferenceLeg(phase);restore();
      const hipAngle=THREE.MathUtils.degToRad(next.thigh),shinAngle=THREE.MathUtils.degToRad(next.thigh-next.knee);
      aim(hip,calf,new THREE.Vector3(0,-Math.cos(hipAngle),Math.sin(hipAngle)));
      aim(calf,foot,new THREE.Vector3(0,-Math.cos(shinAngle),Math.sin(shinAngle)));
      frame=next;
    }catch(error){stop();throw error;}
  }
  function tick(now:number){
    if(state!=='playing')return;
    if(!Number.isFinite(now)){stop();throw Error('Invalid playback time');}
    elapsed+=Math.max(0,now-lastNow);lastNow=now;render((elapsed%data.periodMs)/data.periodMs);
  }
  return {
    get state(){return state;},get frame(){return frame?{...frame}:undefined;},
    get baseline(){return base.map(q=>q.clone());},
    start(now:number){
      if(!Number.isFinite(now))throw Error('Invalid playback time');
      if(state==='playing')return;
      lastNow=now;render((elapsed%data.periodMs)/data.periodMs);state='playing';
    },
    pause(now:number){if(state==='playing'){tick(now);state='paused';}},
    seek(phase:number){sampleReferenceLeg(phase);render(phase);elapsed=phase*data.periodMs;state='paused';},
    measure(){
      const leg=p(calf).sub(p(hip)),shin=p(foot).sub(p(calf));
      return {thigh:Math.atan2(leg.z,-leg.y)*180/Math.PI,knee:THREE.MathUtils.radToDeg(leg.angleTo(shin))};
    },stop,tick,
  };
}
