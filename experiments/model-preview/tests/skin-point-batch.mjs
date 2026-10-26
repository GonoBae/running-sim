import assert from 'node:assert/strict';
import * as T from 'three';
import {createSkinPointBatch} from '../review/skin-point-batch.js';

// Independent oracle is Three's public SkinnedMesh.getVertexPosition(), not a
// second copy of the optimized formula. Mutations must be seen on every batch.
let maxError=0,checks=0;
for(const relative of [false,true])for(const normalized of [false,true]){
 const geometry=new T.BufferGeometry(),count=24;
 const positions=Array.from({length:count*3},(_,i)=>Math.sin(i*.31)*.4);
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(Array.from({length:count*4},(_,i)=>i%4),4));
 geometry.setAttribute('skinWeight',normalized?new T.Uint8BufferAttribute(Array.from({length:count},()=>[51,0,102,102]).flat(),4,true):new T.Float32BufferAttribute(Array.from({length:count},()=>[.2,0,.4,.4]).flat(),4));
 geometry.morphAttributes.position=[new T.Float32BufferAttribute(positions.map((v,i)=>relative?Math.cos(i)*.03:v+Math.cos(i)*.03),3)];geometry.morphTargetsRelative=relative;
 const mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial()),root=new T.Group(),bones=Array.from({length:4},()=>new T.Bone());
 root.add(mesh);mesh.add(bones[0]);for(let i=1;i<4;i++){bones[i-1].add(bones[i]);bones[i].position.y=.2;}
 mesh.position.set(.3,-.1,.4);mesh.rotation.set(.1,.2,-.1);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
 const read=createSkinPointBatch(mesh),ids=Array.from({length:count},(_,i)=>i);
 const compare=()=>{root.updateMatrixWorld(true);mesh.skeleton.update();const actual=read(ids);for(let i=0;i<count;i++){const expected=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);maxError=Math.max(maxError,expected.distanceTo(actual[i]));assert.deepEqual(actual[i].toArray(),expected.toArray());checks++;}return actual;};
 for(let pose=0;pose<20;pose++){
  root.position.set(Math.sin(pose),.1*pose,-.02*pose);root.rotation.y=.03*pose;
  bones.forEach((b,i)=>b.rotation.set(.1*Math.sin(pose+i),.03*pose,.1*Math.cos(pose-i)));
  mesh.morphTargetInfluences[0]=pose/19;
  compare();
 }
 const retained=compare(),copy=retained.map(p=>p.toArray());
 geometry.attributes.position.setY(3,.72);geometry.attributes.skinWeight.setComponent(4,0,.1);geometry.attributes.skinIndex.setComponent(4,0,2);
 mesh.skeleton.boneInverses[2].elements[13]+=.015;
 mesh.bindMatrix.elements[12]+=.07;mesh.bindMatrixInverse.copy(mesh.bindMatrix).invert();
 compare();assert.deepEqual(retained.map(p=>p.toArray()),copy,'later reads cannot mutate earlier points');
 assert.deepEqual(read([]),[]);
}
console.log({result:'PASS',checks,maxError,relativeAndAbsoluteMorphs:true,normalizedWeights:true,poseAndInputChanges:true});
