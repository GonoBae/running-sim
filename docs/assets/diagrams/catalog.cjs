// Rebuild document catalog diagrams: node docs/assets/diagrams/catalog.cjs
const fs=require('node:fs'),path=require('node:path');
const e=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(x,y,s,size=17,color='#304337',anchor='middle')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${e(s)}</text>`;
const card=(x,y,w,title,lines)=>`<g><rect x="${x}" y="${y}" width="${w}" height="130" rx="15" fill="white" stroke="#d8e0d8"/>${text(x+w/2,y+36,title,22)}${lines.map((s,i)=>text(x+w/2,y+72+i*26,s,16,'#6b786e')).join('')}</g>`;
function save(name,title,caption,height,body){fs.writeFileSync(path.join(__dirname,name+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${height}" viewBox="0 0 1120 ${height}" role="img" aria-labelledby="title desc"><title id="title">${e(title)}</title><desc id="desc">${e(caption)}</desc><rect width="1120" height="${height}" rx="22" fill="#f5f7f1"/><g font-family="Malgun Gothic,Apple SD Gothic Neo,sans-serif">${text(40,48,title,28,'#304337','start')}${text(40,80,caption,16,'#6b786e','start')}${body}</g></svg>`);}
save('document-map','문서는 docs/에서 관리합니다','초안 작성 여부와 최종 확정 여부는 다릅니다. 상태는 문서 목록에서 확인합니다.',635,
card(40,115,320,'01 · 기획',['서비스 목적 · 진행 방식','결정 기록 · 개발 계획'])+card(400,115,320,'02 · 요구사항',['R01–R14 기능 요구','검수 기준 · 미정 항목'])+card(760,115,320,'03 · 화면',['전체 화면 정의','캐릭터 · 동작 · 코스 · 관리자'])+
card(40,285,320,'04 · 기술',['기술내역 · 아키텍처','데이터 · 체형 자산'])+card(400,285,320,'05 · 검증',['확인한 범위와 제약','reports/ 원본 수치'])+card(760,285,320,'06 · 가이드',['실행 · 모델 준비','MPFB 설치 · GLB 내보내기'])+
card(40,455,500,'07 · 참고자료',['연구 후보 · 출처·확인 범위','자산 정보와 체크섬'])+card(580,455,500,'assets · 공용 그림',['도식 · 이미지 · 생성 프롬프트','이전 시안은 images/archive/']));
save('requirements-map','요구 → 화면 → 설계 → 검증','R01–R14 ID 유지 · 최신 기준은 요구사항 명세서 한 곳에서 관리',465,
card(40,120,230,'요구사항',['무엇이 되어야 하나','R01–R14'])+card(310,120,230,'화면 정의',['어디서 조작하나','SCR01–SCR07'])+card(580,120,230,'기술·데이터',['어떻게 연결하나','구현 / 제안 구분'])+card(850,120,230,'검증 증거',['무엇으로 확인하나','수치·화면·남은 한계'])+
text(290,193,'→',26)+text(560,193,'→',26)+text(830,193,'→',26)+
`<rect x="40" y="290" width="1040" height="122" rx="16" fill="#e6eee1"/>${text(560,328,'일부 로컬 확인: 체형 길이 · 제한 자세 · 모델 선택 · 관리자 시험',20)}${text(560,362,'미구현: 프레임 편집 · 실제 코스 주행 · 기록 계산 · 운영 인증/통계',18)}${text(560,391,'미정 사양은 검토 항목으로 남기고, 구현 완료로 표시하지 않습니다.',16,'#6b786e')}`);
