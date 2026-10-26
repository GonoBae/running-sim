"""Actual captures + independently sampled validation traces. Run at repo root."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
images=root/'docs/assets/images'
report=json.loads((root/'docs/05-validation/reports/cmu-ground.json').read_text())
font='C:/Windows/Fonts/malgun.ttf'
canvas=Image.new('RGB',(1100,590),'#f6f5f1');d=ImageDraw.Draw(canvas)
def label(x,y,text,size=22):d.text((x,y),text,font=ImageFont.truetype(font,size),fill='#263c40')
label(28,18,'착지 높이 보정 · 실제 화면 비교',28)
label(28,62,'CMU 35_17 · 남성형 · 동일한 주기 83% · 왼발 지지 구간',18)
for x,state,title in [(28,'before','보정 끔'),(568,'after','보정 켬')]:
    label(x,104,title)
    shot=Image.open(images/f'cmu-ground-{state}.png')
    crop=shot.crop((350,80,850,480))
    canvas.paste(crop,(x,149))
label(28,555,'관절 각도는 유지하고 발 표면에 맞춰 몸 전체 높이를 이동',20)
canvas.save(images/'cmu-ground-comparison.png')

frames=[Image.open(root/f'outputs/cmu-ground/frame-{k:02}.png').resize((992,664)).convert('P',palette=Image.Palette.ADAPTIVE) for k in range(24)]
timing=[(round((k+1)*75.833333/24)-round(k*75.833333/24))*10 for k in range(24)]
frames[0].save(images/'cmu-ground-preview.gif',save_all=True,append_images=frames[1:],duration=timing,loop=0,disposal=2)

# Standard scientific plotting; local research environment provides matplotlib.
import os
os.environ.setdefault('MPLCONFIGDIR',str(root/'outputs/matplotlib-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.family']='Malgun Gothic'
plt.rcParams['axes.unicode_minus']=False
fig,axes=plt.subplots(2,1,figsize=(11,5.8),sharex=True,layout='constrained')
row=report['results'][0];tr=row['trace'];x=[t['phase']*100 for t in tr]
for ax,key,title in zip(axes,['before','after'],['보정 전 · 발 표면이 바닥 아래로 내려감','보정 후 · 지지 시 바닥 / 공중 전환은 유지']):
    for side,color,name in [('l','#307a68','왼발'),('r','#bd694b','오른발')]:
        ax.plot(x,[t[key][side]*100 for t in tr],label=name,color=color,lw=1.8)
    ax.axhline(0,color='#263c40',lw=.8);ax.set_ylim(-4,22);ax.set_ylabel('발 최저 높이 (cm)');ax.set_title(title,loc='left',fontsize=12);ax.grid(alpha=.18)
    ax.axvspan(0,9,color='#307a68',alpha=.08);ax.axvspan(75,100,color='#307a68',alpha=.08);ax.axvspan(28,58,color='#bd694b',alpha=.08)
    ax.legend(loc='upper right',ncol=2,frameon=False)
axes[1].set_xlabel('한 주기 (%) · 색 영역: 실험용 추정 지지 구간')
fig.suptitle('CMU 35_17 · 남성형 · 실제 변형된 발 표면 표본',fontsize=15)
fig.savefig(images/'cmu-ground-heights.png',dpi=140)
