"""M56: measured skin paths, preserved-pose checks, and real page captures."""
from pathlib import Path
import json,math
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'docs/assets/images';SRC=ROOT/'outputs/cmu-toe-slip-path'
DATA=json.loads((ROOT/'docs/05-validation/reports/cmu-toe-slip-path.json').read_text(encoding='utf-8'))
BG,INK,OLD,NEW='#faf9f6','#233b32','#b56a49','#237e72'
def font(n):return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
def text(d,xy,s,n=20,c=INK):d.text(xy,s,font=font(n),fill=c)

im=Image.new('RGB',(1300,1170),BG);d=ImageDraw.Draw(im)
text(d,(28,18),'착지 순간은 유지하고, 후반의 급한 이동을 완화했습니다',29)
text(d,(28,66),'M56 · 실제 모델 수치 검사 / 자연스러움 사용자 검토 전 · 주황 M54 / 초록 M56',18)
for i,(title,sub) in enumerate([('착지 위치 유지','지지 0~50% 그대로'),('후반 경로 완화','지지 50~100%의 지면 이동'),('회수 자세 유지','100%에서 원래 동작에 연결')]):
 x=28+i*426;d.rounded_rectangle((x,110,x+390,203),12,fill='#e7eee7');text(d,(x+18,122),title,23);text(d,(x+18,162),sub,18)
 if i<2:text(d,(x+397,138),'→',26)

for col,t in enumerate(DATA['results'][0]['tracks']):
 x=80+col*650;y=293;w=520;h=282
 text(d,(x-25,y-50),('남성 오른발' if t['side']=='r' else '남성 왼발')+' · 발끝 지면 속도 (mm/s)',21)
 curves=[];period=(.3 if t['side']=='r' else .34)*91/120
 for j in [0,1]:
  curve=[]
  for a,b in zip(t['track'],t['track'][1:]):
   p,q=a['lanes'][j]['toe'],b['lanes'][j]['toe'];v=math.hypot(q[0]-p[0],q[2]-p[2])*1000/((b['u']-a['u'])*period)
   curve.append(((a['u']+b['u'])/2,v))
  curves.append(curve)
 top=math.ceil(max(v for c in curves for _,v in c)/200)*200
 def px(u):return x+(u-.5)/.5*w
 def py(v):return y+h-v/top*h
 d.rectangle((px(.9),y,px(1),y+h),fill='#eee9df')
 for i in range(5):
  v=top*i/4;yy=py(v);d.line((x,yy,x+w,yy),fill='#d7ddd8');text(d,(x-52,yy-10),f'{v:g}',16)
 for c,color in zip(curves,[OLD,NEW]):d.line([(px(u),py(v)) for u,v in c],fill=color,width=3)
 for u in [.5,.65,.85,1]:text(d,(px(u)-14,y+h+12),f'{u*100:g}',17)
 text(d,(x,y+h+48),'지지 진행률 % · 음영: 원래 회수 자세에 연결',17)

text(d,(28,665),'잠시 붙잡았다 놓지 않습니다. 해제 구간 이동 거리·최고 속도도 함께 검사했습니다.',21)
xs=[28,414,628,842,1056];ws=[386,214,214,214,216]
rows=[['기존 → 수정','남성 오른발','남성 왼발','여성 오른발','여성 왼발']]
for label,f in [('후반 전체 이동 거리 (mm)',lambda m:f"{m[0]['late']['pathMm']:.2f} → {m[1]['late']['pathMm']:.2f}"),('65~85% 최고 속도 (mm/s)',lambda m:f"{m[0]['hold']['maxSpeedMmS']:.0f} → {m[1]['hold']['maxSpeedMmS']:.0f}"),('해제 85~100% 이동 거리 (mm)',lambda m:f"{m[0]['release']['pathMm']:.2f} → {m[1]['release']['pathMm']:.2f}"),('해제 최고 속도 (mm/s)',lambda m:f"{m[0]['release']['maxSpeedMmS']:.0f} → {m[1]['release']['maxSpeedMmS']:.0f}")]:
 rows.append([label]+[f(t['metrics']) for r in DATA['results'] for t in r['tracks']])
for i,row in enumerate(rows):
 for x,w,s in zip(xs,ws,row):d.rectangle((x,714+i*51,x+w-2,763+i*51),fill='#e5ece5' if i==0 else '#f0eee8');text(d,(x+8,727+i*51),s,17 if i else 16)
text(d,(28,999),'검증: 착지 순간·골반·회수·발 높이 보존 / 발바닥 기울기 변화 <0.001°',22)
text(d,(28,1043),'남은 한계: 회수 시작 위치를 유지하므로 전진 이동은 남습니다. 완전한 지면 고정은 아닙니다.',19)
text(d,(28,1083),'고정된 피부 구역을 추적한 기하학적 결과 · 압력·마찰·모든 체형 검증은 포함하지 않습니다.',18)
im.save(OUT/'cmu-toe-slip-path-metrics.png')

for view,label in [('front','정면'),('side','측면')]:
 im=Image.new('RGB',(1320,570),BG);d=ImageDraw.Draw(im);text(d,(24,16),f'{label} · 지지 75% · 초록 점: 발끝 구역 / 노란 점: 기존 착지 피부 구역',23)
 for i,(side,j) in enumerate([('r',0),('r',1),('l',0),('l',1)]):
  x=12+i*328;text(d,(x+8,65),('오른발' if side=='r' else '왼발')+(' · 기존 M54' if j==0 else ' · 수정 M56'),19,c=OLD if j==0 else NEW)
  pic=Image.open(SRC/f'close-{side}-{view}-{j}.png').convert('RGB');pic.thumbnail((320,442));im.paste(pic,(x+(320-pic.width)//2,102))
 im.save(OUT/f'cmu-toe-slip-path-{view}.png')
im=Image.new('RGB',(1300,820),BG);d=ImageDraw.Draw(im);text(d,(24,16),'실제 비교 화면 · 각 칸 왼쪽 M54 / 오른쪽 M56',28)
for i,(v,phase,label) in enumerate([('front',505,'오른발 지지 75% · 정면'),('side',505,'오른발 지지 75% · 측면'),('front',5,'왼발 지지 75% · 정면'),('side',5,'왼발 지지 75% · 측면')]):
 x=20+(i%2)*640;y=74+(i//2)*367;text(d,(x,y),label,21);pic=Image.open(SRC/f'male-{v}-{phase}.png').convert('RGB');pic.thumbnail((620,325));im.paste(pic,(x,y+37))
im.save(OUT/'cmu-toe-slip-path-comparison.png')
print('M56 measured figures and actual screen comparisons generated')
