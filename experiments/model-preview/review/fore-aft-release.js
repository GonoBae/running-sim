import {Vector3,Quaternion} from 'three';
import {solve} from './stance-chain.js';
export const foreAftSettings={start:.46,end:.58,samples:64,band:.004,maxOffset:.003};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
const basis=(u,j)=>u**3*(1-u)**3*(j?2*u-1:1);
const derivative=(u,j)=>{const b=u**3*(1-u)**3,d=3*u*u*(1-u)**2*(1-2*u);return j?d*(2*u-1)+2*b:d;};
// Fixed material vertex IDs. Current-frame weights describe geometric proximity,
// not pressure/contact forces. This reader is used only while preparing a model.
export function createForeAftReader(model){
 const groups=[];model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;const ids=[],{skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let id=0;id<skinIndex.count;id++){let w=0;for(let j=0;j<4;j++)if(/^(foot|ball)_r$/.test(mesh.skeleton.bones[skinIndex.getComponent(id,j)].name))w+=skinWeight.getComponent(id,j);if(w>.5)ids.push(id);}
  groups.push({mesh,ids});
 });
 return ()=>{const points=[];for(const {mesh,ids} of groups){mesh.skeleton.update();for(const id of ids)points.push(mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld));}return points;};
}
export function createForeAftCurve(sample,seconds){
 const {start,end,samples,band,maxOffset}=foreAftSettings,phaseStep=(end-start)/samples,dt=phaseStep*seconds;
 const frames=[];for(let i=-1;i<=samples+1;i++)frames.push(sample(start+i*phaseStep));
 let a=0,b=0,c=0,r=0,s=0;
 for(let i=0;i<=samples;i++){
  const u=i/samples,frame=frames[i+1],p=derivative(u,0)/((end-start)*seconds),q=derivative(u,1)/((end-start)*seconds);
  let mass=0,velocity=0;
  for(let j=0;j<frame.length;j++){
   const w=smooth((band-Math.max(0,frame[j].y))/band);if(!w)continue;
   mass+=w;velocity+=w*(frames[i+2][j].z-frames[i][j].z)/(2*dt);
  }
  a+=mass*p*p;b+=mass*p*q;c+=mass*q*q;r-=velocity*p;s-=velocity*q;
 }
 const det=a*c-b*b;if(!(det>1e-12))throw Error('Insufficient fore-aft contact samples');
 const coefficients=[(r*c-s*b)/det,(s*a-r*b)/det];
 let peak=0;for(let i=0;i<=1000;i++)peak=Math.max(peak,Math.abs(coefficients[0]*basis(i/1000,0)+coefficients[1]*basis(i/1000,1)));
 const scale=Math.min(1,maxOffset/Math.max(peak,1e-12));
 return {coefficients:coefficients.map(c=>c*scale),scale,offset(phase){
  const u=(phase-start)/(end-start);return u<=0||u>=1?0:scale*(coefficients[0]*basis(u,0)+coefficients[1]*basis(u,1));
 }};
}
export function applyForeAftRelease(model,bones,pivot,phase,curve,read){
 const {start,end}=foreAftSettings;if(phase<=start||phase>=end)return {active:false};
 const by=n=>bones.find(b=>b.name===n),hip=by('thigh_r'),knee=by('calf_r'),foot=by('foot_r');
 const pos=b=>b.getWorldPosition(new Vector3()),q=foot.getWorldQuaternion(new Quaternion()),upper=pos(knee).sub(pos(hip));
 const floor=read('r').min,target=pivot.read(),offset=curve.offset(phase);target.z+=offset;
 const goal=pos(foot);
 for(let i=0;i<5;i++){
  const p=pivot.read();goal.x+=target.x-p.x;goal.z+=target.z-p.z;goal.y+=floor-read('r').min;
  solve(model,hip,knee,foot,goal,q,0,upper);
  const after=pivot.read();if(Math.hypot(target.x-after.x,target.z-after.z,floor-read('r').min)<1e-7)break;
 }
 return {active:true,offset,target:target.toArray(),pivot:pivot.read().toArray()};
}
