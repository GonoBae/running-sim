import {Vector3} from 'three';
import {createSkinPointBatch} from './skin-point-batch.js';
import {solveSupportLeg} from './shared-support.js';
import {monotoneRelease} from './shared-release.js';

// M75: one continuous contact path, with the same rule half a cycle later.
// These are clip-specific test intervals, not measured force events.
export const UNIFIED_STANCE_WINDOW=Object.freeze({start:.28,settle:.30,rollStart:.36,rollEnd:.40,release:.55,end:.68,step:.001,softness:.002});
const wrap=t=>((t%1)+1)%1;
const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(10+u*(-15+6*u));};

export function createUnifiedStance(baseline,lane,probe,travel,contacts,options=UNIFIED_STANCE_WINDOW){
 const {start,settle,rollStart,rollEnd,release,end,step,softness}=options;
 const curves={};
 const local=(target,name)=>target.group.worldToLocal(target.model.getObjectByName(name).getWorldPosition(new Vector3()));
 const mesh=lane.model.getObjectByName('Human'),batch=createSkinPointBatch(mesh),attrs=mesh.geometry.attributes;
 for(const side of ['r','l']){
  const shift=side==='l'?.5:0,indices=[];
  for(let i=0;i<attrs.position.count;i++){
   let w=0;for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[attrs.skinIndex.getComponent(i,j)].name))w+=attrs.skinWeight.getComponent(i,j);
   if(w>.99)indices.push(i);
  }
  const firstContact=indices.indexOf(contacts[side].id);
  if(contacts[side].mesh!==mesh.name||firstContact<0)throw Error('Initial contact is outside the rigid sole patch.');
  const count=Math.round((end-start)/step),samples=[],hips=[];
  let previous=null,rolled;
  for(let i=0;i<=count;i++){
   const t=start+(end-start)*i/count;baseline.apply(lane,probe,t+shift);
   const ankle=local(lane,'foot_'+side);
   const offsets=batch(indices).map(p=>lane.group.worldToLocal(p).sub(ankle));
   const min=Math.min(...offsets.map(p=>p.y));
   const low=offsets.map(p=>Math.exp(-(p.y-min)/softness)),sumLow=low.reduce((sum,v)=>sum+v,0);
   const roll=smooth((t-rollStart)/(rollEnd-rollStart));
   // Keep the accepted first contact while the sole is flat, then transfer
   // contact toward the rolling forefoot without returning to another anchor.
   const weights=low.map((w,j)=>roll*w/sumLow+(j===firstContact?1-roll:0));
   if(!previous)rolled=ankle.clone();
   else{
    const delta=new Vector3();let sum=0;
    for(let j=0;j<offsets.length;j++){
     const w=(weights[j]+previous.weights[j])/2;
     delta.addScaledVector(offsets[j].clone().sub(previous.offsets[j]),w);sum+=w;
    }
    // Cancel the rotational motion of the currently low sole patch. A fixed
    // ankle or a changing minimum-position target would still slide on roll.
    rolled.addScaledVector(delta,-1/sum);
   }
   samples.push(rolled.clone());hips.push(local(lane,'thigh_'+side));previous={offsets,weights};
  }
  // Cubic Hermite sampling keeps position and velocity continuous between
  // preparation samples. Entry and exit weights retain the old pose at ends.
  const tangent=i=>samples[Math.min(count,i+1)].clone().sub(samples[Math.max(0,i-1)]).multiplyScalar(i===0||i===count?1:.5);
  const at=t=>{
   const x=Math.max(0,Math.min(count,(t-start)/(end-start)*count)),i=Math.min(count-1,Math.floor(x)),u=x-i;
   return samples[i].clone().multiplyScalar(2*u**3-3*u*u+1).addScaledVector(tangent(i),u**3-2*u*u+u)
    .addScaledVector(samples[i+1],-2*u**3+3*u*u).addScaledVector(tangent(i+1),u**3-u*u);
  };
  const goalAt=(t,before,cycle=0)=>{
   const weight=smooth((t-start)/(settle-start))*(1-smooth((t-release)/(end-release)));
   const goal=at(t).addScaledVector(travel,cycle).lerp(before,1-weight);goal.y=before.y;
   return goal;
  };
  curves[side]={shift,indices,at,goalAt,samples,hips};
 }
 // Use one mirrored lateral path relative to each hip. Preserving the old
 // pelvis motion while locking both world X paths otherwise increases the
 // visible side-to-side pose difference. Fore-aft rolling remains unchanged.
 for(let i=0;i<curves.r.samples.length;i++){
  const r=curves.r,l=curves.l;
  const x=((r.samples[i].x-r.hips[i].x)-(l.samples[i].x-l.hips[i].x))/2;
  r.samples[i].x=r.hips[i].x+x;l.samples[i].x=l.hips[i].x-x;
 }
 for(const side of ['r','l']){
  const curve=curves[side];
  const flexAt=t=>{
   baseline.apply(lane,probe,t+curve.shift);
   const H=local(lane,'thigh_'+side),K=local(lane,'calf_'+side),A=local(lane,'foot_'+side);
   const goal=curve.goalAt(t,A),a=H.distanceTo(K),b=K.distanceTo(A);
   const cosine=(H.distanceToSquared(goal)-a*a-b*b)/(2*a*b);
   if(Math.abs(cosine)>=1)throw Error('Unified contact target leaves the leg reach.');
   return Math.acos(cosine);
  };
  const boundary=t=>{const h=1e-4,p=flexAt(t),lo=flexAt(t-h),hi=flexAt(t+h);return {p,v:(hi-lo)/(2*h),a:(hi+lo-2*p)/(h*h)};};
  curve.knee=monotoneRelease(boundary(release),boundary(end),end-release);
 }
 function apply(target,mirrorProbe,phase){
  const result=baseline.apply(target,mirrorProbe,phase),changes=[];
  for(const side of ['r','l']){
   const curve=curves[side],t=wrap(phase-curve.shift);
   if(t<=start||t>=end)continue;
   const model=target.model,hip=model.getObjectByName('thigh_'+side),knee=model.getObjectByName('calf_'+side),foot=model.getObjectByName('foot_'+side);
   const before=local(target,foot.name),goal=curve.goalAt(t,before,Math.floor(phase-curve.shift));
   if(t>release){
    // Unload the foot vertically while the knee folds, rather than holding
    // ankle height and forcing another bend/extend/bend on the way to swing.
    const H=local(target,hip.name),K=local(target,knee.name),a=H.distanceTo(K),b=K.distanceTo(before);
    const flex=curve.knee.read((t-release)/(end-release));
    const vertical=a*a+b*b+2*a*b*Math.cos(flex)-(goal.x-H.x)**2-(goal.z-H.z)**2;
    if(vertical<=0)throw Error('Unified release target leaves the lower leg arc.');
    const lift=H.y-Math.sqrt(vertical)-before.y;
    // A C2 positive lift avoids a tiny below-ground dip at unloading. The
    // 0.2 mm transition removes the corner a hard max(0, lift) would create.
    goal.y=before.y+(lift>0?lift*smooth(lift/.0002):0);
   }
   target.group.localToWorld(goal);
   solveSupportLeg(model,hip,knee,foot,goal);
   changes.push({side,phase:t,deltaMm:local(target,foot.name).distanceTo(before)*1000});
  }
  return {...result,unifiedStance:changes};
 }
 return {apply,baseline,curves,options};
}
