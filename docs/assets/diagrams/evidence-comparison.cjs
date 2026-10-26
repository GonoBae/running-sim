// Hand-authored product diagrams. Illustrative silhouettes/curves, not measured plots.
// Run from repository root: node docs/assets/diagrams/evidence-comparison.cjs
const fs=require('node:fs'),path=require('node:path');
const green='#237864',ink='#243c34',muted='#718277',orange='#bb6848';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const t=(x,y,s,size=18,color=ink,weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`;
const box=(x,y,w,h,fill='#fff',r=16)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="#d9e1d9"/>`;
const line=(x,y,x2,y2,c='#ced8ce',w=2)=>`<path d="M${x} ${y}L${x2} ${y2}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const arrow=(x,y,x2,y2)=>line(x,y,x2,y2,green)+`<path d="M${x2-8} ${y2-5}L${x2} ${y2}L${x2-8} ${y2+5}" fill="none" stroke="${green}" stroke-width="2"/>`;
const pill=(x,y,w,label,color=green)=>box(x,y,w,30,'#edf3ed',15)+t(x+12,y+21,label,13,color,600);
const save=(name,w,h,body)=>fs.writeFileSync(path.join(__dirname,name),`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f7f8f3"/><g font-family="Malgun Gothic, sans-serif">${body}</g></svg>\n`);
// The grey body is a layout illustration. Only the highlighted left leg is the initial data scope.
const runner=(x,y,c)=>`<g transform="translate(${x} ${y})" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="-130" r="23" fill="#d8dfd7"/><path d="M4 -98L-10 -10M0 -76L-49 -47L-72 -75M0 -76L48 -61L64 -91M-10 -10L-48 68L-29 125L-1 125" stroke="#c5cfc4" stroke-width="20"/><path d="M-10 -10L32 57L98 94L119 86" stroke="${c}" stroke-width="17"/><circle cx="32" cy="57" r="11" fill="#fff" stroke="${c}" stroke-width="4"/></g>`;
let b=t(32,48,'자세를 만들고, 근거와 함께 확인하기',30)+pill(32,68,189,'정식 기능 방향 · 확정')+pill(233,68,225,'아래 상세 흐름 · 검토 제안');
const cards=[['체형 설정','내 러너 준비','현재 길이·모델 유지'],['자세 설정','자세 조절 · 재생','기존 SCR03 흐름'],['근거 비교','내 설정 ↔ 선택한 자료','SCR08 보조 화면 제안'],['코스 설정','확인 후 계속하기','기존 순서 유지']];
cards.forEach(([h,a,c],i)=>{const x=32+i*295;b+=box(x,140,260,152,i===2?'#eaf2ea':'#fff')+t(x+20,180,h,24)+t(x+20,221,a,18)+t(x+20,260,c,15,muted);if(i<3)b+=arrow(x+266,216,x+288,216);});
b+=`<path d="M752 305V337H457V305" fill="none" stroke="${green}" stroke-width="2"/>`+t(505,365,'비교 후 자세로 돌아가 수정',17,green);
b+=box(32,394,1136,87)+t(54,425,'현재 검증 완료 · M13',18,green,600)+t(54,454,'기본 남성형 + 실측 유래 왼다리 두 각도 대응 / 내 설정 연결·전신 비교는 미구현',18,muted);
save('evidence-comparison-flow.svg',1200,510,b);

b=t(32,42,'SCR08 · 근거 기반 자세 비교',28)+pill(1035,18,370,'화면 설계 제안 · 미구현 · 도형/곡선은 예시');
b+=box(32,69,1376,73)+t(54,99,'← 자세 설정',16)+t(54,125,'내 러너와 자료를 같은 진행률에서 살펴보세요.',15,muted)+pill(528,90,215,'내 설정 ↔ 참고 자료')+t(781,115,'변경 전 ↔ 변경 후  · 후속',16,muted)+box(1215,87,171,38,'#eaf2ea',8)+t(1233,112,'자료 선택 · 출처',16,green);
b+=box(32,159,1376,59,'#eef3eb')+t(52,184,'자료  AB01 · 평지 s2x0 · 왼발 35주기 평균',17,green,600)+t(52,205,'명령 속도 2.060804 m/s · 주기 중앙값 0.78초 · Reznick 2021 / CC0',13,muted)+t(960,184,'같은 진행률 ≠ 같은 실제 시간',16,orange)+t(960,205,'내 조건과 자료 조건의 차이 보기 ↗',13,muted);
b+=box(32,234,680,398)+box(728,234,680,398);
b+=pill(54,252,112,'사용자 설정')+t(54,306,'내 러너',27)+t(54,331,'설정으로 생성한 동작',15,muted)+runner(347,461,orange);
b+=pill(750,252,146,'실측 유래 자료')+t(750,306,'선택한 참고 자료',27)+t(750,331,'마커에서 계산한 각도',15,muted)+runner(1052,461,green);
b+=t(54,601,'내 설정의 동작 연결 · 미구현',14,orange)+t(750,601,'왼다리만 강조 · 회색 부위는 비교 근거 없음',14,muted);
b+=box(32,648,1376,79)+t(54,677,'선택 부위   왼쪽 무릎 굽힘 ▾',18)+t(54,706,'내 러너  —°      자료  —°      차이  —°',16)+t(587,677,'각도 정의 · 펴짐 0° / 굽힘 +',16,green)+t(587,706,'좌표 기준 대응 전에는 차이를 계산하지 않음',14,muted)+t(1125,677,'측면  /  정면',16)+t(1125,706,'값은 실행 후 표시',13,muted);
b+=box(32,743,1376,233)+t(54,774,'한 주기 각도 변화',20)+t(890,772,'● 내 설정',15,orange)+t(1010,772,'● 참고 자료',15,green)+t(1160,772,'예시 곡선 · 측정값 아님',13,muted);
b+=line(94,804,94,897)+line(94,897,1358,897)+t(58,824,'각도',13,muted)+t(62,845,'(°)',13,muted);
b+=`<path d="M94 862C230 854 310 798 420 836S660 893 800 851S1010 782 1120 833S1280 871 1358 862" fill="none" stroke="${orange}" stroke-width="3"/><path d="M94 873C240 879 330 815 440 853S660 883 800 873S1010 789 1120 847S1280 866 1358 873" fill="none" stroke="${green}" stroke-width="3"/><path d="M726 795V900" stroke="${ink}" stroke-dasharray="4 4"/>`;
b+=t(85,917,'0%',13,muted)+t(710,917,'50%',13,muted)+t(1320,917,'100%',13,muted)+t(54,954,'▶ 재생     0.5× / 1×     ↺ 처음',16)+t(531,954,'진행률 50%  ─────●─────  두 화면 함께 이동',16,green);
b+=t(32,1008,'자료와의 차이를 보여주는 화면입니다. 일치율·최적 자세·기록 향상 점수로 표시하지 않습니다.',16,muted)+t(32,1037,'R16 / SCR08 · 위 인체는 배치 설명용 도형 · M13 실제 화면과 구분',14,muted);
save('evidence-comparison-screen.svg',1440,1060,b);

b=t(32,47,'무엇이 근거이고, 어디까지 비교할 수 있나요?',29)+pill(32,67,272,'표시·상태 정책 · 설계 제안 / 미구현');
const groups=[['사용자 설정',orange,['입력한 각도·체형','생성 방식·모델 버전','사용자를 촬영한 실측값 아님']],['실측 유래 자료',green,['참가자·조건·주기 수·출처','마커 좌표 / 계산 각도 구분','한 표본을 권장값으로 삼지 않음']],['계산 결과',ink,['두 곡선의 차이·변경량','정의·단위·대응 상태 표시','기록 예측은 별도 검증 후']]];
groups.forEach(([h,c,rows],i)=>{const x=32+i*390;b+=box(x,124,356,180)+t(x+20,161,h,24,c,600);rows.forEach((s,j)=>b+=t(x+20,201+j*33,s,17,muted));});
b+=t(32,352,'같은 기준으로 비교 가능한가?',23)+box(32,376,552,123,'#eaf2ea')+t(54,411,'대응 확인',21,green,600)+t(54,446,'같은 부위·각도 정의·단위·진행률 기준',18)+t(54,478,'차이 = 내 러너 − 자료  ·  + / − 부호 유지',16,muted);
b+=box(608,376,560,123,'#fbf1e9')+t(630,411,'자료 부족 / 대응 전 / 조건 차이',21,orange,600)+t(630,446,'누락은 —  ·  이유와 가능한 범위를 표시',18)+t(630,478,'대응 전: 차이 숨김 / 조건 차이: 탐색 비교로 표시',16,muted);
b+=box(32,523,1136,99)+t(54,555,'기록 변화로 연결하려면 · 후속 검토',20)+t(54,587,'자세 차이 → 별도 계산 모델·검증 → 지원 조건 안에서만 예상 기록 표시',18,muted);
save('evidence-comparison-evidence.svg',1200,650,b);
