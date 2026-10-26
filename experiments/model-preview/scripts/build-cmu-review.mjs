// Targeted ASF/AMC downloads only; run at repo root. CMU files stay in data/raw/cmu.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../node_modules/three/build/three.module.js';
const scale=(1/.45)*2.54/100;
const vec=a=>new T.Vector3(...a);
// ASF XYZ uses fixed-axis rotations, equivalent to Three's intrinsic ZYX.
const q=a=>new T.Quaternion().setFromEuler(new T.Euler(...a.map(T.MathUtils.degToRad),'ZYX'));
function parse(subject,trial){
 const asf=fs.readFileSync(`data/raw/cmu/${subject}.asf`,'utf8'),amc=fs.readFileSync(`data/raw/cmu/${subject}_${trial}.amc`,'utf8');
 const bones=[];
 for(const block of asf.split(':bonedata')[1].split(':hierarchy')[0].matchAll(/begin([\s\S]*?)end/g)){
  const fields=Object.fromEntries(block[1].trim().split('\n').map(l=>l.trim().split(/\s+/)).map(([k,...v])=>[k,v]));
  bones.push({name:fields.name[0],direction:fields.direction.map(Number),length:Number(fields.length[0])*scale,axis:fields.axis.slice(0,3).map(Number),dof:fields.dof||[]});
 }
 const byName=new Map(bones.map(b=>[b.name,b]));
 for(const line of asf.split(':hierarchy')[1].split('\n')){
  const [parent,...children]=line.trim().split(/\s+/);for(const child of children)if(byName.has(child))byName.get(child).parent=parent;
 }
 const raw=[];let frame;
 for(const line of amc.split('\n')){
  const parts=line.trim().split(/\s+/);if(/^\d+$/.test(parts[0])){frame={};raw.push(frame);}
  else if(frame&&parts.length>1)frame[parts[0]]=parts.slice(1).map(Number);
 }
 const names=['root',...bones.map(b=>b.name)],parents=[-1,...bones.map(b=>names.indexOf(b.parent))];
 const frames=raw.map(f=>{
  const points={root:vec(f.root.slice(0,3)).multiplyScalar(scale)},rotations={root:q(f.root.slice(3))};
  function solve(b){if(points[b.name])return;if(b.parent!=='root')solve(byName.get(b.parent));
   const values=f[b.name]||[],angles=['rx','ry','rz'].map(k=>b.dof.includes(k)?values[b.dof.indexOf(k)]:0),basis=q(b.axis);
   rotations[b.name]=rotations[b.parent].clone().multiply(basis).multiply(q(angles)).multiply(basis.clone().invert());
   points[b.name]=points[b.parent].clone().add(vec(b.direction).multiplyScalar(b.length).applyQuaternion(rotations[b.name]));
  }
  bones.forEach(solve);return {p:names.map(n=>points[n].toArray()),q:names.map(n=>rotations[n].toArray())};
 });
 if(frames.some(f=>[...f.p.flat(),...f.q.flat()].some(n=>!Number.isFinite(n))))throw Error('Nonfinite source frame');
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 return {id:`${subject}_${trial}`,fps:120,names,parents,bones,frames,source:`https://mocap.cs.cmu.edu/search.php?subjectnumber=${subject}`,asfSha256:hash(asf),amcSha256:hash(amc)};
}
const clips=[parse('35','17'),parse('127','06')];
fs.mkdirSync('experiments/model-preview/review/data',{recursive:true});
fs.writeFileSync('experiments/model-preview/review/data/cmu.json',JSON.stringify(clips));
console.log(clips.map(c=>({id:c.id,frames:c.frames.length,seconds:c.frames.length/c.fps,bones:c.bones.length})));
