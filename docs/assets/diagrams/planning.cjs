// Documentation-only SVG sources. Run: node docs/assets/diagrams/planning.cjs
const fs=require('node:fs'),path=require('node:path');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const t=(x,y,s,size=18,fill='#283b35',anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}">${esc(s)}</text>`;
const box=(x,y,w,title,lines=[],status='설계 제안',h=142)=>`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="15" fill="#fff" stroke="#d6ded6"/>${t(x+20,y+27,status,13,status.includes('완료')?'#387148':'#996334','start')}${t(x+w/2,y+62,title,21)}${lines.map((s,i)=>t(x+w/2,y+92+i*23,s,16,'#67756e')).join('')}</g>`;
const arrow=(x,y,xx,yy)=>`<path d="M${x} ${y} L${xx} ${yy}" stroke="#90a297" stroke-width="2" marker-end="url(#a)"/>`;
const note=(y,s)=>`<rect x="40" y="${y}" width="1040" height="46" rx="12" fill="#e8eee6"/>${t(560,y+29,s,16)}`;
function save(name,title,sub,height,body){fs.writeFileSync(path.join(__dirname,name+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${height}" viewBox="0 0 1120 ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(sub)}</desc><defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#90a297"/></marker></defs><rect width="1120" height="${height}" rx="22" fill="#f6f7f2"/><g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">${t(40,48,title,28,'#283b35','start')}${t(40,80,sub,16,'#67756e','start')}${body}</g></svg>`);}
save('review-workflow','문서 먼저, 작은 작업 하나씩','확정된 협업 방식 · 기능 실험은 합의한 범위에서 문서 작업과 병행 가능',545,
 box(40,120,300,'01 설명과 문서',['목적 · 그림 · 작업 범위'],'확정')+box(410,120,300,'02 함께 검토',['선택 · 보류 · 수정'],'확정')+box(780,120,300,'03 작은 작업 하나',['검토한 범위만 구현'],'확정')+arrow(340,190,400,190)+arrow(710,190,770,190)+
 box(780,315,300,'04 코드와 설명',['변경 코드 · 동작 · 검사 결과'],'확정')+box(410,315,300,'05 다음 단계 검토',['검토 후 다음 작업 선택'],'확정')+box(40,315,300,'문서에 반영',['결정과 검증 상태 갱신'],'확정')+arrow(930,265,930,305)+arrow(780,385,720,385)+arrow(410,385,350,385)+note(485,'실험 결과가 좋아도 다음 기능을 자동으로 확정하거나 구현하지 않습니다.'));
save('motion-authoring','사용자가 만드는 달리기 동작','검토 제안 · 핵심 자세를 저장하고 연결 · 실제 달리기 자세 측정 기능은 아님',540,
 box(40,120,300,'자세 조절',['어깨 · 팔꿈치 · 고관절 · 무릎'],'일부 구현 완료')+box(410,120,300,'프레임 저장',['시간 + 관절값의 복사본'])+box(780,120,300,'타임라인 편집',['추가 · 복사 · 삭제 · 시간'])+arrow(340,190,400,190)+arrow(710,190,770,190)+
 box(780,310,300,'중간 동작 연결',['각도 제한 · 주기 경계 검사'])+box(410,310,300,'반복 재생·수정',['전신 보기 · 프레임 탐색'])+box(40,310,300,'동작 확정',['코스 재생용 버전 보관'])+arrow(930,263,930,300)+arrow(780,380,720,380)+arrow(410,380,350,380)+note(480,'먼저 자세 1개 저장·불러오기 검토 → 영상 녹화와 자동 접지는 후속'));
function runner(cx,cy,scale=1,phase=0){return `<g transform="translate(${cx} ${cy}) scale(${scale})" stroke="#506b58" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cy="-125" r="19" fill="#dce5d6"/><path d="M0 -105L3 -20 M0 -85L${-35-phase} -48L-65 -68 M0 -85L${36+phase} -58L62 -86 M3 -20L${-23-phase} 42L-58 91 M3 -20L${30+phase} 26L35 94"/></g>`;}
save('motion-editor-wireframe','동작 편집 화면 · 검토용 배치','미구현 와이어프레임 · 수치와 4개 프레임은 예시이며 확정 사양이 아님',800,
 `<rect x="40" y="110" width="1040" height="52" rx="10" fill="#e8eee6"/>${t(65,143,'동작 편집',21,'#283b35','start')}${t(1055,143,'전신  /  측면  /  정면',15,'#67756e','end')}`+
 `<rect x="40" y="178" width="655" height="356" rx="16" fill="#fff" stroke="#d6ded6"/>${runner(355,380,1.05,12)}${t(64,207,'캐릭터 전체 동작',16,'#67756e','start')}`+
 box(715,178,365,'선택한 프레임의 자세',['어깨 앞뒤        15°','팔꿈치 굽힘      80°','다리 앞뒤        30°','무릎 굽힘        65°'],'입력 예시 · 기능 미구현',225)+
 `<rect x="715" y="420" width="365" height="114" rx="16" fill="#e8eee6"/>${t(897,455,'[현재 자세 저장]  [원래 값으로]',17)}${t(897,491,'재생 중에는 편집 잠금 제안',15,'#67756e')}`+
 `<rect x="40" y="554" width="1040" height="165" rx="16" fill="#fff" stroke="#d6ded6"/>${t(65,583,'타임라인  ·  재생 / 정지  ·  현재 시점  ·  한 주기 길이',17,'#283b35','start')}`+
 [0,1,2,3].map((i)=>`<rect x="${70+i*245}" y="603" width="210" height="80" rx="10" fill="${i===1?'#e0eadb':'#f4f5f1'}" stroke="${i===1?'#607d55':'#d6ded6'}"/>${t(175+i*245,635,`자세 ${i+1}`,18)}${t(175+i*245,662,['0.00초','0.25초','0.50초','0.75초'][i],15,'#67756e')}`).join('')+
note(739,'프레임 데이터 저장 ≠ 조작 과정 녹화 ≠ 재생 영상 파일 저장'));
save('body-asset-pipeline','체형 조절을 웹으로 가져오는 구조','앞부분은 확인 완료 · 체형과 길이 조절을 함께 쓰는 연결 방식은 검토 제안',550,
 box(40,120,300,'MakeHuman · MPFB',['머리 형태 · 가슴 · 근육 · 살집'],'원본 데이터 확인 완료')+box(410,120,300,'웹 항목 선택',['이름 · 기준값 · 조절 범위'])+box(780,120,300,'변형 데이터 준비',['필요한 변형 + 뼈대 대응'])+arrow(340,190,400,190)+arrow(710,190,770,190)+
 box(780,315,300,'웹에서 체형 적용',['원본 기준에서 외형 재계산'])+box(410,315,300,'길이·뼈대 함께 적용',['변형 순서와 조합 검사'])+box(40,315,300,'자세·프레임 재생',['실제 관절값 검사'])+arrow(930,265,930,305)+arrow(780,385,720,385)+arrow(410,385,350,385)+note(489,'현재 길이 편집은 기존 변형을 굳혀 적용합니다. 체형 슬라이더를 바로 덧붙일 수 없습니다.'));
save('implementation-map','현재 구현과 목표 구조','로컬 시험 결과와 운영 설계를 분리 · 모든 운영 연결은 아직 미완료',555,
 box(40,120,300,'브라우저 시험 화면',['남성형·여성형 · 길이 · 자세'],'로컬 구현 완료')+box(410,120,300,'로컬 관리자',['모델 시험 · 제한 · 통계'],'로컬 구현 완료')+box(780,120,300,'브라우저 저장소',['파일 / 설정 / 사용 이벤트'],'로컬 구현 완료')+arrow(340,190,400,190)+arrow(710,190,770,190)+
 box(40,320,300,'서비스 웹 · Vercel',['체형 → 동작 → 코스 → 주행'],'배포 방향 확정')+box(410,320,300,'Supabase · 운영 서버',['인증 · 게시 버전 · 통계'],'연결 전')+box(780,320,300,'계산 서비스',['자세에 따른 예상 기록'],'모델·호스팅 미선정')+arrow(340,390,400,390)+arrow(710,390,770,390)+note(490,'동작 편집·고정 페이스 재생은 브라우저 우선 제안 · 기록 효과 계산은 별도 검증'));
save('data-map','무엇을 저장하고 연결하나요','데이터 설계 초안 · 표시는 모델 외형, 자세는 관절값, 동작은 시간에 따른 자세',560,
 box(40,120,300,'모델·체형',['자산 해시 + 체형/길이 값','변형 방식·관절 대응 버전'])+box(410,120,300,'프레임 묶음',['프레임 ID + 시각 + 관절값','주기·연결 방식·편집 버전'])+box(780,120,300,'실행 조건',['체형 + 동작의 확정 복사본','코스·방향·거리·실행 방식'])+arrow(340,190,400,190)+arrow(710,190,770,190)+
 box(780,320,300,'실행 결과',['상태·거리·시간·동작 참조','공통 시각으로 두 화면 재생'])+box(410,320,300,'비교 A / B',['기준 A 보관 · 자세만 변경','조건 불일치 → 비교 차단'])+box(40,320,300,'관리자 사용 통계',['확정 버튼 기준 사용 기록','시험·단순 편집 제외'])+arrow(930,265,930,310)+arrow(780,390,720,390)+note(495,'현재 프레임 저장은 미구현 · 영구 저장과 운영 이벤트 정의는 별도 검토'));
console.log('Generated 6 planning SVGs.');
