"""M83 figures from real browser captures and measured skin contact JSON.
Run check-midfoot.cjs, capture-midfoot.cjs, then this script.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
root=Path(__file__).resolve().parents[3]
source=root/'outputs/midfoot';dest=root/'docs/assets/images'
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',25)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
sheet=Image.new('RGB',(1180,810),'#f7f8f5');d=ImageDraw.Draw(sheet)
d.text((26,20),'미드풋 선택 · 실제 데스크톱 / 모바일 화면',font=font,fill='#294632')
for name,xy,limit in [('direct-side.png',(20,85),(800,705)),('mobile.png',(840,85),(320,705))]:
 im=Image.open(source/name).convert('RGB');im.thumbnail(limit);sheet.paste(im,xy)
sheet.save(dest/'midfoot-screen.png')
sheet=Image.new('RGB',(1200,1060),'#f7f8f5');d=ImageDraw.Draw(sheet)
d.text((26,20),'같은 착지 시점 · 기본 동작 / 미드풋',font=font,fill='#294632')
d.text((26,60),'실제 구현 캡처 / 다리 +5cm · 팔 +10° · 상체 +8° 유지 / 기본도 평평해서 차이는 작음',font=small,fill='#748074')
for row,view in enumerate(['front','side']):
 for col,kind in enumerate(['base','midfoot']):
  x,y=20+col*590,130+row*460;d.text((x,y-34),('정면' if view=='front' else '측면')+' · '+('기본 동작' if kind=='base' else '미드풋'),font=small,fill='#294632')
  im=Image.open(source/f'{kind}-{view}.png').convert('RGB');im.thumbnail((570,420));sheet.paste(im,(x,y))
sheet.save(dest/'midfoot-compare.png')
report=json.loads((root/'docs/05-validation/reports/midfoot.json').read_text(encoding='utf-8'))
sheet=Image.new('RGB',(1120,480),'#f7f8f5');d=ImageDraw.Draw(sheet)
d.text((28,18),'착지 순간의 뒤꿈치·앞발바닥 높이 차이',font=font,fill='#294632')
d.text((28,58),'독립 피부점 측정 · 기본 체형 / 단위 mm / 오른발 28%, 왼발 78% 시점',font=small,fill='#748074')
for col,sex in enumerate(['male','female']):
 row=next(x for x in report['profiles'] if x['model']==sex and not x['custom']);x=28+col*550
 d.text((x,106),'남성형' if sex=='male' else '여성형',font=font,fill='#294632')
 for i,c in enumerate(row['contact']):
  y=170+i*125;d.text((x,y-15),'오른발' if c['side']=='r' else '왼발',font=small,fill='#294632')
  for k,(key,color,label) in enumerate([('beforeGapMm','#9fa99d','기본'),('gapMm','#3b614a','미드풋')]):
   top=y+k*37;w=c[key]*82;d.text((x+70,top-2),label,font=small,fill='#748074');d.rectangle((x+138,top,x+138+max(2,w),top+21),fill=color);d.text((x+148+w,top-2),f'{c[key]:.2f}',font=small,fill='#294632')
d.text((28,437),'검증 완료 · 시각적 접촉 기능 / 정적 피부 굴곡·압축·압력 분포는 계산하지 않음',font=small,fill='#748074')
sheet.save(dest/'midfoot-contact.png')
