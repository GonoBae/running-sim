import {createLegLiftMotion,legLiftLimit} from './leg-lift-motion';
import type {createRunningPose} from './running-pose';

type Pose=ReturnType<typeof createRunningPose>;
type Context={pose:Pose;ready:boolean;currentPolicy:()=>boolean};
export function connectLegLiftControls(getContext:()=>Context) {
  const input=document.getElementById('lift-angle') as HTMLInputElement;
  const number=document.getElementById('lift-number') as HTMLInputElement;
  const play=document.getElementById('play-lift') as HTMLButtonElement;
  const halt=document.getElementById('stop-lift') as HTMLButtonElement;
  const message=document.getElementById('lift-message')!;
  let motion:ReturnType<typeof createLegLiftMotion>|undefined;
  let owner:Pose;
  function available() {
    try {
      const c=getContext();return c.ready&&c.currentPolicy()?legLiftLimit(c.pose):undefined;
    }catch{return undefined;}
  }
  function refresh(notice?:string) {
    const limit=available();
    for(const el of [input,number]){el.disabled=limit===undefined;el.max=String(limit??0);}
    // A disabled range clamps to zero while the model loads; resync it on readiness.
    if(limit!==undefined&&Number.isInteger(number.valueAsNumber)&&number.valueAsNumber>=0&&number.valueAsNumber<=limit)
      input.value=number.value;
    play.disabled=limit===undefined||!!motion?.playing;halt.disabled=!motion?.playing;
    document.getElementById('lift-section')!.dataset.playing=String(!!motion?.playing);
    message.textContent=notice??(limit===undefined?'준비된 모델과 최신 설정이 필요합니다. 고관절 조절과 0°를 허용해야 합니다.':
      motion?.playing?'좌우 다리를 번갈아 올리는 중입니다.':'최대 올림 각도를 설정한 뒤 재생하세요.');
  }
  function stop(notice?:string) {
    const wasPlaying=!!motion?.playing;
    motion?.stop();
    refresh(notice??(wasPlaying?'정지했습니다. 편집하던 자세로 돌아왔습니다.':undefined));
  }
  function edit(el:HTMLInputElement) {
    stop();const limit=available(),value=el.valueAsNumber;
    if(limit===undefined)return;
    if(!Number.isInteger(value)||value<0||value>limit){refresh(`0° ~ ${limit}° 사이의 정수를 입력하세요.`);return;}
    input.value=number.value=String(value);refresh('최대 올림 각도를 바꿨습니다. 재생해서 확인하세요.');
  }
  input.addEventListener('input',()=>edit(input));number.addEventListener('change',()=>edit(number));
  play.addEventListener('click',()=>{
    const limit=available(),value=number.valueAsNumber,c=getContext();
    if(limit===undefined||!c.pose){refresh();return;}
    if(owner!==c.pose){motion?.stop();owner=c.pose;motion=createLegLiftMotion(c.pose);}
    try {
      if(!motion!.start(value,performance.now())){refresh(`0° ~ ${limit}° 사이의 정수를 입력하세요.`);return;}
      refresh();
    }catch{stop('동작을 적용하지 못해 재생을 멈췄습니다.');}
  });
  halt.addEventListener('click',()=>stop());
  // Stop before existing handlers save, restore, edit shape, or count an applied configuration.
  for(const type of ['click','input','change'])document.addEventListener(type,event=>{
    const target=event.target;
    if(motion?.playing&&target instanceof Element&&target.closest(
      '#pose-angle,#pose-number,#reset-pose,#save-pose,#load-pose,#part-length,#part-number,#reset-lengths,#body-height,#reset-height,#apply-settings,[data-model-type],#file,#fit'))stop();
  },true);
  addEventListener('storage',()=>{if(available()===undefined)stop();else refresh();});
  addEventListener('focus',()=>{if(available()===undefined)stop();else refresh();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('탭이 숨겨져 재생을 멈췄습니다. 다시 재생하세요.');});
  refresh();
  return {
    refresh,stop,
    tick(now:number){
      if(!motion?.playing)return;
      if(available()===undefined||owner!==getContext().pose){stop();return;}
      try{motion.tick(now);}catch{stop('동작을 적용하지 못해 재생을 멈췄습니다.');}
    },
    get playing(){return !!motion?.playing;},
    get frame(){return motion?.frame;},
  };
}
