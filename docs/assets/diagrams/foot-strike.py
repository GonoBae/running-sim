"""M84 figures from actual UI captures. Run check-foot-strike.cjs and capture-foot-strike.cjs first."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
src=root/'outputs/foot-strike';dest=root/'docs/assets/images'
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',25)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
bg='#f7f8f5';ink='#294632';muted='#748074'
sheet=Image.new('RGB',(1180,810),bg);d=ImageDraw.Draw(sheet)
d.text((26,20),'착지 선택 · 실제 데스크톱 / 모바일 화면',font=font,fill=ink)
for name,xy,limit in [('screen-side.png',(20,85),(800,705)),('mobile.png',(840,85),(320,705))]:
 im=Image.open(src/name).convert('RGB');im.thumbnail(limit);sheet.paste(im,xy)
sheet.save(dest/'foot-strike-screen.png')
sheet=Image.new('RGB',(1200,835),bg);d=ImageDraw.Draw(sheet)
d.text((25,18),'뒤꿈치 → 미드풋 → 앞꿈치 · 같은 착지 시점',font=font,fill=ink)
d.text((25,60),'실제 구현 / 다리 +5cm · 팔 +10° · 상체 +8° 유지 / 오른발 28% 시점',font=small,fill=muted)
for col,(mode,label) in enumerate([('heel','뒤꿈치'),('midfoot','미드풋'),('forefoot','앞꿈치')]):
 x=15+col*395;d.text((x+10,104),label,font=font,fill=ink)
 for row,view in enumerate(['front','side']):
  y=155+row*335;d.text((x+10,y-23),'정면' if view=='front' else '측면',font=small,fill=muted)
  im=Image.open(src/f'{mode}-{view}.png').convert('RGB');im.thumbnail((380,305));sheet.paste(im,(x,y))
sheet.save(dest/'foot-strike-compare.png')
sheet=Image.new('RGB',(1120,370),bg);d=ImageDraw.Draw(sheet)
d.text((25,18),'착지 부위 확대 · 실제 피부 모양',font=font,fill=ink)
for col,(mode,label,desc) in enumerate([('heel','뒤꿈치','뒤꿈치 먼저 · 발끝 들림'),('midfoot','미드풋','뒤꿈치·앞발바닥 함께'),('forefoot','앞꿈치','앞발바닥 먼저 · 뒤꿈치 들림')]):
 x=20+col*365;d.text((x,70),label,font=font,fill=ink)
 # Identical crop and scale for all views; includes the ground line.
 im=Image.open(src/f'{mode}-side.png').convert('RGB').crop((250,424,365,520)).resize((276,230))
 sheet.paste(im,(x+30,105));d.text((x,337),desc,font=small,fill=ink)
sheet.save(dest/'foot-strike-contact.png')
