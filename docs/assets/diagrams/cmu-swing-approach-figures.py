"""Actual M48 frames and measured approach paths. No generated human poses."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1320,960),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((25,15),'M48 · 양발의 회수 후반부터 착지까지',font=font(30),fill='#233b32')
d.text((25,62),'실제 정면 캡처 · 각 칸 왼쪽 기존 / 오른쪽 수정 · 자연스러움 사용자 검토 전',font=font(20),fill='#63736a')
for row,phases in enumerate([[8,16,24],[55,63,71]]):
 for col,phase in enumerate(phases):
  x=col*440;y=110+row*415
  d.text((x+20,y),('오른발' if row==0 else '왼발')+f' 접근 · {phase}%',font=font(23),fill='#233b32')
  im=Image.open(root/f'outputs/cmu-swing-approach/male-front-{phase}.png')
  for j,(lo,hi) in enumerate([(260,470),(705,915)]):
   crop=im.crop((lo,240,hi,550));canvas.paste(crop,(x+10+j*210,y+70))
   d.text((x+115+j*210,y+40),'기존' if j==0 else '수정',font=font(18),fill='#b96540' if j==0 else '#1687ad',anchor='mt')
d.text((25,930),'35_17 · 양발 경로 수정 / 골반·지지 보존 / 실제 인체·물리 접지 검증 아님',font=font(18),fill='#63736a')
canvas.save(out/'cmu-swing-approach-comparison.png')
report=json.loads((root/'docs/05-validation/reports/cmu-swing-approach.json').read_text(encoding='utf-8'))
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':10})
fig,axes=plt.subplots(2,2,figsize=(12,7));fig.set_facecolor('#f6f5f1')
for row,result in enumerate(report['results']):
 for col,(data,metrics) in enumerate(zip(result['approach'],result['metrics']['approach'])):
  ax=axes[row,col];side=data['side'];sign=-1 if side=='r' else 1
  for lane,label,color in [(0,'기존','#b96540'),(1,'수정','#1687ad')]:
   m=metrics['lanes'][lane];x=[i for i in range(101)]
   ax.plot(x,[(data['targetX']-v)*sign*1000 for v in m['x']],color=color,label=label+' 발',lw=2)
   ax.plot(x,[(data['kneeTarget']-v)*sign*1000 for v in m['kneeX']],color=color,label=label+' 무릎',lw=1.6,ls='--')
  ax.axhline(0,color='#555',lw=.8);ax.grid(alpha=.15);ax.set_title(('남성형' if row==0 else '여성형')+' · '+('오른발' if side=='r' else '왼발'));ax.set_xlabel('회수 후반 → 착지 진행 (%)');ax.set_ylabel('각 부위 착지 X 대비 (mm)\n+ 안쪽 / - 바깥');ax.legend(frameon=False,ncol=2,fontsize=9)
fig.suptitle('발과 무릎을 각각 추적 · 착지 위치를 지나 안쪽으로 들어갔다가 돌아오는 경로 비교',fontsize=15)
fig.tight_layout();fig.savefig(out/'cmu-swing-approach-paths.png',dpi=150);plt.close(fig)
