import {Vector3} from 'three';

const opposite=n=>n.endsWith('_r')?n.slice(0,-2)+'_l':n.endsWith('_l')?n.slice(0,-2)+'_r':n;

// Run once on the neutral loaded asset, after the accepted ankle weights.
// Preserve the original GLB and bone motion. Body/knee/ankle weights also
// need correspondence; matching joints alone does not match the surface.
export function createBilateralSkin(model){
 model.updateMatrixWorld(true);
 const edits=[],summary={appliedVertices:0,centerVertices:0,maxCenterRedistributedWeight:0,maxRestPairMm:0,unmatchedVertices:0},unmatched=[];
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const at=mesh.geometry.attributes,bones=mesh.skeleton.bones,byName=new Map(bones.map((b,i)=>[b.name,i]));
  const cells=new Map(),points=[],step=.0002;
  const key=p=>[p.x,p.y,p.z].map(v=>Math.round(v/step)).join(',');
  mesh.skeleton.update();
  for(let i=0;i<at.position.count;i++){
   const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);points.push(p);
   if(p.x<0){const k=key(p);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);}
  }
  for(let id=0;id<points.length;id++){
   const p=points[id];
   if(Math.abs(p.x)<=1e-6){
    // A centerline vertex corresponds to itself. One-sided thigh/arm weight
    // would still deform it asymmetrically even with perfectly mirrored bones.
    const weights=new Map();
    for(let j=0;j<4;j++){
     const name=bones[at.skinIndex.getComponent(id,j)].name,w=at.skinWeight.getComponent(id,j);
     if(!w)continue;
     for(const n of [name,opposite(name)])weights.set(n,(weights.get(n)||0)+w/2);
    }
    let redistributed=0;
    while(weights.size>4){
     const pairs=[...weights].filter(([n])=>n.endsWith('_r')).sort((a,b)=>a[1]-b[1]);
     const [name,w]=pairs[0],other=opposite(name);let parent=bones[byName.get(name)].parent;
     while(/_[rl]$/.test(parent.name))parent=parent.parent;
     const mass=w+weights.get(other);weights.delete(name);weights.delete(other);
     weights.set(parent.name,(weights.get(parent.name)||0)+mass);redistributed+=mass;
    }
    const entries=[...weights],oldIndex=[0,1,2,3].map(j=>at.skinIndex.getComponent(id,j)),oldWeight=[0,1,2,3].map(j=>at.skinWeight.getComponent(id,j));
    const newIndex=[0,1,2,3].map(j=>entries[j]?byName.get(entries[j][0]):0),newWeight=[0,1,2,3].map(j=>entries[j]?.[1]||0);
    if(newIndex.some(i=>i===undefined))throw Error('Missing centerline skin ancestor.');
    edits.push({at,id,oldIndex,oldWeight,newIndex,newWeight});
    summary.centerVertices++;summary.maxCenterRedistributedWeight=Math.max(summary.maxCenterRedistributedWeight,redistributed);
    continue;
   }
   if(p.x<0)continue;
   const target=new Vector3(-p.x,p.y,p.z),base=[target.x,target.y,target.z].map(v=>Math.round(v/step));let match=-1,distance=step;
   for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const i of cells.get([base[0]+x,base[1]+y,base[2]+z].join(','))||[]){
    const d=points[i].distanceTo(target);if(d<distance){distance=d;match=i;}
   }
   if(match<0){summary.unmatchedVertices++;if(unmatched.length<4)unmatched.push({mesh:mesh.name,id,p:p.toArray()});continue;}
   const oldIndex=[0,1,2,3].map(j=>at.skinIndex.getComponent(id,j)),oldWeight=[0,1,2,3].map(j=>at.skinWeight.getComponent(id,j));
   const newIndex=[0,1,2,3].map(j=>byName.get(opposite(bones[at.skinIndex.getComponent(match,j)].name)));
   const newWeight=[0,1,2,3].map(j=>at.skinWeight.getComponent(match,j));
   if(newIndex.some(i=>i===undefined))throw Error('Missing mirrored skin bone.');
   edits.push({at,id,oldIndex,oldWeight,newIndex,newWeight});
   summary.appliedVertices++;summary.maxRestPairMm=Math.max(summary.maxRestPairMm,distance*1000);
  }
 });
 if(summary.unmatchedVertices)throw Error('Missing mirrored surface vertices: '+JSON.stringify(unmatched));
 let enabled=false;
 function setEnabled(value){
  if(enabled===value)return;enabled=value;
  for(const e of edits)for(let j=0;j<4;j++){
   e.at.skinIndex.setComponent(e.id,j,(enabled?e.newIndex:e.oldIndex)[j]);
   e.at.skinWeight.setComponent(e.id,j,(enabled?e.newWeight:e.oldWeight)[j]);
  }
  for(const {at}of edits){at.skinIndex.needsUpdate=true;at.skinWeight.needsUpdate=true;}
 }
 return {setEnabled,summary,get enabled(){return enabled;}};
}
