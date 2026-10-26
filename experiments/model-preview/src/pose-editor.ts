import * as T from 'three';
import {createPosePicking,poseParts,type PosePart} from './pose-picking';

export const poseDragSettings={leg:{min:0,max:10,step:1,pixels:8},elbow:{min:-20,max:20,step:1,pixels:3},lean:{min:-10,max:15,step:1,pixels:3}} as const;
type Id=PosePart['id'];
type Context={model:T.Group;playing:boolean;phase:number;leg:number;elbow:number;lean:number}|undefined;
type Options={viewport:HTMLElement;canvas:HTMLCanvasElement;camera:T.OrthographicCamera;getContext:()=>Context;
 begin:(part:PosePart)=>void;change:(id:Id,value:number)=>void;restore:(id:Id,value:number,phase:number)=>void;redraw:()=>void};
const keyOf=(part:PosePart)=>`${part.id}-${part.side}`;
const label=(id:Id)=>id==='leg'?'다리 들림':id==='elbow'?'팔꿈치 굽힘':'상체 기울기';
const units=(id:Id,v:number)=>`${v>0?'+':''}${v}${id==='leg'?' cm':'°'}`;

/** Edits shared animation parameters. No bone transforms are authored
 * here; the established running runtime remains the only pose writer. */
export function createPoseEditor(o:Options){
 const layer=document.createElement('div');layer.className='pose-editor';layer.hidden=true;o.viewport.append(layer);
 const meter=document.createElement('div');meter.className='pose-meter';meter.hidden=true;meter.innerHTML='<span class="pose-values"></span><small></small>';o.viewport.after(meter);
 const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');layer.append(status);
 const picker=createPosePicking(o.camera),buttons=new Map<string,HTMLButtonElement>();
 let selected:PosePart|undefined,owner:T.Group|undefined,pendingY:number|undefined,frame=0;
 let drag:undefined|{part:PosePart;model:T.Group;value:number;phase:number;y:number;pointer:number;source:HTMLElement;moved:boolean};
 const context=()=>o.getContext();
 function pick(x:number,y:number){const c=context();if(!c)return;picker.update(c.model);const r=o.canvas.getBoundingClientRect();return picker.at(new T.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2));}
 function announce(cancel=false){const c=context();if(c&&selected)status.textContent=cancel?'조절 전 값과 시점으로 복원했습니다.':`${label(selected.id)} ${units(selected.id,c[selected.id])} · ${selected.id==='lean'?'상체 함께':'양쪽에 적용'}` ;}
 function applyPending(){
  if(!drag||pendingY===undefined)return;const d=drag,delta=d.y-pendingY;pendingY=undefined;
  if(context()?.model!==d.model){finish(true);return;}
  if(!d.moved&&Math.abs(delta)<3)return;d.moved=true;
  const spec=poseDragSettings[d.part.id],value=T.MathUtils.clamp(Math.round(d.value+delta/spec.pixels),spec.min,spec.max);
  if(context()![d.part.id]!==value)o.change(d.part.id,value);
 }
 function finish(cancel=false){
  if(!drag)return;if(frame)cancelAnimationFrame(frame);frame=0;if(!cancel)applyPending();
  const d=drag;if(!d)return;drag=undefined;pendingY=undefined;
  if(d.source.hasPointerCapture(d.pointer))d.source.releasePointerCapture(d.pointer);
  if(cancel&&context()?.model===d.model)o.restore(d.part.id,d.value,d.phase);
  layer.classList.remove('is-dragging');o.canvas.style.cursor='';announce(cancel);o.redraw();
 }
 function start(e:PointerEvent,part:PosePart,source:HTMLElement){
  const c=context();if(!c||drag||e.button!==0||!e.isPrimary)return;
  e.preventDefault();selected=part;source.focus({preventScroll:true});
  drag={part,model:c.model,value:c[part.id],phase:c.phase,y:e.clientY,pointer:e.pointerId,source,moved:false};
  source.setPointerCapture(e.pointerId);layer.classList.add('is-dragging');o.begin(part);o.canvas.style.cursor='ns-resize';
 }
 function bind(source:HTMLElement,part?:PosePart){
  source.addEventListener('pointerdown',e=>{const chosen=part??pick(e.clientX,e.clientY);if(chosen)start(e,chosen,source);});
  source.addEventListener('pointermove',e=>{if(drag?.pointer===e.pointerId){e.preventDefault();pendingY=e.clientY;if(!frame)frame=requestAnimationFrame(()=>{frame=0;applyPending();});}
   else if(source===o.canvas&&context())o.canvas.style.cursor=pick(e.clientX,e.clientY)?'grab':'';
  });
  source.addEventListener('pointerup',e=>{if(e.pointerId===drag?.pointer)finish();});
  for(const event of ['pointercancel','lostpointercapture'])source.addEventListener(event,e=>{if((e as PointerEvent).pointerId===drag?.pointer)finish(true);});
 }
 bind(o.canvas);
 for(const part of poseParts){
  const {id,side}=part,key=keyOf(part),b=document.createElement('button');b.type='button';b.className='pose-grip';b.dataset.posePart=key;
  b.setAttribute('role','slider');b.setAttribute('aria-orientation','vertical');b.setAttribute('aria-label',id==='lean'?'몸통 · 상체 기울기':`${side==='r'?'오른쪽':'왼쪽'} ${id==='leg'?'다리':'아래팔'} · ${label(id)}`);
  b.setAttribute('aria-valuemin',String(poseDragSettings[id].min));b.setAttribute('aria-valuemax',String(poseDragSettings[id].max));
  b.innerHTML=`<span aria-hidden="true">↕</span><span class="pose-grip-label">${id==='leg'?'다리':id==='elbow'?'팔':'몸통'} 조절</span>`;
  layer.append(b);buttons.set(key,b);bind(b,part);
  b.addEventListener('focus',()=>{selected=part;refresh();});
  b.addEventListener('keydown',e=>{const c=context();if(!c||drag)return;const spec=poseDragSettings[id],v=c[id];
   const next=e.key==='Home'?spec.min:e.key==='End'?spec.max:['ArrowUp','ArrowRight'].includes(e.key)?v+1:['ArrowDown','ArrowLeft'].includes(e.key)?v-1:undefined;
   if(next===undefined)return;e.preventDefault();selected=part;o.begin(part);o.change(id,T.MathUtils.clamp(next,spec.min,spec.max));announce();
  });
 }
 function refresh(){
  const c=context();layer.hidden=!c;meter.hidden=!c;if(!c){if(owner){picker.clear();owner=undefined;}return;}
  if(owner!==c.model){owner=c.model;selected=undefined;}
  meter.querySelector('.pose-values')!.textContent=`다리 ${units('leg',c.leg)}  ·  팔 ${units('elbow',c.elbow)}  ·  상체 ${units('lean',c.lean)}`;
  meter.querySelector('small')!.textContent=drag?(drag.part.id==='lean'?'상체 기울기 · 위로 앞으로 / 아래로 뒤로 · 기본 대비 각도':`${label(drag.part.id)} 확인 · 위로 ${drag.part.id==='leg'?'높이':'굽힘'} / 아래로 ${drag.part.id==='leg'?'낮게':'펴기'} · 양쪽 함께`):
   c.playing?'몸통·다리·아래팔을 잡으면 멈춥니다':'몸통·다리·아래팔을 위아래로 조절한 뒤 재생하세요';
  // No mesh skinning/raycast work in the playback frame loop. Handles are
  // editable on pause; grabbing actual moving skin also pauses immediately.
  if(c.playing){for(const b of buttons.values())b.hidden=true;return;}
  picker.update(c.model);o.camera.updateMatrixWorld(true);
  const world=(name:string)=>c.model.getObjectByName(name)!.getWorldPosition(new T.Vector3());
  for(const part of poseParts){
   const {id,side}=part,key=keyOf(part),b=buttons.get(key)!;
   const edges=id==='lean'?[['spine_02','neck_01']]:id==='leg'?[[`thigh_${side}`,`calf_${side}`],[`calf_${side}`,`foot_${side}`]]:[[`lowerarm_${side}`,`hand_${side}`]];let screen:T.Vector3|undefined;
   for(const [a,z] of edges){for(const ratio of [.55,.75,.3]){const p=world(a).lerp(world(z),ratio).project(o.camera);
    if(Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1)continue;
    const hit=picker.at(new T.Vector2(p.x,p.y));if(hit&&keyOf(hit)===key){screen=p;break;}
   }if(screen)break;}
   b.hidden=!screen;
   if(screen){b.style.left=`${(screen.x+1)*o.viewport.clientWidth/2}px`;b.style.top=`${(1-screen.y)*o.viewport.clientHeight/2}px`;}
   b.classList.toggle('selected',!!selected&&keyOf(selected)===key);b.setAttribute('aria-valuenow',String(c[id]));b.setAttribute('aria-valuetext',units(id,c[id]));
  }
 }
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();finish(true);}});
 window.addEventListener('blur',()=>finish(true));window.addEventListener('resize',()=>finish(true));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
 return {refresh,cancel:()=>finish(true),get dragging(){return !!drag;}};
}
