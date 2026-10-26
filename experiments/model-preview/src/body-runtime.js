import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createBodyDimensions,lengthFields} from './body-dimensions';
import {createAnkleWeights} from '../review/ankle-weights.js';
import {createBilateralSkin} from '../review/bilateral-skin.js';

// Own both geometry and rig. Rebuilding one body must never edit the original
// asset, the other sex, or a running model still visible during preparation.
export function cloneBodySource(source){
 const model=clone(source);model.traverse(o=>{
  if(o.isMesh)o.geometry=o.geometry.clone();
  // SkeletonUtils clones bones, but Skeleton.clone shares the inverse-bind
  // array. calculateInverses() clears that array during a body rebuild.
  if(o.isSkinnedMesh)o.skeleton.boneInverses=o.skeleton.boneInverses.map(m=>m.clone());
 });
 return model;
}

export function createBodyModel(source){
 const model=cloneBodySource(source);
 createAnkleWeights(model).setEnabled(true);createBilateralSkin(model).setEnabled(true);
 const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});
 const dimensions=createBodyDimensions(model,bones,Object.fromEntries(lengthFields.map(f=>[f.id,true])));
 if(!dimensions)throw Error('신체 길이 설정을 불러오지 못했습니다.');
 return {model,dimensions,baseScale:model.scale.clone()};
}

export function applyBodySettings(body,settings){
 const {model,dimensions,baseScale}=body;
 dimensions.setRatios(settings.ratios);
 model.scale.copy(baseScale);model.position.copy(dimensions.anchorPosition);model.updateMatrixWorld(true);
 const floor=new T.Box3().setFromObject(model,true).min.y;
 model.scale.copy(baseScale).multiplyScalar(settings.scale);
 model.position.y+=(1-settings.scale)*(floor-model.position.y);model.updateMatrixWorld(true);
 return new T.Box3().setFromObject(model,true);
}

export function bodyKey(settings){return JSON.stringify([settings.scale,...lengthFields.map(f=>settings.ratios[f.id])]);}

export function disposeBodyModels(...models){
 const geometries=new Set(),skeletons=new Set();
 for(const model of models.filter(Boolean)){
  model.removeFromParent();model.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);if(o.isSkinnedMesh)skeletons.add(o.skeleton);});
 }
 for(const skeleton of skeletons)skeleton.dispose();for(const geometry of geometries)geometry.dispose();
 // Materials/textures are shared with the immutable cached source.
}
