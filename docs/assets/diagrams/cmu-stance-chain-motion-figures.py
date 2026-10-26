"""M37 actual playback captures and measured transition curves."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1260,1430),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((25,15),'오른발 착지 구간 · 골반–무릎–발 연동 재생',font=font(28),fill='#233b32')
d.text((25,58),'실제 구현 화면 · 35_17 · 43% 시점은 검토한 M36 자세와 동일',font=font(20),fill='#63736a')
for view,y,label in [('front',140,'정면'),('side',760,'측면')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,text in [(390,'현재 동작'),(870,'오른발 연동')]:d.text((x,y),text,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-stance-chain-motion/{view}-support.png').crop((0,35,1202,590));canvas.paste(im,(29,y+40))
d.text((25,1395),'구간 밖은 원래 동작 · 구현·수치 검사 완료 / 자연스러움 사용자 검토 전',font=font(19),fill='#63736a')
canvas.save(out/'cmu-stance-chain-motion-comparison.png')
Image.open(root/'outputs/cmu-stance-chain-motion/front-recovery.png').save(out/'cmu-stance-chain-motion-recovery.png')
rows=json.loads((root/'docs/05-validation/reports/cmu-stance-chain-motion.json').read_text())['results'][0]['rows']
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,1,figsize=(11,5.6),sharex=True);fig.set_facecolor('#f6f5f1')
xs=[r['phase']*100 for r in rows]
for ax in axes:ax.axvspan(28,58,color='#e0e9dd');ax.grid(alpha=.15);ax.set_xlim(0,100)
axes[0].plot(xs,[r['weight']*100 for r in rows],color='#1687ad',lw=2);axes[0].set_ylabel('연동 적용량 (%)');axes[0].set_title('시작·끝을 길게 연결하고 회수 구간에서 0으로 복귀',fontsize=17)
for i,text,color in [(0,'골반 좌우','#1687ad'),(1,'골반 높이','#d18b27')]:axes[1].plot(xs,[r['pelvisShift'][i]*100 for r in rows],label=text,color=color,lw=2)
axes[1].set_ylabel('원래 동작 대비 이동 (cm)');axes[1].legend(frameon=False);axes[1].set_xlabel('한 주기 (%) · 녹색은 오른발 지지 추정 구간')
fig.tight_layout();fig.savefig(out/'cmu-stance-chain-motion-window.png',dpi=150);plt.close(fig)
