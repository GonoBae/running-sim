"""M30 plots from independently compared numeric coordinates; no pose editing."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];r=json.loads((root/'docs/05-validation/reports/cmu-independent.json').read_text());out=root/'docs/assets/images'
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
# Show actual computed lower-chain positions, overlaid, not a new animation.
fig,axs=plt.subplots(1,3,figsize=(12,6));fig.set_facecolor('#f6f5f1')
for ax,f in zip(axs,[54,88,131]):
 row=r['rows'][f]
 for key,color,label,ls,lw in [('current','#147dba','현재 ASF/AMC 해석','-',3.5),('external','#d48a29','외부 BVH 변환','--',2)]:
  p={k:np.array(v) for k,v in row[key].items()};center=(p['lhipjoint']+p['rhipjoint'])/2
  for side in ['l','r']:
   chain=['root',side+'hipjoint',side+'femur',side+'tibia',side+'foot',side+'toes'];a=np.array([p[n]-center for n in chain])*100
   ax.plot(a[:,0],a[:,1],color=color,ls=ls,lw=lw,label=label if side=='l' else None)
   ax.scatter(a[:,0],a[:,1],facecolors='none',edgecolors=color,s=25)
  if key=='current':
   for side,text in [('l','왼다리'),('r','오른다리')]:
    q=(p[side+'hipjoint']-center)*100;ax.annotate(text,(q[0],q[1]),xytext=(8 if side=='l' else -48,8),textcoords='offset points',fontsize=10)
 ax.axvline(0,color='#999',lw=.8,ls=':');ax.set_title(f"AMC {f+1} ↔ BVH {f+2}");ax.set_xlim(-34,34);ax.set_ylim(-105,22);ax.set_aspect('equal');ax.grid(alpha=.15);ax.set_xlabel('골반 기준 좌우 (cm)')
axs[0].set_ylabel('골반 기준 높이 (cm)')
fig.suptitle('35_17 골반·다리: 독립 변환과 겹쳐 보입니다',fontsize=20,y=.98)
fig.legend(*axs[0].get_legend_handles_labels(),loc='upper center',bbox_to_anchor=(.5,.93),ncol=2,frameon=False)
fig.text(.5,.045,'167프레임 × 11지점 · 최대 위치 차이 0.00472mm · 방향·길이를 눈에 맞춰 조정하지 않은 비교',ha='center',fontsize=12)
fig.subplots_adjust(left=.08,right=.98,top=.83,bottom=.15,wspace=.25);fig.savefig(out/'cmu-independent-overlay.png',dpi=150);plt.close(fig)
fig,axs=plt.subplots(1,2,figsize=(13,5.2));fig.set_facecolor('#f6f5f1')
x=[row['amcFrame'] for row in r['rows']];e=[max(row['errorsMm'].values()) for row in r['rows']]
axs[0].plot(x,e,color='#147dba');axs[0].axhline(.01,color='#888',ls='--',label='검사 허용 오차 0.01mm');axs[0].set_ylim(0,.011);axs[0].set_title('전체 프레임 · 골반/다리 최대 차이');axs[0].set_xlabel('AMC 프레임');axs[0].set_ylabel('차이 (mm)');axs[0].grid(alpha=.2);axs[0].legend(frameon=False)
keys=['one_frame_late','reverse_rotation_order','reverse_basis_sandwich','mirror_X','left_right_names_swapped','Y_Z_swap']
labels=['정확히 대응','1프레임 어긋남','회전 순서 반대','기준축 변환 반대','X축 거울반전','좌우 이름 뒤바꿈','Y/Z축 뒤바꿈']
vals=[r['comparison']['rmsMm']]+[r['controls'][k]['rmsMm'] for k in keys]
y=np.arange(len(vals));axs[1].barh(y,vals,color=['#147dba']+['#b8bdc2']*6);axs[1].set_yticks(y,labels);axs[1].invert_yaxis();axs[1].set_xscale('log');axs[1].set_xlim(.001,4000);axs[1].set_xlabel('위치 차이 RMS (mm, 로그 눈금)');axs[1].set_title('일부러 틀리면 차이가 커지는지 확인')
for i,v in enumerate(vals):axs[1].text(v*1.18,i,f'{v:.3f}' if v<1 else f'{v:.1f}',va='center',fontsize=10)
axs[1].set_xticks([.001,.01,.1,1,10,100,1000],['0.001','0.01','0.1','1','10','100','1000'])
fig.suptitle('좌우·축·순서 오류를 구별하는 대조 검사',fontsize=19)
fig.text(.5,.025,'축/좌우 대조는 root 이동을 제거해 검사 · 나머지는 원본 세계 좌표 · 사람의 실제 동작 정확도 수치가 아닙니다.',ha='center',fontsize=11)
fig.subplots_adjust(left=.075,right=.98,top=.83,bottom=.17,wspace=.52);fig.savefig(out/'cmu-independent-errors.png',dpi=150);plt.close(fig)
fig,axs=plt.subplots(1,2,figsize=(12,4.3));fig.set_facecolor('#f6f5f1')
for ax,side,sign,title in zip(axs,['r','l'],[-1,1],['오른발','왼발']):
 rows=r['rows'][54:145];phase=np.arange(91)/91*100
 for key,color,label,ls in [('current','#147dba','현재 해석','-'),('external','#d48a29','외부 변환','--')]:ax.plot(phase,[sign*row['relativeAnkles'][side][key][0]*100 for row in rows],color=color,label=label,ls=ls,lw=2)
 ax.axhline(0,color='#888',lw=.8);ax.set_title(title+' · 골반 중점에 대한 발목 위치');ax.set_xlabel('기존 선택 구간 (%)');ax.set_ylabel('자기 쪽 + / 반대쪽 - (cm)');ax.grid(alpha=.2);ax.legend(frameon=False)
fig.suptitle('중앙선 교차는 외부 변환에도 있습니다 · 두 곡선이 겹침',fontsize=18)
fig.text(.5,.025,'원본 미터 단위 · M29의 모델 다리 길이 배율은 적용하지 않음 · 교차를 정상/비정상으로 판정하는 그래프가 아닙니다.',ha='center',fontsize=10)
fig.subplots_adjust(left=.08,right=.98,top=.80,bottom=.20,wspace=.24);fig.savefig(out/'cmu-independent-crossing.png',dpi=150);plt.close(fig)
