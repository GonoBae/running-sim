import * as THREE from 'three';
import type {createRunningPose} from './running-pose';
import {createBodyPicking} from './body-picking';

type Pose=NonNullable<ReturnType<typeof createRunningPose>>;
type Context={pose:Pose|undefined;model:THREE.Group|undefined;bones:THREE.Bone[];ready:boolean;editable:boolean;currentPolicy:()=>boolean};
export const elbowPixelsPerDegree=2;
type Options={
  viewport:HTMLElement;camera:THREE.PerspectiveCamera;controls:{enabled:boolean};
  getContext:()=>Context;stopPlayback:()=>void;onEdited:(jointId:string)=>void;
};

/** Both elbows share the policy and a single drag lock; each keeps its own start value. */
export function connectElbowDrag(options:Options) {
  const picker=createBodyPicking(options.camera),canvas=options.viewport.querySelector('canvas')!;
  canvas.tabIndex=0;canvas.setAttribute('aria-label','러너 시점 조절 · 오른쪽 아래팔을 잡아 팔꿈치 조절');
  let hover=false,selected=false,lastModel:THREE.Group|undefined;
  const handles:ReturnType<typeof connectElbowHandle>[]=[];
  function enabled(){try{const c=options.getContext();return c.ready&&c.editable&&c.currentPolicy()&&!!c.pose?.definitions.find(j=>j.id==='lowerarm_r');}catch{return false;}}
  function syncPicker(){const c=options.getContext();if(c.model!==lastModel){hover=selected=false;lastModel=c.model;}picker.update(c.model);}
  for(const side of ['l','r'] as const)handles.push(connectElbowHandle({...options,side,canvas,isBusy:()=>handles.some(h=>h.dragging),
    visible:(bone,hand)=>{syncPicker();return picker.jointVisible(side,bone,hand);},
  }));
  function hits(event:PointerEvent){
    if(!enabled())return false;syncPicker();
    const r=canvas.getBoundingClientRect();
    return picker.isRightForearm(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2));
  }
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary||handles.some(h=>h.dragging))return;
    selected=hits(event);
    if(selected){event.preventDefault();event.stopImmediatePropagation();handles[1].start(event,canvas);}
  },true);
  canvas.addEventListener('pointermove',event=>{if(!handles.some(h=>h.dragging))hover=hits(event);});
  canvas.addEventListener('pointerleave',()=>{hover=false;});
  document.getElementById('bone')!.addEventListener('change',()=>{selected=false;});
  return {
    refresh(){
      const context=options.getContext();
      if(context.ready&&context.editable)syncPicker();
      handles.forEach(h=>h.refresh());
      if(!enabled())hover=selected=false;
      picker.highlight(enabled()&&(hover||selected));
      canvas.style.cursor=enabled()&&(hover||handles[1].dragging)?'ns-resize':'';
      options.viewport.dataset.selectedPart=selected?'right-forearm':'';
      options.viewport.dataset.hoverPart=hover?'right-forearm':'';
    },
    cancel:()=>handles.forEach(h=>h.cancel()),
    get dragging(){return handles.some(h=>h.dragging);},
  };
}

/** One screen-space joint handle. Rotations still pass through the existing pose policy. */
function connectElbowHandle(options:Options&{side:'l'|'r';canvas:HTMLCanvasElement;isBusy:()=>boolean;visible:(bone:THREE.Bone,hand:THREE.Bone)=>boolean}) {
  const jointId=`lowerarm_${options.side}`;
  const jointLabel=options.side==='l'?'왼쪽 팔꿈치':'오른쪽 팔꿈치';
  const handle=document.createElement('button');
  handle.type='button';handle.id=options.side==='l'?'elbow-handle':'right-elbow-handle';handle.className='joint-handle';handle.hidden=true;
  handle.dataset.side=options.side;
  handle.setAttribute('role','slider');handle.setAttribute('aria-orientation','vertical');
  handle.setAttribute('aria-label',`${jointLabel} 굽힘`);handle.setAttribute('aria-describedby','elbow-help');
  handle.innerHTML='<span class="joint-dot" aria-hidden="true"></span><span class="joint-label" aria-hidden="true"></span>';
  options.viewport.append(handle);
  const label=handle.querySelector('.joint-label')!;
  const message=document.getElementById('elbow-message')!;
  let drag:{pointer:number;y:number;angle:number;pose:Pose;controlsEnabled:boolean;source:HTMLElement}|undefined;
  function live(){
    try{
      const c=options.getContext(),joint=c.pose?.definitions.find(j=>j.id===jointId);
      const bone=c.bones.find(b=>b.name===jointId);
      return c.ready&&c.editable&&c.currentPolicy()&&c.pose&&joint&&bone?{pose:c.pose,joint,bone}:undefined;
    }catch{return undefined;}
  }
  function finish(cancel=false){
    if(!drag)return;
    const previous=drag;drag=undefined;
    options.controls.enabled=previous.controlsEnabled;
    handle.classList.remove('is-dragging');
    if(previous.source.hasPointerCapture(previous.pointer))previous.source.releasePointerCapture(previous.pointer);
    if(cancel&&options.getContext().pose===previous.pose){
      const result=previous.pose.restore({...previous.pose.values,[jointId]:previous.angle});
      if(result.ok)options.onEdited(jointId);
      message.textContent=result.ok?'조절을 취소하고 시작 각도로 돌아왔습니다.':'시작 각도로 복원하지 못했습니다. 현재 자세를 확인하세요.';
    }else if(!cancel){message.textContent=`${jointLabel} 각도를 적용했습니다.`;}
  }
  function setAngle(value:number){
    const c=live();if(!c)return false;
    const angle=THREE.MathUtils.clamp(Math.round(value),c.joint.min,c.joint.max);
    const result=c.pose.restore({...c.pose.values,[jointId]:angle});
    if(!result.ok){message.textContent='각도를 적용하지 못했습니다. 기존 자세를 유지합니다.';return false;}
    options.onEdited(jointId);
    message.textContent=value<c.joint.min||value>c.joint.max?`${c.joint.min}° ~ ${c.joint.max}° 범위 끝입니다.`:`${jointLabel} ${angle}° · 위로 굽힘 / 아래로 펴기`;
    return true;
  }
  function start(event:PointerEvent,source:HTMLElement){
    if(options.isBusy()||event.button!==0||!event.isPrimary)return;
    if(source===handle&&handle.hidden)return;
    let c=live();if(!c)return;
    options.stopPlayback();c=live();if(!c)return;
    source.focus({preventScroll:true});
    drag={pointer:event.pointerId,y:event.clientY,angle:c.pose.values[jointId],pose:c.pose,controlsEnabled:options.controls.enabled,source};
    options.controls.enabled=false;handle.classList.add('is-dragging');
    source.setPointerCapture(event.pointerId);options.onEdited(jointId);
    message.textContent='위로 굽히기 · 아래로 펴기 · Escape로 취소';
  }
  handle.addEventListener('pointerdown',event=>{
    event.preventDefault();event.stopPropagation();start(event,handle);
  });
  function move(event:PointerEvent){
    if(!drag||event.pointerId!==drag.pointer)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(live()?.pose!==drag.pose){finish(true);return;}
    if(!setAngle(drag.angle+(drag.y-event.clientY)/elbowPixelsPerDegree))finish(true);
  }
  const sources:HTMLElement[]=options.side==='r'?[handle,options.canvas]:[handle];
  for(const source of sources){
    source.addEventListener('pointermove',move,true);
    source.addEventListener('pointerup',event=>{
      if(event.pointerId===drag?.pointer){event.preventDefault();event.stopImmediatePropagation();finish();}
    },true);
    source.addEventListener('pointercancel',()=>finish(true));
    source.addEventListener('lostpointercapture',()=>finish(true));
    source.addEventListener('blur',()=>finish(true));
  }
  handle.addEventListener('keydown',event=>{
    const c=live();if(!c)return;
    const value=c.pose.values[jointId];
    const target=event.key==='ArrowUp'||event.key==='ArrowRight'?value+1:
      event.key==='ArrowDown'||event.key==='ArrowLeft'?value-1:
      event.key==='Home'?c.joint.min:event.key==='End'?c.joint.max:undefined;
    if(target===undefined||options.isBusy())return;
    event.preventDefault();event.stopPropagation();options.stopPlayback();setAngle(target);refresh();
  });
  addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();finish(true);}});
  addEventListener('blur',()=>finish(true));
  addEventListener('resize',()=>finish(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
  for(const event of ['click','input','change'])document.addEventListener(event,e=>{
    if(drag&&e.target instanceof Element&&e.target.closest('aside,.views,#file'))finish(true);
  },true);
  // Stop immediately on navigation/loading/policy changes, including outside the render loop.
  new MutationObserver(()=>{if(drag&&live()?.pose!==drag.pose)finish(true);refresh();})
    .observe(document.body,{attributes:true,attributeFilter:['data-loaded','data-setup-step']});
  addEventListener('storage',()=>{if(drag&&!live())finish(true);refresh();});
  function refresh(){
    let c=live();
    if(drag&&c?.pose!==drag.pose){finish(true);c=live();}
    if(!c){handle.hidden=true;return;}
    options.camera.updateMatrixWorld();
    const point=c.bone.getWorldPosition(new THREE.Vector3()).project(options.camera);
    const hand=options.getContext().bones.find(b=>b.name===`hand_${options.side}`);
    const visible=!!hand&&options.visible(c.bone,hand);
    handle.hidden=!visible;
    if(!visible&&drag?.source===handle)finish(true);
    const width=options.viewport.clientWidth,height=options.viewport.clientHeight;
    handle.style.left=`${(point.x+1)*width/2}px`;handle.style.top=`${(1-point.y)*height/2}px`;
    const angle=c.pose.values[jointId];
    label.textContent=`${jointLabel} ${angle}° ↕`;
    handle.setAttribute('aria-valuemin',String(c.joint.min));handle.setAttribute('aria-valuemax',String(c.joint.max));
    handle.setAttribute('aria-valuenow',String(angle));handle.setAttribute('aria-valuetext',`${angle}도`);
  }
  return {handle,refresh,start,cancel:()=>finish(true),get dragging(){return !!drag;}};
}
