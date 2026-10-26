"""Rebuild documentation plots from checked-in JSON and captured frames.
Run from repository root with numpy/matplotlib; capture images first.
"""
from pathlib import Path
import os
os.environ.setdefault('MPLCONFIGDIR',str(Path('work/matplotlib').resolve()))
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

font=Path('C:/Windows/Fonts/malgun.ttf')
if font.exists():
 font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']='Malgun Gothic'
else:plt.rcParams['font.family']=['Noto Sans CJK KR','AppleGothic','sans-serif']
plt.rcParams.update({'axes.unicode_minus':False,'font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.edgecolor':'#c5cec8','text.color':'#23372d','axes.labelcolor':'#23372d','xtick.color':'#5d6c63','ytick.color':'#5d6c63'})
ref=json.loads(Path('docs/05-validation/reports/gait-reference-ab01.json').read_text())
cur=json.loads(Path('docs/05-validation/reports/gait-current.json').read_text())
out=Path('docs/assets/images');out.mkdir(exist_ok=True)
green='#277c68';orange='#d05a37';bg='#f6f7f3'
x=np.array(ref['phase'])*100
fig,axes=plt.subplots(1,2,figsize=(13.8,5.4),dpi=120,facecolor=bg)
fig.subplots_adjust(left=.055,right=.98,bottom=.22,top=.75,wspace=.22)
fig.suptitle('실측 유래 곡선과 현재 동작 · 크기보다 타이밍부터 비교',x=.055,y=.96,ha='left',fontsize=21,fontweight='bold')
fig.text(.055,.86,'AB01 왼발 35주기 평균 ± 1 SD  /  현재 남성형 기본 모델  /  좌표 대응은 1차 검토',fontsize=11)
metrics={}
for ax,(field,key,title) in zip(axes,[('ThighAbsolute','thighAbsolute','허벅지 앞뒤 방향'),('KneeAngles','knee','무릎 굽힘')]):
 y=np.array(ref['mean'][field]);std=np.array(ref['std'][field]);c=np.array([f[key] for f in cur['frames']])
 ax.set_facecolor('white');ax.fill_between(x,y-std,y+std,color=green,alpha=.15)
 ax.plot(x,y,color=green,lw=2.6,label='실측 유래 · 한 참가자 평균')
 ax.plot(x,c,color=orange,lw=2.6,label='현재 앱 · 실제 뼈 좌표')
 ax.set_title(title,loc='left',fontsize=15,pad=13,fontweight='bold');ax.set_xlabel('한 주기의 진행률 (%)');ax.set_ylabel('각도 (°)');ax.set_xlim(0,100);ax.set_xticks([0,25,50,75,100]);ax.grid(alpha=.18)
 metrics[key]={'referencePeakDeg':float(y.max()),'referencePeakPercent':float(x[y.argmax()]),'currentPeakDeg':float(c.max()),'currentPeakPercent':float(x[c.argmax()])}
 if key=='knee':
  for vals,col,offset in [(y,green,(6,-24)),(c,orange,(5,-20))]:
   i=vals.argmax();ax.scatter(x[i],vals[i],c=col,s=35,zorder=5);ax.annotate(f'{vals[i]:.1f}° / {x[i]:.0f}%',(x[i],vals[i]),xytext=offset,textcoords='offset points',color=col,fontsize=11)
 axes[0].legend(loc='lower left',fontsize=9,frameon=False)
fig.text(.055,.105,'초록 띠는 1명의 주기 간 변동입니다. 사람 전체의 정상 범위가 아닙니다.',fontsize=10)
fig.text(.055,.055,'실측: 접촉 사건 기준 0% · 앱: 작성한 시작 프레임 0%  |  같은 속도·체형으로 검증한 오차 그래프가 아닙니다.',fontsize=10)
fig.savefig(out/'gait-comparison-curves.png');plt.close(fig)

# Marker trajectory: measured left-side skin markers, not estimated joint centers.
mk={k:np.array(v) for k,v in ref['markersFirstLeftStride'].items()}
fig,axes=plt.subplots(3,4,figsize=(13.8,11.8),dpi=120,facecolor=bg,gridspec_kw={'height_ratios':[.8,1.3,1.3]})
fig.subplots_adjust(left=.04,right=.98,top=.86,bottom=.075,wspace=.045,hspace=.17)
fig.suptitle('같은 진행률에서 보는 다리의 회수',x=.04,y=.97,ha='left',fontsize=22,fontweight='bold')
fig.text(.04,.93,'위: 실측 마커의 측면 투영  /  가운데: 현재 앱 측면  /  아래: 현재 앱 정면',fontsize=12)
fig.text(.04,.895,'초록은 AB01 첫 왼발 주기(0.79초). 주황색 배지는 앱(0.72초). 같은 사람·속도·축척의 비교가 아닙니다.',fontsize=10)
for j,p in enumerate([0,.25,.5,.75]):
 i=round(p*149);ax=axes[0,j]
 # Source X=mediolateral, Y=progression, Z=height for this trial; verify by ranges.
 points=[mk['LGT'][:3,i],(mk['LKNE'][:3,i]+mk['LKNEM'][:3,i])/2,(mk['LANK'][:3,i]+mk['LANKM'][:3,i])/2,mk['LHEE'][:3,i],mk['LTOE'][:3,i]]
 hip=points[0];xy=np.array([[-(v[1]-hip[1]),v[2]] for v in points]);
 ax.plot(xy[:3,0],xy[:3,1],'-o',color=green,lw=4,ms=6);ax.plot(xy[[2,3,4],0],xy[[2,3,4],1],'-o',color=green,lw=3,ms=4)
 ax.axhline(0,color='#adbab1',lw=1);ax.set_xlim(-.57,.57);ax.set_ylim(-.03,1.07);ax.set_aspect('equal');ax.axis('off');ax.set_title(f'{int(p*100)}%  ·  {p*.79:.3f}초',fontsize=12,color=green,pad=8)
 for row,view in [(1,'side'),(2,'front')]:
  ax=axes[row,j];ax.imshow(plt.imread(f'outputs/gait-comparison/{view}-{j}.png'));ax.axis('off');ax.set_title(f'현재 {"측면" if row==1 else "정면"}  ·  {p*.72:.2f}초',fontsize=10,color=orange,pad=5)
fig.text(.04,.038,'마커 선: 피부 표면 위치를 연결한 참고 그림(관절 중심·촬영 영상 아님). 실측 정면 전신·팔 움직임 대조는 이번 범위 밖입니다.',fontsize=10)
fig.savefig(out/'gait-comparison-frames.png');plt.close(fig)

metrics['period']={'referenceMedianSeconds':float(np.median(ref['strideTimesSeconds'])),'currentSeconds':cur['periodMs']/1000}
metrics['scope']='AB01 left 35 cycles, nominal s2x0/i0; not population range, same-speed accuracy or clinical validation'
Path('docs/05-validation/reports/gait-comparison-summary.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
print(json.dumps(metrics,ensure_ascii=False))
