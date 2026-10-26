"""M29: charts from recorded poses, contact sheet from actual browser captures."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
r=json.loads((root/'docs/05-validation/reports/cmu-cycle-review.json').read_text(encoding='utf-8'))
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
# Two views of the same six instants; source skeleton aligned at hip midpoint.
canvas=Image.new('RGB',(1500,865),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((28,15),'35_17 · 한 주기를 여섯 순간으로 보기',font=font(29),fill='#233b32')
d.text((28,58),'실제 현재 모델 · M28 꺼짐 · 점선은 원본 재구성 다리(골반 중점·크기 정렬) · 정면/측면 같은 순간',font=font(18),fill='#63736a')
labels=['착지 시작 추정','지지 중간','지지 끝 / 밀기 추정','다리 회수','회수 후반','다음 착지 준비']
phases=['28%','43%','58%','72%','90%','다음 주기 8%']
for i,(label,phase) in enumerate(zip(labels,phases)):
 x=24+i*246
 d.text((x,100),label,font=font(19),fill='#233b32');d.text((x,130),phase,font=font(17),fill='#63736a')
 for view,y in [('front',165),('side',570)]:
  im=Image.open(root/f'outputs/cmu-cycle-review/{view}-{i}.png').convert('RGB')
  im.thumbnail((234,390 if view=='front' else 245));canvas.paste(im,(x+(234-im.width)//2,y))
d.text((28,832),'오른발 기준 순서 · 단계는 기존 지지 구간의 추정 · 실제 접촉력이나 최적 자세를 나타내는 그림이 아닙니다.',font=font(18),fill='#63736a')
canvas.save(out/'cmu-cycle-frames.png')
# Full phase traces, male; female also sampled in JSON.
b=next(x for x in r['results'] if x['model']=='male' and not x['rejected']);a=next(x for x in r['results'] if x['model']=='male' and x['rejected'])
fig,axs=plt.subplots(2,2,figsize=(13,8.5),sharex=True);fig.set_facecolor('#f6f5f1')
for col,(side,sign,title) in enumerate([('r',-1,'오른다리'),('l',1,'왼다리')]):
 for row,joint in enumerate(['ankle','knee']):
  ax=axs[row,col];ax.set_facecolor('#fffefa');ax.axhline(0,color='#767d77',lw=1)
  spans=[(28,58)] if side=='r' else [(0,9),(75,100)]
  for lo,hi in spans:ax.axvspan(lo,hi,color='#dcead9',alpha=.7)
  for data,group,label,color,style in [(b,'rawSource','반복 가공 전 재구성','#8d9499',':'),(b,'loopSource','반복 가공 후 재구성','#5b8e68','--'),(b,'target','현재 모델 · M28 꺼짐','#087cac','-'),(a,'target','반려한 M28','#c14e4c','-')]:
   rows=[s for s in data['rows'] if group!='rawSource' or s['rawExact']]
   ax.plot([s['phase']*100 for s in rows],[sign*s[group][side][joint][0]*100 for s in rows],label=label,color=color,ls=style,lw=2)
  ax.set_title(title+' · '+('발목' if joint=='ankle' else '무릎'));ax.set_ylabel('자기 쪽 거리 (cm)');ax.grid(alpha=.15);ax.set_xlim(0,100)
  if row==1:ax.set_xlabel('현재 한 주기 (%)')
handles,labels=axs[0,0].get_legend_handles_labels();fig.legend(handles,labels,loc='upper center',bbox_to_anchor=(.5,.90),ncol=4,frameon=False)
fig.suptitle('같은 각도를 계속 더하면 회수 구간도 벌어집니다\n초록 배경: 해당 다리 지지 추정 / 흰 배경: 회수 추정 · 0은 골반 중심선',fontsize=17)
fig.subplots_adjust(left=.07,right=.98,bottom=.09,top=.80,hspace=.22,wspace=.18)
fig.savefig(out/'cmu-cycle-lateral.png',dpi=150);plt.close(fig)
# Spatial ankle path in the same pelvis-relative forward frame.
fig,axs=plt.subplots(1,2,figsize=(12,5));fig.set_facecolor('#f6f5f1')
for ax,axes,title in [(axs[0],(0,2),'위에서 본 오른발 · 좌우/앞뒤'),(axs[1],(2,1),'옆에서 본 오른발 · 앞뒤/높이')]:
 for dat,group,color,label,ls in [(b,'loopSource','#5b8e68','원본 재구성','--'),(b,'target','#087cac','현재 모델','-'),(a,'target','#c14e4c','반려한 M28','-')]:
  pts=np.array([s[group]['r']['ankle'] for s in dat['rows']])*100
  if axes[0]==0:pts[:,0]*=-1
  ax.plot(pts[:,axes[0]],pts[:,axes[1]],color=color,label=label,ls=ls,lw=2)
  for phase in [.28,.58,.90]:
   k=min(range(len(dat['rows'])),key=lambda i:abs(dat['rows'][i]['phase']-phase));ax.scatter(pts[k,axes[0]],pts[k,axes[1]],s=22,color=color)
   if label=='현재 모델':ax.annotate(f'{phase:.0%}',(pts[k,axes[0]],pts[k,axes[1]]),xytext=(5,5),textcoords='offset points',fontsize=9)
 ax.grid(alpha=.2);ax.set_title(title);ax.set_xlabel('자기 쪽 거리 (cm)' if axes[0]==0 else '앞뒤 거리 (cm)');ax.set_ylabel('앞뒤 거리 (cm)' if axes[1]==2 else '골반보다 아래인 높이 (cm)');ax.set_aspect('equal',adjustable='datalim')
fig.legend(*axs[0].get_legend_handles_labels(),loc='upper center',bbox_to_anchor=(.5,.91),ncol=3,frameon=False)
fig.suptitle('발목이 지나가는 경로 · 골반 중점 기준 / 발바닥 접촉점 아님',fontsize=17)
fig.subplots_adjust(left=.08,right=.98,bottom=.14,top=.77,wspace=.23);fig.savefig(out/'cmu-cycle-paths.png',dpi=150);plt.close(fig)
# Source root trace is shown separately from foot-to-pelvis distances.
fig,axs=plt.subplots(1,2,figsize=(12,3.5),layout='constrained');fig.set_facecolor('#f6f5f1')
for ax,key,scale,title,unit in [(axs[0],'pelvisRollDegrees',1,'원본 재구성 골반 좌우 기울기','도'),(axs[1],'worldRoot',100,'복원한 원본 몸 이동 · 좌우 성분','cm')]:
 for dat,color,label,ls in [(b,'#087cac','현재','#-'),(a,'#c14e4c','반려한 M28','--')]:
  y=[(s[key][0] if key=='worldRoot' else s[key])*scale for s in dat['rows']]
  ax.plot([s['phase']*100 for s in dat['rows']],y,color=color,label=label,ls='-' if ls=='#-' else ls,lw=2)
 ax.set_title(title);ax.set_xlabel('현재 한 주기 (%)');ax.set_ylabel(unit);ax.grid(alpha=.2);ax.legend(frameon=False)
fig.suptitle('M28은 골반 자체의 이동·회전을 고치지 않았습니다 · 두 선이 겹침',fontsize=16)
fig.savefig(out/'cmu-cycle-pelvis.png',dpi=150);plt.close(fig)
# Reproducible summary, excluding duplicate period endpoint for swing averages.
summary=[]
for model in ['male','female']:
 before=next(x for x in r['results'] if x['model']==model and not x['rejected']);after=next(x for x in r['results'] if x['model']==model and x['rejected'])
 for side,sign in [('l',1),('r',-1)]:
  swing=[(x,y) for x,y in zip(before['rows'][:-1],after['rows'][:-1]) if x['support']!=side]
  shift=[sign*(y['target'][side]['ankle'][0]-x['target'][side]['ankle'][0])*100 for x,y in swing]
  summary.append({'model':model,'side':side,'recoverySamples':len(swing),'meanOutwardCm':float(np.mean(shift)),'maxOutwardCm':max(shift)})
(root/'docs/05-validation/reports/cmu-cycle-summary.json').write_text(json.dumps({'scope':'Derived M29 metrics; support/recovery labels are estimates. No new correction.','recovery':summary},indent=2),encoding='utf-8')
