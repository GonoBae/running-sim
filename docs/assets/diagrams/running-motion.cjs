// Source for the agreed interaction flow and proposed screen. No implementation screenshot.
const fs = require('node:fs');
const path = require('node:path');
const text = (x,y,s,size=20,color='#203c34') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${s}</text>`;
const box = (x,y,w,h,fill='#ffffff') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="#ccd9d2"/>`;
const arrow = (x,y,x2,y2) => `<path d="M${x} ${y} L${x2} ${y2}" stroke="#598673" stroke-width="3" fill="none" marker-end="url(#arrow)"/>`;
const runner = (x,y,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="#345e4f" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="-102" r="18" fill="#d6e5dc"/><path d="M5 -77 L-8 -12 M0 -60 L-34 -38 L-55 -63 M0 -60 L35 -45 L57 -65 M-8 -12 L42 8 L38 65 L65 65 M-8 -12 L-40 35 L-65 58 L-47 65"/></g>`;
function save(name,height,body){fs.writeFileSync(path.join(__dirname,name),`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${height}" viewBox="0 0 1120 ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#598673"/></marker></defs><rect width="1120" height="${height}" fill="#f5f7f3"/><g font-family="Malgun Gothic, sans-serif">${body}</g></svg>\n`);}
save('running-motion-flow.svg',440,
 text(36,48,'주요 자세 잡기 → 달리기 재생 → 보고 수정',30)+text(36,80,'합의한 사용자 흐름 · M06 다리 올림 반복 확인 · 완성 달리기/접지 미구현',17)+
 box(36,120,310,170)+text(60,156,'01  사용자가 자세 조절',23)+text(60,199,'다리 올림 · 회수 · 착지',20)+text(60,235,'팔 · 상체 등 러닝에 필요한 입력',17)+
 arrow(355,203,391,203)+box(405,120,310,170)+text(429,156,'02  시스템이 동작 생성',23)+text(429,199,'설정한 자세를 달리기에 반영',20)+text(429,235,'사이 동작 · 좌우 교대 · 반복',17)+
 arrow(724,203,760,203)+box(774,120,310,170)+text(798,156,'03  재생하며 확인',23)+text(798,199,'원하는 움직임인지 보기',20)+text(798,235,'멈춤 → 자세 수정 → 다시 재생',17)+
 `<path d="M930 303 V332 H190 V303" fill="none" stroke="#598673" stroke-width="3" marker-end="url(#arrow)"/>`+
 text(365,364,'수정한 설정으로 다시 생성',18)+text(36,411,'M01 저장·복원 + M06 다리 올림: 로컬 확인  /  완성 달리기·접지: 별도 검증 필요',17));
save('running-motion-screen.svg',660,
 text(36,46,'달리는 자세 만들기',30)+text(36,78,'SCR03 화면 배치 제안 · 미구현 · 자세 종류와 조작 방식은 검토 대상',17)+
 box(36,104,650,500)+text(60,141,'자세 조절 / 달리기 미리보기',22)+runner(350,350,1.35)+
 `<path d="M120 453 H600" stroke="#ccd9d2" stroke-width="2"/>`+text(60,490,'정면 · 측면 보기',17)+
 box(60,518,170,58,'#d6e5dc')+text(88,555,'▶ 달리기 재생',20)+box(246,518,120,58)+text(279,555,'정지',20)+text(396,554,'↻ 반복 미리보기',18)+
 box(710,104,374,500)+text(734,145,'주요 자세',24)+text(734,181,'다리 올림  /  회수  /  착지',20)+
 box(734,205,326,110,'#edf3ed')+text(754,243,'선택한 자세를 조절',21)+text(754,280,'허용 방향 · 범위 안에서 입력',17)+
 text(734,358,'착지 방식',22)+text(734,394,'뒤꿈치  /  미드풋  /  앞꿈치',19)+text(734,428,'선택이 발 접촉으로 이어지는지 검증',16)+
 text(734,493,'입력 → 캐릭터 자세 확인',19)+text(734,530,'재생 → 수정 → 다시 재생',19)+text(734,571,'프레임·시각 수동 배치는 필수 아님',16)+
 text(36,638,'그림의 캐릭터는 배치 설명용 도형입니다. 실제 모델 화면이나 접지 검증 결과가 아닙니다.',17));
