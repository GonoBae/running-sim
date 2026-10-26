import {Vector3} from 'three';

export const HEIGHT_WINDOW=Object.freeze({start:.10,end:.24,edge:.014,derivativeStep:1e-5});
const halfPhase=phase=>((phase%.5)+.5)%.5;

// Integrate a cubic velocity curve. Its integral is a quartic position curve;
// matching velocity and acceleration at the joins makes position C2.
function velocitySegment(v0,a0,v1,a1,length){
 const c=[v0,a0*length,-3*v0-2*a0*length+3*v1-a1*length,2*v0+a0*length-2*v1+a1*length];
 const velocity=x=>c.reduce((sum,v,i)=>sum+v*x**i,0);
 const acceleration=x=>c.slice(1).reduce((sum,v,i)=>sum+(i+1)*v*x**i,0)/length;
 const integral=x=>length*c.reduce((sum,v,i)=>sum+v*x**(i+1)/(i+1),0);
 return {velocity,acceleration,integral};
}

export function createHeightBridge(sample,options=HEIGHT_WINDOW){
 const {start,end,edge,derivativeStep:h}=options,L=end-start;
 if(!(edge>0&&2*edge<L&&h>0))throw Error('Invalid height connection window.');
 const endpoint=t=>{const left=sample(t-h),p=sample(t),right=sample(t+h);return {p,v:(right-left)/(2*h),a:(right-2*p+left)/(h*h)};};
 const A=endpoint(start),B=endpoint(end);
 // Solve the middle velocity from the required total vertical displacement.
 const middle=(B.p-A.p-edge*(A.v+B.v)/2-edge*edge*(A.a-B.a)/12)/(L-edge);
 const enter=velocitySegment(A.v,A.a,middle,0,edge),leave=velocitySegment(middle,0,B.v,B.a,edge);
 const first=enter.integral(1),flat=L-2*edge;
 function read(t){
  const u=t-start;
  if(u<=edge){const x=u/edge;return {y:A.p+enter.integral(x),v:enter.velocity(x),a:enter.acceleration(x)};}
  if(u<L-edge)return {y:A.p+first+middle*(u-edge),v:middle,a:0};
  const x=(u-L+edge)/edge;
  return {y:A.p+first+middle*flat+leave.integral(x),v:leave.velocity(x),a:leave.acceleration(x)};
 }
 return {read,start,end,edge,A,B,middle};
}

export function createBodyHeight(plan,lane,probe,options=HEIGHT_WINDOW){
 const pelvis=lane.model.getObjectByName('pelvis'),travelY=plan.pelvisTravel.y;
 const sample=t=>{
  plan.apply(lane,probe,t);
  return pelvis.getWorldPosition(new Vector3()).y-t*travelY;
 };
 const bridge=createHeightBridge(sample,options);
 function apply(target,mirrorProbe,phase){
  const baseline=plan.apply(target,mirrorProbe,phase),t=halfPhase(phase);
  if(t<=bridge.start||t>=bridge.end)return {...baseline,bodyHeightDelta:0,groundLimited:false};
  const beforeY=target.model.getObjectByName('pelvis').getWorldPosition(new Vector3()).y;
  const desired=bridge.read(t).y+phase*travelY-beforeY;
  // plan.apply leaves its hidden probe at the unshifted mirrored pose. Include
  // its matching shift so both halves use the same skin-based ground guard.
  const minimum=Math.min(
   target.readSurface('r').min,target.readSurface('l').min,
   mirrorProbe.readSurface('r').min+baseline.heightShift,
   mirrorProbe.readSurface('l').min+baseline.heightShift
  );
  const delta=Math.max(desired,-minimum);
  target.model.position.y+=delta;target.model.updateMatrixWorld(true);
  return {...baseline,bodyHeightDelta:delta,groundLimited:delta>desired+1e-9,minimumBefore:minimum};
 }
 return {apply,bridge,options};
}
