import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {sourceRootTravel} from './root-travel.js';
import {soleReader,createSoleSlipPlan,soleSlipSettings} from './sole-slip.js';
import {supportWindows,relativeAnkleSupportWindows} from './ground-contact.js';

const names=['pelvis','ball_l','ball_r'];
const colors=['#b47808','#007fba','#c04381'];
const position=b=>b.getWorldPosition(new T.Vector3());

export function createTravelComparison({sourceGroup,modelGroup,lines,dots,camera,state,apply,slipMode=false}){
  let fixed, fixedBones=[],paths=[],markers=[],traces=[],building=false,currentFrame=0;
  let laneWidth=3;
  let slipPlan=null;
  const slipEnabled=()=>slipMode&&document.getElementById('sole-slip').checked&&document.getElementById('grounding').checked;
  lines.visible=false;dots.forEach(dot=>dot.visible=false);
  const getBones=model=>{const result=[];model.traverse(o=>{if(o.isBone)result.push(o);});return result;};
  function update(frame){
    if(!fixed)return;
    const s=state();currentFrame=frame;
    fixed.position.copy(s.model.position);
    s.bones.forEach((b,i)=>{
      fixedBones[i].position.copy(b.position);fixedBones[i].quaternion.copy(b.quaternion);fixedBones[i].scale.copy(b.scale);
    });
    const travel=sourceRootTravel(s.clip,s.cycle,frame,s.heading,s.scale);
    if(slipMode)fixed.position.add(travel);
    s.model.position.add(travel);
    if(slipPlan&&slipEnabled())s.model.position.add(slipPlan.sample(frame));
    fixed.updateMatrixWorld(true);s.model.updateMatrixWorld(true);
    if(building)return;
    for(let lane=0;lane<2;lane++)for(let j=0;j<3;j++){
      const bones=lane?s.bones:fixedBones,group=lane?modelGroup:sourceGroup;
      const dot=markers[lane*3+j];
      dot.position.copy(group.worldToLocal(position(bones.find(b=>b.name===names[j]))));
      const support=j>0&&s.contact?.support===(j===1?'l':'r');
      dot.scale.setScalar(j===0?1:support?1.65:.65);
      dot.material.opacity=j===0||support?1:.4;
    }
    const d=sourceRootTravel(s.clip,s.cycle,frame,s.heading,s.scale);
    document.getElementById('travel-status').textContent=`${Math.min(100,frame/s.cycle.period*100).toFixed(0)}% · 복원 변위: 전후 ${d.z.toFixed(2)}m / 좌우 ${d.x.toFixed(2)}m${frame>=s.cycle.period?' · 한 주기 완료':''}`;
    if(slipMode)document.getElementById('travel-status').textContent+=` · 오른발 보정 ${slipEnabled()&&slipPlan?(slipPlan.sample(frame).length()*100).toFixed(1):'0.0'}cm`;
  }
  function rebuild(){
    const s=state();
    if(fixed)sourceGroup.remove(fixed);
    for(const object of [...paths,...markers]){
      object.removeFromParent();object.geometry.dispose();object.material.dispose();
    }
    paths=[];markers=[];traces=[[],[]].map(()=>names.map(()=>[]));
    fixed=clone(s.model);fixedBones=getBones(fixed);sourceGroup.add(fixed);
    // Clone shares mesh geometry/materials with the live model. Never dispose it
    // separately: model replacement owns these resources.
    building=true;slipPlan=null;
    if(slipMode&&document.getElementById('grounding').checked){
      const read=soleReader(s.model),samples=[];
      for(let f=0;f<=s.cycle.period;f+=soleSlipSettings.step){apply(f);samples.push({frame:f,points:read()});}
      const windows=document.getElementById('ankle-relative').checked?relativeAnkleSupportWindows:supportWindows;
      slipPlan=createSoleSlipPlan(samples,s.clip.fps,s.cycle.period,windows[s.clip.id].find(w=>w.side==='r'));
    }
    for(let f=0;f<=s.cycle.period;f++){
      apply(f);
      for(let lane=0;lane<2;lane++)for(let j=0;j<3;j++){
        const bones=lane?s.bones:fixedBones,group=lane?modelGroup:sourceGroup;
        traces[lane][j].push(group.worldToLocal(position(bones.find(b=>b.name===names[j]))));
      }
    }
    for(let lane=0;lane<2;lane++)for(let j=0;j<3;j++){
      const group=lane?modelGroup:sourceGroup;
      const line=new T.Line(new T.BufferGeometry().setFromPoints(traces[lane][j]),new T.LineBasicMaterial({color:colors[j],transparent:true,opacity:.7}));
      // Pelvis is inside the skin: this diagnostic marker is intentionally
      // visible through it, unlike user interaction handles.
      const dot=new T.Mesh(new T.SphereGeometry(.035,12,10),new T.MeshBasicMaterial({color:colors[j],transparent:true,depthTest:j!==0}));
      if(j===0)dot.renderOrder=2;
      group.add(line,dot);paths.push(line);markers.push(dot);
    }
    building=false;apply(s.frame);
    view(s.side);
  }
  function view(side){
    if(!traces.length)return;
    const axis=side?'z':'x';
    const ranges=traces.map(lane=>{
      const values=lane.flat().map(p=>p[axis]);return {min:Math.min(...values),max:Math.max(...values)};
    });
    laneWidth=Math.max(...ranges.map(r=>r.max-r.min))+1.25;
    [sourceGroup,modelGroup].forEach((g,i)=>{
      g.position.set(0,0,0);
      g.position[axis]=(side?1:-1)*(i===0?1:-1)*laneWidth/2-(ranges[i].min+ranges[i].max)/2;
      // Static ground remains a world reference, not a moving treadmill.
      const grid=g.children.find(o=>o.isGridHelper);if(grid)grid.scale.setScalar(2.5);
    });
    camera.position.set(side?10:0,side?2:.95,side?0:10);camera.lookAt(0,.95,0);camera.updateMatrixWorld(true);
    let extentX=0,extentY=0;
    [sourceGroup,modelGroup].forEach((group,lane)=>{
      group.updateMatrixWorld(true);
      // Fit the complete trajectory in camera space, including its depth when
      // viewing from the front. Pelvis + .9m also leaves head/arm clearance.
      for(let j=0;j<3;j++)for(const p of traces[lane][j])for(const lift of j===0?[0,.9]:[0]){
        const point=p.clone().add(new T.Vector3(0,lift,0)).applyMatrix4(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        extentX=Math.max(extentX,Math.abs(point.x));extentY=Math.max(extentY,Math.abs(point.y));
      }
    });
    // Reference points lie inside the skin; allow heels, hands and the head
    // beyond them so the complete runner stays visible at both endpoints.
    const halfHeight=Math.max(1.15,extentY+.25,(extentX+.5)/camera.aspect);
    camera.left=-halfHeight*camera.aspect;camera.right=halfHeight*camera.aspect;
    camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    apply(currentFrame);
  }
  return {update,rebuild,view,get slipPlan(){return slipPlan;},get fixed(){return fixed;},get fixedBones(){return fixedBones;},get traces(){return traces;},get markers(){return markers;}};
}
