"""M40 actual screenshots and comparison against independently sampled reference pelvis."""
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
d.text((25,15),'오른발 착지 · 골반을 기준으로 다리 연동',font=font(28),fill='#233b32')
d.text((25,58),'실제 구현 화면 · 한 주기 47% · 주황 오른다리 / 파랑 왼다리',font=font(20),fill='#63736a')
for view,y,label in [('front',140,'정면'),('side',760,'측면')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,text in [(390,'기존 M39'),(870,'오른발 고관절 기준')]:d.text((x,y),text,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-hip-reference/{view}-support.png').crop((0,35,1202,590));canvas.paste(im,(29,y+40))
d.text((25,1395),'구현·수치 검사 완료 / 자연스러움 검토 전 · 회수·왼발 지지는 M39 유지',font=font(19),fill='#63736a')
canvas.save(out/'cmu-hip-reference-comparison.png')
report=json.loads((root/'docs/05-validation/reports/cmu-hip-reference.json').read_text());rows=report['results'][0]['rows']
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,1,figsize=(11,6.2));fig.set_facecolor('#f6f5f1')
x=[r['phase']*100 for r in rows]
for key,label,color in [('beforePelvis','기존 M39','#b96540'),('pelvis','오른발 고관절 기준','#1687ad')]:axes[0].plot(x,[(r[key][0]-r['referencePelvis'][0])*100 for r in rows],label=label,color=color,lw=2)
axes[0].set_ylabel('기준 대비 골반 좌우 이동 (cm)');axes[0].set_xlim(0,100);axes[0].set_title('오른발 구간은 기준 골반 유지 · 왼발 구간은 기존 M39 유지',fontsize=16);axes[0].legend(frameon=False)
for key,label,color in [('beforeSurface','기존 발 표면','#b96540'),('surface','새 발 표면','#1687ad')]:axes[1].plot(x,[(r[key][0]-r['referenceHip'][0])*100 for r in rows],label=label,color=color,lw=2)
axes[1].axhline(0,color='#444',lw=1,ls='--',label='기준 오른쪽 고관절 수직선');axes[1].set_xlim(28,58);axes[1].set_ylim(-1,18);axes[1].set_ylabel('발 표면 - 기준 고관절 (cm)');axes[1].legend(frameon=False);axes[1].set_title('완전 적용 구간에서 고관절 선에 정렬 · 양끝은 원래 동작에 연결',fontsize=14)
for ax in axes:ax.grid(alpha=.15);ax.axvspan(40,46,color='#1687ad',alpha=.08);ax.set_xlabel('한 주기 (%) · 옅은 파랑은 완전 적용 구간')
fig.tight_layout();fig.savefig(out/'cmu-hip-reference-traces.png',dpi=150);plt.close(fig)
