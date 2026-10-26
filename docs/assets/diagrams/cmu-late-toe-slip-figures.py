"""M55: recorded material points + real browser captures. No generated poses."""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'docs/assets/images'; SRC=ROOT/'outputs/cmu-late-toe-slip'
data=json.loads((ROOT/'docs/05-validation/reports/cmu-late-toe-slip.json').read_text(encoding='utf-8'))
BG,INK,OLD,TRIAL,PATCH='#faf9f6','#233b32','#287967','#b45338','#ba861d'
def font(n): return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
def text(d,xy,s,n=20,c=INK): d.text(xy,s,font=font(n),fill=c)

im=Image.new('RGB',(1300,1090),BG);d=ImageDraw.Draw(im)
text(d,(28,20),'발끝 이동을 잠시 줄여도, 해제 구간으로 밀려납니다',30)
text(d,(28,68),'M55 · 원인·반려 검사 완료 / 교정 미채택 · 실제 남성형 피부점 · 주기 경계 이동 보정',19)
for col,t in enumerate(data['results'][0]['tracks']):
 x=80+col*650;y=178;w=520;h=300
 text(d,(x-25,y-55),('오른발' if t['side']=='r' else '왼발')+' · 지면 앞뒤 위치 변화 (mm)',22)
 values=[]
 for j,key in [(0,'toe'),(1,'toe'),(0,'patch')]:
  z0=t['track'][0]['lanes'][j][key][2]
  values.extend((r['lanes'][j][key][2]-z0)*1000 for r in t['track'])
 low=math.floor(min(values)/5)*5;high=math.ceil(max(values)/10)*10
 def px(u):return x+(u-.5)/.5*w
 def py(v):return y+h-(v-low)/(high-low)*h
 d.rectangle((px(.65),y,px(.85),y+h),fill='#e5eee6')
 d.rectangle((px(.85),y,px(1),y+h),fill='#f3dfd8')
 for i in range(5):
  v=low+(high-low)*i/4; yy=py(v);d.line((x,yy,x+w,yy),fill='#d7ddd8');text(d,(x-45,yy-10),f'{v:g}',16)
 for j,key,color in [(0,'toe',OLD),(1,'toe',TRIAL),(0,'patch',PATCH)]:
  z0=t['track'][0]['lanes'][j][key][2];p=[(px(r['u']),py((r['lanes'][j][key][2]-z0)*1000)) for r in t['track']]
  if key=='patch':
   for i in range(0,len(p)-1,4):d.line(p[i:i+3],fill=color,width=2)
  else:d.line(p,fill=color,width=3)
 for u in [.5,.65,.85,1]:text(d,(px(u)-14,y+h+12),f'{u*100:g}',17)
 text(d,(x,y+h+48),'지지 진행률 % · 착지 0 / 회수 시작 100',18)
text(d,(28,566),'초록: 유지 M54 발끝  /  주황: 25% 완화 시험 발끝  /  점선: M54 착지 기준점',20)
text(d,(28,602),'기준점도 전진합니다. 발끝을 잡은 만큼 기준점이 바뀌고, 회수로 돌아갈 때 더 빨리 이동합니다.',20)

headers=['실제 측정 · 기준 → 시험','남성 오른발','남성 왼발','여성 오른발','여성 왼발']
xs=[28,418,632,846,1060];widths=[390,214,214,214,212]
rows=[headers]
for label,fn in [('지지 65~85% 이동 거리 (mm)',lambda b,a:f"{b['hold']['pathMm']:.1f} → {a['hold']['pathMm']:.1f}"),('해제 85~100% 최고 속도 (mm/s)',lambda b,a:f"{b['release']['maxSpeedMmS']:.0f} → {a['release']['maxSpeedMmS']:.0f}"),('지지 후반 전체 거리 (mm)',lambda b,a:f"{b['late']['pathMm']:.1f} → {a['late']['pathMm']:.1f}")]:
 rows.append([label]+[fn(*t['metrics']) for r in data['results'] for t in r['tracks']])
for i,row in enumerate(rows):
 for x,w,s in zip(xs,widths,row):
  d.rectangle((x,666+i*51,x+w-2,715+i*51),fill='#e6ece6' if i==0 else '#f0eee8');text(d,(x+8,679+i*51),s,17 if i else 16)
for i,r in enumerate(data['results']):
 m=r['metrics']; text(d,(28,903+i*42),f"{'남성형' if i==0 else '여성형'}: 기존 착지점 최대 {m['patchXZmm']:.2f}mm 변경 · 종아리 대비 발 회전 최대 {m['ankleRelativeDeg']:.2f}° 변경",22,c=TRIAL)
text(d,(28,1010),'보존 조건 불합격 → 기본 M54 유지. 압력·마찰 측정이나 자연스러움 검증 결과가 아닙니다.',19)
im.save(OUT/'cmu-late-toe-slip-metrics.png')

for view,label in [('front','정면'),('side','측면')]:
 im=Image.new('RGB',(1320,570),BG);d=ImageDraw.Draw(im)
 text(d,(24,16),f'{label} · 지지 75% · 초록 점: 발끝 구역 / 노란 점: 기존 착지 기준점',24)
 for i,(side,j) in enumerate([('r',0),('r',1),('l',0),('l',1)]):
  x=12+i*328;text(d,(x+8,65),('오른발' if side=='r' else '왼발')+(' · 유지 M54' if j==0 else ' · 미채택 25% 시험'),18,c=INK if j==0 else TRIAL)
  pic=Image.open(SRC/f'close-{side}-{view}-{j}.png').convert('RGB');pic.thumbnail((320,442));im.paste(pic,(x+(320-pic.width)//2,102))
 im.save(OUT/f'cmu-late-toe-slip-{view}.png')

im=Image.new('RGB',(1300,820),BG);d=ImageDraw.Draw(im)
text(d,(24,16),'실제 비교 화면 · 왼쪽 유지 M54 / 오른쪽 미채택 시험',28)
for i,(v,phase,label) in enumerate([('front',505,'오른발 지지 75% · 정면'),('side',505,'오른발 지지 75% · 측면'),('front',5,'왼발 지지 75% · 정면'),('side',5,'왼발 지지 75% · 측면')]):
 x=20+(i%2)*640;y=74+(i//2)*367;text(d,(x,y),label,21)
 pic=Image.open(SRC/f'male-{v}-{phase}.png').convert('RGB');pic.thumbnail((620,325));im.paste(pic,(x,y+37))
im.save(OUT/'cmu-late-toe-slip-comparison.png')

# Toe-only local Jacobian: check numerical rank and an upper bound on any
# displacement that stays inside inherited 0.01mm / 0.001deg linear tolerances.
jp=ROOT/'docs/05-validation/reports/cmu-late-toe-joint.json'
joint=json.loads(jp.read_text(encoding='utf-8'))
for r in joint['results']:
 for s in r['samples']:
  j=np.array(s['jacobian']);c=j[:5]/np.array([.01,.01,.01,.001,.001])[:,None]
  sv=np.linalg.svd(c,compute_uv=False);s['rank']=int(np.linalg.matrix_rank(c));s['singularValues']=sv.tolist()
  s['linearToeDisplacementUpperBoundMm']=float(np.linalg.norm(j[5:]@np.linalg.pinv(c),2)*np.sqrt(5))
jp.write_text(json.dumps(joint,ensure_ascii=False,indent=2),encoding='utf-8')
print('M55 figures and toe-only local rank report generated')
