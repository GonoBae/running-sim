"""M33 actual comparison screenshots and measured phase-local displacement."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1260,1260),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((25,15),'오른발 지지 구간만 비교 · 실제 구현 화면',font=font(29),fill='#233b32')
d.text((25,58),'왼쪽 현재 / 가운데 최대 2cm / 오른쪽 최대 4cm · 남성형 · 같은 43% 시점',font=font(20),fill='#63736a')
for view,y,label in [('front',120,'정면'),('side',670,'측면')]:
 d.text((25,y-28),label,font=font(23),fill='#233b32')
 im=Image.open(root/f'outputs/cmu-landing/{view}.png').crop((119,260,1321,800));canvas.paste(im,(29,y))
d.text((25,1225),'현재 동작은 유지 · M28 꺼짐 · 정식 기본 동작 채택 전 사용자 검토용 실험',font=font(19),fill='#63736a')
canvas.save(out/'cmu-landing-comparison.png')
im=Image.open(root/'outputs/cmu-landing/recovery.png').crop((119,200,1321,800));im.save(out/'cmu-landing-recovery.png')
report=json.loads((root/'docs/05-validation/reports/cmu-landing.json').read_text());rows=report['results'][0]['rows']
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,ax=plt.subplots(figsize=(11,3.7));fig.set_facecolor('#f6f5f1');ax.axvspan(28,58,color='#e0e9dd',label='오른발 지지 추정 구간')
for i,color in [(0,'#1687ad'),(1,'#d18b27')]:ax.plot([r['phase']*100 for r in rows],[r['variants'][i]['actual']*100 for r in rows],lw=2,color=color,label=f'최대 {(i+1)*2}cm · 실제 발목 이동')
ax.axhline(0,color='#888',lw=.7);ax.set_xlim(0,100);ax.set_ylim(-.15,4.4);ax.set_xlabel('한 주기 (%)');ax.set_ylabel('바깥 이동량 (cm)');ax.grid(alpha=.15);ax.legend(frameon=False,loc='upper right',fontsize=10)
ax.set_title('회수 구간에는 이동량 0 · 한 주기 내내 벌리지 않습니다',fontsize=18)
fig.subplots_adjust(left=.08,right=.98,top=.84,bottom=.20);fig.savefig(out/'cmu-landing-window.png',dpi=150);plt.close(fig)
