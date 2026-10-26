"""M67 actual before/after frames, independently tracked skin paths and timing."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
r=json.loads((root/'docs/05-validation/reports/cmu-shared-support-bilateral.json').read_text(encoding='utf-8'));assert r['status']=='passed'
out=root/'docs/assets/images';raw=root/'outputs/cmu-shared-support-bilateral'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';old='#b96540';new='#1687ad'
im=Image.new('RGB',(1400,730),bg);d=ImageDraw.Draw(im)
d.text((30,20),'왼발에도 같은 지지 연결 · 오른발 결과 유지',font=font(30),fill=ink)
d.text((30,65),'M67 실제 화면 / 남성형 다음 주기 4% · 왼발 지지 중 / 사용자 외형 검토 전',font=font(20),fill=muted)
for v,view in enumerate(['front','side']):
 photo=Image.open(raw/f'male-{view}-4.png')
 for j,label in enumerate(['오른발만','양발 적용']):
  x=20+v*690+j*335;im.paste(photo.crop((235+400*j,70,555+400*j,555)),(x,165))
  d.text((x+50,120),('정면' if v==0 else '측면')+' · '+label,font=font(22),fill=old if j==0 else new)
d.text((30,675),'골반·몸 높이·양발 세계 방향·회수 보존 / 무릎과 종아리 대비 발목 상대각은 변경',font=font(21),fill=ink)
im.save(out/'cmu-shared-support-bilateral-comparison.png')
im=Image.new('RGB',(1400,1190),bg);d=ImageDraw.Draw(im)
d.text((30,18),'양발 지지 후반 · 같은 방식, 반 주기 차이',font=font(30),fill=ink)
d.text((30,63),'M67 검사 완료 / 주황 수정 전 · 파랑 수정 후 / 지면 1mm 이내의 같은 피부점 경로',font=font(20),fill=muted)
for j,result in enumerate(r['results']):
 x=30+j*685;p=result['paths']['l']['nearGround'];right=result['paths']['r']['nearGround']['afterMm']
 d.rounded_rectangle((x,110,x+655,290),16,fill='white')
 d.text((x+20,122),('남성형' if j==0 else '여성형')+' · 왼발',font=font(23),fill=ink)
 fmt=lambda z:'<0.01' if z<.01 else f'{z:.2f}'
 d.text((x+20,165),f"{p['beforeMm']:.2f} → {fmt(p['afterMm'])} mm",font=font(31),fill=new)
 d.text((x+20,215),f"같은 시간 범위 {p['start']*100:.1f}~{p['end']*100:.1f}% / 100%부터 다음 주기",font=font(17),fill=muted)
 d.text((x+20,250),f"오른발: {fmt(right)}mm 유지 / M66 저장 곡선 차이 0mm",font=font(19),fill=ink)
rows=r['results'][0]['stance']['l'];base=min(rows,key=lambda row:abs(row['t']-.93))['before']
for panel,(axis,title) in enumerate([(0,'좌우 X'),(2,'앞뒤 Z')]):
 x=85+panel*690;y=390;w=560;h=260
 values=[(row[key][axis]-base[axis])*1000 for row in rows for key in ['before','after']]
 lo=math.floor(min(values)/10)*10-5;hi=math.ceil(max(values)/10)*10+5
 d.text((x-20,y-54),'왼발 '+title+' · 93% 기준점 대비 mm',font=font(22),fill=ink)
 project=lambda t,z:(x+(t-.88)/.22*w,y+h-(z-lo)/(hi-lo)*h)
 d.rectangle((project(.93,hi),project(1.05,lo)),fill='#e5efe9')
 for k in range(5):
  val=lo+(hi-lo)*k/4;yy=project(.88,val)[1];d.line((x,yy,x+w,yy),fill='#d2dcd4');d.text((x-44,yy-9),f'{val:g}',font=font(16),fill=muted)
 for key,color in [('before',old),('after',new)]:d.line([project(row['t'],(row[key][axis]-base[axis])*1000) for row in rows],fill=color,width=4)
 for phase in [.88,.93,1,1.05,1.10]:
  xx=project(phase,0)[0];d.text((xx-14,y+h+12),f'{phase*100:.0f}',font=font(16),fill=muted)
 xx=project(1,0)[0]
 for yy in range(y,y+h,12):d.line((xx,yy,xx,min(yy+5,y+h)),fill='#819187',width=2)
 d.text((x+80,y+h+50),'100% 반복 경계를 지나 같은 기준점 유지',font=font(18),fill=muted)
for row,labels in enumerate([['오른발','38~43% 연결','43~55% 유지','55~60% 해제','회수 보존'],['왼발','88~93% 연결','93~105% 유지','105~110% 해제','회수 보존']]):
 y=770+row*80;d.text((30,y+22),labels[0],font=font(22),fill=ink)
 for j,(x,w,color) in enumerate([(145,270,'#e8ddd5'),(425,370,'#dcebe3'),(805,310,'#dce8ed'),(1125,245,'#e7e7e2')]):
  d.rounded_rectangle((x,y,x+w,y+66),10,fill=color);d.text((x+18,y+19),labels[j+1],font=font(22),fill=ink)
d.text((30,958),'보존 확인   골반·몸 높이·오른발 M66 결과 / 양발 세계 회전 <0.001° / 회수·반복 검사 통과',font=font(20),fill=ink)
d.text((30,1005),'발목 상대각 변화   오른발 최대 2.85°·2.94° / 왼발 최대 1.72°·1.93° (남성·여성)',font=font(20),fill=ink)
m=[v['metrics'] for v in r['results']]
d.text((30,1052),f"반 주기 관절 대응 차이   남성 {m[0]['halfCycleBeforeMm']:.2f} → {m[0]['halfCycleAfterMm']:.2f}mm / 여성 {m[1]['halfCycleBeforeMm']:.2f} → {m[1]['halfCycleAfterMm']:.2f}mm",font=font(20),fill=ink)
d.text((30,1100),'완전 대칭은 아님: 기존 골반의 옆 이동과 지면 고정을 함께 유지합니다. 해제 이동도 남아 있습니다.',font=font(19),fill=muted)
im.save(out/'cmu-shared-support-bilateral-results.png')
summary={'status':'passed','results':[{k:v[k] for k in ['model','metrics','holdSymmetry','paths','speeds','travel']} for v in r['results']]}
(root/'docs/05-validation/reports/cmu-shared-support-bilateral-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated M67 figures and summary')
