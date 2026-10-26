// Documentation illustrations only. Run: node docs/assets/diagrams/pose-snapshot.cjs
const fs = require('node:fs');
const path = require('node:path');
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const t = (x,y,s,size=18,fill='#283b35',anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}">${esc(s)}</text>`;
const rect = (x,y,w,h,fill='#fff') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="#d6ded6"/>`;
const card = (x,y,title,lines) => `<g>${rect(x,y,300,148)}${t(x+20,y+28,'로컬 동작 확인',13,'#387148','start')}${t(x+150,y+66,title,22)}${lines.map((s,i)=>t(x+150,y+98+i*24,s,16,'#67756e')).join('')}</g>`;
const arrow=(x,y,xx,yy)=>`<path d="M${x} ${y}L${xx} ${yy}" fill="none" stroke="#90a297" stroke-width="2.5" marker-end="url(#a)"/>`;
const note=(y,s)=>rect(40,y,1040,48,'#e8eee6')+t(560,y+30,s,17);
function save(name,title,sub,height,body){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${height}" viewBox="0 0 1120 ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(sub)}</desc><defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#90a297"/></marker></defs>${rect(0,0,1120,height,'#f6f7f2')}<g font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif">${t(40,48,title,28,'#283b35','start')}${t(40,80,sub,16,'#67756e','start')}${body}</g></svg>`;
 fs.writeFileSync(path.join(__dirname,name+'.svg'),svg);
}
save('pose-snapshot-flow','M01 · 자세 하나 저장하고 복원하기','로직 39건 · 실제 남녀 모델 화면 17건 확인 · 로컬 Edge 범위 · R12 / D09 / D13',655,
 card(40,116,'자세 A 저장',['현재 관절값 8개 복사','저장 슬롯은 1개'])+
 card(410,116,'자세 B로 편집',['화면의 값만 변경','저장한 A는 유지'])+
 card(780,116,'불러오기 검사',['모델 · 설정 · 8개 값 확인','일부 값만 적용하지 않음'])+
 arrow(340,190,400,190)+arrow(710,190,770,190)+
 card(780,330,'각도 A 복원',['검사를 통과하면 한 번에 적용','현재 체형 · 카메라 유지'])+
 card(410,330,'검사 실패',['현재 자세 · 저장본 유지','불러올 수 없는 이유 표시'])+
 card(40,330,'새로고침 · 페이지 종료',['임시 저장본 사라짐','영구 보관은 후속 검토'])+
 arrow(1000,264,1000,318)+t(1035,300,'통과',14,'#67756e')+
 `<path d="M850 264V292H560V318" fill="none" stroke="#90a297" stroke-width="2.5" marker-end="url(#a)"/>`+t(700,284,'실패',14,'#67756e')+
 note(516,'저장/복원은 관절 각도만 다룹니다. 체형 변경 후 같은 각도를 불러와도 외형은 다를 수 있습니다.')+
 note(578,'검수: A → B → A 일치 · 저장본 독립 · 실패 시 변경 없음 · 남성형/여성형 각각 확인'));
function runner(){return `<g transform="translate(335 370)" stroke="#506b58" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cy="-128" r="22" fill="#dce5d6"/><path d="M0 -104L4 -10 M0 -80L-37 -37L-70 -70 M0 -80L44 -48L76 -77 M4 -10L-25 60L-54 124 M4 -10L45 38L32 124"/></g>`;}
function button(x,y,w,label,fill='#e8eee6'){return rect(x,y,w,45,fill)+t(x+w/2,y+29,label,16);}
save('pose-snapshot-screen','M01 · 관절 입력 아래 저장 슬롯 하나','검토용 화면 배치 · 미구현 · 캐릭터와 수치는 설명용 예시',720,
 rect(40,112,1040,52,'#e8eee6')+t(65,145,'모델 시험',21,'#283b35','start')+t(1055,145,'정면 / 측면 / 뼈대 보기',15,'#67756e','end')+
 rect(40,180,590,420)+t(65,211,'현재 자세 B',18,'#283b35','start')+runner()+t(335,573,'불러오기 → 저장한 각도 A로 변경',17,'#67756e')+
 rect(650,180,430,165)+t(675,212,'관절 조절',20,'#283b35','start')+t(675,250,'왼쪽 어깨    20°',17,'#67756e','start')+
 `<path d="M680 281H1035" stroke="#c8d4c6" stroke-width="5"/><circle cx="865" cy="281" r="7" fill="#bb5835"/>`+t(675,322,'기존 관절 입력과 기본 자세 복원 유지',15,'#67756e','start')+
 rect(650,363,430,237)+t(675,396,'임시 저장한 자세',20,'#283b35','start')+t(675,428,'자세 1개를 저장했습니다.',16,'#67756e','start')+
 button(675,448,232,'저장한 자세 바꾸기')+button(920,448,135,'불러오기','#dce7d8')+
 t(675,523,'이 페이지에서만 임시 보관됩니다.',15,'#67756e','start')+t(675,548,'새로고침하면 사라집니다.',15,'#67756e','start')+t(675,577,'키·부위 길이는 현재 값을 유지합니다.',15,'#67756e','start')+
 note(622,'빈 슬롯: [현재 자세 저장] · 불러오기 비활성 / 저장 완료: 위 버튼으로 교체')+
 t(40,697,'기존 ‘이 설정 적용’과 별개 · 저장/복원만으로 사용 통계를 늘리지 않는 제안',16,'#67756e','start'));
console.log('Generated 2 M01 review diagrams.');
