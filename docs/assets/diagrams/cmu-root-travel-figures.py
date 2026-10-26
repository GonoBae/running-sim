"""M25 report → plots; captured browser frames → approximately half-speed GIF."""
import json
from pathlib import Path
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

root=Path(__file__).resolve().parents[3]
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf')
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':12})
report=json.loads((root/'docs/05-validation/reports/cmu-root-travel.json').read_text(encoding='utf-8'))
r=report['results'][0]
fig,axes=plt.subplots(1,2,figsize=(12,4.1),sharex=True,sharey=True)
for lane,ax in enumerate(axes):
    for j,(name,color) in enumerate(zip(['골반','왼발 기준점','오른발 기준점'],['#b47808','#007fba','#c04381'])):
        xs=[t['phase']*100 for t in r['traces']]
        ys=[t['points'][lane][j][2] for t in r['traces']]
        ax.plot(xs,ys,color=color,label=name,linewidth=2)
        if j:
            support=[i for i,t in enumerate(r['traces']) if t['support']==('l' if j==1 else 'r')]
            ax.scatter([xs[i] for i in support],[ys[i] for i in support],s=8,color=color)
    ax.set_title(['현재 · 제자리','비교 · 원본 수평 이동 복원'][lane])
    ax.set_xlabel('한 주기 진행률 (%)');ax.grid(alpha=.2);ax.spines[['top','right']].set_visible(False)
axes[0].set_ylabel('각 화면 원점 기준 전후 위치 (m)')
axes[1].legend(loc='upper left',fontsize=10)
fig.suptitle('검증 결과 · 남성형 35_17 | 점 구간 = 추정 지지 구간',fontsize=16)
fig.tight_layout(rect=(0,.04,1,.94))
fig.text(.5,.015,'발 기준점의 이동이며 실제 발바닥 미끄러짐 측정값이 아닙니다.',ha='center',fontsize=11,color='#57635d')
fig.savefig(root/'docs/assets/images/cmu-root-travel-traces.png',dpi=150,facecolor='#f6f5f1');plt.close(fig)

frames=[Image.open(p).convert('RGB') for p in sorted((root/'outputs/cmu-root-travel').glob('frame-*.png'))]
if frames:
    # 23 intervals sum to 1,520ms (approximately 0.5x of the .758s clip).
    durations=[round((i+1)*152/23)*10-round(i*152/23)*10 for i in range(23)]+[900]
    frames[0].save(root/'docs/assets/images/cmu-root-travel-preview.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=False)
