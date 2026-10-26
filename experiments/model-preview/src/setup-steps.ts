type Step='body'|'pose';

/** Keep one model and its controllers alive; only switch the visible editing panel. */
export function connectSetupSteps(options:{adminPreview:boolean;canContinue:()=>boolean;beforeLeavePose:()=>void}) {
  const body=document.getElementById('body-panel')!;
  const pose=document.getElementById('pose-panel')!;
  const next=document.getElementById('next-pose') as HTMLButtonElement;
  const previous=document.getElementById('previous-body') as HTMLButtonElement;
  const title=document.getElementById('setup-title')!;
  let step:Step='body';
  function refresh(){
    let ready=false;try{ready=options.canContinue();}catch{/* Fail closed on unreadable policy. */}
    next.disabled=!ready;
    document.getElementById('step-message')!.textContent=ready?'체형을 확인했다면 자세 설정으로 넘어가세요.':'모델과 현재 설정을 확인한 뒤 다음 단계로 이동할 수 있습니다.';
  }
  function render(focus=false){
    document.body.dataset.setupStep=options.adminPreview?'admin':step;
    body.hidden=!options.adminPreview&&step!=='body';
    pose.hidden=!options.adminPreview&&step!=='pose';
    title.textContent=options.adminPreview?'모델 테스트':step==='body'?'체형 설정':'자세 설정';
    document.getElementById('stage-title')!.textContent=options.adminPreview?'웹에서 움직여 보기.':step==='body'?'내 몸에 맞춰 보기.':'달리는 자세를 잡아 보기.';
    document.getElementById('stage-label')!.textContent=options.adminPreview?'MODEL CHECK':step==='body'?'01 — BODY':'02 — POSE';
    for(const el of document.querySelectorAll<HTMLElement>('[data-setup-indicator]')){
      if(el.dataset.setupIndicator===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
    }
    refresh();
    if(focus){
      document.querySelector('aside')!.scrollTop=0;
      title.focus({preventScroll:true});
      if(matchMedia('(max-width:850px)').matches)title.scrollIntoView({block:'start'});
    }
  }
  next.addEventListener('click',()=>{
    refresh();if(next.disabled)return;
    step='pose';render(true);
  });
  previous.addEventListener('click',()=>{
    options.beforeLeavePose();step='body';render(true);
  });
  // The admin lab intentionally retains the combined inspection controls.
  for(const el of document.querySelectorAll<HTMLElement>('[data-user-steps]'))el.hidden=options.adminPreview;
  new MutationObserver(()=>refresh()).observe(document.body,{attributes:true,attributeFilter:['data-loaded']});
  addEventListener('storage',refresh);addEventListener('focus',refresh);
  render();
  return {refresh};
}
