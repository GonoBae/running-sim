import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {totalDistanceM,goalLabel,paceLabel,durationLabel} from './course';
import './course-run.css';

/** A display-only copy: no IK, skin weights, bone angles or source transforms change. */
export function createCourseRunView(root,actions){
 root.innerHTML=`<div class="run-heading"><div><p class="eyebrow">COURSE PLAYBACK</p><h2>롯데가든파크를 달리다</h2></div><span id="run-status" role="status">준비 중</span></div>
 <p id="run-course-label"></p><div id="course-run-viewport"><div class="run-camera"><button id="run-follow" aria-pressed="true">러너 따라가기</button><button id="run-overview" aria-pressed="false">전체 코스</button></div><div id="run-map" aria-label="코스 안 현재 위치"></div><div id="run-loading" role="status">코스와 달리기를 준비하는 중…</div></div>
 <div class="run-credit">실제 경로 · 평면/폭은 표시용 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></div>
 <div class="run-metrics"><div><small>이동 거리</small><strong id="run-distance">—</strong></div><div><small>완료한 바퀴</small><strong id="run-laps">—</strong></div><div><small>경과 시간</small><strong id="run-time">—</strong></div><div><small id="run-duration-label">총 소요 시간</small><strong id="run-duration">—</strong></div></div>
 <div class="run-controls"><button id="run-play" class="primary" disabled>재생</button><button id="run-reset" disabled>처음부터</button><label for="run-rate">재생 배속 <select id="run-rate"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
 <label class="run-progress-label" for="run-progress">코스 진행 위치 <output id="run-percent">0%</output></label><input id="run-progress" aria-label="코스 진행 위치" type="range" min="0" max="1" step="0.00001" value="0" disabled>
 <p id="run-speed" class="run-note">기존 달리기 동작의 속도로 재생합니다. 기록 예측은 제공하지 않습니다.</p>`;
 const $=id=>root.querySelector('#'+id),viewport=$('course-run-viewport');
 let renderer,scene,camera,terrain,traveler,cycleOffset,copy,source,pairs=[],course,draft,origin,travel,overview=false,lastFrame;
 let minimapRunner,minimapSize=1;
 function init(){
  if(renderer)return;
  renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));viewport.prepend(renderer.domElement);
  scene=new T.Scene();scene.background=new T.Color('#e9eee4');camera=new T.PerspectiveCamera(42,1,.05,4000);
  scene.add(new T.HemisphereLight(0xffffff,0x7a8477,2.5));const sun=new T.DirectionalLight(0xfff5e8,3);sun.position.set(2,4,5);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(3000,3000),new T.MeshBasicMaterial({color:'#e4eadc'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
  const grid=new T.GridHelper(3000,600,0xc9d4c0,0xd8e1d0);grid.position.y=-.005;scene.add(grid);
  traveler=new T.Group();cycleOffset=new T.Group();traveler.add(cycleOffset);scene.add(traveler);
  viewport.insertAdjacentHTML('beforeend','<span id="run-location-pin" hidden>러너</span>');
 }
 function releaseTerrain(){if(!terrain)return;scene.remove(terrain);terrain.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 function bind(model,c,d,o,delta){
  init();course=c;draft={...d};origin=o;travel=delta;
  if(source!==model){
   if(copy){copy.removeFromParent();copy.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
   source=model;copy=clone(model);cycleOffset.add(copy);
   const from=[],to=[];source.traverse(o=>from.push(o));copy.traverse(o=>to.push(o));pairs=from.map((node,i)=>[node,to[i]]);
  }
  releaseTerrain();terrain=new T.Group();terrain.scale.set(c.distanceScale,1,c.distanceScale);scene.add(terrain);
  const verts=[];
  for(let i=1;i<c.local.length;i++){
   const a=new T.Vector3(c.local[i-1][0],.003,-c.local[i-1][1]),b=new T.Vector3(c.local[i][0],.003,-c.local[i][1]);
   const n=new T.Vector3(b.z-a.z,0,a.x-b.x).normalize().multiplyScalar(1.8),v=[a.clone().add(n),a.clone().sub(n),b.clone().add(n),b.clone().sub(n)];
   for(const j of [0,1,2,2,1,3])verts.push(...v[j].toArray());
   const joint=new T.Mesh(new T.CircleGeometry(1.8,16),new T.MeshBasicMaterial({color:'#c8b7a0',side:T.DoubleSide}));joint.rotation.x=-Math.PI/2;joint.position.copy(a);terrain.add(joint);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  terrain.add(new T.Mesh(geometry,new T.MeshBasicMaterial({color:'#c8b7a0',side:T.DoubleSide})));
  const line=new T.Line(new T.BufferGeometry().setFromPoints(c.local.map(p=>new T.Vector3(p[0],.009,-p[1]))),new T.LineBasicMaterial({color:'#f9f8ed'}));terrain.add(line);
  for(let m=0;m<c.lengthM;m+=20){const p=c.pointAt(m/c.distanceScale),mark=new T.Mesh(new T.CircleGeometry(.18,10),new T.MeshBasicMaterial({color:'#829574'}));mark.rotation.x=-Math.PI/2;mark.position.set(p[0],.012,-p[1]);terrain.add(mark);}
  const total=totalDistanceM(c,d),start=c.atTravel(d,0),finish=c.atTravel(d,total),same=Math.hypot(start[0]-finish[0],start[1]-finish[1])<.01;
  for(const m of same?[0]:[0,total]){
   const p=c.atTravel(d,m),next=c.atTravel(d,m+1),flag=new T.Group();flag.name=m===0?'start-line':'finish-line';flag.position.set(p[0],.016,-p[1]);flag.rotation.y=Math.atan2(next[0]-p[0],-(next[1]-p[1]));terrain.add(flag);
   for(let x=0;x<8;x++)for(let z=0;z<2;z++){const tile=new T.Mesh(new T.PlaneGeometry(.45,.45),new T.MeshBasicMaterial({color:(x+z)%2?(m===0&&!same?'#344d3a':'#5454a8'):'#fffdf2',side:T.DoubleSide}));tile.rotation.x=-Math.PI/2;tile.position.set((x-3.5)*.45,0,(z-.5)*.45);flag.add(tile);}
  }
  const xs=c.local.map(p=>p[0]),zs=c.local.map(p=>-p[1]),x=Math.min(...xs),z=Math.min(...zs),w=Math.max(...xs)-x,h=Math.max(...zs)-z;minimapSize=Math.max(w,h);
  $('run-map').innerHTML=`<svg viewBox="${x-20} ${z-20} ${w+40} ${h+40}" role="img" aria-label="출발점·도착점과 현재 러너 위치"><polyline points="${c.local.map(p=>`${p[0]},${-p[1]}`).join(' ')}" fill="none" stroke="#7f9b76" stroke-width="5"/><circle cx="${start[0]}" cy="${-start[1]}" r="6" fill="#d67b48"/><circle id="run-map-finish" cx="${finish[0]}" cy="${-finish[1]}" r="${same?10:7}" fill="${same?'none':'#5454a8'}" stroke="${same?'#5454a8':'white'}" stroke-width="2"/><path id="run-map-runner" d="M0,-10 L-7,8 L7,8 Z" fill="#294632" stroke="white" stroke-width="2"/></svg><small>${same?'출발·도착':'출발 <span>●</span> · 도착 <span class="finish-color">●</span>'} · 현재 ▲</small>`;
  minimapRunner=$('run-map-runner');
  $('run-course-label').textContent=`${d.direction==='forward'?'시계':'반시계'} 방향 · ${goalLabel(d)}${d.goal?'':` · ${(total/1000).toFixed(2)} km`}${d.paceSecondsPerKm?` · ${paceLabel(d.paceSecondsPerKm)}`:''}`;
 }
 function render(frame){
  if(!renderer||!copy)return;lastFrame=frame;
  for(const [a,b] of pairs){b.position.copy(a.position);b.quaternion.copy(a.quaternion);b.scale.copy(a.scale);if(a.morphTargetInfluences)b.morphTargetInfluences=[...a.morphTargetInfluences];}
  // Remove only the clip's linear cycle travel before adding continuous route travel.
  // Residual pelvis sway and all vertical/relative joint motion remain intact.
  cycleOffset.position.set(-origin.x-travel.x*frame.phase,0,-origin.z-travel.z*frame.phase);
  traveler.position.set(frame.position[0]*course.distanceScale,0,-frame.position[1]*course.distanceScale);traveler.rotation.y=frame.heading;scene.updateMatrixWorld(true);
  const rect=viewport.getBoundingClientRect();if(!rect.width||!rect.height)return;
  camera.aspect=rect.width/rect.height;
  if(overview){
   const points=course.local.map(p=>new T.Vector3(p[0]*course.distanceScale,0,-p[1]*course.distanceScale)),center=new T.Box3().setFromPoints(points).getCenter(new T.Vector3());
   const direction=new T.Vector3(.15,1,.35).normalize(),right=new T.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right).normalize();
   const tanY=Math.tan(camera.fov*Math.PI/360),tanX=tanY*camera.aspect;
   const distance=Math.max(20,...points.map(p=>{const v=p.clone().sub(center);return v.dot(direction)+Math.max(Math.abs(v.dot(right))/tanX,Math.abs(v.dot(up))/tanY);}))*1.12;
   camera.position.copy(center).addScaledVector(direction,distance);camera.lookAt(center);
  }
  else{const target=traveler.position.clone().add(new T.Vector3(0,.9,0));camera.position.copy(target).add(new T.Vector3(5,3.2,7));camera.lookAt(target);}
  camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);renderer.render(scene,camera);
  const pin=$('run-location-pin');pin.hidden=!overview;
  if(overview){const p=traveler.position.clone().add(new T.Vector3(0,2,0)).project(camera);pin.style.left=(p.x*.5+.5)*rect.width+'px';pin.style.top=(-p.y*.5+.5)*rect.height+'px';}
  // SVG points are East/South; a north-pointing arrow is rotated by world yaw + pi.
  minimapRunner.setAttribute('transform',`translate(${frame.position[0]},${-frame.position[1]}) rotate(${180-frame.heading*180/Math.PI}) scale(${minimapSize/550})`);
  $('run-status').textContent=frame.complete?'주행 완료':frame.playing?'재생 중':frame.elapsed===0?'출발 준비':'일시정지';
  $('run-play').textContent=frame.complete?'다시 재생':frame.playing?'일시정지':'재생';
  $('run-distance').textContent=`${(frame.distanceM/1000).toFixed(2)} / ${(frame.totalM/1000).toFixed(2)} km`;
  $('run-laps').textContent=draft.goal?`${frame.completedLaps}바퀴`:`${frame.completedLaps} / ${draft.laps}`;$('run-time').textContent=durationLabel(frame.elapsed);
  $('run-duration-label').textContent=frame.targetPace?'예상 소요 · 설정 기준':'총 소요 · 동작 기준';$('run-duration').textContent=durationLabel(frame.duration);
  $('run-progress').value=String(frame.progress);$('run-percent').textContent=(frame.progress*100).toFixed(1)+'%';$('run-rate').value=String(frame.rate);
  $('run-speed').textContent=frame.targetPace?`목표 ${paceLabel(frame.paceSecondsPerKm)} · ${(frame.speedMps*3.6).toFixed(2)} km/h · 지도 경로 거리 × 설정 페이스 · 실제 기록 예측은 아닙니다.`:`동작 기준 ${frame.speedMps.toFixed(2)} m/s · 지도 경로 거리 · 재생 시간이며 예상 기록은 아닙니다.`;
 }
 function ready(value,message='코스와 달리기를 준비하는 중…'){
  for(const id of ['run-play','run-reset','run-progress','run-rate'])$(id).disabled=!value;
  $('run-loading').hidden=value;$('run-loading').textContent=message;
  if(!value)$('run-status').textContent='준비 중';
 }
 $('run-play').onclick=actions.play;$('run-reset').onclick=actions.reset;
 $('run-progress').oninput=e=>actions.seek(+e.target.value);$('run-rate').onchange=e=>actions.rate(+e.target.value);
 function view(value){overview=value;$('run-overview').setAttribute('aria-pressed',String(value));$('run-follow').setAttribute('aria-pressed',String(!value));if(lastFrame)render(lastFrame);}
 $('run-follow').onclick=()=>view(false);$('run-overview').onclick=()=>view(true);
 new ResizeObserver(()=>{if(lastFrame&&!root.hidden)render(lastFrame);}).observe(viewport);
 ready(false);
 return {bind,render,ready,get model(){return copy;},get group(){return traveler;},get offset(){return cycleOffset;},get camera(){return camera;}};
}
