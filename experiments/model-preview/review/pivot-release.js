import {Vector3,Quaternion} from 'three';
import {solve} from './stance-chain.js';
export const pivotReleaseSettings={start:.46,end:.58};
// Choose one material vertex at release end, then keep its identity throughout.
export function selectReleasePivot(model){
 let selected=null,lowest=Infinity;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let id=0;id<skinIndex.count;id++){
   let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(id,j)].name))w+=skinWeight.getComponent(id,j);
   if(w<=.5)continue;
   const p=mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld);
   if(p.y<lowest){lowest=p.y;selected={mesh,id};}
  }
 });
 if(!selected)throw Error('Missing right foot pivot');
 return {id:selected.id,read(){selected.mesh.skeleton.update();return selected.mesh.getVertexPosition(selected.id,new Vector3()).applyMatrix4(selected.mesh.matrixWorld);}};
}
// A contact-point path, rather than an independently interpolated ankle path.
// Match M42 at both boundaries so recovery and seek order remain unchanged.
export function createPivotPath(sample){
 const {start,end}=pivotReleaseSettings,d=end-start,e=.001;
 const boundary=t=>{const p=sample(t),lo=sample(t-e),hi=sample(t+e);return {p,v:hi.clone().sub(lo).multiplyScalar(d/(2*e)),a:hi.clone().add(lo).addScaledVector(p,-2).multiplyScalar(d*d/(e*e))};};
 const s=boundary(start),t=boundary(end),delta=t.p.clone().sub(s.p);
 return phase=>{
  const u=Math.max(0,Math.min(1,(phase-start)/d));
  return s.p.clone().addScaledVector(s.v,u).addScaledVector(s.a,.5*u*u)
   .addScaledVector(delta,10*u**3-15*u**4+6*u**5)
   .addScaledVector(s.v,-6*u**3+8*u**4-3*u**5).addScaledVector(t.v,-4*u**3+7*u**4-3*u**5)
   .addScaledVector(s.a,-1.5*u**3+1.5*u**4-.5*u**5).addScaledVector(t.a,.5*u**3-u**4+.5*u**5);
 };
}
export function applyPivotRelease(model,bones,pivot,target,phase,readSurface){
 const {start,end}=pivotReleaseSettings;
 if(phase<=start||phase>=end)return {active:false};
 const by=n=>bones.find(b=>b.name===n),hip=by('thigh_r'),knee=by('calf_r'),foot=by('foot_r');
 const pos=b=>b.getWorldPosition(new Vector3()),q=foot.getWorldQuaternion(new Quaternion());
 const upper=pos(knee).sub(pos(hip)),goal=pos(foot),floor=readSurface('r').min;
 for(let i=0;i<5;i++){
  const point=pivot.read();goal.x+=target.x-point.x;goal.z+=target.z-point.z;
  goal.y+=floor-readSurface('r').min;
  solve(model,hip,knee,foot,goal,q,0,upper);
  const after=pivot.read();
  if(Math.hypot(target.x-after.x,target.z-after.z,floor-readSurface('r').min)<1e-7)break;
 }
 return {active:true,pivot:pivot.read().toArray(),target:target.toArray()};
}
