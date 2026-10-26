import {Vector3, Quaternion, Matrix4} from 'three';
import {stanceContactWindows} from './stance-contact.js';
import {solve} from './stance-chain.js';

const position = b => b.getWorldPosition(new Vector3());
const rotation = b => b.getWorldQuaternion(new Quaternion()).normalize();
const smooth = x => {x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
const quantile = (values,q) => values.slice().sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];

// Call in the neutral GLB pose, once per configuration. Material vertex IDs
// stay fixed while the character moves; they are not reselected by height.
export function selectSoleRegions(model) {
 const specs={};
 for(const side of ['r','l']){
  const vertices=[];
  model.traverse(mesh=>{
   if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
   const {skinIndex,skinWeight}=mesh.geometry.attributes;
   for(let id=0;id<skinIndex.count;id++){
    let w=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(id,j)].name))w+=skinWeight.getComponent(id,j);
    if(w>.5)vertices.push({mesh:mesh.name,id,p:mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld)});
   }
  });
  const min=Math.min(...vertices.map(v=>v.p.y)),sole=vertices.filter(v=>v.p.y<min+.012);
  const z0=quantile(sole.map(v=>v.p.z),.2),z1=quantile(sole.map(v=>v.p.z),.8),x0=quantile(sole.map(v=>v.p.x),.2),x1=quantile(sole.map(v=>v.p.x),.8);
  specs[side]=Object.fromEntries(Object.entries({heel:sole.filter(v=>v.p.z<=z0),toe:sole.filter(v=>v.p.z>=z1),negativeX:sole.filter(v=>v.p.x<=x0),positiveX:sole.filter(v=>v.p.x>=x1)}).map(([key,vs])=>[key,vs.map(({mesh,id})=>({mesh,id}))]));
 }
 return specs;
}

export function bindSoleReader(model,specs) {
 const groups=Object.fromEntries(Object.entries(specs).map(([s,regions])=>[s,Object.fromEntries(Object.entries(regions).map(([n,ids])=>[n,ids.map(v=>({mesh:model.getObjectByName(v.mesh),id:v.id}))]))]));
 const skeletons=Object.fromEntries(Object.entries(groups).map(([side,regions])=>[side,[...new Set(Object.values(regions).flat().map(({mesh})=>mesh.skeleton))]]));
 return side=>{
  // The pose is unchanged while reading its skin points. Update each skeleton
  // once per read, not once per vertex; subsequent reads still use fresh poses.
  for(const skeleton of skeletons[side])skeleton.update();
  const mean=ids=>{const p=new Vector3();for(const {mesh,id} of ids)p.add(mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld));return p.divideScalar(ids.length);};
  const p=Object.fromEntries(Object.entries(groups[side]).map(([n,ids])=>[n,mean(ids)]));
  const z=p.toe.clone().sub(p.heel).normalize(),rawX=p.positiveX.clone().sub(p.negativeX).normalize();
  const y=z.clone().cross(rawX).normalize(),x=y.clone().cross(z).normalize();
  return {frame:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z)).normalize(),yaw:Math.atan2(z.x,z.z),points:p};
 };
}

// Early stance only. The same fraction is used for both authored support
// intervals: full at touchdown through 25%, original pose again by 50%.
export function soleAlignmentWeight(phase,window) {
 const p=((phase%1)+1)%1,duration=window.end-window.start;
 return smooth((p-window.approach)/(window.start-window.approach))*smooth((window.start+duration*.5-p)/(duration*.25));
}

// Fixed pelvis and fixed material contact target. Foot and toe rotate together;
// a two-segment leg solve supplies the ankle displacement, without root motion.
export function applyLandingSoleAlignment(lane,phase) {
 const diagnostics=[];
 for(const window of stanceContactWindows){
  const weight=soleAlignmentWeight(phase,window),side=window.side;
  if(!weight){diagnostics.push({side,weight:0});continue;}
  const by=n=>lane.bones.find(b=>b.name===n+'_'+side),hip=by('thigh'),knee=by('calf'),foot=by('foot'),toe=by('ball');
  const patch=lane.contactPlans.find(p=>p.window.side===side).patch;
  const targetPoint=patch.read(),floor=lane.readSurface(side).min,original=lane.readSole(side);
  const flat=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),original.yaw);
  const desired=original.frame.clone().slerp(flat,weight).normalize();
  const forward=new Vector3(0,0,1).applyQuaternion(desired);
  desired.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),original.yaw-Math.atan2(forward.x,forward.z)));
  const upper=position(knee).sub(position(hip)),kneeX=position(knee).x,goal=position(foot);
  let footQ=rotation(foot),toeQ=rotation(toe),residual=Infinity,angleError=Infinity,kneeClamp=0,iterations=0;
  for(let i=0;i<14;i++){
   const delta=desired.clone().multiply(lane.readSole(side).frame.invert());
   footQ.premultiply(delta).normalize();toeQ.premultiply(delta).normalize();
   const result=solve(lane.model,hip,knee,foot,goal,footQ,0,upper,kneeX);
   kneeClamp=Math.max(kneeClamp,Math.abs(result.kneeClamp));
   toe.quaternion.copy(rotation(toe.parent).invert().multiply(toeQ));lane.model.updateMatrixWorld(true);
   const point=patch.read(),offset=new Vector3(targetPoint.x-point.x,floor-lane.readSurface(side).min,targetPoint.z-point.z);
   residual=offset.length();angleError=desired.angleTo(lane.readSole(side).frame);iterations=i+1;
   if(residual<1e-8&&angleError<1e-7)break;
   goal.add(offset);
  }
  diagnostics.push({side,weight,residual,angleError,kneeClamp,iterations});
 }
 return diagnostics;
}
