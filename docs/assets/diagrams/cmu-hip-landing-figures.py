"""M35 actual browser captures and measured hip-line residuals."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1260,1440),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((25,15),'양발 고관절 수직선 목표 · 실제 구현 화면',font=font(28),fill='#233b32')
d.text((25,58),'남성형 · 왼발 지지 88% · 오른다리 회수 동작은 동일',font=font(20),fill='#63736a')
for view,y,label in [('front',140,'정면 · 점선: 고관절 기준 / 점: 발바닥 기준'),('side',760,'측면 · 발 앞뒤 위치 유지')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,text in [(390,'현재 동작'),(870,'양발 · 고관절 수직선')]:d.text((x,y),text,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-hip-landing/{view}-left.png').crop((0,35,1202,590));canvas.paste(im,(29,y+40))
d.text((25,1400),'착지 중간에 선에 정렬 · 시작/끝은 연결 · 자연스러움 검토 전',font=font(20),fill='#63736a')
canvas.save(out/'cmu-hip-landing-comparison.png')
Image.open(root/'outputs/cmu-hip-landing/front-recovery.png').save(out/'cmu-hip-landing-recovery.png')
rows=json.loads((root/'docs/05-validation/reports/cmu-hip-landing.json').read_text())['results'][0]['rows']
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,1,figsize=(11,6),sharex=True);fig.set_facecolor('#f6f5f1')
for ax,side,label,windows in [(axes[0],'r','오른발',[(28,58)]),(axes[1],'l','왼발',[(0,9),(75,100)])]:
    for start,end in windows:ax.axvspan(start,end,color='#e0e9dd')
    for key,text,color in [('beforeInwardCm','현재','#888888'),('afterInwardCm','수직선 목표','#1687ad')]:
        ax.plot([r['phase']*100 for r in rows],[r['variants'][0]['feet'][side][key] for r in rows],lw=2,color=color,label=text)
    ax.axhline(0,color='#233b32',lw=.8,ls='--');ax.set_ylabel(f'{label} 안쪽 거리 (cm)');ax.grid(alpha=.15);ax.legend(frameon=False,loc='upper right',ncol=2)
axes[0].set_title('0 = 고관절 수직선 · 회수 구간의 두 선은 겹칩니다',fontsize=17)
axes[1].set_xlabel('한 주기 (%) · 녹색은 추정 지지 구간');axes[1].set_xlim(0,100)
fig.tight_layout();fig.savefig(out/'cmu-hip-landing-residual.png',dpi=150);plt.close(fig)
