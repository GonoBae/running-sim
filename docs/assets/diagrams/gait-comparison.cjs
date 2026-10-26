// Documentation diagrams, manually authored from inspected code and source contracts.
const fs=require('node:fs'),path=require('node:path');
const t=(x,y,s,size=18,color='#263c31')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${s}</text>`;
const box=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="white" stroke="#d8e1d9"/>`;
const line=(x1,y1,x2,y2,c='#287d69',w=5)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const arrow=(x,y)=>`<path d="M${x} ${y}h32l-8-6m8 6-8 6" stroke="#718779" stroke-width="2" fill="none"/>`;
const svg=(h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${h}" viewBox="0 0 1200 ${h}"><rect width="1200" height="${h}" rx="20" fill="#f4f6f1"/><g font-family="Malgun Gothic, sans-serif">${body}</g></svg>`;
let body=t(32,48,'같은 °라도 기준선이 다릅니다',29)+t(32,79,'확인된 정의 · 변환 후 대조 / 무릎 수치 하나로 전체 동작을 판정하지 않음',17,'#617568');
body+=box(32,105,358,300)+box(421,105,358,300)+box(810,105,358,300);
body+=t(52,142,'01  허벅지',23)+line(135,188,150,245,'#617568')+line(150,245,205,330)+line(150,245,150,345,'#a8b5ab',2)+t(225,227,'골반 기준',16)+t(225,252,'≠ 수직 기준',16)+t(52,365,'자료: Hip − Pelvis → 전후 방향',17)+t(52,390,'앱: 실제 뼈 좌표로 방향 재측정',16,'#617568');
body+=t(441,142,'02  무릎',23)+line(510,190,540,260)+line(540,260,625,300)+line(540,260,565,325,'#a8b5ab',2)+t(630,237,'펴짐 0°',16)+t(630,264,'굽힘 +',16)+t(441,365,'굽힘 곡선의 크기·시점 대조',17)+t(441,390,'관절 좌표계·3D 회전 차이는 남음',16,'#617568');
body+=t(830,142,'03  발목과 발',23)+line(915,190,915,290)+line(915,290,1015,270)+line(890,290,1040,290,'#a8b5ab',2)+t(830,340,'자료: 종아리에 대한 발목 굽힘',17)+t(830,368,'앱: 수평면에 대한 발 기울기',17)+t(830,393,'현재 그래프에 직접 겹치지 않음',16,'#b35838');
body+=t(32,450,'출처: Reznick 자료 설명·예제 / 앱 basic-run-motion.ts · running-pose.ts',16,'#617568');
fs.writeFileSync(path.join(__dirname,'gait-angle-reference.svg'),svg(480,body));
body=t(32,48,'검토안 · 근거가 있는 기본 동작 → 사용자 설정',29)+t(32,79,'M13: 왼다리 두 각도 대응만 구현 / 전신·접지·설정 연결은 검토안',17,'#617568');
const cards=[['1  자료와 조건','참가자·속도·한 주기','실측 좌표 / 계산 각도 구분'],['2  뼈대 대응','골반·허벅지·무릎·발','기준축·중립 자세 변환'],['3  기본 주기','같은 쪽 착지 → 다음 착지','반복 경계·좌우 위상 검사'],['4  발과 지면','착지·지지·떼기 구분','발 미끄러짐 / 골반 보정'],['5  사용자 설정','다리 올림·팔·착지 형태','설정 후 궤적을 다시 계산'],['6  시각·수치 확인','정면 / 측면 / 느린 재생','자료 대조 + 기존 기능 회귀']];
cards.forEach(([head,a,b],i)=>{let x=32+(i%3)*390,y=i<3?115:310;body+=box(x,y,355,150)+t(x+20,y+40,head,23)+t(x+20,y+81,a,18)+t(x+20,y+116,b,17,'#617568');if(i%3<2)body+=arrow(x+360,y+75);});
body+=t(32,505,'M13 첫 실험: 별도 화면에서 왼다리 두 각도 대응 검사 완료 → 사용자 검토',20)+t(32,540,'착지 유형·팔·몸통·다른 체형·기록 예측은 각각 후속 범위로 검토합니다.',17,'#617568');
fs.writeFileSync(path.join(__dirname,'gait-improvement-plan.svg'),svg(575,body));
