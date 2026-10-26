"""M85: native SVG mockup and diagrams. Geometry comes only from course-source.json.
The course screen is a PROPOSAL; no production UI or approved running loop exists.
Run capture-course-runner.cjs first to refresh the illustrative existing runner.
"""
from pathlib import Path
import json,math,html,base64
from PIL import Image
R=Path(__file__).resolve().parents[3];D=R/'docs/assets/diagrams';I=R/'docs/assets/images'
data=json.loads((R/'docs/05-validation/reports/course-source.json').read_text(encoding='utf8'))
es=data['elements'];park=next(e for e in es if e['id']==data['park']['osmId']);inside=set(data['inParkPathIds'])
INK='#294632';MUTED='#7b887a';BG='#f7f8f5';LINE='#dce2d8';GREEN='#e3edd9';AMBER='#996526';PALE='#f8edda'
def text(x,y,s,size=18,color=INK,weight=400):return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}">{html.escape(s)}</text>'
def rect(x,y,w,h,fill='white',stroke=LINE,r=14):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'
def badge(x,y,s,w=165,ok=False):return rect(x,y,w,30,GREEN if ok else PALE,'none',15)+text(x+12,y+21,s,14,INK if ok else AMBER,600)
def save(name,w,h,content):
 (D/f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="{BG}"/><g font-family="Malgun Gothic, sans-serif">{content}</g></svg>',encoding='utf8')
def map_svg(x,y,w,h):
 lat0,lon0=35.1828979,128.8266217;mx=111195*math.cos(math.radians(lat0));my=111195
 # True aspect ratio in a local metre plane; no topology invented.
 coords=park['geometry'];xmin=min(p['lon'] for p in coords)-.0005;xmax=max(p['lon'] for p in coords)+.0005;ymin=min(p['lat'] for p in coords)-.0005;ymax=max(p['lat'] for p in coords)+.0005
 scale=min(w/((xmax-xmin)*mx),h/((ymax-ymin)*my));cx=(xmin+xmax)/2;cy=(ymin+ymax)/2
 def xy(p):return (x+w/2+(p['lon']-cx)*mx*scale,y+h/2-(p['lat']-cy)*my*scale)
 def points(g):return ' '.join(f'{a:.2f},{b:.2f}' for a,b in map(xy,g))
 clip=f'map-{x}-{y}';s=f'<defs><clipPath id="{clip}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/></clipPath></defs><g clip-path="url(#{clip})"><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#edf1e9"/>'
 s+=f'<polygon points="{points(coords)}" fill="#dce9d1" stroke="#bccfb2"/>'
 for e in es:
  g=e.get('geometry',[]);t=e['tags']
  if len(g)<2:continue
  if t.get('building'):s+=f'<polygon points="{points(g)}" fill="#d5dcd1"/>'
  if t.get('highway'):
   walk=t['highway'] in {'footway','path','pedestrian'};c='#508173' if e['id'] in inside else '#bdc7b9';width=1.6 if walk else 4
   if t.get('area')=='yes':s+=f'<polygon points="{points(g)}" fill="#d6e0d1" stroke="#b0c1a9"/>'
   else:s+=f'<polyline points="{points(g)}" fill="none" stroke="{c}" stroke-width="{width}" stroke-linejoin="round"/>'
 s+='</g>';s+=rect(x+12,y+12,171,31,'#fffffff2','none',7)+text(x+22,y+34,'롯데가든파크 · OSM',15,INK,600)
 s+=text(x+w-35,y+30,'N',16,INK,600)+f'<path d="M{x+w-30},{y+38} l-5,12 h10 Z" fill="{INK}"/>'
 length=100*scale;s+=f'<path d="M{x+18},{y+h-24} h{length:.2f}" stroke="{INK}" stroke-width="3"/>'+text(x+18,y+h-31,'100 m',12)
 return s

# Evidence map: all measured source geometry, no guessed loop.
s=text(28,42,'실제 경로 좌표는 확보 · 달리는 한 바퀴는 미확정',27,INK,600)+text(28,76,'자료 확인 2026-10-22 / 공원 경계를 러닝 트랙으로 사용하지 않음',17,MUTED)
s+=map_svg(28,104,760,435)+rect(812,104,280,435)
s+=badge(831,122,'확인 완료 · 좌표 자료',236,True)+text(832,182,'롯데가든파크',23,INK,600)+text(832,214,'공원 안 보행 선형 107개',18)+text(832,242,'전용 트랙 태그 0개',18)
s+=text(832,286,'남은 확인',20,AMBER,600)+text(832,319,'어느 선이 평소 뛰는 트랙인가',16)+text(832,349,'출발점 · 방향 · 한 바퀴 길이',16)+text(832,379,'실제 현장 · GPS와 대조',16)
s+=rect(831,413,240,98,PALE,'none',12)+text(845,443,'107개는 산책로 선 조각 수',15,AMBER)+text(845,470,'완성된 코스 107개가 아닙니다.',15,AMBER)+text(845,497,'거리·고도는 아직 미검증',15,AMBER)
s+=text(28,571,'녹색 면: 공원 경계 / 녹색 선: 공개 보행 경로 / 주변 도로·건물은 위치 확인용',16,MUTED)
s+=text(28,605,'© OpenStreetMap contributors · ODbL · openstreetmap.org/copyright',14,MUTED)
save('course-evidence',1120,630,s)

# Illustrative preview image from the unchanged, implemented /pose screen.
runner=R/'outputs/course-research/runner-example.png'
if runner.exists():
 im=Image.open(runner).convert('RGB').crop((250,40,510,510));im.save(I/'course-runner-example.png')
encoded=base64.b64encode((I/'course-runner-example.png').read_bytes()).decode()
s=text(40,49,'running sim.',24,INK,700)+badge(985,23,'화면 설계안 · 미구현',240)
for i,label in enumerate(['신체 세팅','자세 세팅','코스 세팅','백테스팅']):
 x=40+i*305;s+=rect(x,82,285,52,GREEN if i==2 else BG,'none',14)+text(x+18,116,f'0{i+1}  {label}',17,INK if i==2 else MUTED,600 if i==2 else 400)
s+=text(40,188,'코스 세팅',32,INK,700)+text(40,222,'달릴 길을 정하고, 만든 러너를 이어가세요.',18,MUTED)
s+=rect(40,250,748,593)+text(62,289,'김해 롯데가든파크',23,INK,600)+badge(579,263,'러닝 경로 확인 필요',185)
s+=map_svg(62,311,704,373)
s+=text(70,710,'실제 지도 좌표 · 러닝 루프는 아직 선택하지 않았습니다.',16,MUTED)
s+=rect(62,736,340,85,BG,'none',10)+text(80,763,'한 바퀴',15,MUTED)+text(80,798,'— m',24,INK,600)+text(191,797,'경로 확인 후 계산',15,MUTED)
s+=rect(416,736,350,85,BG,'none',10)+text(434,763,'출발점',15,MUTED)+text(434,798,'경로 확인 후 지정',19,INK,600)
s+=rect(812,250,428,293)+text(834,287,'이어받은 러너',22,INK,600)+text(834,313,'예시 입력 · 현재 사용자 값 아님',13,MUTED)
s+=f'<image x="830" y="328" width="120" height="192" href="data:image/png;base64,{encoded}"/>'
for k,(a,b) in enumerate([('신체','남성형 · 전체 100%'),('부위 길이','6개 비율 그대로'),('다리 들림','+5 cm'),('팔꿈치 / 상체','+10° / +8°'),('착지','앞꿈치')]):s+=text(970,350+k*35,a,13,MUTED)+text(1075,350+k*35,b,14,INK,600)
s+=rect(812,561,428,282)+text(834,599,'코스 조건',21,INK,600)+text(834,629,'경로 확인 후 활성화',14,AMBER)
s+=text(834,668,'진행 방향',15,MUTED)+rect(946,645,122,38,BG,LINE,8)+text(969,671,'정방향',15,MUTED)+rect(1080,645,136,38,BG,LINE,8)+text(1101,671,'반대 방향',15,MUTED)
s+=text(834,720,'목표 바퀴',15,MUTED)+rect(946,694,270,44,BG,LINE,8)+text(965,724,'−                  1 바퀴                 +',15,MUTED)
s+=text(834,779,'총 거리  —',19,INK,600)+text(834,812,'주변 풍경 없이 경로부터 확인합니다.',14,MUTED)
s+=text(62,868,'지도 데이터 © OpenStreetMap contributors · ODbL',13,MUTED)
s+=rect(40,900,170,48,'white',LINE,9)+text(60,931,'← 자세 세팅',17)+text(450,930,'경로를 확인하면 다음 단계로 이동할 수 있습니다.',16,MUTED)
s+=rect(1010,900,230,48,'#e3e6df','none',9)+text(1066,931,'백테스팅 →',17,MUTED,600)
save('course-screen-v2',1280,980,s)

s=text(28,42,'신체 · 자세를 그대로 전달하고 코스만 추가',27,INK,600)+text(28,76,'기존 전달: 소스 확인 / 코스 저장 구조: 설계 제안 · 미구현',17,MUTED)
cards=[(28,'01  신체','model · scale','ratios 6개','남녀 / 크기 / 부위 길이',True),(305,'02  자세','leg · elbow · lean','strike','다리 / 팔 / 상체 / 착지',True),(582,'03  코스','course 초안 추가','원래 값 덮어쓰기 없음','경로 / 출발 / 방향 / 바퀴',False),(859,'04  백테스팅','설정 요약 전달','계산 기능은 준비 중','기록 예측 없음',False)]
for x,title,a,b,c,ok in cards:
 s+=rect(x,112,247,210)+badge(x+16,128,'기존 구현' if ok else '설계 제안',130,ok)+text(x+16,192,title,22,INK,600)+text(x+16,228,a,16)+text(x+16,257,b,16)+text(x+16,294,c,14,MUTED)
 if x<859:s+=text(x+254,228,'→',20,MUTED)
s+=rect(28,351,1078,66,GREEN,'none',12)+text(49,379,'같은 탭에서 이전·다음·새로고침 → 신체·자세·코스 초안 유지 제안',18,INK,600)+text(49,404,'현재 저장은 sessionStorage입니다. 계정 동기화·탭을 닫은 뒤 복원은 이번 범위 밖입니다.',15,MUTED)
save('course-handoff',1135,444,s)

s=text(28,42,'실제 경로 자료 → 검증된 한 바퀴 → 코스 화면',27,INK,600)+text(28,76,'위치 자료 확보와 러닝 코스 확정은 서로 다른 단계입니다.',17,MUTED)
items=[(28,'좌표 자료 확보','OSM 보행 선형','원본 ID · 버전 · 출처','확인 완료',True),(305,'한 바퀴 확정','현장 / GPS와 대조','경로 순서 · 닫힘 · 출발','검토 필요',False),(582,'거리 검증','미터 변환 · 누적 거리','원본 길이와 변환 오차','미구현',False),(859,'화면 연결','고정 코스 1개','출발 · 방향 · 바퀴','미구현',False)]
for x,title,a,b,state,ok in items:
 s+=rect(x,112,247,204)+badge(x+15,127,state,120,ok)+text(x+15,189,title,22,INK,600)+text(x+15,228,a,17)+text(x+15,270,b,15,MUTED)
 if x<859:s+=text(x+254,228,'→',20,MUTED)
s+=rect(28,344,1078,100,PALE,'none',12)+text(47,375,'OSM 선형이 실제 트랙과 다르면: 현장 GPS 한 바퀴 → GPX → 같은 검증 단계',18,AMBER,600)+text(47,405,'NRC는 지역에서 지원되는 Strava 연동 후 GPX 내보내기 경로를 검토할 수 있습니다.',16,AMBER)+text(47,430,'현재 계정·기존 기록의 좌표 포함 여부는 미확인입니다. 자동 계정 연동은 구현 범위 밖입니다.',15,AMBER)
save('course-pipeline',1135,470,s)

s=text(28,42,'첫 구현은 코스 확인 · 설정 전달까지',27,INK,600)+text(28,76,'M85 문서 작업 완료 후 검토할 순서 / 아래 기능 구현은 아직 승인·착수 전',17,MUTED)
for x,title,rows,ok in [(28,'포함 제안',['실제 경로 1개를 지도에 표시','출발점 · 방향 · 바퀴 수','검증된 길이로 총 거리 계산','현재 러너 · 자세 요약 유지','이전·다음·새로고침 유지'],True),(584,'후속으로 분리',['코스 위 3D 주행 · 발 미끄러짐 검사','경사 · 노면 · 날씨 계산','NRC 자동 연동 · 파일 업로드 UI','지도 검색 · 여러 코스 관리','자세별 기록 예측 · 백테스팅 실행'],False)]:
 s+=rect(x,111,508,276,GREEN if ok else 'white')+text(x+22,151,title,23,INK,600)
 for i,line in enumerate(rows):s+=text(x+24,194+i*37,'• '+line,18)
s+=text(28,426,'완료 기준 제안: 원래 신체·자세 값 동일 / 잘못된 경로는 진행 차단 / 미확인 거리는 숫자로 표시하지 않음',16,MUTED)
save('course-scope',1120,455,s)
print('5 SVG diagrams created; runner image cropped from actual /pose capture')
