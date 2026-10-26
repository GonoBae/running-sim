"""M66 figures from actual browser frames and fixed material-point measurements."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
r=json.loads((root/'docs/05-validation/reports/cmu-shared-support.json').read_text());assert r['status']=='passed'
out=root/'docs/assets/images';raw=root/'outputs/cmu-shared-support'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';old='#b96540';new='#1687ad'
im=Image.new('RGB',(1400,730),bg);d=ImageDraw.Draw(im)
d.text((30,20),'오른발 지지 후반 · 고관절과 무릎을 함께 연결',font=font(30),fill=ink)
d.text((30,65),'M66 실제 구현 화면 / 남성형 54% / 오른발만 변경 · 외형 검토 전',font=font(20),fill=muted)
for v,view in enumerate(['front','side']):
 photo=Image.open(raw/f'male-{view}-54.png')
 for j,label in enumerate(['수정 전','수정 후']):
  x=20+v*690+j*335
  crop=photo.crop((235+400*j,70,555+400*j,555));im.paste(crop,(x,165))
  d.text((x+65,120),('정면' if v==0 else '측면')+' · '+label,font=font(22),fill=old if j==0 else new)
d.text((30,675),'골반·몸 높이·발 세계 방향 유지 / 무릎 굽힘과 종아리 대비 발목 상대각은 변경',font=font(22),fill=ink)
im.save(out/'cmu-shared-support-comparison.png')
im=Image.new('RGB',(1400,1100),bg);d=ImageDraw.Draw(im)
d.text((30,18),'발끝의 같은 피부점으로 전후 비교',font=font(30),fill=ink)
d.text((30,63),'M66 검사 완료 / 주황 수정 전 · 파랑 수정 후 / 지면 X·Z 이동, 물리적 마찰 검증 아님',font=font(20),fill=muted)
for j,result in enumerate(r['results']):
 x=30+j*685;p=result['paths']['nearGround'];late=result['paths']['late'];m=result['metrics']
 d.rounded_rectangle((x,110,x+655,290),16,fill='white')
 d.text((x+20,122),'남성형' if j==0 else '여성형',font=font(23),fill=ink)
 after='<0.01' if p['afterMm']<.01 else f"{p['afterMm']:.2f}"
 d.text((x+20,165),f"{p['beforeMm']:.2f} → {after} mm",font=font(31),fill=new)
 d.text((x+20,215),f"지면 1mm 이내 / 같은 시간 {p['start']*100:.1f}~{p['end']*100:.1f}%",font=font(18),fill=muted)
 d.text((x+20,250),f"43~58% 전체: {late['beforeMm']:.2f} → {late['afterMm']:.2f}mm",font=font(18),fill=ink)
rows=[row for row in r['results'][0]['rows'] if .38<=row['t']<=.60]
base=min(rows,key=lambda row:abs(row['t']-.43))['before']
for panel,(axis,title) in enumerate([(0,'좌우 X'),(2,'앞뒤 Z')]):
 x=85+panel*690;y=390;w=560;h=280;lo=-45;hi=20
 d.text((x-20,y-54),'남성형 '+title+' · 43% 기준점 대비 mm',font=font(21),fill=ink)
 project=lambda t,z:(x+(t-.38)/.22*w,y+h-(z-lo)/(hi-lo)*h)
 d.rectangle((project(.43,hi),project(.55,lo)),fill='#e5efe9')
 for val in [-40,-20,0,20]:
  yy=project(.38,val)[1];d.line((x,yy,x+w,yy),fill='#d2dcd4');d.text((x-45,yy-9),str(val),font=font(16),fill=muted)
 for key,color in [('before',old),('after',new)]:d.line([project(row['t'],(row[key][axis]-base[axis])*1000) for row in rows],fill=color,width=4)
 for phase in [.38,.43,.50,.55,.60]:
  xx=project(phase,0)[0];d.text((xx-12,y+h+12),f'{phase*100:.0f}',font=font(16),fill=muted)
 d.text((x+70,y+h+50),'초록 영역: 같은 점 수평 고정 / 이후 해제',font=font(18),fill=muted)
# Visible timeline explicitly shows the finite correction interval.
y=790
for x,w,title,caption,color in [(30,270,'38~43% 연결','기존 경로에서 연결','#e8ddd5'),(310,440,'43~55% 유지','같은 피부점의 X/Z 유지','#dcebe3'),(760,270,'55~60% 해제','기존 회수로 연결','#dce8ed'),(1040,330,'60% 이후','기존 동작 그대로','#e7e7e2')]:
 d.rounded_rectangle((x,y,x+w,y+110),12,fill=color);d.text((x+16,y+16),title,font=font(23),fill=ink);d.text((x+16,y+65),caption,font=font(18),fill=muted)
d.text((30,944),'보존 확인   골반·상체·왼다리·뼈 길이 / 발 세계 회전 <0.001° / 피부 최저 높이 변화 <0.003mm',font=font(20),fill=ink)
d.text((30,991),'변경 공개   종아리 대비 발목 최대 2.85°·2.94° / 해제 속도 약 13~22% 증가 / 양발 확대 전',font=font(20),fill=ink)
d.text((30,1040),'완전 고정·자연스러움 확정 아님: 해제 이동과 여성형의 잔여 이동은 계속 검토해야 합니다.',font=font(19),fill=muted)
im.save(out/'cmu-shared-support-results.png')
summary={'status':'passed','results':[{k:x[k] for k in ['model','vertex','metrics','paths','speeds']} for x in r['results']]}
(root/'docs/05-validation/reports/cmu-shared-support-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated M66 comparison, measurement figures and summary')
