// Reproduce the current implementation and architecture diagrams from repo facts.
// Run from repository root: node docs/assets/diagrams/current-state.cjs
const fs = require('node:fs');
const out = 'docs/assets/diagrams/';
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const text = (x,y,s,size=20,color='#233b35',weight=400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`;
const box = (x,y,w,h,title,lines,color='#e7f0e8') => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}"/>${text(x+24,y+38,title,24,'#233b35',700)}${lines.map((s,i)=>text(x+24,y+78+i*30,s,18)).join('')}</g>`;
const arrow = (x1,y1,x2,y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="#6c8179" stroke-width="3" marker-end="url(#a)"/>`;
const svg = (title,body,height=700) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-label="${title}"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#6c8179"/></marker></defs><rect width="1200" height="${height}" fill="#fafbf8"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">${text(40,58,title,32,'#203a32',700)}${body}</g></svg>`;
fs.writeFileSync(out+'current-implementation.svg', svg('현재 구현 · 신체에서 실제 코스 주행까지',
 text(40,95,'2026-10-26 문서 대조 · M93까지의 로컬 기능 · 확정 요구 R01–R16과 별도 표시',18,'#63786e')+
 box(40,135,535,180,'01  신체 세팅  /body',['남성형·여성형 / 몸 위에서 길이·크기 조절','외형과 뼈대 함께 변경 → 달리기에 전달','구현·기능 검사: M79–M80'])+
 box(625,135,535,180,'02  자세 세팅  /pose',['다리·아래팔·몸통을 잡아 양쪽 공통 설정','착지 선택 / 기본 달리기 재생·정지·앞·옆','구현·기능 검사: M75–M84'])+arrow(582,225,618,225)+
 '<path d="M890 319 V335 H307 V350" fill="none" stroke="#6c8179" stroke-width="3" marker-end="url(#a)"/>'+
 box(40,355,535,180,'03  코스 세팅  /course',['출발점·방향 / 바퀴 또는 km / 목표 페이스','지도 도착점 / 항공사진 수정 전후 비교','구현·기능 검사: M87–M93'])+
 box(625,355,535,180,'04  백테스팅 단계  /backtest',['현재 화면 이름: 코스 주행','왼쪽 경로 이동 + 오른쪽 같은 순간 자세','구현: 주행·종료 / 미구현: 자세별 기록 예측'])+arrow(582,445,618,445)+
 text(40,583,'설정 유지',20,'#233b35',700)+text(185,583,'같은 탭의 단계 이동·새로고침: sessionStorage / 재생 시간은 다시 시작',19)+
 box(40,610,1120,110,'미완료',['현장 도착점 전체 일치 / 기록 A·B / 근거 비교 정식 화면 / 운영 관리자·통계'], '#f5e8d9'),740));
fs.writeFileSync(out+'current-architecture.svg', svg('실제 실행 구조와 후속 운영 설계',
 text(40,95,'실선 영역: 현재 코드 · 아래 회색 영역: 미연결 설계 · 2026-10-26',18,'#63786e')+
 box(40,130,360,145,'로컬 자산',['남성형·여성형 GLB (별도 전달)','35_17 유래 공통 동작 JSON'])+
 box(440,130,720,145,'Vite + TypeScript / JavaScript + Three.js',['entry.ts → stages.js → 신체·자세·코스·주행','body-runtime / running-runtime / course-playback'])+arrow(402,200,434,200)+
 box(40,315,360,175,'경로 생성·검사',['OSM 원본 검증 → C 좌표','항공사진 국소 수정 → D 자산','빌드: 원본·수정 재현 일치 검사'])+
 box(440,315,340,175,'브라우저 상태',['stage-state.ts','sessionStorage: 설정','메모리: 재생 시간·배속'])+
 box(820,315,340,175,'공통 재생 시각',['왼쪽: 코스 위 러너','오른쪽: 같은 순간 자세','설정 페이스 → 거리·시간'])+arrow(402,400,434,400)+arrow(786,400,814,400)+
 box(40,540,1120,120,'운영 연결 제안 · 아직 실행 경로에 없음',['Vercel Pro / Supabase 인증·저장·관리자·통계 / Python 계산 모델·API','React·R3F 전환, 자세별 예상 기록·A/B 비교는 후속 설계'], '#edf0f1'),690));
console.log('Generated current-implementation.svg and current-architecture.svg');
