"""M34: actual browser captures and measured bilateral ankle displacement."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
def panel(name,frames,title,subtitle):
    canvas=Image.new('RGB',(1260,1380),'#f6f5f1');d=ImageDraw.Draw(canvas)
    d.text((25,15),title,font=font(28),fill='#233b32')
    d.text((25,58),subtitle,font=font(19),fill='#63736a')
    for view,y,label in [('front',130,'정면'),('side',730,'측면')]:
        d.text((25,y-30),label,font=font(23),fill='#233b32')
        for i,text in enumerate(['현재 동작','양발 · 최대 2cm','양발 · 최대 4cm']):
            d.text((230+400*i,y+10),text,font=font(20),fill='#233b32',anchor='mt')
        im=Image.open(root/f'outputs/cmu-bilateral/{view}-{frames}.png').crop((0,60,1202,570))
        canvas.paste(im,(29,y+43))
    d.text((25,1340),'실제 구현 화면 · 자연스러움 검토 전 · 기본 동작에는 미채택',font=font(20),fill='#63736a')
    canvas.save(out/f'cmu-bilateral-{name}.png')
panel('comparison','left','양발 착지 구간 비교 · 왼발 지지 시점','남성형 · 같은 88% 시점 · 오른다리 회수 동작 유지')
panel('right','right','양발 착지 구간 비교 · 오른발 지지 시점','남성형 · 같은 43% 시점 · 왼다리 회수 동작 유지')
im=Image.open(root/'outputs/cmu-bilateral/front-recovery.png')
im.save(out/'cmu-bilateral-recovery.png')
rows=json.loads((root/'docs/05-validation/reports/cmu-bilateral.json').read_text())['results'][0]['rows']
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf')
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,1,figsize=(11,5.7),sharex=True);fig.set_facecolor('#f6f5f1')
for ax,side,label,windows in [(axes[0],'r','오른발',[(28,58)]),(axes[1],'l','왼발',[(0,9),(75,100)])]:
    for start,end in windows:ax.axvspan(start,end,color='#e0e9dd')
    for i,color in [(0,'#1687ad'),(1,'#d18b27')]:
        ax.plot([r['phase']*100 for r in rows],[r['variants'][i]['feet'][side]['actual']*100 for r in rows],lw=2,color=color,label=f'최대 {(i+1)*2}cm')
    ax.set_ylabel(f'{label} 바깥 이동 (cm)');ax.set_ylim(-.15,4.5);ax.grid(alpha=.15);ax.legend(frameon=False,loc='upper right' if side=='r' else 'upper center',ncol=2)
axes[0].set_title('각 발의 회수 구간에서는 보정량 0',fontsize=18)
axes[1].set_xlabel('한 주기 (%) · 왼발 보정은 100% → 0% 경계에서 이어집니다');axes[1].set_xlim(0,100)
fig.tight_layout();fig.savefig(out/'cmu-bilateral-window.png',dpi=150);plt.close(fig)
