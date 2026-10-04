// Rebuild documentation diagrams: node docs/assets/diagrams/generate.cjs
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const colors = { confirmed: ['#e5f2eb', '#276648', '확정'], tested: ['#e5f2eb', '#276648', '시험 확인'], proposed: ['#eaf0fa', '#3e5b91', '제안'], pending: ['#fff0db', '#886024', '미검증'], later: ['#edf0f2', '#64707a', '후속'] };
function text(x,y,value,size=19,color='#27313b',anchor='middle',weight=500) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${esc(value)}</text>`;
}
function card(x,y,w,title,lines=[],status='proposed',h=132) {
  const [fill,ink,badge] = colors[status];
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="white" stroke="#d9dfe5"/><rect x="${x+16}" y="${y+14}" width="86" height="24" rx="12" fill="${fill}"/>${text(x+59,y+31,badge,13,ink)}${text(x+w/2,y+64,title,21,'#27313b','middle',650)}${lines.map((v,i)=>text(x+w/2,y+91+i*23,v,16,'#63717d')).join('')}</g>`;
}
function arrow(points, label='', lx=0,ly=0) {
  return `<path d="${points}" fill="none" stroke="#98a3ae" stroke-width="2.5" stroke-linejoin="round" marker-end="url(#arrow)"/>${label?text(lx,ly,label,15,'#63717d'):''}`;
}
function note(x,y,w,value) {
  return `<rect x="${x}" y="${y}" width="${w}" height="48" rx="12" fill="#edf0f2"/>${text(x+w/2,y+30,value,17)}`;
}
function make(file,title,subtitle,height,body) {
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${height}" viewBox="0 0 1120 ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(subtitle)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#98a3ae"/></marker></defs><rect width="1120" height="${height}" rx="24" fill="#f7f8fa"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif">${text(40,48,title,28,'#202b36','start',700)}${text(40,78,subtitle,16,'#63717d','start')}${body}</g></svg>\n`;
  fs.writeFileSync(path.join(out,file+'.svg'),svg);
}
make('journey','서비스 이용 흐름','기존 화면 순서 유지 · 캐릭터 내 동작 편집은 추가 검토',360,
  card(40,116,220,'메인',['내 러너 만들기'],'confirmed')+card(310,116,220,'캐릭터',['체형 + 자세 · 동작 편집 검토'],'confirmed')+card(580,116,220,'코스',['실제 트랙 + 실행 조건'],'confirmed')+card(850,116,230,'주행과 비교',['왼쪽 트랙 · 오른쪽 자세'],'confirmed')+
  arrow('M 260 182 H 302')+arrow('M 530 182 H 572')+arrow('M 800 182 H 842')+
  note(40,282,1040,'목표: 같은 능력·노력 조건에서 자세 A/B의 시뮬레이션 예상 기록 비교'));
make('comparison','자세를 바꾸면 무엇을 비교하나요','실행 방식의 설계안 · 비용·능력·노력 모델은 아직 미선정',530,
  card(40,116,300,'고정 페이스',['거리 + 페이스 고정'],'proposed')+card(410,116,300,'동작 관찰',['자세 A / 자세 B'],'proposed')+card(780,116,300,'같은 소요 시간',['시간 = 거리 ÷ 속도'],'proposed')+
  arrow('M 340 182 H 402')+arrow('M 710 182 H 772')+
  card(40,300,300,'같은 노력 조건',['체형·능력·코스·거리 고정'],'proposed')+card(410,300,300,'자세 A / 자세 B',['동작 + 비용 계산'],'pending')+card(780,300,300,'예상 기록 비교',['속도·시간 산출 → B − A'],'pending')+
  arrow('M 340 366 H 402')+arrow('M 710 366 H 772')+note(40,460,1040,'표시: 시뮬레이션 예상 기록 / 미지원 이유 · 자세 추천과 교정 점수는 제외'));
make('stack','언어와 도구','현재 시험과 본 서비스 제안을 구분한 기술 구성',570,
  card(40,120,300,'TypeScript · Three.js',['Vite 기반 로컬 모델 시험'],'tested')+card(410,120,300,'MakeHuman → GLB',['MPFB · Blender'],'tested')+card(780,120,300,'Vercel Pro',['웹 배포 방향 · 배포 전'],'confirmed')+
  card(40,310,300,'React · R3F · Drei',['설정 화면 + 두 시점 3D'],'proposed')+card(410,310,300,'Python → FastAPI',['계산 검증 → 웹 연결'],'proposed')+card(780,310,300,'Supabase',['관리자 인증 · 게시 · 통계'],'pending')+
  arrow('M 190 252 V 302')+arrow('M 560 252 V 277 H 210 V 302')+
  note(40,478,1040,'계산 서버는 실행량 측정 후 선정 · GLB는 외형·뼈대 자료이며 기록 계산 모델은 별도'));
make('architecture','하나의 실행 결과로 두 화면을 재생','설계안 · 현재는 로컬 모델·관절·관리자 시험까지 구현',704,
  card(40,126,270,'설정 확정',['체형·자세·코스·실행 방식'],'proposed')+card(425,126,270,'실행 엔진',['동작 생성 + 경로 + 계산'],'proposed')+card(810,126,270,'실행 결과',['동작·거리·속도·시간'],'proposed')+
  arrow('M 310 192 H 417')+arrow('M 695 192 H 802')+
  card(40,320,270,'자산과 모델',['GLB·코스·사용자 제작 동작','검증된 비용·능력 모델'],'pending',150)+arrow('M 310 389 H 360 V 225 H 417')+
  card(425,320,270,'공통 재생 시간',['결과의 같은 시점 읽기'],'proposed')+arrow('M 945 258 V 285 H 560 V 312')+
  card(810,320,270,'A/B 비교',['자세 외 조건 일치 검사'],'proposed')+arrow('M 945 258 V 312')+
  card(235,524,270,'왼쪽 트랙',['실제 경로 위의 러너'],'proposed')+card(580,524,270,'오른쪽 자세',['동일 순간 · 전신 확대'],'proposed')+
  arrow('M 560 452 V 484 H 370 V 516')+arrow('M 560 484 H 715 V 516'));
make('solver','자세에서 예상 기록까지','연결 구조 제안 · 비용 함수·노력 정책·해법 모두 선정 전',560,
  card(40,120,300,'조건 고정',['체형·능력·노력·코스·자세'],'proposed')+card(410,120,300,'속도 후보',['모델 지원 범위 안에서'],'proposed')+card(780,120,300,'동작 생성과 측정',['각도·주기·접지 확인'],'pending')+
  arrow('M 340 186 H 402')+arrow('M 710 186 H 772')+
  card(780,320,300,'비용 계산',['실제 생성 동작 / 명시한 특징'],'pending')+card(410,320,300,'노력 조건 확인',['불일치 → 속도 후보 재검토'],'pending')+card(40,320,300,'최종 실행 자료',['동작 + 속도 + 예상 시간'],'proposed')+
  arrow('M 930 252 V 312')+arrow('M 780 386 H 718')+arrow('M 410 386 H 348', '충족',379,375)+arrow('M 560 320 V 260', '반복',600,290)+
  note(40,484,1040,'생성 불가 / 범위 밖 / 해 없음 → 계산 불가 · 보기 배속은 예상 기록에 영향 없음'));
make('roadmap','개발 순서와 통과 조건','문서 최우선 · 다음 작은 작업은 함께 검토한 뒤 선택',560,
  card(40,120,300,'P0 기획과 설계',['요구·기술·구조 일치'],'proposed')+card(410,120,300,'P1 입력과 근거',['자료·지원 범위·평가 기준'],'pending')+card(780,120,300,'P2 체형과 자세 재생',['치수·각도·접지·좌우 일치'],'pending')+
  arrow('M 340 186 H 402')+arrow('M 710 186 H 772')+
  card(780,320,300,'P3 기록 모델 검증',['비용 → 속도 → 시간 평가'],'pending')+card(410,320,300,'P4 서비스 통합',['설정 → 주행 → 자세 A/B'],'pending')+card(40,320,300,'P5 공개 준비',['성능·비용·권한·배포'],'later')+
  arrow('M 930 252 V 312')+arrow('M 780 386 H 718')+arrow('M 410 386 H 348')+
  note(40,484,1040,'P2 고정 페이스 재생은 중간 검증 · 서비스 완료에는 자세별 예상 기록 비교가 필요'));
make('validation','실제 자료로 검증하는 순서','검증 계획 · 보정 자료와 독립 평가 자료를 참가자 단위로 분리',600,
  card(40,120,270,'원자료 확인',['출처·사용 조건·측정량'],'pending')+card(425,120,270,'단위와 기준 정리',['좌표·관절·측정 / 추정 구분'],'proposed')+card(810,120,270,'참가자별 분리',['보정용 / 독립 평가용'],'proposed')+
  arrow('M 310 186 H 417')+arrow('M 695 186 H 802')+
  card(810,338,270,'모델 보정',['보정용 자료만 사용'],'proposed')+card(425,338,270,'모델과 기준 고정',['지원 범위·오차 기준'],'proposed')+card(40,338,270,'독립 평가',['오차·한계·버전 보고서'],'proposed')+
  arrow('M 945 252 V 330')+arrow('M 810 404 H 703')+arrow('M 425 404 H 318')+arrow('M 945 252 V 288 H 175 V 330','독립 평가용 자료',400,279)+
  note(40,512,1040,'각도 일치 · 접지 일관성 · 비용 정확도 · 완주 시간 정확도는 각각 별도 검사'));
make('export','Blender에서 웹까지','현재 모델 기준 · 원본 .blend는 보관하고 복사본을 GLB로 출력',380,
  card(40,126,220,'저장한 .blend',['몸체 + 뼈대'],'tested')+card(310,126,220,'보조 형상 정리',['원본과 출력 분리'],'tested')+card(580,126,220,'GLB 내보내기',['Shape Keys + Skinning'],'tested')+card(850,126,230,'웹에서 확인',['GLB 열기 → 조절 → 복원'],'tested')+
  arrow('M 260 192 H 302')+arrow('M 530 192 H 572')+arrow('M 800 192 H 842')+
  note(40,294,1040,'초기 원본 시험: 53개 뼈 · 12개 변형키 / 최신 길이·자세 검사는 검증 문서 참고'));
make('pose','러닝 자세 입력 후보','최종 항목·각도 기준·범위·기록 계산 지원은 검증 후 결정',580,
  card(40,124,300,'상체 기울기',['몸통 기준선 ↔ 수직'],'proposed')+card(410,124,300,'다리 들기',['한 주기 최대 전방 각도'],'proposed')+card(780,124,300,'팔 흔들기',['어깨 기준 전후 운동 범위'],'proposed')+
  arrow('M 190 256 V 288 H 560 V 326')+arrow('M 560 256 V 326')+arrow('M 930 256 V 288 H 560')+
  card(40,334,300,'목표값과 실제값',['생성한 동작에서 각도 측정'],'pending')+card(410,334,300,'달리기 한 주기',['무릎·발목·접지 연동'],'pending')+card(780,334,300,'기록 계산 지원 검사',['지원하지 않으면 비교 불가'],'pending')+
  arrow('M 410 400 H 348')+arrow('M 710 400 H 772')+
  note(40,504,1040,'시각적으로 조절 가능 ≠ 기록 효과 계산 가능 · 원시 뼈 이름과 X/Y/Z는 최종 설정에서 제외'));
make('states','실행과 재생 상태','화면 설계안 · 계산 상태와 보기 상태를 별도로 관리',530,
  card(40,118,220,'입력 검사',['오류·범위 밖 → 수정'],'proposed')+card(310,118,220,'계산 중',['이전 결과와 구분'],'proposed')+card(580,118,220,'준비 완료',['결과 자료 확보'],'proposed')+card(850,118,230,'재생 ↔ 정지',['좌우 함께 제어'],'proposed')+
  arrow('M 260 184 H 302')+arrow('M 530 184 H 572')+arrow('M 800 184 H 842')+
  card(40,312,300,'실패 / 미지원',['이유 표시 · 임의 결과 없음'],'proposed')+card(410,312,300,'완료 / 중도 종료',['완주 기록과 진행 거리 구분'],'proposed')+card(780,312,300,'기준 A → 비교 B',['A 보존 · 자세만 변경'],'proposed')+
  arrow('M 420 250 V 280 H 190 V 304')+arrow('M 965 250 V 280 H 560 V 304')+arrow('M 710 378 H 772'));
make('admin-flow','사용자와 관리자의 연결','운영 구조 제안 · 현재는 브라우저 안의 로컬 시험만 구현',570,
  card(40,120,300,'관리자 로그인',['서버 권한 확인'],'pending')+card(410,120,300,'모델과 설정 검증',['모델 버전·각도·노출 항목'],'proposed')+card(780,120,300,'게시 버전',['사용자는 게시 설정만 읽기'],'proposed')+
  arrow('M 340 186 H 402')+arrow('M 710 186 H 772')+
  card(780,320,300,'사용자 설정 확정',['남성형/여성형 · 자세 · 체형'],'confirmed')+card(410,320,300,'사용 이벤트 수집',['중복·범위 검사 · 시험 제외'],'proposed')+card(40,320,300,'관리자 통계',['접속 · 인기 자세 · 인기 체형'],'confirmed')+
  arrow('M 930 252 V 312')+arrow('M 780 386 H 718')+arrow('M 410 386 H 348')+
  note(40,492,1040,'현재 로컬: 모델 파일은 IndexedDB · 설정·사용 기록은 같은 브라우저에만 저장'));
console.log('Generated 11 SVG diagrams.');
