import * as THREE from 'three';
import {defaults, type Settings, type Category} from './settings';
import {poseDefinitionVersion, validatePoseValues, type PoseResult} from './pose-values';

// Preview limits, not population-wide anatomical ranges or clinical guidance.
export const joints = (['l', 'r'] as const).flatMap(side => {
  const label = side === 'l' ? '왼쪽' : '오른쪽';
  return [
    {id:`upperarm_${side}`, label:`${label} 어깨`, action:'팔 앞뒤 움직임', min:-25, max:45, initial:0, range:'뒤로 25° ~ 앞으로 45°', reference:'0°는 팔을 몸 옆으로 내린 자세입니다.'},
    {id:`lowerarm_${side}`, label:`${label} 팔꿈치`, action:'팔 굽히기', min:45, max:120, initial:80, range:'굽힘 45° ~ 120°', reference:'팔을 편 상태가 0°입니다. 앞으로 굽히는 방향만 허용합니다.'},
    {id:`thigh_${side}`, label:`${label} 고관절`, action:'다리 앞뒤 움직임', min:-15, max:65, initial:0, range:'뒤로 15° ~ 앞으로 65°', reference:'0°는 허벅지가 아래로 향한 자세입니다.'},
    {id:`calf_${side}`, label:`${label} 무릎`, action:'무릎 굽히기', min:0, max:120, initial:5, range:'굽힘 0° ~ 120°', reference:'다리를 편 상태가 0°입니다. 뒤로 접히는 방향만 허용합니다.'},
  ];
});
export const verifiedModelHash = '6fb12de1c339ab304588702507125a7799e78916f0628c779e163a24269268f2';

export function createRunningPose(model: THREE.Group, bones: THREE.Bone[], settings:Settings=defaults()) {
  const byName = new Map(bones.map(b=>[b.name,b]));
  const required = ['upperarm','lowerarm','hand','thigh','calf','foot'].flatMap(n=>[`${n}_l`,`${n}_r`]);
  if (required.some(n=>!byName.has(n))) return undefined;
  const base = bones.map(b=>b.quaternion.clone());
  model.updateMatrixWorld(true);
  // Keep the asset's neutral foot orientation; ankle-to-toe is not a sole plane.
  const rootInverse=model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const neutralFeet=Object.fromEntries(['l','r'].map(side=>[side,rootInverse.clone().multiply(byName.get(`foot_${side}`)!.getWorldQuaternion(new THREE.Quaternion())).normalize()]));
  const configured=joints.map(j=>{
    const config=settings.categories[j.id.split('_')[0] as Category];
    return {...j,...config, label:j.label,range:`${config.min}° ~ ${config.max}°`};
  });
  const values = Object.fromEntries(configured.map(j=>[j.id,j.initial]));
  const p = (name: string) => byName.get(name)!.getWorldPosition(new THREE.Vector3());
  // The verified asset faces +Z, with +Y up. Align segments in this frame,
  // rather than treating the rig's arbitrary local X/Y/Z as anatomical axes.
  function aim(name: string, child: string, direction: THREE.Vector3) {
    const b = byName.get(name)!;
    const current = p(child).sub(p(name)).normalize();
    const world = b.getWorldQuaternion(new THREE.Quaternion());
    const parent = b.parent!.getWorldQuaternion(new THREE.Quaternion());
    const delta = new THREE.Quaternion().setFromUnitVectors(current,direction);
    b.quaternion.copy(parent.invert().multiply(delta).multiply(world)).normalize();
    model.updateMatrixWorld(true);
  }
  function flex(direction: THREE.Vector3, forward: number, degrees: number) {
    const bend = new THREE.Vector3(0,0,forward);
    bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const angle = THREE.MathUtils.degToRad(degrees);
    return direction.clone().multiplyScalar(Math.cos(angle)).addScaledVector(bend,Math.sin(angle)).normalize();
  }
  const direction = (angle: number, lateral: number) => {
    const rad = THREE.MathUtils.degToRad(angle);
    const sagittal = Math.sqrt(1-lateral*lateral);
    return new THREE.Vector3(lateral,-Math.cos(rad)*sagittal,Math.sin(rad)*sagittal);
  };
  function apply(frameValues=values, compactStride=false) {
    // Recompute from the saved rest state: no accumulated rotations or unlocked axes.
    bones.forEach((b,i)=>b.quaternion.copy(base[i]));
    model.updateMatrixWorld(true);
    for(const side of ['l','r']) {
      const sign = side==='l'?1:-1;
      const arm = direction(frameValues[`upperarm_${side}`],sign*Math.sin(THREE.MathUtils.degToRad(compactStride?6:12)));
      aim(`upperarm_${side}`,`lowerarm_${side}`,arm);
      aim(`lowerarm_${side}`,`hand_${side}`,flex(arm,1,frameValues[`lowerarm_${side}`]));
      // Keep each leg in the forward/back plane beneath its own hip.
      // A fixed outward tilt widened the stance further with each leg segment.
      const leg = direction(frameValues[`thigh_${side}`],0);
      aim(`thigh_${side}`,`calf_${side}`,leg);
      aim(`calf_${side}`,`foot_${side}`,flex(leg,-1,frameValues[`calf_${side}`]));
    }
  }
  function applyCandidate(candidate:unknown, continuous=false,compactStride=false):PoseResult {
      const checked=validatePoseValues(candidate,configured,continuous);
      if (!checked.ok) return checked;
      const previous={...values}, rotations=bones.map(b=>b.quaternion.clone());
      // Preserve matrix caches too: rollback must not invoke a failing update again.
      const matrices:{node:THREE.Object3D; local:THREE.Matrix4; world:THREE.Matrix4; dirty:boolean}[]=[];
      model.traverse(node=>matrices.push({node,local:node.matrix.clone(),world:node.matrixWorld.clone(),dirty:node.matrixWorldNeedsUpdate}));
      try {
        if(!continuous)Object.assign(values,checked.values);
        apply(checked.values,compactStride);
        return {ok:true};
      } catch {
        Object.assign(values,previous);
        bones.forEach((b,i)=>b.quaternion.copy(rotations[i]));
        matrices.forEach(({node,local,world,dirty})=>{
          node.matrix.copy(local);node.matrixWorld.copy(world);node.matrixWorldNeedsUpdate=dirty;
        });
        return {ok:false,reason:'apply-failed'};
      }
  }
  return {
    definitionVersion:poseDefinitionVersion,
    settingsRevision:settings.revision,
    definitions:configured.filter(j=>j.enabled),
    values,
    neutralFootRotation:(side:'l'|'r')=>neutralFeet[side].clone(),
    apply:()=>apply(),
    validate(candidate:unknown) {return validatePoseValues(candidate,configured);},
    restore:(candidate:unknown)=>applyCandidate(candidate),
    // Generated frames may be fractional; editing and snapshot contracts stay integer-only.
    applyFrame:(candidate:unknown)=>applyCandidate(candidate,true),
    // Baseline run uses a narrow arm swing without changing edit values or bone lengths.
    applyRunFrame:(candidate:unknown)=>applyCandidate(candidate,true,true),
    set(id: string, value: number) {
      const joint = configured.find(j=>j.id===id);
      if (!joint || !joint.enabled || !Number.isFinite(value)) return false;
      values[id] = THREE.MathUtils.clamp(Math.round(value),joint.min,joint.max);
      apply();return true;
    },
    reset() {configured.forEach(j=>{values[j.id]=j.initial;});apply();},
  };
}
