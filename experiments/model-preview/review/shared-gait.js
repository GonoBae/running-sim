import {Quaternion,Vector3} from 'three';

const wrap=x=>((x%1)+1)%1;
const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
const q=a=>new Quaternion(...a).normalize();
// S R S for reflection S=diag(-1,1,1). A rotation is not mirrored by negating
// Euler angles or copying the other rig bone's local quaternion.
export const mirrorRotation=r=>new Quaternion(r.x,-r.y,-r.z,r.w).normalize();

export function rotationCurve(values){
 return phase=>{
  const f=wrap(phase)*values.length,i=Math.floor(f),t=f-i,n=values.length;
  const vs=[-1,0,1,2].map(d=>values[(i+d+n)%n]),anchor=q(vs[1]);
  const aligned=vs.map(v=>q(v).dot(anchor)<0?v.map(x=>-x):v);
  return new Quaternion(...[0,1,2,3].map(k=>cubic(...aligned.map(a=>a[k]),t))).normalize();
 };
}
function scalarCurve(values){
 return phase=>{const f=wrap(phase)*values.length,i=Math.floor(f),n=values.length;return cubic(...[-1,0,1,2].map(d=>values[(i+d+n)%n]),f-i);};
}
function travelCurve(frames,key){
 const count=frames.length-1,start=new Vector3(...frames[0][key]),delta=new Vector3(...frames[count][key]).sub(start);
 const residual=frames.slice(0,count).map((f,i)=>new Vector3(...f[key]).sub(start).addScaledVector(delta,-i/count));
 const curves=['x','y','z'].map(k=>scalarCurve(residual.map(p=>p[k])));
 return {start,delta,residual:phase=>new Vector3(...curves.map(read=>read(phase))),read(phase){return this.residual(phase).add(start).addScaledVector(delta,phase);}};
}

export function createSharedGait(reference){
 const frames=reference.frames.slice(0,-1),rest=Object.fromEntries(reference.bones.map(b=>[b.name,q(b.worldQ)]));
 const local=reference.bones.map((b,i)=>rotationCurve(frames.map(f=>f.q[i])));
 const pelvis=travelCurve(reference.frames,'pelvis'),position=travelCurve(reference.frames,'position');
 const bodyDeltas=frames.map(f=>q(f.pelvisQ).multiply(rest.pelvis.clone().invert()).normalize());
 const body=rotationCurve(bodyDeltas.map(r=>r.toArray()));
 const parts=['thigh','calf','foot','ball'];
 const right=parts.map((name,i)=>rotationCurve(frames.map((f,j)=>bodyDeltas[j].clone().invert().multiply(q(f.rightQ[i])).normalize().toArray())));
 const floor=scalarCurve(frames.map(f=>f.floor));
 const world=(bone,rotation,model)=>{bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(rotation).normalize());model.updateMatrixWorld(true);};
 function original(lane,phase){
  lane.model.position.copy(position.read(phase));
  reference.bones.forEach((b,i)=>lane.model.getObjectByName(b.name).quaternion.copy(local[i](phase)));
  lane.model.updateMatrixWorld(true);
 }
 function core(lane,phase){
  original(lane,phase);
  const model=lane.model,by=n=>model.getObjectByName(n);
  const upper=by('spine_01').getWorldQuaternion(new Quaternion());
  const p=body(phase).slerp(mirrorRotation(body(phase+.5)),.5).normalize();
  world(by('pelvis'),p.clone().multiply(rest.pelvis),model);
  // This small comparison changes the pelvis/lower limbs; preserve the existing
  // upper body's world orientation instead of adding another arm correction.
  world(by('spine_01'),upper,model);
  for(const side of ['r','l'])for(let i=0;i<parts.length;i++){
   const name=parts[i],canonical=right[i](phase+(side==='l'?.5:0));
   const rotation=side==='r'?canonical:mirrorRotation(canonical.multiply(rest[name+'_r'].clone().invert())).multiply(rest[name+'_l']);
   world(by(name+'_'+side),p.clone().multiply(rotation),model);
  }
  const a=pelvis.residual(phase),b=pelvis.residual(phase+.5);
  const target=new Vector3((a.x-b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2).add(pelvis.start).addScaledVector(pelvis.delta,phase);
  const actual=lane.group.worldToLocal(by('pelvis').getWorldPosition(new Vector3()));
  model.position.add(target.sub(actual));model.updateMatrixWorld(true);
 }
 // Use the same vertical adjustment at t and t+1/2. This keeps half-cycle
 // symmetry even when the exported left/right skin shapes are not identical.
 // Both surfaces are measured, so a mirrored ankle never silently clips ground.
 function apply(lane,probe,phase){
  core(lane,phase);core(probe,phase+.5);
  const minimum=l=>Math.min(l.readSurface('r').min,l.readSurface('l').min);
  const gap=Math.max(0,Math.min(floor(phase),floor(phase+.5)));
  const shift=Math.max(gap-minimum(lane),gap-minimum(probe));
  lane.model.position.y+=shift;lane.model.updateMatrixWorld(true);
  return {phase:wrap(phase),leftPhase:wrap(phase+.5),floorTarget:gap,heightShift:shift};
 }
 return {original,core,apply,pelvisTravel:pelvis.delta.clone(),parts,reference};
}
