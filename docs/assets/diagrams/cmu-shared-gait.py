"""Generate figures from M58 browser measurements/captures, no invented poses."""
import json, math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-shared-gait.json').read_text('utf-8'))
assert report['status']=='passed'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';orange='#b96540';blue='#1687ad'

img=Image.new('RGB',(1320,410),bg);d=ImageDraw.Draw(img)
d.text((26,20),'M58 · 같은 동작을 양발이 번갈아 재생',font=font(30),fill=ink)
d.text((26,68),'발목 사용자 확인 완료 · 기본 남녀 비교 구현·수치 검사 완료 · 전신 검토는 M59',font=font(20),fill=muted)
for x,y,w,h,title,sub,color in [
 (26,165,300,140,'35_17 → M56 오른다리','기존 한 주기를 공통 기준으로',ink),
 (390,130,330,95,'오른발: 현재 단계 t','고관절 → 무릎 → 발목 → 발끝',orange),
 (390,248,330,95,'왼발: 반 주기 뒤 t + 0.5','기본 뼈 축으로 좌우 반사',blue),
 (800,165,490,140,'골반·몸 높이도 함께 연결','같은 단계의 양발 위치·회전·속도 대응',ink)]:
 d.rounded_rectangle((x,y,x+w,y+h),radius=12,fill='#e7eee7')
 d.text((x+18,y+15),title,font=font(23),fill=color);d.text((x+18,y+55),sub,font=font(18),fill=muted)
for x,y in [(345,174),(345,278),(749,174),(749,278)]:d.text((x,y),'→',font=font(28),fill=muted)
d.text((26,365),'하나의 하체 동작에서 고관절·무릎·발목을 함께 구성합니다.',font=font(20),fill=ink)
img.save(root/'docs/assets/images/cmu-shared-gait-flow.png')

# Matched-stage joint geometry, normalized only by pelvis origin. Orange and
# blue coincide in the new result; left X is reflected in the common frame.
img=Image.new('RGB',(1320,900),bg);d=ImageDraw.Draw(img)
d.text((26,20),'양발을 같은 단계로 겹쳐 비교했습니다',font=font(30),fill=ink)
d.text((26,68),'남성형 · 주황 오른다리 / 파랑 반 주기 뒤 왼다리를 좌우 반사 · 측면 모델 측정 좌표',font=font(19),fill=muted)
male=report['results'][0]
for col,(pair,title) in enumerate(zip(male['sameStage'][:4],['착지 기준','지지 중간','발 떼기 기준','회수 연결'])):
 x=95+col*305
 d.text((x-30,112),title,font=font(22),fill=ink)
 for row,lane in enumerate([0,1]):
  top=170+row*325
  if col==0:d.text((12,top+110),'기존' if row==0 else '수정',font=font(21),fill=muted)
  for side,key,color,width in [('r','right',orange,8),('l','left',blue,3)]:
   pose=pair[key]['lanes'][lane];P=pose['bones']['pelvis']['p']
   points=[pose['bones'][n+'_'+side]['p'] for n in ['thigh','calf','foot','ball']]
   xy=[(x+85+(p[2]-P[2])*240,top+10-(p[1]-P[1])*240) for p in points]
   d.line(xy,fill=color,width=width)
   for px,py in xy:d.ellipse((px-4,py-4,px+4,py+4),fill=color)
  d.line((x-20,top+285,x+215,top+285),fill='#d5ded5')
d.text((26,830),'수정 후 반 주기 대응: 관절 위치 <0.01mm / 회전 <0.001° / 무릎 굽힘 <0.001° 차이',font=font(21),fill=ink)
d.text((26,865),'좌표 일치 검사입니다. 완전 접지·최적 자세·물리적 균형의 검증은 아닙니다.',font=font(17),fill=muted)
img.save(root/'docs/assets/images/cmu-shared-gait-match.png')

img=Image.new('RGB',(1280,880),bg);d=ImageDraw.Draw(img)
d.text((26,20),'왼발만 빠르게 풀리던 발목 회전도 같은 기준으로',font=font(28),fill=ink)
d.text((26,68),'같은 해제 진행률 · 종아리 대비 발의 총 회전 속도 · 남성형 실제 측정',font=font(20),fill=muted)
x0,y0,w,h=105,170,1060,440
for value in range(0,1201,300):
 y=y0+h-value/1200*h;d.line((x0,y,x0+w,y),fill='#d5ded5');d.text((25,y-12),str(value),font=font(18),fill=muted)
for value in range(0,101,25):
 x=x0+value/100*w;d.text((x-12,y0+h+12),str(value),font=font(18),fill=muted)
d.text((28,128),'°/초',font=font(19),fill=muted)
for key,color,width in [('oldLeft','#99aaa2',4),('newRight',orange,8),('newLeft',blue,3)]:
 d.line([(x0+p['u']*w,y0+h-p['speed']/1200*h) for p in male['releaseSpeeds'][key]],fill=color,width=width)
for x,label,color in [(106,'기존 왼발', '#99aaa2'),(430,'수정 오른발',orange),(800,'수정 왼발',blue)]:
 d.line((x,688,x+34,688),fill=color,width=5);d.text((x+45,674),label,font=font(20),fill=color)
d.text((485,642),'각 발의 해제 진행률 (%)',font=font(20),fill=ink)
for i,r in enumerate(report['results']):
 peak=lambda key:max(x['speed'] for x in r['releaseSpeeds'][key])
 d.text((26,736+i*43),f"{'남성형' if i==0 else '여성형'}: 기존 왼발 {peak('oldLeft'):.0f}°/초 → 수정 양발 {peak('newRight'):.0f}°/초",font=font(23),fill=ink)
d.text((26,837),'수동 구간의 표본 최대값. M57과 표본 보간 방식이 달라 기존 최대값이 소폭 다릅니다.',font=font(18),fill=muted)
img.save(root/'docs/assets/images/cmu-shared-gait-speed.png')

img=Image.new('RGB',(1280,1390),bg);d=ImageDraw.Draw(img)
d.text((26,20),'실제 화면 · 왼쪽 기존 / 오른쪽 양발 공통 기준',font=font(28),fill=ink)
for row,view in enumerate(['front','side']):
 y=90+row*630;d.text((26,y),'정면 · 왼발 해제 구간' if view=='front' else '측면 · 같은 시점',font=font(22),fill=ink)
 photo=Image.open(root/f'outputs/cmu-shared-gait/male-{view}-14.png').convert('RGB');photo.thumbnail((1220,580));img.paste(photo,(30,y+42))
d.text((26,1350),'남성형 · 주기 14% · 새 동작에서는 양발 착지·회수 경로와 골반 주기 내 움직임이 바뀝니다.',font=font(18),fill=muted)
img.save(root/'docs/assets/images/cmu-shared-gait-comparison.png')
print('Generated 4 figures from passed M58 measurements and actual browser captures.')
