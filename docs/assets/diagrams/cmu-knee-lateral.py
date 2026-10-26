"""M69 actual hip-relative knee trajectories and unaltered review captures."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-knee-lateral.json').read_text(encoding='utf-8'))
assert report['status']=='passed'
out=root/'docs/assets/images';raw=root/'outputs/cmu-knee-lateral'
bg='#f6f5f1';ink='#233b32';muted='#63736a';old='#b96540';new='#1687ad'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
im=Image.new('RGB',(1400,1050),bg);d=ImageDraw.Draw(im)
d.text((30,20),'무릎이 안쪽으로 갔다 나오는 우회 줄이기',font=font(30),fill=ink)
d.text((30,65),'M69 실제 관절 측정 / 주황 M68 · 파랑 M69 / 검사 완료 · 사용자 외형 검토 전',font=font(20),fill=muted)
for mi,result in enumerate(report['results']):
 for si,side in enumerate(['r','l']):
  x=90+si*685;y=165+mi*340;w=550;h=225
  m=result['motion'][side]['kneePosition'];sign=1 if side=='r' else -1
  title=('남성형' if mi==0 else '여성형')+' · '+('오른발' if side=='r' else '왼발')
  d.text((x-35,y-49),title+f"   옆 우회 {m['before']['lateralExtraPathMm']:.2f} → 0mm",font=font(21),fill=ink)
  project=lambda t,z:(x+(t-.50)/.22*w,y+h-(z-30)/45*h)
  d.rectangle((project(.53,75),project(.68,30)),fill='#e5efe9')
  for val in [30,40,50,60,70]:
   yy=project(.5,val)[1];d.line((x,yy,x+w,yy),fill='#d3ddd5')
   d.text((x-45,yy-10),str(val),font=font(16),fill=muted)
  for key,color in [('jointBefore',old),('jointAfter',new)]:
   d.line([project(r['t'],sign*(r[key][0]-r['hip'][0])*1000) for r in result['release'][side]],fill=color,width=4)
  for phase in [.50,.53,.60,.65,.68,.72]:
   xx=project(phase,30)[0];label=phase*100+(50 if side=='l' else 0)
   d.text((xx-14,y+h+12),f'{label:.0f}',font=font(16),fill=muted)
  if mi==1:d.text((x+40,y+h+47),'가로: 주기(%) / 세로: 고관절 기준 바깥쪽(mm)',font=font(17),fill=muted)
d.rounded_rectangle((30,845,1370,965),12,fill='white')
d.text((50,863),'무릎의 옆 위치만 연결 · 고관절과 발목은 그대로',font=font(27),fill=ink)
d.text((50,909),'무릎 굽힘 차이 <0.001° / 발·발가락 위치 차이 <0.01mm / 발 세계 방향 차이 <0.001°',font=font(20),fill=muted)
d.text((30,998),'구간 안 되돌아오는 경로를 제거한 결과입니다. 무릎의 옆 이동 자체나 전체 러닝 흔들림이 0이라는 뜻은 아닙니다.',font=font(18),fill=muted)
im.save(out/'cmu-knee-lateral-curves.png')

im=Image.new('RGB',(1400,1130),bg);d=ImageDraw.Draw(im)
d.text((30,20),'같은 시각의 정면·측면 비교',font=font(30),fill=ink)
d.text((30,65),'M69 실제 남성형 캡처 / 주황 선 오른다리 · 파랑 선 왼다리 / 사용자 외형 검토 전',font=font(20),fill=muted)
for col,label in enumerate(['정면 · 기존','정면 · 수정','측면 · 기존','측면 · 수정']):
 d.text((100+col*325,112),label,font=font(23),fill=old if col%2==0 else new)
for row,(phase,label) in enumerate([(56,'56%'),(60,'60%'),(10,'10%')]):
 y=155+row*295;d.text((12,y+120),label,font=font(18),fill=muted)
 for v,view in enumerate(['front','side']):
  photo=Image.open(raw/f'male-{view}-{phase}.png')
  for j in range(2):
   crop=photo.crop((260+400*j,275,575+400*j,555)).resize((300,267))
   im.paste(crop,(75+(v*2+j)*325,y))
d.text((30,1060),'위 두 줄: 오른발 해제 / 아래: 왼발 해제 · 발 위치와 굽힘을 유지하면서 무릎 방향만 조절합니다.',font=font(20),fill=muted)
im.save(out/'cmu-knee-lateral-comparison.png')
summary={k:v for k,v in report.items() if k!='results'}
summary['results']=[{k:v for k,v in r.items() if k not in ['cycle','release']} for r in report['results']]
(root/'docs/05-validation/reports/cmu-knee-lateral-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated M69 measured curves, actual frames and summary.')
