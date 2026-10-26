import {Matrix4, Mesh, Vector3, Vector4} from 'three';

// CPU measurement only: preserve Three's morph -> bind -> weighted bones ->
// inverse bind -> world operation order, using full-precision Matrix4 values.
// A batch is one pose. Never reuse its bone matrices after a pose change.
export function createSkinPointBatch(mesh){
 const matrices=[],stamps=[],base=new Vector4(),transformed=new Vector4();let batch=0;
 return indices=>{
  batch++;
  const {skinIndex,skinWeight}=mesh.geometry.attributes,skeleton=mesh.skeleton;
  const points=[];
  for(const index of indices){
   const point=Mesh.prototype.getVertexPosition.call(mesh,index,new Vector3());
   base.set(point.x,point.y,point.z,1).applyMatrix4(mesh.bindMatrix);point.set(0,0,0);
   for(let j=0;j<4;j++){
    const weight=skinWeight.getComponent(index,j);if(weight===0)continue;
    const boneIndex=skinIndex.getComponent(index,j);
    if(stamps[boneIndex]!==batch){
     (matrices[boneIndex]??=new Matrix4()).multiplyMatrices(skeleton.bones[boneIndex].matrixWorld,skeleton.boneInverses[boneIndex]);
     stamps[boneIndex]=batch;
    }
    point.addScaledVector(transformed.copy(base).applyMatrix4(matrices[boneIndex]),weight);
   }
   points.push(point.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld));
  }
  return points;
 };
}
