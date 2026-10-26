"""M62 figures: actual render captures and measured joint coordinates."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
data=json.loads((root/'docs/05-validation/reports/cmu-upper-center.json').read_text())
assert data['status']=='passed'
out=root/'docs/assets/images'
font=lambda size:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',size)
bg='#f6f5f1';ink='#233b32';muted='#63736a';before='#ad7656';after='#267d67';right='#b96540';left='#1687ad'
summary=[]
for r in data['results']:
    m=r['metrics']
    summary.append({'model':r['model'],**m,'maxLandingGapMm':max(p['floors'][1][p['side']]*1000 for p in r['landing'])})
(root/'docs/05-validation/reports/cmu-upper-center-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')

img=Image.new('RGB',(1320,840),bg);d=ImageDraw.Draw(img)
d.text((28,20),'M62 · 상체 중심도 반 주기에 대응하도록',font=font(30),fill=ink)
d.text((28,67),'구현·수치 확인 완료 / 외형 사용자 검토 전 · 실제 남성형 어깨 중점 X(mm) · 골반 기준',font=font(20),fill=muted)
rows=data['results'][0]['rows']
for col,mode in enumerate(['before','after']):
    x,y,w,h=90+650*col,190,490,300
    d.text((x,120),'기존 M60' if mode=='before' else '수정 M62',font=font(25),fill=ink)
    X=lambda t:x+t/.5*w
    Y=lambda v:y+h-(v+40)/60*h
    for value in [-40,-20,0,20]:
        yy=Y(value);d.line((x,yy,x+w,yy),fill='#d5ded5');d.text((x-48,yy-12),str(value),font=font(17),fill=muted)
    for s,offset,sign,color,width in [('r',0,1,right,6),('l',500,-1,left,3)]:
        points=[(X(rows[i]['phase']),Y(sign*rows[i+offset][mode]['shoulder'][0]*1000)) for i in range(501)]
        d.line(points,fill=color,width=width)
    for i in range(6):d.text((x+i*w/5-8,y+h+14),str(i*10),font=font(18),fill=muted)
    d.text((x+70,y+h+56),'주기 % · 반 주기 뒤 좌우 반사',font=font(19),fill=muted)
d.text((28,595),'갈색 현재 단계 / 파랑 반 주기 뒤 반사 · 수정 후 두 곡선이 겹칩니다.',font=font(21),fill=ink)
for i,r in enumerate(summary):
    name='남성형' if r['model']=='male' else '여성형'
    d.text((28,645+45*i),f"{name}  어깨 중점 3D 대응 오차 {r['shoulderMirrorBeforeMm']:.1f} → <0.01mm   머리 {r['headMirrorBeforeMm']:.1f} → <0.01mm",font=font(23),fill=ink)
d.text((28,757),'그래프는 X 좌표, 아래 수치는 한 주기 3D 위치의 최대 반사 오차입니다. 팔 전체 대칭은 이번 범위가 아닙니다.',font=font(18),fill=muted)
d.text((28,792),'발목·다리·골반 위치와 몸 전체 Y는 유지했습니다. 양발의 기존 안쪽 접근 경로도 그대로입니다.',font=font(18),fill=muted)
img.save(out/'cmu-upper-center-curves.png')

img=Image.new('RGB',(1280,1370),bg);d=ImageDraw.Draw(img)
d.text((28,20),'실제 비교 · 왼쪽 기존 M60 / 오른쪽 상체 중심 M62',font=font(28),fill=ink)
for i,view in enumerate(['front','side']):
    y=85+i*605;d.text((28,y),'정면 · 주기 28%' if i==0 else '측면 · 같은 순간',font=font(22),fill=ink)
    photo=Image.open(root/f'outputs/cmu-upper-center/male-{view}-28.png').convert('RGB');photo.thumbnail((1220,555));img.paste(photo,(28,y+42))
d.text((28,1317),'몸통·목·머리 중심의 회전만 변경 · 팔 굽힘은 유지하며 몸통을 따라갑니다.',font=font(21),fill=muted)
img.save(out/'cmu-upper-center-comparison.png')

img=Image.new('RGB',(1320,670),bg);d=ImageDraw.Draw(img)
d.text((28,20),'수정 순서와 보존 검사',font=font(30),fill=ink)
boxes=[(28,95,390,270,'1  기존 동작 계산',['M58 양발 공통 곡선','M60 몸 높이·접지 계산','골반·발목·다리 그대로']),
       (470,95,832,270,'2  상체 중심만 연결',['현재 회전 ↔ 반 주기 반사','중간 회전을 계산','몸통 → 목 → 머리 순서']),
       (912,95,1290,270,'3  같은 순간 비교',['정면·측면 / 남녀 모델','기존·수정 두 칸 동기화','반복·정지·시점 이동'])]
for x1,y1,x2,y2,title,lines in boxes:
    d.rounded_rectangle((x1,y1,x2,y2),14,fill='#e4ede5')
    d.text((x1+16,y1+15),title,font=font(22),fill=ink)
    for j,line in enumerate(lines):d.text((x1+16,y1+63+j*32),line,font=font(19),fill=ink)
for x in [410,850]:d.text((x,160),'→',font=font(34),fill=ink)
checks=[('몸 전체 위치·골반·다리 위치','차이 <0.01mm'),('발목·다리 회전 / 팔의 부모 기준 회전','차이 <0.001°'),('발 피부 위치 / 착지 최저 높이','<0.01mm / 높이 차이 0mm'),('남녀 착지·지지 표본','바닥 침투 없음 · 최대 간격 <0.05mm')]
for i,(label,value) in enumerate(checks):
    y=315+i*58;d.line((28,y+48,1290,y+48),fill='#d5ded5')
    d.text((35,y),label,font=font(22),fill=ink);d.text((735,y),value,font=font(21),fill=after)
d.text((28,578),'남녀 각각 1,001시점 · 보관한 M60 좌표와 기준칸 대조 · 피부 정점 독립 계산',font=font(20),fill=muted)
d.text((28,619),'몸 높이 = 모델 전체 Y·골반 높이. 상체 자세가 바뀌어 어깨 자체 높이는 최대 4.9mm 달라집니다.',font=font(18),fill=muted)
img.save(out/'cmu-upper-center-preservation.png')
print(json.dumps(summary,ensure_ascii=False,indent=2))
