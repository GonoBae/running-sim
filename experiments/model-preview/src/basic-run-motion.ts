import * as THREE from 'three';
import type {createRunningPose} from './running-pose';
import {sampleReferenceLeg,referenceLegData} from './reference-leg-motion';

type Pose=NonNullable<ReturnType<typeof createRunningPose>>;
type Key=readonly [number,number];
export const basicRunPeriodMs=referenceLegData.periodMs;
// AB01 left-leg mean; the right side is a half-cycle assumption, not measured bilateral gait.
// Ankle/arms/flight remain authored presentation. No contact mechanics or speed prediction.
// Sole pitch relative to the asset's neutral foot, not the ankle-to-toe vector.
const ankle:Key[]=[[0,5],[.12,0],[.35,-12],[.48,-24],[.64,-8],[.8,0],[1,5]];
function curve(keys:Key[],p:number){
  const n=keys.length-1;
  const slope=(i:number)=>{const k=(i+n)%n;return (keys[k+1][1]-keys[k][1])/(keys[k+1][0]-keys[k][0]);};
  const tangent=(i:number)=>{const a=slope(i-1),b=slope(i);return a*b<=0?0:2*a*b/(a+b);};
  let i=0;while(i<n-1&&p>keys[i+1][0])i++;
  const h=keys[i+1][0]-keys[i][0],t=(p-keys[i][0])/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*keys[i][1]+(t3-2*t2+t)*h*tangent(i)+(-2*t3+3*t2)*keys[i+1][1]+(t3-t2)*h*tangent(i+1);
}
export function sampleBasicRun(elapsed:number){
  if(!Number.isFinite(elapsed)||elapsed<0)throw Error('Invalid run time');
  const phase=(elapsed%basicRunPeriodMs)/basicRunPeriodMs;
  const lean=6,twist=3*Math.sin(2*Math.PI*phase);
  const values:Record<string,number>={},feet:Record<string,number>={};
  for(const [side,offset] of [['l',0],['r',.5]] as const){
    const p=(phase+offset)%1;
    const reference=sampleReferenceLeg(p),angle=THREE.MathUtils.degToRad(reference.thigh);
    // applyRunFrame uses pre-root directions; undo the later YXZ lean/yaw so the
    // final side projection matches the source's vertical-referenced thigh angle.
    values[`thigh_${side}`]=THREE.MathUtils.radToDeg(Math.atan2(Math.sin(angle)/Math.cos(THREE.MathUtils.degToRad(twist)),Math.cos(angle)))+lean;
    values[`calf_${side}`]=reference.knee;
    values[`upperarm_${side}`]=2-22*Math.cos(2*Math.PI*(p-.86));
    values[`lowerarm_${side}`]=88+4*Math.cos(2*Math.PI*(p-.36));
    feet[side]=curve(ankle,p);
  }
  return {phase,values,feet,lean,twist,flight:0};
}
export function basicRunAvailable(pose:Pose|undefined){
  if(!pose)return false;
  // Rounded outward bounds, including compensation for lean/yaw. Never widen admin limits.
  const limits:Record<string,[number,number]>={upperarm:[-20,24],lowerarm:[84,92],thigh:[-9.3,32.3],calf:[6.5,70.7]};
  return Object.entries(limits).every(([category,[min,max]])=>['l','r'].every(side=>{
    const j=pose.definitions.find(j=>j.id===`${category}_${side}`);return j&&j.min<=min&&j.max>=max;
  }));
}

/** Transient presentation only: original pose values, bone lengths and model transform stay recoverable. */
export function createBasicRunMotion(pose:Pose,model:THREE.Group,bones:THREE.Bone[],floorY:number){
  const names=new Map(bones.map(b=>[b.name,b]));
  for(const name of ['pelvis','spine_01','foot_l','foot_r','ball_l','ball_r'])if(!names.has(name))throw Error('Unsupported run rig');
  let state:'idle'|'playing'|'paused'='idle',elapsed=0,lastTime=0;
  let origin=model.position.clone(),rotation=model.quaternion.clone();
  let lastFrame:ReturnType<typeof sampleBasicRun>|undefined;
  let footHeights={left:0,right:0};
  const samples:{mesh:THREE.SkinnedMesh;indices:{l:number[];r:number[]}}[]=[];
  model.traverse(node=>{
    const mesh=node as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh||mesh.userData.selectionOverlay)return;
    const skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    const indices={l:[] as number[],r:[] as number[]};
    for(let i=0;i<skin.count;i++)for(const side of ['l','r'] as const){
      let sum=0;for(let j=0;j<4;j++){
        const name=mesh.skeleton.bones[skin.getComponent(i,j)]?.name;
        if(name===`foot_${side}`||name===`ball_${side}`)sum+=weights.getComponent(i,j);
      }
      if(sum>.15)indices[side].push(i);
    }
    if(indices.l.length||indices.r.length)samples.push({mesh,indices});
  });
  if(['l','r'].some(s=>!samples.some(v=>v.indices[s as 'l'|'r'].length)))throw Error('Foot surface missing');
  const p=(name:string)=>names.get(name)!.getWorldPosition(new THREE.Vector3());
  const handFrames=new Map<string,THREE.Quaternion>();
  function basis(forward:THREE.Vector3,up:THREE.Vector3){
    const z=forward.clone().normalize(),y=up.clone().addScaledVector(z,-up.dot(z)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(y.clone().cross(z).normalize(),y,z));
  }
  for(const side of ['l','r'])if(['hand','middle_01','index_01','pinky_01'].every(n=>names.has(`${n}_${side}`))){
    const inv=names.get(`hand_${side}`)!.getWorldQuaternion(new THREE.Quaternion()).invert();
    handFrames.set(side,basis(p(`middle_01_${side}`).sub(p(`hand_${side}`)).applyQuaternion(inv),p(`index_01_${side}`).sub(p(`pinky_01_${side}`)).applyQuaternion(inv)).invert());
  }
  function setWorldRotation(b:THREE.Bone,q:THREE.Quaternion){
    b.quaternion.copy(b.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q)).normalize();model.updateMatrixWorld(true);
  }
  function rotateWorld(b:THREE.Bone,axis:THREE.Vector3,degrees:number){
    const world=b.getWorldQuaternion(new THREE.Quaternion()),parent=b.parent!.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(parent.invert().multiply(new THREE.Quaternion().setFromAxisAngle(axis,THREE.MathUtils.degToRad(degrees))).multiply(world));
    model.updateMatrixWorld(true);
  }
  function renderRaw(time:number){
    model.position.copy(origin);model.quaternion.copy(rotation);model.updateMatrixWorld(true);
    const frame=sampleBasicRun(time),result=pose.applyRunFrame(frame.values);
    if(!result.ok)throw Error(result.reason);
    // Lean around the pelvis, then counter-rotate the chest for a small shoulder/pelvis opposition.
    const pivot=p('pelvis');
    model.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(frame.lean),THREE.MathUtils.degToRad(frame.twist),0,'YXZ')));
    model.updateMatrixWorld(true);model.position.add(pivot.sub(p('pelvis')));model.updateMatrixWorld(true);
    rotateWorld(names.get('spine_01')!,new THREE.Vector3(0,1,0),-frame.twist*1.8);
    for(const side of ['l','r']){
      // Keep the wrist aligned with the forearm and the thumb side up.
      const handFrame=handFrames.get(side);
      if(handFrame)setWorldRotation(names.get(`hand_${side}`)!,basis(p(`hand_${side}`).sub(p(`lowerarm_${side}`)),new THREE.Vector3(0,1,0)).multiply(handFrame));
      // A relaxed hand instead of the imported spread-finger rest pose.
      if(['index_01','pinky_01','middle_01','middle_02'].every(n=>names.has(`${n}_${side}`))){
        const axis=p(`pinky_01_${side}`).sub(p(`index_01_${side}`)).normalize();
        const forward=p(`middle_02_${side}`).sub(p(`middle_01_${side}`)).normalize();
        const inward=p(`hand_${side==='l'?'r':'l'}`).sub(p(`hand_${side}`));
        const sign=axis.clone().cross(forward).dot(inward)>=0?1:-1;
        for(const finger of ['index','middle','ring','pinky'])for(const [i,angle] of [30,42,24].entries()){
          const bone=names.get(`${finger}_0${i+1}_${side}`);if(bone)rotateWorld(bone,axis,angle*sign);
        }
      }
      const footRotation=rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-THREE.MathUtils.degToRad(frame.feet[side]),THREE.MathUtils.degToRad(frame.twist),0,'YXZ'))).multiply(pose.neutralFootRotation(side as 'l'|'r'));
      setWorldRotation(names.get(`foot_${side}`)!,footRotation);
    }
    // Ground clearance from the actual skinned foot vertices, not the ankle joint.
    // The contact solver below uses these heights alongside the world X/Z anchor.
    const heights={l:Infinity,r:Infinity},v=new THREE.Vector3();
    for(const {mesh,indices} of samples){
      mesh.skeleton.update();
      for(const side of ['l','r'] as const)for(const index of indices[side]){
        mesh.getVertexPosition(index,v).applyMatrix4(mesh.matrixWorld);heights[side]=Math.min(heights[side],v.y);
      }
    }
    return {frame,heights,points:{l:p('ball_l'),r:p('ball_r')}};
  }
  // Authored contact schedule: 32% stance + 18% flight per half-cycle.
  // Preserve the angular reference; solve body translation from the planted toe anchor.
  const stance=.32,flight=.5-stance,h=.0001;
  const travel=new THREE.Vector3();
  let contact:'l'|'r'|'flight'='flight';
  type Raw=ReturnType<typeof renderRaw>;
  type Boundary={start:Raw;end:Raw;startSlope:THREE.Vector3;endSlope:THREE.Vector3};
  let plan:{legs:Boundary[];stepLength:number;anchorX:number[];anchorZ:number;legLength:number}|undefined;
  const requiredOffset=(raw:Raw,side:'l'|'r')=>new THREE.Vector3(-raw.points[side].x,floorY+.0001-raw.heights[side],-raw.points[side].z);
  function buildPlan(){
    const legs=(['l','r'] as const).map((side,index)=>{
      const phase=index*.5,start=renderRaw(phase*basicRunPeriodMs),after=renderRaw((phase+h)*basicRunPeriodMs);
      const end=renderRaw((phase+stance)*basicRunPeriodMs),before=renderRaw((phase+stance-h)*basicRunPeriodMs);
      return {start,end,startSlope:requiredOffset(after,side).sub(requiredOffset(start,side)).divideScalar(h),endSlope:requiredOffset(end,side).sub(requiredOffset(before,side)).divideScalar(h)};
    });
    const stepLength=legs.reduce((sum,leg,i)=>{const side=i===0?'l':'r';return sum+leg.start.points[side].z-leg.end.points[side].z+flight*(leg.startSlope.z+leg.endSlope.z)/2;},0)/2;
    if(!Number.isFinite(stepLength)||stepLength<=0)throw Error('Unsupported forward stepLength');
    plan={legs,stepLength,anchorX:[legs[0].start.points.l.x,legs[1].start.points.r.x],anchorZ:legs[0].start.points.l.z,legLength:p('thigh_l').distanceTo(p('calf_l'))+p('calf_l').distanceTo(p('foot_l'))};
  }
  function hermite(a:number,b:number,va:number,vb:number,t:number){
    return (2*t*t*t-3*t*t+1)*a+(t*t*t-2*t*t+t)*flight*va+(-2*t*t*t+3*t*t)*b+(t*t*t-t*t)*flight*vb;
  }
  function render(){
    if(!plan)buildPlan();
    const data=plan!,raw=renderRaw(elapsed),half=Math.floor(elapsed/(basicRunPeriodMs/2)),index=half%2,side=index===0?'l':'r',u=raw.frame.phase-index*.5;
    const anchorZ=data.anchorZ+half*data.stepLength;
    let offset:THREE.Vector3;
    if(u<=stance){
      contact=side;offset=requiredOffset(raw,side);offset.x+=data.anchorX[index];offset.z+=anchorZ;
    }else{
      contact='flight';const nextIndex=1-index,nextSide=nextIndex===0?'l':'r',current=data.legs[index],next=data.legs[nextIndex];
      const from=requiredOffset(current.end,side).add(new THREE.Vector3(data.anchorX[index],0,anchorZ));
      const to=requiredOffset(next.start,nextSide).add(new THREE.Vector3(data.anchorX[nextIndex],0,anchorZ+data.stepLength));
      const t=(u-stance)/flight;
      offset=new THREE.Vector3(...(['x','y','z'] as const).map(k=>hermite(from[k],to[k],current.endSlope[k],next.startSlope[k],t)) as [number,number,number]);
      // Small authored clearance on top of the endpoint height trajectory. The former
      // 5.5cm boost compressed a large rise/fall into 140ms; this is not measured COM motion.
      // Zero height and velocity adjustment at both contact boundaries.
      offset.y+=16*t*t*(1-t)*(1-t)*.012*data.legLength/.8;
    }
    if(!offset.toArray().every(Number.isFinite))throw Error('Invalid contact trajectory');
    model.position.add(offset);model.updateMatrixWorld(true);
    travel.set(offset.x,0,offset.z);
    footHeights={left:raw.heights.l+offset.y-floorY,right:raw.heights.r+offset.y-floorY};lastFrame=raw.frame;
  }

  function stop(){
    if(state==='idle')return;
    state='idle';elapsed=0;lastFrame=undefined;travel.set(0,0,0);contact='flight';
    model.position.copy(origin);model.quaternion.copy(rotation);pose.apply();model.updateMatrixWorld(true);
  }
  function tick(now:number){
    if(state!=='playing')return;
    if(!Number.isFinite(now))throw Error('Invalid playback time');
    elapsed+=Math.max(0,now-lastTime);lastTime=now;
    try{render();}catch(error){stop();throw error;}
  }
  return {
    get travel(){return travel.clone();},get contact(){return contact;},get stepLength(){return plan?.stepLength;},
    get state(){return state;},get playing(){return state==='playing';},get active(){return state!=='idle';},
    get frame(){return lastFrame?structuredClone(lastFrame):undefined;},get footHeights(){return {...footHeights};},
    start(now:number){
      if(!basicRunAvailable(pose)||!Number.isFinite(now))return false;
      if(state==='idle'){origin=model.position.clone();rotation=model.quaternion.clone();elapsed=0;}
      lastTime=now;state='playing';try{render();}catch(error){stop();throw error;}return true;
    },
    pause(now:number){if(state==='playing'){tick(now);state='paused';}},
    reset(){if(state!=='idle'){elapsed=0;state='paused';render();}},
    tick,stop,
  };
}
