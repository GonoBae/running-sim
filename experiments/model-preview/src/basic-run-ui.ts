import type * as THREE from 'three';
import type {createRunningPose} from './running-pose';
import {basicRunAvailable,createBasicRunMotion} from './basic-run-motion';

type Context={pose:ReturnType<typeof createRunningPose>;model:THREE.Group|undefined;bones:THREE.Bone[];floorY:number;ready:boolean;currentPolicy:()=>boolean};
export function connectBasicRunControls(getContext:()=>Context,beforeStart:()=>void,onTravel:(travel?:THREE.Vector3)=>void=()=>{}){
  const play=document.getElementById('play-run') as HTMLButtonElement;
  const reset=document.getElementById('reset-run') as HTMLButtonElement;
  const edit=document.getElementById('edit-run') as HTMLButtonElement;
  const message=document.getElementById('run-message')!;
  const progress=document.getElementById('run-progress') as HTMLProgressElement;
  let motion:ReturnType<typeof createBasicRunMotion>|undefined;
  let owner:Context['pose'];
  function available(){try{const c=getContext();return c.ready&&!!c.model&&c.currentPolicy()&&basicRunAvailable(c.pose);}catch{return false;}}
  function refresh(notice?:string){
    onTravel(motion?.travel);
    const ready=available();play.disabled=!ready;reset.disabled=!motion?.active;edit.disabled=!motion?.active;
    play.textContent=motion?.playing?'일시정지':motion?.active?'이어 재생':'달리기 재생';
    document.body.dataset.runState=motion?.state??'idle';
    progress.value=(motion?.frame?.phase??0)*100;
    message.textContent=notice??(!ready?'기본 달리기에 필요한 관절 범위와 준비된 모델이 필요합니다.':
      motion?.playing?'팔과 다리를 교차하며 달리고 있습니다.':motion?.active?'멈춘 동작을 확인하세요. 이어 재생할 수 있습니다.':'기본 달리기를 재생해 확인하세요.');
  }
  function stop(){motion?.stop();motion=undefined;owner=undefined;refresh();}
  play.addEventListener('click',()=>{
    if(!available()){stop();return;}
    try{
      if(motion?.playing){motion.pause(performance.now());refresh();return;}
      beforeStart();const c=getContext();
      if(!motion||owner!==c.pose){stop();owner=c.pose;motion=createBasicRunMotion(c.pose!,c.model!,c.bones,c.floorY);}
      if(!motion.start(performance.now())){stop();return;}refresh();
    }catch{stop();refresh('달리기를 적용하지 못했습니다. 편집 자세로 돌아왔습니다.');}
  });
  reset.addEventListener('click',()=>{try{motion?.reset();refresh('첫 동작으로 돌아왔습니다. 재생하면 시작합니다.');}catch{stop();}});
  edit.addEventListener('click',stop);
  for(const type of ['click','input','change'])document.addEventListener(type,event=>{
    if(motion?.active&&event.target instanceof Element&&event.target.closest(
      '#pose-angle,#pose-number,#reset-pose,#save-pose,#load-pose,#part-length,#part-number,#reset-lengths,#body-height,#reset-height,#apply-settings,[data-model-type],#file,#fit,#play-lift'))stop();
  },true);
  const policy=()=>{if(!available()&&motion?.active)stop();else refresh();};
  addEventListener('storage',policy);addEventListener('focus',policy);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&motion?.playing){try{motion.pause(performance.now());refresh('화면이 숨겨져 일시정지했습니다.');}catch{stop();}}
  });
  refresh();
  return {stop,refresh,
    tick(now:number){
      if(!motion?.active)return;
      if(!available()||owner!==getContext().pose){stop();return;}
      try{motion.tick(now);onTravel(motion.travel);progress.value=(motion.frame?.phase??0)*100;}catch{stop();refresh('달리기를 적용하지 못해 멈췄습니다.');}
    },
    get playing(){return !!motion?.playing;},get active(){return !!motion?.active;},get state(){return motion?.state??'idle';},
    get frame(){return motion?.frame;},get footHeights(){return motion?.footHeights;},
  };
}
