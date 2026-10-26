"""M76: actual browser screenshots + measured knee height, no synthetic poses."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
raw=root/'outputs/cmu-leg-height';out=root/'docs/assets/images'
report=json.loads((root/'docs/05-validation/reports/cmu-leg-height.json').read_text(encoding='utf-8'))
assert report['status']=='passed'
bg,ink,muted,blue,green='#f6f5f1','#233b32','#63736a','#1687ad','#26765e'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
# Keep the actual UI and dimensions; raw captures remain in outputs.
Image.open(raw/'male-side.png').crop((0,0,1280,960)).save(out/'cmu-leg-height-screen.png')
im=Image.new('RGB',(1360,1070),bg);d=ImageDraw.Draw(im)
d.text((30,24),'기본 0cm ↔ 무릎 +10cm / 실제 정면·측면 화면',font=font(29),fill=ink)
d.text((30,71),'M76 구현 화면 · 각 쌍 왼쪽 기본 / 오른쪽 설정 · 같은 시점 · 남성형과 여성형',font=font(20),fill=muted)
for mi,model in enumerate(['male','female']):
 for vi,view in enumerate(['front','side']):
  x=30+vi*670;y=115+mi*460
  d.text((x,y),('남성형' if model=='male' else '여성형')+' · '+('정면' if view=='front' else '측면'),font=font(24),fill=ink)
  shot=Image.open(raw/f'{model}-{view}.png').crop((235,390,1045,860))
  shot.thumbnail((640,390));im.paste(shot,(x+(640-shot.width)//2,y+45))
d.text((30,1030),'골반·몸 높이·지지 중 다리는 그대로 / 앞으로 드는 무릎의 추가 높이만 양쪽에 적용',font=font(21),fill=ink)
im.save(out/'cmu-leg-height-comparison.png')
im=Image.new('RGB',(1360,650),bg);d=ImageDraw.Draw(im)
d.text((30,24),'입력한 cm만큼 / 양쪽 무릎에 같은 높이',font=font(31),fill=ink)
d.text((30,74),'실제 기하 검사 · 선: 오른다리 / 점: 반 주기 맞춘 왼다리 · 색: +5cm / +10cm',font=font(20),fill=muted)
for mi,result in enumerate(report['results']):
 x=90+mi*665;y=170;w=555;h=310
 xx=lambda t:x+(t-.70)/.60*w
 yy=lambda cm:y+h-cm/10*h
 d.text((x,125),'남성형' if mi==0 else '여성형',font=font(23),fill=ink)
 for v in [0,5,10]:
  d.line((x,yy(v),x+w,yy(v)),fill='#d5dfd7');d.text((x-40,yy(v)-12),str(v),font=font(18),fill=muted)
 for cm,col in [(5,green),(10,blue)]:
  rows=next(s['frames'] for s in result['series'] if s['cm']==cm)
  d.line([(xx(i/500),yy(rows[i%500]['r']['riseMm']/10)) for i in range(350,651)],fill=col,width=4)
  for i in range(350,651,10):
   px,py=xx(i/500),yy(rows[(i+250)%500]['l']['riseMm']/10)
   d.ellipse((px-3,py-3,px+3,py+3),outline=col,width=2)
 for t in [.84,1.04,1.28]:
  d.text((xx(t)-15,500),str(round(t*100)),font=font(18),fill=muted)
 d.text((x-25,540),'가로: 같은 쪽 다리 주기(%) · 세로: 추가 높이(cm)',font=font(19),fill=muted)
d.text((30,601),'0~10cm 전체 검사 · 0cm 기본 일치 · 착지·지지 변화 없음 · 새 바닥 침투 없음',font=font(24),fill=ink)
im.save(out/'cmu-leg-height-curves.png')
summary={k:v for k,v in report.items() if k!='results'}
summary['results']=[{k:v for k,v in r.items() if k!='series'} for r in report['results']]
(root/'docs/05-validation/reports/cmu-leg-height-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
