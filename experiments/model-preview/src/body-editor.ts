import * as T from 'three';
import {lengthFields, type LengthId} from './body-dimensions';

type Id=LengthId|'scale';
type Settings={scale:number;ratios:Record<LengthId,number>};
type Context={model:T.Group;bounds:T.Box3;baseline:Record<LengthId,number>;state:Settings}|undefined;
type Segment={key:string;id:LengthId;a:T.Vector3;b:T.Vector3};
type Options={viewport:HTMLElement;canvas:HTMLCanvasElement;camera:T.OrthographicCamera;
 getContext:()=>Context;change:(id:Id,value:number)=>void;select:(id:LengthId)=>void;redraw:()=>void};
const clamp=(id:Id,n:number)=>T.MathUtils.clamp(n,id==='scale'?.9:.85,id==='scale'?1.1:1.15);

/** Direct rest-body editing. A frozen projection and start value prevent feedback
 * when stretching the mesh also moves the floor anchor or camera framing. */
export function createBodyEditor(o:Options){
 const layer=document.createElement('div');layer.className='body-editor';layer.hidden=true;o.viewport.append(layer);
 const meter=document.createElement('div');meter.className='body-meter';meter.innerHTML='<span>부위를 잡고 조절</span><strong>길이 · 양쪽 함께</strong><small>화살표 방향으로 드래그</small>';o.viewport.after(meter);
 const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');layer.append(status);
 const buttons=new Map<string,HTMLButtonElement>(),ray=new T.Raycaster();
 let selected:string|undefined,segments:Segment[]=[],model:T.Group|undefined,meshes:T.Object3D[]=[],drag:undefined|{
  pointer:number;source:HTMLElement;model:T.Group;id:Id;value:number;start:T.Vector2;axis:T.Vector2;pixels:number;moved:boolean;
 },pending:T.Vector2|undefined,frame=0;
 const context=()=>o.getContext();
 const value=(c:NonNullable<Context>,id:Id)=>id==='scale'?c.state.scale:c.state.ratios[id];
 const label=(id:Id)=>id==='scale'?'전체 크기':lengthFields.find(f=>f.id===id)!.label;
 const units=(c:NonNullable<Context>,id:Id)=>id==='scale'?`${Math.round(c.state.scale*100)}%`:`${(c.baseline[id]*c.state.scale*c.state.ratios[id]).toFixed(1)} cm`;
 function project(p:T.Vector3){const n=p.clone().project(o.camera);return new T.Vector2((n.x+1)*o.viewport.clientWidth/2,(1-n.y)*o.viewport.clientHeight/2);}
 function rebuildSegments(c:NonNullable<Context>){
  if(model!==c.model){model=c.model;meshes=[];model.traverse(m=>{if((m as T.Mesh).isMesh)meshes.push(m);});selected=undefined;}
  c.model.updateMatrixWorld(true);
  const point=(name:string)=>c.model.getObjectByName(name)!.getWorldPosition(new T.Vector3());
  const result:Segment[]=[];
  for(const side of ['l','r'])for(const [id,a,b] of [['upperArm','upperarm','lowerarm'],['forearm','lowerarm','hand'],['thigh','thigh','calf'],['shin','calf','foot']] as const)
   result.push({key:`${id}-${side}`,id,a:point(a+'_'+side),b:point(b+'_'+side)});
  result.push({key:'torso',id:'torso',a:point('pelvis'),b:point('neck_01')});
  const left=point('upperarm_l'),right=point('upperarm_r'),center=left.clone().add(right).multiplyScalar(.5);
  for(const [side,b] of [['l',left],['r',right]] as const)result.push({key:'shoulders-'+side,id:'shoulders',a:center.clone(),b});
  segments=result;
 }
 // Classify only the first visible skin hit. Bones/handles behind the body
 // cannot steal selection from the near limb (especially in side view).
 function pick(p:T.Vector2){
  if(!context())return undefined;
  ray.setFromCamera(new T.Vector2(p.x/o.viewport.clientWidth*2-1,1-p.y/o.viewport.clientHeight*2),o.camera);
  const hit=ray.intersectObjects(meshes,false)[0];if(!hit)return undefined;
  let best:Segment|undefined,score=Infinity;
  for(const s of segments){const nearest=new T.Line3(s.a,s.b).closestPointToPoint(hit.point,true,new T.Vector3());const d=nearest.distanceToSquared(hit.point);if(d<score){score=d;best=s;}}
  // Ignore head, hands and feet rather than stretching an unrelated segment.
  if(!best)return undefined;
  const v=best.b.clone().sub(best.a),t=hit.point.clone().sub(best.a).dot(v)/v.lengthSq();
  return score<.16*.16&&t>=-.05&&t<=1.05?best:undefined;
 }
 function updateMeter(){
  const c=context();if(!c)return;
  const id=selected==='scale'?'scale':segments.find(s=>s.key===selected)?.id;
  if(!id){meter.innerHTML='<span>부위를 잡고 조절</span><strong>길이 · 양쪽 함께</strong><small>화살표 방향으로 드래그</small>';return;}
  meter.querySelector('span')!.textContent=label(id);meter.querySelector('strong')!.textContent=units(c,id);
  meter.querySelector('small')!.textContent=id==='scale'?'위로 크게 · 아래로 작게':id==='shoulders'?'바깥으로 넓게 · 안으로 좁게':'화살표 방향 · 양쪽 함께';
 }
 function select(key:string){selected=key;const s=segments.find(s=>s.key===key);if(s)o.select(s.id);refresh();}
 function announce(){const c=context(),id=drag?.id??(selected==='scale'?'scale':segments.find(s=>s.key===selected)?.id);if(c&&id)status.textContent=`${label(id)} ${units(c,id)} 적용` ;}
 function applyPending(){
  if(!drag||!pending)return;const d=drag,p=pending;pending=undefined;
  if(context()?.model!==d.model){finish(true);return;}
  const delta=p.clone().sub(d.start);if(!d.moved&&delta.length()<3)return;d.moved=true;
  o.change(d.id,clamp(d.id,d.value+delta.dot(d.axis)/d.pixels));
 }
 function finish(cancel=false){
  if(!drag)return;
  if(frame)cancelAnimationFrame(frame);frame=0;
  if(!cancel)applyPending();
  const d=drag;if(!d)return;pending=undefined;drag=undefined;
  if(d.source.hasPointerCapture(d.pointer))d.source.releasePointerCapture(d.pointer);
  layer.classList.remove('is-dragging');o.canvas.style.cursor='';
  if(cancel&&context()?.model===d.model)o.change(d.id,d.value);
  announce();o.redraw();
 }
 function start(e:PointerEvent,key:string,source:HTMLElement){
  const c=context();if(!c||drag||e.button!==0||!e.isPrimary)return;
  const s=segments.find(s=>s.key===key),id=key==='scale'?'scale':s?.id;if(!id)return;
  const axis=id==='scale'?new T.Vector2(0,-1):project(s!.b).sub(project(s!.a));
  const pixels=id==='scale'?Math.abs(project(c.bounds.max).y-project(c.bounds.min).y)/c.state.scale:axis.length()/value(c,id);
  if(pixels<15)return;axis.normalize();e.preventDefault();source.focus({preventScroll:true});select(key);
  drag={pointer:e.pointerId,source,model:c.model,id,value:value(c,id),start:new T.Vector2(e.clientX,e.clientY),axis,pixels,moved:false};
  source.setPointerCapture(e.pointerId);layer.classList.add('is-dragging');o.canvas.style.cursor='grabbing';
 }
 function bind(source:HTMLElement,key?:string){
  source.addEventListener('pointerdown',e=>{const r=o.canvas.getBoundingClientRect(),s=key??pick(new T.Vector2(e.clientX-r.left,e.clientY-r.top))?.key;if(s)start(e,s,source);});
  source.addEventListener('pointermove',e=>{
   if(drag?.pointer===e.pointerId){e.preventDefault();pending=new T.Vector2(e.clientX,e.clientY);if(!frame)frame=requestAnimationFrame(()=>{frame=0;applyPending();});}
   else if(source===o.canvas&&context()){const r=o.canvas.getBoundingClientRect();o.canvas.style.cursor=pick(new T.Vector2(e.clientX-r.left,e.clientY-r.top))?'grab':'';}
  });
  source.addEventListener('pointerup',e=>{if(drag?.pointer===e.pointerId)finish();});
  source.addEventListener('pointercancel',e=>{if(drag?.pointer===e.pointerId)finish(true);});source.addEventListener('lostpointercapture',e=>{if(drag?.pointer===e.pointerId)finish(true);});
 }
 bind(o.canvas);o.canvas.tabIndex=0;o.canvas.setAttribute('aria-label','신체 부위를 잡아 길이 조절');
 function button(key:string,id:Id){
  if(buttons.has(key))return buttons.get(key)!;
  const b=document.createElement('button');b.type='button';b.className=id==='scale'?'body-size':'body-grip';b.dataset.bodyPart=key;b.setAttribute('role','slider');b.setAttribute('aria-label',`${key.endsWith('-r')?'오른쪽 ':key.endsWith('-l')?'왼쪽 ':''}${label(id)} 조절`);
  b.innerHTML=id==='scale'?'<span>전체 크기</span><b>↕ 100%</b>':'<span class="grip-arrow" aria-hidden="true">↔</span><span class="grip-name"></span>';
  layer.append(b);buttons.set(key,b);bind(b,key);
  b.addEventListener('focus',()=>{if(!drag)select(key);});
  b.addEventListener('keydown',e=>{
   const c=context();if(!c||drag)return;const delta=id==='scale'?.01:.1/(c.baseline[id]*c.state.scale),v=value(c,id);
   const n=e.key==='Home'?(id==='scale'?.9:.85):e.key==='End'?(id==='scale'?1.1:1.15):['ArrowUp','ArrowRight'].includes(e.key)?v+delta:['ArrowDown','ArrowLeft'].includes(e.key)?v-delta:undefined;
   if(n===undefined)return;e.preventDefault();select(key);o.change(id,clamp(id,n));announce();
  });return b;
 }
 function refresh(){
  const c=context(),wasActive=!layer.hidden;layer.hidden=!c;meter.hidden=!c;if(!c){if(wasActive)o.canvas.style.cursor='';return;}
  rebuildSegments(c);o.camera.updateMatrixWorld(true);
  for(const s of segments){
   const b=button(s.key,s.id),p=project(s.a.clone().lerp(s.b,s.id==='shoulders'?.72:.53)),direction=project(s.b).sub(project(s.a));
   // Width has no usable drag axis in a strict side view. Front is one tap away.
   b.hidden=direction.length()<15||pick(p)?.key!==s.key;
   b.style.left=p.x+'px';b.style.top=p.y+'px';b.classList.toggle('selected',selected===s.key);
   b.setAttribute('aria-orientation',Math.abs(direction.y)>Math.abs(direction.x)?'vertical':'horizontal');
   (b.querySelector('.grip-arrow') as HTMLElement).style.transform=`rotate(${Math.atan2(direction.y,direction.x)}rad)`;
   b.querySelector('.grip-name')!.textContent=label(s.id);
   b.setAttribute('aria-valuemin',(c.baseline[s.id]*c.state.scale*.85).toFixed(1));b.setAttribute('aria-valuemax',(c.baseline[s.id]*c.state.scale*1.15).toFixed(1));b.setAttribute('aria-valuenow',(c.baseline[s.id]*c.state.scale*c.state.ratios[s.id]).toFixed(1));b.setAttribute('aria-valuetext',units(c,s.id));
  }
  const size=button('scale','scale');size.querySelector('b')!.textContent='↕ '+units(c,'scale');size.classList.toggle('selected',selected==='scale');
  size.setAttribute('aria-orientation','vertical');
  size.setAttribute('aria-valuemin','90');size.setAttribute('aria-valuemax','110');size.setAttribute('aria-valuenow',String(Math.round(c.state.scale*100)));size.setAttribute('aria-valuetext',units(c,'scale'));
  updateMeter();
 }
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();finish(true);}});
 window.addEventListener('blur',()=>finish(true));window.addEventListener('resize',()=>finish(true));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
 return {refresh,cancel:()=>finish(true),get dragging(){return !!drag;}};
}
