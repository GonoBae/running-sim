// Independent external conversion, loaded with the published Three.js BVHLoader.
// Output is diagnostic only: never imports or writes the app's ASF parser/data.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3,Quaternion} from '../node_modules/three/build/three.module.js';
import {BVHLoader} from '../node_modules/three/examples/jsm/loaders/BVHLoader.js';
const path='data/raw/cmu-independent/35_17.bvh',raw=fs.readFileSync(path,'utf8');
const {skeleton,clip}=new BVHLoader().parse(raw),root=skeleton.bones[0];
const map={root:'Hips',lhipjoint:'LHipJoint',lfemur:'LeftUpLeg',ltibia:'LeftLeg',lfoot:'LeftFoot',ltoes:'LeftToeBase',rhipjoint:'RHipJoint',rfemur:'RightUpLeg',rtibia:'RightLeg',rfoot:'RightFoot',rtoes:'RightToeBase',lowerback:'LowerBack',upperback:'Spine',thorax:'Spine1',lowerneck:'Neck',upperneck:'Neck1',head:'Head',lclavicle:'LeftShoulder',lhumerus:'LeftArm',lradius:'LeftForeArm',lwrist:'LeftHand',lhand:'LeftFingerBase',lfingers:'LeftHandIndex1',lthumb:'LThumb',rclavicle:'RightShoulder',rhumerus:'RightArm',rradius:'RightForeArm',rwrist:'RightHand',rhand:'RightFingerBase',rfingers:'RightHandIndex1',rthumb:'RThumb'};
const frames=Number(raw.match(/Frames:\s*(\d+)/)[1]),dt=Number(raw.match(/Frame Time:\s*([\d.]+)/)[1]);
const tracks=clip.tracks.map(t=>{const [name,property]=t.name.split('.');const bone=skeleton.bones.find(b=>b.name===name);if(!bone)throw Error(name);return {t,bone,property,size:property==='position'?3:4};});
const rows=[];
for(let frame=0;frame<frames;frame++){
 for(const {t,bone,property,size} of tracks)bone[property].fromArray(t.values,frame*size);
 root.updateMatrixWorld(true);
 const points={},rotations={};
 for(const [name,target] of Object.entries(map)){
  const b=skeleton.bones.find(b=>b.name===target);if(!b)throw Error(target);
  // ASF stores segment endpoints; BVH joint origin is the segment start.
  const endpoint=name==='root'?b:b.children[0];
  points[name]=endpoint.getWorldPosition(new Vector3()).toArray();
  rotations[name]=b.getWorldQuaternion(new Quaternion()).toArray();
 }
 rows.push({points,rotations});
}
const report={source:'https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/09a07f54f3bbb58797325f009282d0b2048a2871/data/035/35_17.bvh',sha256:crypto.createHash('sha256').update(raw).digest('hex'),frames,dt,map,rows};
fs.mkdirSync('outputs/cmu-independent',{recursive:true});fs.writeFileSync('outputs/cmu-independent/bvh-samples.json',JSON.stringify(report));console.log({frames,dt,bones:skeleton.bones.length});
