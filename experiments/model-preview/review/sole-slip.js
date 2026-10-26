import {Vector3} from 'three';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
export const soleSlipSettings={band:.004,fadePhase:.04,maxOffset:.05,step:.25,smoothingSeconds:.025};

// Keep material vertex identities fixed. A moving lowest-point index alone
// cannot distinguish skin sliding from a foot rolling onto different vertices.
export function soleReader(model,side='r'){
  const groups=[];
  model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;
    for(let i=0;i<skinIndex.count;i++){
      let weight=0;
      for(let k=0;k<4;k++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))weight+=skinWeight.getComponent(i,k);
      if(weight>.5)ids.push(i);
    }
    groups.push({mesh,ids});
  });
  return ()=>{
    const points=[];
    for(const {mesh,ids} of groups){
      mesh.skeleton.update();
      for(const id of ids)points.push(mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld));
    }
    return points;
  };
}

export function createSoleSlipPlan(samples,fps,period,supportWindow){
  const {band,fadePhase,maxOffset}=soleSlipSettings;
  const dt=(samples[1].frame-samples[0].frame)/fps;
  let rates=samples.map(()=>new Vector3());
  const details=[];
  for(let i=1;i<samples.length-1;i++){
    const sample=samples[i],phase=sample.frame/period;
    let weightSum=0,minY=Infinity,mean=new Vector3();
    sample.points.forEach((p,j)=>{
      minY=Math.min(minY,p.y);
      const weight=smooth((band-p.y)/band);if(!weight)return;
      const velocity=samples[i+1].points[j].clone().sub(samples[i-1].points[j]).divideScalar(2*dt);velocity.y=0;
      mean.addScaledVector(velocity,weight);weightSum+=weight;
    });
    if(weightSum)mean.divideScalar(weightSum);
    const gate=smooth((phase-supportWindow.start)/fadePhase)*smooth((supportWindow.end-phase)/fadePhase)*smooth((band-minY)/band);
    rates[i].copy(mean).multiplyScalar(-gate);
    details.push({frame:sample.frame,minY,gate,mean:mean.toArray()});
  }
  // Do not transfer each small skin-velocity fluctuation into a whole-body
  // twitch. Smooth the correction velocity over time, then taper it again so
  // the filter never introduces motion outside the selected support window.
  const rawRates=rates,sigma=soleSlipSettings.smoothingSeconds/dt,radius=Math.ceil(3*sigma);
  rates=rawRates.map((_,i)=>{
    const filtered=new Vector3();let sum=0;
    for(let j=Math.max(0,i-radius);j<=Math.min(rawRates.length-1,i+radius);j++){
      const weight=Math.exp(-.5*((j-i)/sigma)**2);filtered.addScaledVector(rawRates[j],weight);sum+=weight;
    }
    const phase=samples[i].frame/period;
    return filtered.divideScalar(sum).multiplyScalar(smooth((phase-supportWindow.start)/fadePhase)*smooth((supportWindow.end-phase)/fadePhase));
  });
  // Exact zero-speed knots at authored boundaries prevent the interpolation
  // from leaking a fraction of a frame outside the selected support interval.
  const knots=samples.map((s,i)=>({frame:s.frame,rate:rates[i]}));
  for(const phase of [supportWindow.start,supportWindow.end]){
    const frame=phase*period;
    if(!knots.some(k=>Math.abs(k.frame-frame)<1e-10))knots.push({frame,rate:new Vector3()});
  }
  knots.sort((a,b)=>a.frame-b.frame);rates=knots.map(k=>k.rate);
  const durations=knots.slice(1).map((k,i)=>(k.frame-knots[i].frame)/fps);
  const integrate=()=>{
    const offsets=[new Vector3()];
    for(let i=1;i<rates.length;i++)offsets.push(offsets[i-1].clone().addScaledVector(rates[i-1],durations[i-1]/2).addScaledVector(rates[i],durations[i-1]/2));
    return offsets;
  };
  let offsets=integrate();
  const required=Math.max(...offsets.map(p=>p.length()));
  // Bound between knots too, not only at stored offsets: the integral cannot
  // travel farther than the trapezoidal integral of the endpoint speed norms.
  const bound=Math.max(...offsets.slice(0,-1).map((p,i)=>p.length()+durations[i]*(rates[i].length()+rates[i+1].length())/2));
  const gain=bound>maxOffset?maxOffset/bound:1;
  rates.forEach(v=>v.multiplyScalar(gain));offsets=integrate();
  // Integrate linearly interpolated velocity exactly: position and velocity
  // are continuous at every knot. No render-dt accumulation or seek history.
  function sample(frame){
    const f=Math.max(0,Math.min(period,frame));
    let low=0,high=knots.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(knots[mid].frame<=f)low=mid;else high=mid;}
    const i=Math.min(low,knots.length-2),t=(f-knots[i].frame)/fps;
    return offsets[i].clone().addScaledVector(rates[i],t).addScaledVector(rates[i+1].clone().sub(rates[i]),t*t/(2*durations[i]));
  }
  const peakAcceleration=values=>Math.max(...values);
  const acceleration={
    unfiltered:peakAcceleration(rawRates.slice(1).map((v,i)=>v.distanceTo(rawRates[i])/dt)),
    filtered:peakAcceleration(rates.slice(1).map((v,i)=>v.distanceTo(rates[i])/durations[i])),
  };
  return {sample,details,gain,required,acceleration,maxOffset:Math.max(...offsets.map(p=>p.length())),endOffset:offsets.at(-1).toArray(),supportWindow};
}
