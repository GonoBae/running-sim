"""M41 ground-frame slip audit: fixed skin vertex identities, no motion edits."""
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
r=json.loads((root/'docs/05-validation/reports/cmu-hip-reference-slip.json').read_text(encoding='utf-8'))
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,2,figsize=(12,6.5),sharex=True);fig.set_facecolor('#f6f5f1')
for col,m in enumerate(r['results']):
 for lane,color in zip(m['lanes'],['#b96540','#1687ad']):
  rows=lane['bands'][1]['rows'];x=[v['phase']*100 for v in rows]
  for row,key in [(0,'rmsX'),(1,'rmsZ')]:axes[row,col].plot(x,[v[key] for v in rows],color=color,lw=2,label='이전 M39' if lane['name']=='M39' else '현재 M40')
 axes[0,col].set_title(('남성형' if col==0 else '여성형')+' · 오른발',fontsize=16);axes[0,col].legend(frameon=False)
 for row,label in [(0,'좌우 미끄러짐 RMS (m/s)'),(1,'앞뒤 미끄러짐 RMS (m/s)')]:
  ax=axes[row,col];ax.set_ylabel(label);ax.grid(alpha=.15);ax.set_xlim(28,58);ax.axvspan(40,46,color='#1687ad',alpha=.08);ax.set_ylim(bottom=0)
 axes[1,col].set_xlabel('한 주기 (%) · 옅은 영역은 완전 정렬 구간')
fig.suptitle('지면 기준 피부점 속도 · 바닥 4mm 이내 / 접촉력 실측 아님',fontsize=16)
fig.tight_layout();fig.savefig(out/'cmu-hip-reference-slip-speed.png',dpi=150);plt.close(fig)
fig,axes=plt.subplots(1,2,figsize=(11,4));fig.set_facecolor('#f6f5f1')
for lane,color in zip(r['results'][0]['lanes'],['#b96540','#1687ad']):
 tr=lane['track']['points'];p0=tr[0]['p'];x=[(v['phase']-tr[0]['phase'])*91/120*1000 for v in tr]
 for j,k in [(0,0),(1,2)]:axes[j].plot(x,[(v['p'][k]-p0[k])*100 for v in tr],label=lane['name'],color=color,lw=2)
for ax,label in zip(axes,['좌우','앞뒤']):ax.set_title(label+' 위치 변화');ax.set_xlabel('추적 시작 후 (ms)');ax.set_ylabel('같은 피부점의 변위 (cm)');ax.grid(alpha=.15);ax.legend(frameon=False)
fig.suptitle('남성형 · 동일 피부점이 바닥 4mm 이내에 머문 약 158ms',fontsize=15)
fig.tight_layout();fig.savefig(out/'cmu-hip-reference-slip-track.png',dpi=150);plt.close(fig)
