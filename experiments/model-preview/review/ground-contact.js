import {Vector3} from 'three';

// Authored support windows inferred from the source and retargeted height traces.
// These are not force-plate measurements. Wrap-around intervals use end > 1.
export const supportWindows={
  '35_17':[{side:'r',start:.28,end:.58},{side:'l',start:.75,end:1.09}],
  '127_06':[{side:'r',start:.13,end:.53},{side:'l',start:.70,end:1.08}],
};
// M23 changes the foot surface trajectory. In 127_06 the old left support
// endpoint (8%) outlasts the lower-foot crossover and lifts that foot by 8mm.
// Keep a separate, explicitly authored 6% endpoint for the new mapping.
export const relativeAnkleSupportWindows={
  ...supportWindows,
  '127_06':[{side:'r',start:.13,end:.53},{side:'l',start:.70,end:1.06}],
};
const wrap=x=>((x%1)+1)%1;
const temperature=.00005; // Smooth surface envelope; contact gap stays <1mm.
function softFloor(surface){
  const ys=[...surface.values.l,...surface.values.r],min=Math.min(...ys);
  if(!Number.isFinite(min))throw new Error('Missing foot surface');
  return min-temperature*Math.log(ys.reduce((s,y)=>s+Math.exp((min-y)/temperature),0));
}
function hermite(y0,y1,m0,m1,t){
  return (2*t**3-3*t*t+1)*y0+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*y1+(t**3-t*t)*m1;
}

export function createContactPlan(id,period,measureRaw,windows=supportWindows[id]){
  if(!windows)throw new Error('No reviewed contact windows for '+id);
  const at=phase=>-softFloor(measureRaw(wrap(phase)*period));
  const slope=phase=>{const e=.00001;return (at(phase+e)-at(phase-e))/(2*e);};
  const flights=windows.map((w,i)=>{
    const next=windows[(i+1)%windows.length],start=w.end,end=next.start+(i===windows.length-1?1:0),length=end-start;
    return {start,end,length,y0:at(start),y1:at(end),m0:slope(start)*length,m1:slope(end)*length};
  });
  return {windows,solve(frame,surface){
    const phase=wrap(frame/period);
    const support=windows.find(w=>[phase,phase+1].some(p=>p>=w.start&&p<=w.end));
    const floor=-softFloor(surface);
    let offset=floor;
    if(!support){
      const flight=flights.find(w=>[phase,phase+1].some(p=>p>=w.start&&p<=w.end));
      if(!flight)throw new Error('Uncovered contact phase');
      const p=phase<flight.start?phase+1:phase,t=(p-flight.start)/flight.length;
      const bridge=hermite(flight.y0,flight.y1,flight.m0,flight.m1,t);
      // Smooth positive part equals zero (with zero slope) at the contact ends.
      // The zero-width end condition avoids an offset jump at lift-off/landing.
      const width=.0001*Math.sin(Math.PI*t)**2,d=bridge-floor;
      offset=floor+.5*(d+Math.sqrt(d*d+width*width));
    }
    return {phase,support:support?.side||null,offset,before:{l:surface.l,r:surface.r},after:{l:surface.l+offset,r:surface.r+offset}};
  }};
}

// Geometric foot-surface samples. Body and unrelated mesh vertices are excluded.
export function footSurfaceReader(model){
  const groups=[];
  model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const {skinIndex,skinWeight}=mesh.geometry.attributes,indices={l:[],r:[]};
    for(let i=0;i<skinIndex.count;i++)for(const side of ['l','r']){
      let weight=0;
      for(let j=0;j<4;j++)if(new RegExp(`^(foot|ball)_${side}$`).test(mesh.skeleton.bones[skinIndex.getComponent(i,j)].name))weight+=skinWeight.getComponent(i,j);
      if(weight>.15)indices[side].push(i);
    }
    groups.push({mesh,indices});
  });
  const point=new Vector3();
  return ()=>{
    const values={l:[],r:[]};
    for(const {mesh,indices} of groups){
      mesh.skeleton.update();
      for(const side of ['l','r'])for(const i of indices[side]){
        mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);values[side].push(point.y);
      }
    }
    return {l:Math.min(...values.l),r:Math.min(...values.r),values};
  };
}
