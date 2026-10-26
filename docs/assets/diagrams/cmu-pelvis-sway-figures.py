"""M39 real browser captures and measured M38/M39 lateral trajectories."""
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
d.text((25,15),'착지 위치 유지 · 골반의 추가 좌우 이동 축소',font=font(28),fill='#233b32')
d.text((25,58),'실제 구현 화면 · 오른발 지지 43% · 주황 오른다리 / 파랑 왼다리',font=font(20),fill='#63736a')
for view,y,label in [('front',140,'정면'),('side',760,'측면')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,text in [(390,'기존 양발 연동'),(870,'추가 좌우 이동 50%')]:d.text((x,y),text,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-pelvis-sway/{view}-support.png').crop((0,35,1202,590));canvas.paste(im,(29,y+40))
d.text((25,1395),'구현·수치 검사 완료 / 자연스러움 검토 전 · 회수 다리 위치는 골반을 따름',font=font(19),fill='#63736a')
canvas.save(out/'cmu-pelvis-sway-comparison.png')
report=json.loads((root/'docs/05-validation/reports/cmu-pelvis-sway.json').read_text())
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,2,figsize=(12,6.4),sharex=True);fig.set_facecolor('#f6f5f1')
for j,result in enumerate(report['results']):
    rows=result['rows'];xs=[r['phase']*100 for r in rows]
    for i,unit in [(0,'추가 좌우 이동 (cm)'),(1,'추가 좌우 속도 (m/s)')]:
        ax=axes[i,j];ax.grid(alpha=.18);ax.axhline(0,color='#aab0aa',lw=.7);ax.set_xlim(0,100);ax.set_ylabel(unit)
        for key,label,color in [('beforeShift','기존 양발 연동','#b96540'),('pelvisShift','추가 이동 50%','#1687ad')]:
            ys=[r[key][0] for r in rows]
            if i==0: ax.plot(xs,[y*100 for y in ys],label=label,color=color,lw=2)
            else: ax.plot([(a+b)/2 for a,b in zip(xs,xs[1:])],[(b-a)/(.25/120) for a,b in zip(ys,ys[1:])],color=color,lw=2)
    axes[0,j].set_title(('남성형' if j==0 else '여성형')+' · 실제 측정',fontsize=16);axes[0,j].legend(frameon=False)
    axes[1,j].set_xlabel('한 주기 (%)')
fig.suptitle('기존 연동이 추가한 골반 좌우 이동과 속도만 비교 · 정상 범위 판정 아님',fontsize=14)
fig.tight_layout();fig.savefig(out/'cmu-pelvis-sway-traces.png',dpi=150);plt.close(fig)
