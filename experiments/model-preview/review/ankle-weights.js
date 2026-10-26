import {Vector3} from 'three';

// A local, reversible weight experiment for the default GLBs. Call at rest.
// Positions, bind matrices, skeleton and on-disk assets are never changed.
export function createAnkleWeights(model){
  model.updateMatrixWorld(true);
  const records=[],stats=[];
  model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
    mesh.skeleton.update();
    const originalIndex=skinIndex.array.slice(),originalWeight=skinWeight.array.slice();
    const nextIndex=originalIndex.slice(),nextWeight=originalWeight.slice();
    const groups=new Map(),keys=[];
    for(let i=0;i<position.count;i++){
      // GLB may split a surface vertex at UV/normal seams. Smooth it once.
      const key=[position.getX(i),position.getY(i),position.getZ(i)].map(x=>x.toFixed(6)).join(',');
      if(!groups.has(key))groups.set(key,{ids:[],neighbours:new Set()});
      groups.get(key).ids.push(i);keys[i]=key;
    }
    const index=mesh.geometry.index,count=index?.count||position.count;
    for(let i=0;i<count;i+=3){
      const triangle=[0,1,2].map(j=>index?index.getX(i+j):i+j);
      for(const a of triangle)for(const b of triangle)if(keys[a]!==keys[b])groups.get(keys[a]).neighbours.add(keys[b]);
    }
    for(const side of ['l','r']){
      const ci=mesh.skeleton.bones.findIndex(b=>b.name==='calf_'+side),fi=mesh.skeleton.bones.findIndex(b=>b.name==='foot_'+side);
      if(ci<0||fi<0)continue;
      const ankle=mesh.skeleton.bones[fi].getWorldPosition(new Vector3());
      const weights=Array.from({length:position.count},(_,i)=>{
        let calf=0,foot=0;
        for(let j=0;j<4;j++){const bone=skinIndex.getComponent(i,j),weight=skinWeight.getComponent(i,j);if(bone===ci)calf+=weight;if(bone===fi)foot+=weight;}
        return {calf,foot};
      });
      const eligible=key=>groups.get(key).ids.every(i=>weights[i].calf+weights[i].foot>.999);
      const active=new Set([...groups].filter(([key,g])=>{
        // Include exported morph values when locating the neutral ankle band.
        const y=mesh.getVertexPosition(g.ids[0],new Vector3()).applyMatrix4(mesh.matrixWorld).y;
        return eligible(key)&&y>ankle.y-.03&&y<ankle.y+.15;
      }).map(([key])=>key));
      let values=new Map([...groups].map(([key,g])=>[key,weights[g.ids[0]].foot]));
      for(let pass=0;pass<10;pass++){
        const next=new Map(values);
        for(const key of active){
          const neighbours=[...groups.get(key).neighbours].filter(eligible);
          if(neighbours.length)next.set(key,.5*values.get(key)+.5*neighbours.reduce((sum,k)=>sum+values.get(k),0)/neighbours.length);
        }
        values=next;
      }
      let changed=0,maxWeightChange=0;
      for(const key of active)for(const i of groups.get(key).ids){
        const foot=values.get(key),difference=Math.abs(foot-weights[i].foot);
        if(difference<1e-7)continue;
        nextIndex.set([ci,fi,0,0],i*4);nextWeight.set([1-foot,foot,0,0],i*4);
        changed++;maxWeightChange=Math.max(maxWeightChange,difference);
      }
      stats.push({mesh:mesh.name,side,changed,maxWeightChange});
    }
    records.push({skinIndex,skinWeight,originalIndex,originalWeight,nextIndex,nextWeight});
  });
  let enabled=false;
  return {stats,get enabled(){return enabled;},setEnabled(value){
    if(value===enabled)return;
    for(const r of records){
      r.skinIndex.array.set(value?r.nextIndex:r.originalIndex);r.skinWeight.array.set(value?r.nextWeight:r.originalWeight);
      r.skinIndex.needsUpdate=true;r.skinWeight.needsUpdate=true;
    }
    enabled=value;
  }};
}
