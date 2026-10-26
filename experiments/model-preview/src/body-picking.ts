import * as THREE from 'three';

/** Ray tests against the visible, deformed skin. Helpers and selection overlays never occlude/pick. */
export function createBodyPicking(camera:THREE.PerspectiveCamera){
  let owner:THREE.Group|undefined;
  let meshes:THREE.Mesh[]=[],surfaces:THREE.Mesh[]=[],overlays:THREE.SkinnedMesh[]=[];
  let signature:number[]=[],cameraSignature='';
  const ray=new THREE.Raycaster(),cache=new Map<string,THREE.Intersection|undefined>();
  function vertexWeight(mesh:THREE.SkinnedMesh,index:number,accept:(name:string)=>boolean){
    const ids=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    if(!ids||!weights)return 0;
    let weight=0;
    for(let j=0;j<4;j++)if(accept(mesh.skeleton.bones[ids.getComponent(index,j)]?.name??''))weight+=weights.getComponent(index,j);
    return weight;
  }
  function influence(hit:THREE.Intersection,accept:(name:string)=>boolean){
    const mesh=hit.object as THREE.SkinnedMesh,face=hit.face;
    if(!mesh.isSkinnedMesh||!face)return 0;
    const bary=hit.barycoord??new THREE.Vector3(1/3,1/3,1/3);
    return vertexWeight(mesh,face.a,accept)*bary.x+vertexWeight(mesh,face.b,accept)*bary.y+vertexWeight(mesh,face.c,accept)*bary.z;
  }
  function clear(){
    for(const mesh of overlays){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}
    for(const mesh of surfaces)mesh.geometry.dispose();
    overlays=[];meshes=[];surfaces=[];signature=[];cache.clear();
  }
  function update(model:THREE.Group|undefined){
    if(model!==owner){
      clear();owner=model;
      model?.traverse(node=>{if((node as THREE.Mesh).isMesh&&!node.userData.selectionOverlay)meshes.push(node as THREE.Mesh);});
      for(const source of meshes){
        // Skin each vertex once per pose, then reuse that exact surface for both visibility rays and picking.
        const surfaceGeometry=new THREE.BufferGeometry();
        surfaceGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(source.geometry.attributes.position.count*3),3));
        surfaceGeometry.setIndex(source.geometry.index);surfaceGeometry.groups=source.geometry.groups.map(g=>({...g}));
        surfaceGeometry.setDrawRange(source.geometry.drawRange.start,source.geometry.drawRange.count);
        const surface=new THREE.Mesh(surfaceGeometry,source.material);surface.matrixAutoUpdate=false;surface.userData.pickSource=source;surfaces.push(surface);
        const mesh=source as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)continue;
        const geometry=new THREE.BufferGeometry(),indices:number[]=[];
        for(const [name,attribute] of Object.entries(mesh.geometry.attributes))geometry.setAttribute(name,attribute);
        geometry.morphAttributes=mesh.geometry.morphAttributes;geometry.morphTargetsRelative=mesh.geometry.morphTargetsRelative;
        const index=mesh.geometry.index,count=index?.count??mesh.geometry.attributes.position.count;
        for(let i=0;i<count;i+=3){
          const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
          if(ids.reduce((sum,id)=>sum+vertexWeight(mesh,id,n=>n==='lowerarm_r'),0)/3>=.5)indices.push(...ids);
        }
        if(!indices.length){geometry.dispose();continue;}
        geometry.setIndex(indices);
        const material=new THREE.MeshBasicMaterial({color:'#e78035',transparent:true,opacity:.38,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
        const overlay=new THREE.SkinnedMesh(geometry,material);
        overlay.morphTargetInfluences=mesh.morphTargetInfluences;
        overlay.name='right-forearm-selection';overlay.userData.selectionOverlay=true;
        overlay.bind(mesh.skeleton,mesh.bindMatrix);overlay.frustumCulled=false;overlay.visible=false;overlay.renderOrder=1;
        mesh.add(overlay);overlays.push(overlay);
      }
    }
    model?.updateMatrixWorld(true);camera.updateMatrixWorld();
    const next:number[]=[];
    for(const m of meshes){
      const position=m.geometry.attributes.position;
      next.push(...m.matrixWorld.elements,position instanceof THREE.InterleavedBufferAttribute?position.data.version:position.version,m.visible?1:0);
      next.push(...(m.morphTargetInfluences??[]));
      const s=m as THREE.SkinnedMesh;
      if(s.isSkinnedMesh)for(const b of s.skeleton.bones)next.push(...b.matrixWorld.elements);
    }
    if(next.length!==signature.length||next.some((n,i)=>n!==signature[i])){
      signature=next;cache.clear();
      for(const [i,mesh] of meshes.entries()){
        const skin=mesh as THREE.SkinnedMesh;
        if(skin.isSkinnedMesh)skin.skeleton.update();
        const surface=surfaces[i],position=surface.geometry.attributes.position as THREE.BufferAttribute,v=new THREE.Vector3();
        for(let j=0;j<position.count;j++){mesh.getVertexPosition(j,v);position.setXYZ(j,v.x,v.y,v.z);}
        position.needsUpdate=true;surface.matrixWorld.copy(mesh.matrixWorld);
        surface.geometry.computeBoundingSphere();surface.geometry.computeBoundingBox();
      }
    }
    const cameraNext=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
    if(cameraNext!==cameraSignature){cache.clear();cameraSignature=cameraNext;}
  }
  function first(point:THREE.Vector2){
    if(!owner)return undefined;
    const key=`${point.x},${point.y}`;
    if(cache.has(key))return cache.get(key);
    ray.setFromCamera(point,camera);ray.near=camera.near;ray.far=camera.far;
    const visible=surfaces.filter(m=>{let n:THREE.Object3D|null=m.userData.pickSource;while(n){if(!n.visible)return false;n=n.parent;}return true;});
    const hit=ray.intersectObjects(visible,false)[0];
    if(hit)hit.object=hit.object.userData.pickSource as THREE.Mesh;
    if(cache.size>32)cache.clear();cache.set(key,hit);return hit;
  }
  return {update,
    isRightForearm(point:THREE.Vector2){const hit=first(point);return !!hit&&influence(hit,n=>n==='lowerarm_r')>=.6;},
    jointVisible(side:'l'|'r',bone:THREE.Bone,hand:THREE.Bone){
      const p=bone.getWorldPosition(new THREE.Vector3()),screen=p.clone().project(camera);
      if(screen.z< -1||screen.z>1||Math.abs(screen.x)>1||Math.abs(screen.y)>1)return false;
      const hit=first(new THREE.Vector2(screen.x,screen.y));if(!hit)return false;
      const reach=p.distanceTo(hand.getWorldPosition(new THREE.Vector3()))*.45;
      return hit.point.distanceTo(p)<reach&&influence(hit,n=>n===`lowerarm_${side}`||n===`upperarm_${side}`)>=.55;
    },
    highlight(on:boolean){for(const mesh of overlays)mesh.visible=on;},
    clear,
  };
}
