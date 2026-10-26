import {Vector3,Quaternion} from 'three';
import {solve} from './stance-chain.js';

// Authored geometric support intervals, not measured contact-force events.
export const stanceContactWindows=[
 {side:'r',approach:.16,start:.28,end:.58,recovery:.70},
 {side:'l',approach:.63,start:.75,end:1.09,recovery:1.21},
];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
// Retain only the world-X twist relative to touchdown: pitch can roll forward,
// while yaw/roll cannot sweep the planted sole sideways. This is a contact
// constraint for this experiment, not an anatomical ankle-angle prescription.
export function contactRotation(current,anchor,weight){
 const relative=current.clone().multiply(anchor.clone().invert()).normalize();
 const twist=new Quaternion(relative.x,0,0,relative.w).normalize();
 return current.clone().slerp(twist.multiply(anchor),weight);
}
export function contactEnvelope(phase,w){
 const shift=phase<w.approach?1:0,p=phase+shift;
 return {phase:p,shift,weight:smooth((p-w.approach)/(w.start-w.approach))*smooth((w.recovery-p)/(w.recovery-w.end)),held:p>=w.start&&p<=w.end};
}

// Select a small material patch once at touchdown. Do not re-select the lowest
// vertex each frame: that can hide sliding by changing the point being measured.
export function selectContactPatch(model,side){
 const samples=[];let min=Infinity;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let id=0;id<skinIndex.count;id++){
   let weight=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(id,j)].name))weight+=skinWeight.getComponent(id,j);
   if(weight<.5)continue;
   const p=mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld);
   samples.push({mesh,id,y:p.y});min=Math.min(min,p.y);
  }
 });
 const patch=samples.filter(s=>s.y<min+.003).map(s=>({...s,weight:Math.exp((min-s.y)/.001)}));
 if(!patch.length)throw Error('Missing contact patch '+side);
 const mass=patch.reduce((s,p)=>s+p.weight,0);
 const skeletons=[...new Set(patch.map(({mesh})=>mesh.skeleton))];
 return {ids:patch.map(p=>p.id),read(){for(const skeleton of skeletons)skeleton.update();const p=new Vector3();for(const item of patch)p.addScaledVector(item.mesh.getVertexPosition(item.id,new Vector3()).applyMatrix4(item.mesh.matrixWorld),item.weight/mass);return p;}};
}

export function applyStanceContact(lane,phase,plans,cycleTravelX){
 const result=[];
 for(const plan of plans){
  const env=contactEnvelope(phase,plan.window);if(!env.weight)continue;
  const {side}=plan.window,by=n=>lane.bones.find(b=>b.name===n+'_'+side),hip=by('thigh'),knee=by('calf'),foot=by('foot'),toe=by('ball');
  const pos=b=>b.getWorldPosition(new Vector3()),H=pos(hip),upper=pos(knee).sub(H);
  const q=contactRotation(foot.getWorldQuaternion(new Quaternion()),plan.footQ,env.weight);
  const toeQ=contactRotation(toe.getWorldQuaternion(new Quaternion()),plan.toeQ,env.weight);
  const before=plan.patch.read(),anchorX=plan.anchorX-env.shift*cycleTravelX;
  const targetX=before.x+(lane.group.position.x+anchorX-before.x)*env.weight;
  const floor=lane.readSurface(side).min,goal=pos(foot),originalZ=goal.z;
  // The hip is never translated. Both leg segments solve together in a forward
  // knee plane; only the airborne approach/recovery blends the lateral target.
  for(let i=0;i<6;i++){
   goal.x+=targetX-plan.patch.read().x;goal.y+=floor-lane.readSurface(side).min;goal.z=originalZ;
   solve(lane.model,hip,knee,foot,goal,q,env.weight,upper);
   toe.quaternion.copy(toe.parent.getWorldQuaternion(new Quaternion()).invert().multiply(toeQ));lane.model.updateMatrixWorld(true);
   if(Math.hypot(targetX-plan.patch.read().x,floor-lane.readSurface(side).min)<1e-7)break;
  }
  result.push({side,held:env.held,weight:env.weight,targetX:targetX-lane.group.position.x,patch:lane.group.worldToLocal(plan.patch.read()).toArray(),hip:lane.group.worldToLocal(pos(hip)).toArray()});
 }
 return result;
}
