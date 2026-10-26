"""M26 independent skin-velocity validation and actual browser captures."""
import json
from pathlib import Path
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

root=Path(__file__).resolve().parents[3]
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf')
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
report=json.loads((root/'docs/05-validation/reports/cmu-sole-slip.json').read_text(encoding='utf-8'))
fig,axes=plt.subplots(2,2,figsize=(12,6.4))
for col,r in enumerate(report['results'][:2]):
    support=[s for s in r['samples'] if s['skinSpeed'] is not None]
    x=[s['phase']*100 for s in support]
    ax=axes[0,col]
    ax.plot(x,[s['skinSpeed'][0] for s in support],color='#c36c48',label='보정 전',lw=2)
    ax.plot(x,[s['skinSpeed'][1] for s in support],color='#218768',label='오른발 보정 후',lw=2)
    ax.set_title(f"남성형 {r['clip']} · 같은 피부 점 속도")
    ax.set_ylabel('수평 속도 RMS (m/s)');ax.legend();ax.set_ylim(bottom=0)
    lo,hi=(28,58) if col==0 else (13,53)
    ax.axvspan(lo+4,hi-4,alpha=.07,color='#218768')
    ax.set_xlim(lo,hi)
    ax=axes[1,col]
    ax.plot([s['phase']*100 for s in r['samples']],[sum(v*v for v in s['offset'])**.5*100 for s in r['samples']],color='#967022',lw=2)
    ax.axvspan(lo,hi,alpha=.07,color='#218768');ax.set_ylim(0,5.2)
    ax.set_ylabel('몸 수평 위치 보정량 (cm)');ax.set_xlim(0,100)
for ax in axes.flat:
    ax.set_xlabel('한 주기 진행률 (%)');ax.grid(alpha=.18);ax.spines[['top','right']].set_visible(False)
fig.suptitle('검증 결과 · 지면 2mm 이내 피부 점 | 적용·해제 구간의 잔여 움직임도 포함',fontsize=15)
fig.tight_layout(rect=(0,.035,1,.95))
fig.text(.5,.012,'추정 오른발 지지 구간만 보정 · 구간 이후에는 누적 위치 차이 유지 · 물리적 접촉 실측 아님',ha='center',fontsize=10,color='#57635d')
fig.savefig(root/'docs/assets/images/cmu-sole-slip-metrics.png',dpi=150,facecolor='#f6f5f1');plt.close(fig)

frames=[Image.open(p).convert('RGB') for p in sorted((root/'outputs/cmu-sole-slip').glob('frame-*.png'))]
if frames:
    durations=[round((i+1)*152/23)*10-round(i*152/23)*10 for i in range(23)]+[900]
    frames[0].save(root/'docs/assets/images/cmu-sole-slip-preview.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=False)
