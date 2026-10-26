"""M32 measured plots: hip-midpoint motion and foot versus ipsilateral vertical."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
r=json.loads((root/'docs/05-validation/reports/cmu-hip-center.json').read_text())
prior=json.loads((root/'docs/05-validation/reports/cmu-transfer.json').read_text())
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
male=next(m for m in r['models'] if m['model']=='male');rows=male['rows'];phase=np.array([a['phase'] for a in rows])*100
colorS='#c78626';colorT='#147dba';colorSkin='#8e4d8c'
fig,axs=plt.subplots(1,2,figsize=(13,4.8));fig.set_facecolor('#f6f5f1')
for key,color,label,ls in [('sourceHip',colorS,'원본 입력 + 원본 이동','-'),('fixedHip',colorT,'모델 · 현재 제자리','-'),('restoredHip','#378f65','모델 · 기존 이동 복원','--')]:
 x=np.array([a[key][0] for a in rows]);axs[0].plot(phase,(x-x[0])*100,color=color,label=label,ls=ls,lw=2)
axs[0].set_title('고관절 중점의 좌우 이동');axs[0].set_ylabel('첫 프레임 대비 변화 (cm)');axs[0].legend(frameon=False,fontsize=10)
source=np.array([a['sourceHip'] for a in rows]);rest=np.array([a['restoredHip'] for a in rows]);gap=(source-source[0])-(rest-rest[0])
axs[1].plot(phase,gap[:,0]*100,color='#444',lw=4,label='원본 - 이동 복원 모델')
axs[1].plot(phase,[a['anchorDrift'][0]*100 for a in rows],color='#d99a2a',ls='--',lw=2,label='골반 기준점 차이만 분리')
axs[1].set_title('기준점 차이의 좌우 변동 폭 · 남 1.70 / 여 1.42cm');axs[1].set_ylabel('첫 프레임의 차이를 뺀 값 (cm)');axs[1].legend(frameon=False,fontsize=10,loc='upper right')
for ax in axs:ax.axhline(0,color='#999',lw=.7);ax.set_xlabel('같은 입력 주기 (%)');ax.grid(alpha=.17)
fig.suptitle('기준점 차이는 몸 이동에 영향을 줍니다 · 추가 회전과는 구분',fontsize=19)
fig.text(.5,.025,'남성형 · 같은 반복 입력 · 시작점의 상수 차이 제거 · 세로 높이는 접지 보정 영향이 있어 이 좌우 분리에서 제외',ha='center',fontsize=10)
fig.subplots_adjust(left=.07,right=.98,top=.81,bottom=.18,wspace=.25);fig.savefig(out/'cmu-hip-center-motion.png',dpi=150);plt.close(fig)
# Same source and target frames; red vertical is a user-proposed reference only.
current=next(a['rows'] for a in prior['results'] if a['model']=='male' and a['stage']=='current')
fig,axs=plt.subplots(1,4,figsize=(13,7));fig.set_facecolor('#f6f5f1')
for ax,(f,side,g) in zip(axs,[(39,'r','source'),(39,'r','target'),(82,'l','source'),(82,'l','target')]):
 row=current[f];c=(np.array(row[g]['lh'])+row[g]['rh'])/2;points={k:(np.array(v)-c)*100 for k,v in row[g].items()}
 for s in ['l','r']:
  a=np.array([points[s+k] for k in ['h','k','a','b']]);color=(colorS if g=='source' else colorT) if s==side else '#cbd0d2'
  ax.plot(a[:,0],a[:,1],color=color,lw=3 if s==side else 1.5,marker='o',markersize=4)
 hip=points[side+'h'];ankle=points[side+'a'];ax.axvline(0,color='#bbb',ls=':',lw=.7);ax.plot([hip[0],hip[0]],[hip[1],-111],color='#b6534f',ls='--',lw=1.5)
 ax.annotate('',xy=(ankle[0],ankle[1]),xytext=(hip[0],ankle[1]),arrowprops={'arrowstyle':'<->','color':'#454545'})
 inside=rows[f]['feet'][side]['insideCm'][g]['a'];ax.text((hip[0]+ankle[0])/2,ankle[1]+5,f'발목 {inside:.1f}cm',ha='center',fontsize=10)
 if g=='target':
  sole=(np.array(row['soles'][side]['lowestBandCenter'])-c)*100;ax.scatter(sole[0],sole[1],s=55,marker='D',color=colorSkin,zorder=5)
  ax.annotate('',xy=(sole[0],sole[1]),xytext=(hip[0],sole[1]),arrowprops={'arrowstyle':'<->','color':colorSkin})
  ax.text((hip[0]+sole[0])/2,sole[1]-6,f"발 표면 {rows[f]['feet'][side]['insideCm']['target']['surface']:.1f}cm",ha='center',color=colorSkin,fontsize=10)
 ax.set_title(f"AMC {row['amcFrame']} · {'오른발' if side=='r' else '왼발'}\n{'원본 입력' if g=='source' else '우리 모델'}",fontsize=12)
 ax.set_xlim(-29,29);ax.set_ylim(-116,9);ax.set_aspect('equal');ax.set_xlabel('고관절 중점 기준 좌우 (cm)',fontsize=10);ax.grid(alpha=.15)
axs[0].set_ylabel('고관절 중점 기준 높이 (cm)')
fig.suptitle('발이 고관절 바로 아래보다 안쪽에 놓이는 것은 확인됩니다',fontsize=19,y=.98)
fig.text(.5,.91,'빨간 점선: 해당 다리 고관절의 수직선 · 주황/파랑: 같은 프레임 · 보라: 모델 발 표면의 최저 띠 중심',ha='center',fontsize=11)
fig.text(.5,.045,'지지 중으로 추정한 두 순간 · 수치는 정면의 좌우 간격 · 수직선은 정상/권장 착지 기준이 아닙니다.',ha='center',fontsize=11)
fig.text(.5,.012,'원본에 발바닥 표면은 없어 발목끼리 비교 · 모델 발 표면은 실측 압력 중심이 아닌 기하학적 대용점입니다.',ha='center',fontsize=10)
fig.subplots_adjust(left=.065,right=.985,top=.82,bottom=.19,wspace=.23);fig.savefig(out/'cmu-hip-center-vertical.png',dpi=150);plt.close(fig)
# Full cycle, but surface comparison is emphasized only in authored support windows.
fig,axs=plt.subplots(1,2,figsize=(12,4.6));fig.set_facecolor('#f6f5f1')
for ax,side,title in zip(axs,['r','l'],['오른발','왼발']):
 spans=[(28,58)] if side=='r' else [(0,9),(75,100)]
 for lo,hi in spans:ax.axvspan(lo,hi,color='#dcead9',alpha=.75)
 for g,joint,color,label,ls in [('source','a',colorS,'원본 발목','--'),('target','a',colorT,'모델 발목','-'),('target','surface',colorSkin,'모델 발 표면','-')]:
  values=np.array([a['feet'][side]['insideCm'][g][joint] for a in rows]);active=np.array([a['feet'][side]['supportEstimated'] for a in rows])
  if joint!='surface':ax.plot(phase,values,color=color,ls=ls,alpha=.25,lw=1)
  ax.plot(phase,np.where(active,values,np.nan),color=color,ls=ls,lw=2,label=label)
 ax.axhline(0,color='#b6534f',lw=1);ax.set_title(title+' · 같은 쪽 고관절 수직선에서');ax.set_xlabel('같은 입력 주기 (%)');ax.set_ylabel('안쪽 + / 바깥쪽 - (cm)');ax.grid(alpha=.15);ax.set_ylim(-6,21);ax.legend(frameon=False,fontsize=10)
fig.suptitle('지지 추정 구간에서도 안쪽 디딤이 이어집니다',fontsize=19)
fig.text(.5,.025,'초록 배경: 기존 지지 추정 구간 · 남성형 · 0 = 같은 쪽 고관절 수직선 · 실제 접촉 시점/정상 범위 검증은 아님',ha='center',fontsize=10)
fig.subplots_adjust(left=.075,right=.98,top=.80,bottom=.19,wspace=.23);fig.savefig(out/'cmu-hip-center-support.png',dpi=150);plt.close(fig)
