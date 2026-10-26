"""M77 figures: actual screenshots and measured bilateral elbow angles."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3];raw=root/'outputs/cmu-elbow-bend';out=root/'docs/assets/images'
report=json.loads((root/'docs/05-validation/reports/cmu-elbow-bend.json').read_text(encoding='utf-8'))
assert report['status']=='passed'
bg,ink,muted,blue,orange='#f6f5f1','#233b32','#63736a','#1687ad','#bc6842'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
Image.open(raw/'male-side.png').save(out/'cmu-elbow-bend-screen.png')
im=Image.new('RGB',(1360,1070),bg);d=ImageDraw.Draw(im)
d.text((30,24),'팔꿈치 기본 ↔ +20° / 다리 설정은 양쪽 모두 +5cm',font=font(29),fill=ink)
d.text((30,71),'M77 실제 구현 화면 · 각 쌍 왼쪽 기본 팔 / 오른쪽 조절 · 같은 시점',font=font(20),fill=muted)
for mi,model in enumerate(['male','female']):
 for vi,view in enumerate(['front','side']):
  x=30+vi*670;y=115+mi*460
  d.text((x,y),('남성형' if mi==0 else '여성형')+' · '+('정면' if vi==0 else '측면'),font=font(24),fill=ink)
  shot=Image.open(raw/f'{model}-{view}.png').crop((235,585,1045,1050));shot.thumbnail((640,390));im.paste(shot,(x+(640-shot.width)//2,y+45))
d.text((30,1030),'팔꿈치 위치·위팔 흔들림은 그대로 / 손목·손가락의 상대 자세 유지 / 아래팔이 굽혀지는 양만 변경',font=font(20),fill=ink)
im.save(out/'cmu-elbow-bend-comparison.png')
im=Image.new('RGB',(1200,700),bg);d=ImageDraw.Draw(im)
d.text((30,24),'덜 굽히기 ← 현재 기본 → 더 굽히기',font=font(30),fill=ink)
for i,(label,file,box) in enumerate([
 ('-20°', 'male-side-less.png',(650,580,1010,1055)),
 ('기본 0°', 'male-side.png',(250,580,610,1055)),
 ('+20°', 'male-side.png',(650,580,1010,1055))]):
 x=20+i*400;d.text((x+130,90),label,font=font(25),fill=ink)
 shot=Image.open(raw/file).crop(box);im.paste(shot,(x+20,140))
d.text((30,650),'실제 화면 · 같은 시점·같은 다리 설정 / 표시값은 기본 굽힘에 더하거나 빼는 각도',font=font(21),fill=muted)
im.save(out/'cmu-elbow-bend-angles.png')
im=Image.new('RGB',(1360,640),bg);d=ImageDraw.Draw(im)
d.text((30,24),'팔꿈치의 원래 주기 변화 + 설정한 각도',font=font(31),fill=ink)
d.text((30,73),'실측이 아닌 모델 기하 측정 · 선: 오른팔 / 점: 반 주기 맞춘 왼팔 · 편 팔 = 0°',font=font(20),fill=muted)
for mi,result in enumerate(report['results']):
 x=90+mi*665;y=170;w=555;h=300
 xx=lambda t:x+t*w
 yy=lambda angle:y+h-(angle-75)/65*h
 d.text((x,125),'남성형' if mi==0 else '여성형',font=font(23),fill=ink)
 for v in [80,100,120,140]:
  d.line((x,yy(v),x+w,yy(v)),fill='#d5dfd7');d.text((x-42,yy(v)-12),str(v),font=font(18),fill=muted)
 for offset,col in [(-20,blue),(0,muted),(20,orange)]:
  rows=next(s['frames'] for s in result['series'] if s['offset']==offset)
  d.line([(xx(i/500),yy(rows[i]['r'])) for i in range(501)],fill=col,width=3)
  for i in range(0,500,25):
   px,py=xx(i/500),yy(rows[(i+250)%500]['l']);d.ellipse((px-3,py-3,px+3,py+3),outline=col,width=2)
 for t in [0,.5,1]:d.text((xx(t)-12,486),str(round(t*100)),font=font(18),fill=muted)
 d.text((x-20,527),'가로: 달리기 주기(%) / 세로: 실제 굽힘 각도(°)',font=font(18),fill=muted)
d.text((30,589),'파랑 -20° / 회색 기본 / 주황 +20° · 반 주기 대응 양팔의 실제 굽힘 차이 <0.001°',font=font(23),fill=ink)
im.save(out/'cmu-elbow-bend-curves.png')
summary={k:v for k,v in report.items() if k!='results'};summary['results']=[]
for result in report['results']:
 r={k:v for k,v in result.items() if k!='series'}
 r['bilateralActualAngleDeg']=max(abs(s['frames'][i]['r']-s['frames'][(i+250)%500]['l']) for s in result['series'] for i in range(500))
 assert r['bilateralActualAngleDeg']<.001
 summary['results'].append(r)
(root/'docs/05-validation/reports/cmu-elbow-bend-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
