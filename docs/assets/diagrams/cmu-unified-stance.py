"""M75 figures from saved geometry checks and actual browser captures."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
r=json.loads((root/'docs/05-validation/reports/cmu-unified-stance.json').read_text(encoding='utf-8'))
assert r['status']=='passed'
out=root/'docs/assets/images';raw=root/'outputs/cmu-unified-stance'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg,ink,muted,orange,blue='#f6f5f1','#233b32','#63736a','#bc6842','#1687ad'
summary={k:v for k,v in r.items() if k!='results'}
summary['results']=[{k:v for k,v in m.items() if k!='frames'} for m in r['results']]
(root/'docs/05-validation/reports/cmu-unified-stance-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

im=Image.new('RGB',(1400,820),bg);d=ImageDraw.Draw(im)
d.text((32,22),'양발 접촉 경로 통합 / 지면 근처 이동 감소',font=font(32),fill=ink)
d.text((32,76),'M75 실제 기하 검사 · 주황 기존 M74 / 파랑 통합 M75 · 발바닥 접촉부 누적 이동 지표(mm)',font=font(21),fill=muted)
for mi,m in enumerate(r['results']):
 for si,s in enumerate(['r','l']):
  y=155+(mi*2+si)*139;x=275;scale=18
  a=m['contact']['before'][s];b=m['contact']['after'][s]
  d.text((32,y+15),('남성형' if mi==0 else '여성형')+' '+('오른발' if s=='r' else '왼발'),font=font(25),fill=ink)
  for off,v,col in [(0,a,orange),(46,b,blue)]:
   d.rounded_rectangle((x,y+off,x+v*scale,y+off+30),radius=6,fill=col)
   d.text((x+v*scale+12,y+off-2),f'{v:.2f}',font=font(22),fill=col)
  d.text((1150,y+22),f'{100*(1-b/a):.1f}% 감소',font=font(23),fill=ink)
d.text((32,733),'전체 지표에는 접지 시간이 약 20–22ms 짧아진 효과도 포함됩니다. 완전 고정·마찰 실험은 아닙니다.',font=font(20),fill=muted)
d.text((32,776),'전후 모두 지면 가까운 같은 구간만 비교해도 이동 지표가 24.6–28.8% 줄었습니다.',font=font(22),fill=ink)
im.save(out/'cmu-unified-stance-contact.png')

im=Image.new('RGB',(1400,780),bg);d=ImageDraw.Draw(im)
d.text((32,22),'발 떼기 → 회수 / 무릎 굽힘을 되돌리지 않고 연결',font=font(31),fill=ink)
d.text((32,73),'M75 실제 측정 · 주황 M74 / 파랑 M75 · 오른발 실선 / 왼발 점 · 같은 단계로 맞춤',font=font(20),fill=muted)
for mi,m in enumerate(r['results']):
 x=85+mi*690;y=180;w=560;h=320
 xx=lambda t:x+(t-.55)/.13*w
 yy=lambda v:y+h-(v-25)/25*h
 d.text((x-25,125),'남성형' if mi==0 else '여성형',font=font(25),fill=ink)
 for v in [25,30,35,40,45,50]:
  d.line((x,yy(v),x+w,yy(v)),fill='#d4ddd5');d.text((x-40,yy(v)-12),str(v),font=font(18),fill=muted)
 for key,col in [('before',orange),('after',blue)]:
  for s in ['r','l']:
   points=[(xx(i/1000),yy(m['frames'][(i+(500 if s=='l' else 0))%1000][key][s]['knee'])) for i in range(550,681)]
   if s=='r':d.line(points,fill=col,width=4)
   else:
    for px,py in points[::10]:d.ellipse((px-3,py-3,px+3,py+3),fill=col)
 for t in [55,58,62,65,68]:d.text((xx(t/100)-12,y+h+12),str(t),font=font(18),fill=muted)
 d.text((x-25,557),'가로: 한쪽 다리의 주기(%) / 세로: 무릎 굽힘(°)',font=font(19),fill=muted)
d.text((32,630),'골반·몸 높이는 그대로 / 발을 뗄 때 발 높이를 최대 14.8mm 연결 / 68%부터 기존 회수 그대로',font=font(23),fill=ink)
d.text((32,683),'남녀 양발: 해제 구간 굽힘 역행 없음 · 전 주기 좌우 무릎 굽힘 최대 차이 0.009° 미만',font=font(21),fill=ink)
d.text((32,736),'기하 기능 시험 / 인간의 관절 정상 범위·접촉력 검증을 뜻하지 않습니다.',font=font(20),fill=muted)
im.save(out/'cmu-unified-stance-release.png')

im=Image.new('RGB',(1400,1140),bg);d=ImageDraw.Draw(im)
d.text((32,22),'정면·측면 / 양발에 같은 통합 경로 적용',font=font(32),fill=ink)
d.text((32,74),'실제 남성형 화면 · 각 쌍 왼쪽 기존 / 오른쪽 수정 · 정면 지지 40% / 측면 발 떼기 60%',font=font(20),fill=muted)
for row,(view,t) in enumerate([('front',40),('side',60)]):
 y=135+row*485
 d.text((32,y),'정면 · 지지' if row==0 else '측면 · 발 떼기',font=font(24),fill=ink)
 photo=Image.open(raw/f'male-{view}-{t}.png').crop((245,75,960,545));photo.thumbnail((1100,438))
 x=(1400-photo.width)//2;scale=photo.width/715
 d.text((x+155*scale,y+14),'기존 M74',font=font(23),fill=orange,anchor='mm')
 d.text((x+555*scale,y+14),'수정 M75',font=font(23),fill=blue,anchor='mm')
 im.paste(photo,(x,y+37))
d.text((32,1100),'팔·몸통·골반·몸 높이·발 방향 유지 / 다리 길이를 바꾸지 않고 고관절–무릎–발을 함께 계산',font=font(20),fill=muted)
im.save(out/'cmu-unified-stance-comparison.png')
print('M75 figures and summary generated.')
