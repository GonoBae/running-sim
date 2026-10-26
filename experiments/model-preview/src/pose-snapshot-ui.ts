import {createPoseSnapshotStore, type PoseContext} from './pose-snapshot';

/** One store per page, independent of model reloads and usage analytics. */
export function connectPoseSnapshotControls(getContext:()=>PoseContext, onRestored:()=>void) {
  const save=document.getElementById('save-pose') as HTMLButtonElement;
  const restore=document.getElementById('load-pose') as HTMLButtonElement;
  const message=document.getElementById('snapshot-message')!;
  const store=createPoseSnapshotStore(getContext);
  const reasons:Record<string,string>={
    'model-mismatch':'저장할 때의 모델에서 불러올 수 있습니다.',
    'settings-changed':'설정이 바뀌어 저장·불러오기를 멈췄습니다. 새로고침하면 임시 저장한 자세가 사라집니다.',
    'definition-mismatch':'관절 설정이 달라 불러올 수 없습니다.',
    'context-changed':'모델이나 설정이 바뀌었습니다. 준비된 뒤 다시 시도해 주세요.',
    'apply-failed':'자세를 불러오지 못해 이전 자세로 되돌렸습니다.',
    'invalid-angle':'관절 각도를 확인해 주세요. 저장한 자세와 현재 값은 유지했습니다.',
  };
  function reason(code:string) {
    if (code==='model-not-ready') {
      const state=getContext().state;
      return state==='loading'?'모델을 불러오는 동안 저장·불러오기를 사용할 수 없습니다.':
        state==='error'?'모델을 불러오지 못했습니다. 모델을 다시 선택해 주세요.':
          '자세 조절을 지원하는 모델에서 사용할 수 있습니다.';
    }
    return reasons[code]??'저장값을 확인할 수 없습니다. 현재 자세와 저장본은 유지했습니다.';
  }
  function refresh(notice?:string) {
    save.textContent=store.getSnapshot()?'저장한 자세 바꾸기':'현재 자세 저장';
    try {
      const available=store.availability();
      save.disabled=!available.save.ok;restore.disabled=!available.restore.ok;
      message.textContent=!available.save.ok?reason(available.save.reason):
        store.getSnapshot()&&!available.restore.ok?reason(available.restore.reason):
          notice??(store.getSnapshot()?'자세 1개를 저장했습니다.':'아직 저장한 자세가 없습니다.');
    } catch {
      save.disabled=true;restore.disabled=true;
      message.textContent='현재 설정을 읽을 수 없습니다. 현재 자세와 임시 저장본은 유지했습니다.';
    }
  }
  save.addEventListener('click',()=>{
    try {
      const result=store.save();
      refresh(result.ok?'자세 1개를 저장했습니다.':reason(result.reason));
    } catch {refresh();}
  });
  restore.addEventListener('click',()=>{
    try {
      const result=store.restore();
      if(result.ok)onRestored();
      refresh(result.ok?'저장한 관절 각도를 불러왔습니다.':reason(result.reason));
    } catch {refresh();}
  });
  window.addEventListener('storage',()=>refresh());
  window.addEventListener('focus',()=>refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  refresh();
  return {refresh, edited:()=>refresh(store.getSnapshot()?'현재 자세를 바꿔도 저장한 자세는 유지됩니다.':undefined)};
}
