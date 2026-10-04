import * as THREE from 'three';

export const lengthFields = [
  {id:'upperArm',label:'위팔 길이',reference:'어깨 관절 중심 → 팔꿈치 관절 중심'},
  {id:'forearm',label:'아래팔 길이',reference:'팔꿈치 관절 중심 → 손목 관절 중심'},
  {id:'thigh',label:'허벅지 길이',reference:'고관절 중심 → 무릎 관절 중심'},
  {id:'shin',label:'종아리 길이',reference:'무릎 관절 중심 → 발목 관절 중심'},
  {id:'torso',label:'몸통 길이',reference:'골반 → 목 시작점의 관절 연결 길이 합'},
  {id:'shoulders',label:'어깨너비',reference:'왼쪽 어깨 관절 중심 ↔ 오른쪽 어깨 관절 중심'},
] as const;
export type LengthId=typeof lengthFields[number]['id'];
const segments={upperArm:['upperarm','lowerarm'],forearm:['lowerarm','hand'],thigh:['thigh','calf'],shin:['calf','foot']} as const;
const spine=['pelvis','spine_01','spine_02','spine_03','neck_01'];
export const bodyRecipe='rest-lengths-v1';

/** Rebuild an unposed mesh and its bind skeleton together, never scale posed bones.
 * Each weighted vertex follows the same affine rest-space deformation as its bone.
 * Always rebuild from immutable imported geometry; successive edits cannot accumulate.
 */
export function createBodyDimensions(model:THREE.Group,bones:THREE.Bone[],enabled:Record<LengthId,boolean>){
  const names=new Map(bones.map(b=>[b.name,b]));
  const required=[...spine,...['upperarm','lowerarm','hand','thigh','calf','foot','clavicle'].flatMap(n=>[n+'_l',n+'_r'])];
  if(required.some(n=>!names.has(n)))return undefined;
  model.updateMatrixWorld(true);
  const originalPosition=model.position.clone(),originalScale=model.scale.clone();
  const rest=new Map(bones.map(b=>[b,{position:b.position.clone(),rotation:b.quaternion.clone(),world:b.matrixWorld.clone()}]));
  const point=(name:string)=>names.get(name)!.getWorldPosition(new THREE.Vector3());
  const measure=()=>{
    const result={} as Record<LengthId,number>;
    for(const [id,[parent,child]] of Object.entries(segments)){
      result[id as LengthId]=(['l','r'].reduce((sum,side)=>sum+point(parent+'_'+side).distanceTo(point(child+'_'+side)),0)/2)*100;
    }
    result.torso=spine.slice(1).reduce((sum,name,i)=>sum+point(spine[i]).distanceTo(point(name)),0)*100;
    result.shoulders=point('upperarm_l').distanceTo(point('upperarm_r'))*100;
    return result;
  };
  const baseline=measure();
  const ratios=Object.fromEntries(lengthFields.map(f=>[f.id,1])) as Record<LengthId,number>;
  const meshes: {mesh:THREE.SkinnedMesh;points:THREE.Vector3[]}[]=[];
  model.traverse(object=>{
    const mesh=object as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
    mesh.skeleton.update();
    const points=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())));
    meshes.push({mesh,points});
  });
  if(!meshes.length||Object.values(baseline).some(n=>!Number.isFinite(n)||n<=0))return undefined;
  const oldFloor=Math.min(...meshes.flatMap(m=>m.points.map(p=>p.y)));
  let referenceHeight=new THREE.Box3().setFromObject(model,true).getSize(new THREE.Vector3()).y;
  let anchorPosition=model.position.clone();
  // Only explicit segment edges affect longitudinal skin stretch. Hand/head size stays fixed.
  const edges=new Map<THREE.Bone,THREE.Bone>();
  for(const [parent,child] of Object.values(segments))for(const side of ['l','r'])edges.set(names.get(parent+'_'+side)!,names.get(child+'_'+side)!);
  for(let i=0;i<spine.length-1;i++)edges.set(names.get(spine[i])!,names.get(spine[i+1])!);
  for(const side of ['l','r'])edges.set(names.get('clavicle_'+side)!,names.get('upperarm_'+side)!);
  function rebuild(){
    model.position.copy(originalPosition);model.scale.copy(originalScale);
    for(const [bone,saved] of rest){bone.position.copy(saved.position);bone.quaternion.copy(saved.rotation);}
    for(const [id,[,child]] of Object.entries(segments))for(const side of ['l','r'])names.get(child+'_'+side)!.position.multiplyScalar(ratios[id as LengthId]);
    for(const name of spine.slice(1))names.get(name)!.position.multiplyScalar(ratios.torso);
    // Shoulder branches start at the top of the same elongated torso.
    for(const side of ['l','r'])names.get('clavicle_'+side)!.position.multiplyScalar(ratios.torso);
    model.updateMatrixWorld(true);
    const left=point('upperarm_l'),right=point('upperarm_r'),center=left.clone().add(right).multiplyScalar(.5);
    const width=left.clone().sub(right).normalize().multiplyScalar(baseline.shoulders/100*ratios.shoulders/2);
    for(const [side,sign] of [['l',1],['r',-1]] as const){
      const b=names.get('upperarm_'+side)!;
      b.position.copy(b.parent!.worldToLocal(center.clone().addScaledVector(width,sign)));
    }
    model.updateMatrixWorld(true);
    const transforms=new Map<THREE.Bone,THREE.Matrix4>();
    for(const [bone,saved] of rest){
      const stretch=new THREE.Matrix4(),child=edges.get(bone);
      if(child){
        const from=rest.get(child)!.position,to=child.position,delta=to.clone().sub(from),denom=from.lengthSq();
        if(denom>1e-12){const a=from.toArray(),d=delta.toArray();for(let row=0;row<3;row++)for(let col=0;col<3;col++)stretch.elements[col*4+row]+=(d[row]*a[col])/denom;}
      }
      transforms.set(bone,bone.matrixWorld.clone().multiply(stretch).multiply(saved.world.clone().invert()));
    }
    for(const {mesh,points} of meshes){
      const geometry=mesh.geometry,positions=geometry.attributes.position,weights=geometry.attributes.skinWeight,indices=geometry.attributes.skinIndex;
      const inverseMesh=mesh.matrixWorld.clone().invert();
      const matrices=mesh.skeleton.bones.map(b=>transforms.get(b)!);
      const result=new THREE.Vector3(),temp=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        result.set(0,0,0);
        for(let slot=0;slot<4;slot++){
          const weight=weights.getComponent(i,slot);if(!weight)continue;
          temp.copy(points[i]).applyMatrix4(matrices[indices.getComponent(i,slot)]);result.addScaledVector(temp,weight);
        }
        result.applyMatrix4(inverseMesh);positions.setXYZ(i,result.x,result.y,result.z);
      }
      // Imported morphs are now baked into these rest vertices, not reapplied twice.
      geometry.morphAttributes={};mesh.morphTargetInfluences=[];mesh.morphTargetDictionary={};
      positions.needsUpdate=true;geometry.computeVertexNormals();
      // GLB duplicates vertices at UV seams. Share smooth normals across identical source points.
      const groups=new Map<string,number[]>();
      points.forEach((p,i)=>{const key=p.toArray().map(n=>n.toFixed(7)).join(',');const group=groups.get(key)??[];group.push(i);groups.set(key,group);});
      const normal=geometry.attributes.normal;
      for(const group of groups.values())if(group.length>1){result.set(0,0,0);for(const i of group)result.add(temp.fromBufferAttribute(normal,i));result.normalize();for(const i of group)normal.setXYZ(i,result.x,result.y,result.z);}
      normal.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
      mesh.skeleton.calculateInverses();mesh.bind(mesh.skeleton,mesh.matrixWorld);mesh.skeleton.update();
      mesh.computeBoundingBox();mesh.computeBoundingSphere();
    }
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model,true);
    referenceHeight=bounds.max.y-bounds.min.y;
    model.position.y+=oldFloor-bounds.min.y;anchorPosition=model.position.clone();
    model.updateMatrixWorld(true);
  }
  return {
    baseline,ratios,measure,
    get referenceHeight(){return referenceHeight;},
    get anchorPosition(){return anchorPosition.clone();},
    set(id:LengthId,centimeters:number,scale=1){
      if(!enabled[id]||!Number.isFinite(centimeters)||!Number.isFinite(scale)||scale<=0)return false;
      ratios[id]=THREE.MathUtils.clamp(centimeters/(baseline[id]*scale),.85,1.15);
      rebuild();return true;
    },
    reset(){for(const f of lengthFields)ratios[f.id]=1;rebuild();},
  };
}
