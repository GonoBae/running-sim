"""M68: actual knee measurements and captured before/after lower-body frames."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-shared-release.json').read_text(encoding='utf-8'))
assert report['status']=='passed'
out=root/'docs/assets/images'
raw=root/'outputs/cmu-shared-release'
bg='#f6f5f1';ink='#233b32';muted='#63736a';old='#b96540';new='#1687ad'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
im=Image.new('RGB',(1400,1060),bg);d=ImageDraw.Draw(im)
d.text((30,20),'발을 뗄 때 굽혔다 펴지는 짧은 왕복',font=font(31),fill=ink)
d.text((30,67),'M68 실제 관절 측정 / 주황 기존 · 파랑 수정 / 수치 검사 완료 · 사용자 외형 검토 전',font=font(20),fill=muted)
for mi,result in enumerate(report['results']):
 for si,side in enumerate(['r','l']):
  x=85+si*690;y=170+mi*335;w=560;h=230
  title=('남성형' if mi==0 else '여성형')+' · '+('오른발' if side=='r' else '왼발')
  m=result['motion'][side]
  d.text((x-35,y-54),title+f"   {m['before']['reverseDeg']:.2f}° 역행 → 0°",font=font(23),fill=ink)
  project=lambda t,z:(x+(t-.50)/.22*w,y+h-(z-25)/35*h)
  d.rectangle((project(.55,60),project(.68,25)),fill='#e5efe9')
  for deg in [25,35,45,55]:
   yy=project(.5,deg)[1];d.line((x,yy,x+w,yy),fill='#d3ddd5')
   d.text((x-42,yy-12),str(deg)+'°',font=font(16),fill=muted)
  for key,color in [('kneeBefore',old),('kneeAfter',new)]:
   d.line([project(r['t'],r[key]) for r in result['release'][side]],fill=color,width=4)
  for phase in [.50,.55,.60,.65,.68,.72]:
   xx=project(phase,25)[0];label=phase*100+(50 if side=='l' else 0)
   d.text((xx-14,y+h+12),f'{label:.0f}',font=font(16),fill=muted)
  if mi==1:d.text((x+160,y+h+42),'주기 진행률 (%)',font=font(17),fill=muted)
d.rounded_rectangle((30,850,1370,965),12,fill='white')
d.text((50,867),'고정 유지 → 무릎 굽힘·방향을 함께 연결 → 기존 회수 합류',font=font(25),fill=ink)
d.text((50,913),'오른발: 55~68% / 왼발: 다음 5~18%   ·   기존 60% 합류보다 약 61ms 더 연결',font=font(20),fill=muted)
d.text((30,994),'골반·몸 높이·발 세계 방향·발목 높이 유지 / 구간 안 무릎 각가속도 최대값 73~81% 감소',font=font(20),fill=ink)
im.save(out/'cmu-shared-release-curves.png')

im=Image.new('RGB',(1400,1210),bg);d=ImageDraw.Draw(im)
d.text((30,20),'정면·측면 같은 시각 비교',font=font(31),fill=ink)
d.text((30,67),'M68 실제 남성형 캡처 / 다리 확대 · 주황 선 오른다리 / 사용자 외형 검토 전',font=font(20),fill=muted)
for col,label in enumerate(['정면 · 기존','정면 · 수정','측면 · 기존','측면 · 수정']):
 d.text((105+col*325,118),label,font=font(23),fill=old if col%2==0 else new)
for row,phase in enumerate([55,59,66]):
 y=160+row*320
 d.text((12,y+125),f'{phase}%',font=font(19),fill=muted)
 for viewIndex,view in enumerate(['front','side']):
  photo=Image.open(raw/f'male-{view}-{phase}.png')
  for j in range(2):
   crop=photo.crop((260+400*j,275,575+400*j,555)).resize((300,267))
   im.paste(crop,(75+(viewIndex*2+j)*325,y))
d.text((30,1130),'무릎 굽힘 역행은 제거했지만 옆 움직임은 일부 남습니다. 전체 달리기 자연스러움은 별도 검토입니다.',font=font(20),fill=muted)
im.save(out/'cmu-shared-release-comparison.png')
summary={k:v for k,v in report.items() if k!='results'}
summary['results']=[{k:v for k,v in r.items() if k not in ['cycle','release']} for r in report['results']]
(root/'docs/05-validation/reports/cmu-shared-release-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated M68 measurement charts, actual frames and summary.')
