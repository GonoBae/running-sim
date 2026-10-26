import {Vector3} from 'three';
import {createSkinPointBatch} from './skin-point-batch.js';
import {applyLandingWidth,landingWeight} from './landing-width.js';

// Smooth low-surface centroid, not a pressure center. Exponential weights avoid
// the membership jumps of a hard minimum-height + 1mm vertex cutoff.
export function createLandingSurface(model){
 const groups=[];
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight}=mesh.geometry.attributes,indices={l:[],r:[]};
  for(let i=0;i<skinIndex.count;i++)for(const side of ['l','r']){
   let w=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(i,j)].name))w+=skinWeight.getComponent(i,j);
   if(w>.15)indices[side].push(i);
  }
  groups.push({mesh,indices,readPoints:createSkinPointBatch(mesh)});
 });
 return side=>{
  const points=[];
  for(const {mesh,indices,readPoints} of groups){mesh.skeleton.update();for(const point of readPoints(indices[side]))points.push(point);}
  const min=Math.min(...points.map(p=>p.y)),center=new Vector3();let sum=0;
  for(const p of points){const w=Math.exp(-(p.y-min)/.001);center.addScaledVector(p,w);sum+=w;}
  return {center:center.divideScalar(sum),min};
 };
}

// Fresh baseline per evaluation; frontal X only, preserving forward/vertical
// ankle position, foot orientation and the original recovery of each leg.
export function applyHipLanding(model,bones,phase,side,read,enabled=true){
 const hip=bones.find(b=>b.name==='thigh_'+side).getWorldPosition(new Vector3());
 const before=read(side),weight=enabled?landingWeight(phase,side):0,sign=side==='r'?-1:1;
 const targetX=before.center.x+weight*(hip.x-before.center.x);
 let limited=false;
 if(weight){
  const first=applyLandingWidth(model,bones,phase,(hip.x-before.center.x)*sign,side);limited=first.limited;
  // Skinning can slightly change the low-surface centroid even with foot world
  // rotation retained. Refine against the same blended target, never the full
  // hip line during fade-in/out. No persistent state or accumulated offsets.
  for(let i=0;i<2&&!limited;i++){
   const residual=targetX-read(side).center.x;if(Math.abs(residual)<1e-7)break;
   limited=applyLandingWidth(model,bones,phase,residual*sign/weight,side).limited;
  }
 }
 const after=read(side);
 return {weight,limited,hip:hip.toArray(),before:before.center.toArray(),after:after.center.toArray(),targetX,error:Math.abs(after.center.x-targetX),surfaceY:after.min};
}
