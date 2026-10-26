"""M82 contact sheets from actual browser captures; SVG is edited natively.
Run capture-upper-lean.cjs and check-upper-lean.cjs before this script.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
source=root/'outputs/upper-lean'
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',25)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
sheet=Image.new('RGB',(1200,1070),'#f7f8f5');d=ImageDraw.Draw(sheet)
d.text((26,20),'같은 시점 · 상체 0° → +8°',font=font,fill='#294632')
d.text((26,60),'실제 구현 캡처 / 다리 +5cm · 팔 +10° 고정 / 골반·다리·발 좌표 유지',font=small,fill='#748074')
for row,view in enumerate(['front','side']):
 for col,kind in enumerate(['base','lean']):
  x,y=20+col*590,130+row*460
  d.text((x,y-34),('정면' if view=='front' else '측면')+' · '+('기본 0°' if kind=='base' else '상체 +8°'),font=small,fill='#294632')
  im=Image.open(source/f'{kind}-{view}.png').convert('RGB');im.thumbnail((570,420));sheet.paste(im,(x,y))
sheet.save(root/'docs/assets/images/upper-lean-compare.png')
if (source/'mobile.png').exists():
 sheet=Image.new('RGB',(1180,810),'#f7f8f5');d=ImageDraw.Draw(sheet)
 d.text((26,20),'몸통 직접 조절 · 실제 데스크톱 / 터치 화면',font=font,fill='#294632')
 for name,xy,limit in [('direct-side.png',(20,85),(800,950)),('mobile.png',(840,85),(320,950))]:
  im=Image.open(source/name).convert('RGB');im.thumbnail(limit);sheet.paste(im,xy)
 sheet.save(root/'docs/assets/images/upper-lean-screen.png')
