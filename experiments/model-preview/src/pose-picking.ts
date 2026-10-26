import * as T from 'three';

export type PosePart={id:'leg'|'elbow';side:'l'|'r'}|{id:'lean';side:'center'};
export const poseParts:PosePart[]=[{id:'leg',side:'r'},{id:'elbow',side:'r'},{id:'leg',side:'l'},{id:'elbow',side:'l'},{id:'lean',side:'center'}];
const accepts=(part:PosePart,name:string)=>part.id==='lean'?/^spine_0[123]$/.test(name):part.id==='elbow'?name===`lowerarm_${part.side}`:name===`thigh_${part.side}`||name===`calf_${part.side}`;

/** CPU surfaces are private picking copies, never added to the scene or rig.
 * Skin each vertex once per sampled pose; reuse for all visibility rays. */
export function createPosePicking(camera:T.Camera){
 let owner:T.Group|undefined,signature:number[]=[];
 const surfaces:T.Mesh[]=[],sources:T.Mesh[]=[],ray=new T.Raycaster();
 function clear(){for(const s of surfaces)s.geometry.dispose();surfaces.length=sources.length=signature.length=0;owner=undefined;}
 function update(model:T.Group){
  if(owner!==model){
   clear();owner=model;model.traverse(o=>{if((o as T.Mesh).isMesh)sources.push(o as T.Mesh);});
   for(const mesh of sources){const geometry=new T.BufferGeometry();geometry.setIndex(mesh.geometry.index);
    geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count*3),3));
    geometry.groups=mesh.geometry.groups.map(g=>({...g}));geometry.setDrawRange(mesh.geometry.drawRange.start,mesh.geometry.drawRange.count);
    const surface=new T.Mesh(geometry,mesh.material);surface.matrixAutoUpdate=false;surfaces.push(surface);
   }
  }
  model.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const next:number[]=[];
  for(const mesh of sources){const pos=mesh.geometry.attributes.position;next.push(...mesh.matrixWorld.elements,pos instanceof T.InterleavedBufferAttribute?pos.data.version:pos.version,...(mesh.morphTargetInfluences??[]));
   if((mesh as T.SkinnedMesh).isSkinnedMesh)for(const b of (mesh as T.SkinnedMesh).skeleton.bones)next.push(...b.matrixWorld.elements);
  }
  if(next.length===signature.length&&next.every((n,i)=>n===signature[i]))return;
  signature=next;const v=new T.Vector3();
  sources.forEach((mesh,i)=>{const surface=surfaces[i],pos=surface.geometry.attributes.position as T.BufferAttribute;
   if((mesh as T.SkinnedMesh).isSkinnedMesh)(mesh as T.SkinnedMesh).skeleton.update();
   for(let j=0;j<pos.count;j++){mesh.getVertexPosition(j,v);pos.setXYZ(j,v.x,v.y,v.z);}
   pos.needsUpdate=true;surface.matrixWorld.copy(mesh.matrixWorld);surface.geometry.computeBoundingSphere();surface.geometry.computeBoundingBox();
  });
 }
 function at(ndc:T.Vector2):PosePart|undefined{
  const visible=surfaces.filter((_,i)=>{let o:T.Object3D|null=sources[i];while(o){if(!o.visible)return false;o=o.parent;}return true;});
  ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects(visible,false)[0];if(!hit?.face)return;
  const source=sources[surfaces.indexOf(hit.object as T.Mesh)] as T.SkinnedMesh;if(!source.isSkinnedMesh)return;
  const indices=source.geometry.attributes.skinIndex,weights=source.geometry.attributes.skinWeight,bary=hit.barycoord??new T.Vector3(1/3,1/3,1/3);
  let best:PosePart|undefined,maximum=.55;
  for(const part of poseParts){let sum=0;
   [hit.face.a,hit.face.b,hit.face.c].forEach((vertex,i)=>{for(let slot=0;slot<4;slot++)if(accepts(part,source.skeleton.bones[indices.getComponent(vertex,slot)].name))sum+=weights.getComponent(vertex,slot)*bary.getComponent(i);});
   if(sum>maximum){maximum=sum;best=part;}
  }
  return best;
 }
 return {update,at,clear};
}
