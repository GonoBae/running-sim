"""M43 read-only release audit; real captures and saved kinematic measurements."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
r=json.loads((root/'docs/05-validation/reports/cmu-foot-release.json').read_text(encoding='utf-8'))
im=Image.new('RGB',(1380,870),'#f6f5f1');d=ImageDraw.Draw(im)
d.text((25,15),'발을 떼는 연결 구간 · 실제 측면 확대',font=font(29),fill='#233b32')
d.text((25,60),'M43 검토 완료 / 보정 없음 · 남성형 · 주황 오른다리 / 파랑 왼다리',font=font(20),fill='#63736a')
for col,phase in enumerate([46,50,54,58]):
 x=15+col*340
 d.text((x+165,115),f'{phase}%'+(' · 고정 끝' if phase==46 else ' · 해제 끝' if phase==58 else ''),font=font(22),fill='#233b32',anchor='mt')
 source=Image.open(root/f'outputs/cmu-foot-release/side-{phase}.png')
 for row,(left,label) in enumerate([(225,'기존 M40'),(710,'짧은 고정 M42')]):
  y=165+row*320
  d.text((x+165,y),label,font=font(19),fill='#233b32',anchor='mt')
  crop=source.crop((left,280,left+375,590));crop.thumbnail((330,275));im.paste(crop,(x,y+30))
d.text((25,820),'화면은 이동 카메라 기준 · 미끄러짐 수치는 별도의 지면 좌표 측정 사용',font=font(21),fill='#9a4a30')
im.save(out/'cmu-foot-release-frames.png')
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf')
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,2,figsize=(12,7.5));fig.set_facecolor('#f6f5f1')
for col,m in enumerate(r['results']):
 rows=[v for v in m['lanes'][1]['rows'] if v['phase']>=.46]
 ax=axes[0,col]
 for key,label,color in [('ankleZ','발목 이동','#1687ad'),('meanZ','바닥 근처 피부점','#b96540')]:
  ax.plot([v['phase']*100 for v in rows],[v[key] for v in rows],label=label,color=color,lw=2)
 ax.axhline(0,color='#666',lw=.8);ax.set_xlim(46,58);ax.set_title(('남성형' if col==0 else '여성형')+' · M42 해제 구간')
 ax.set_ylabel('앞뒤 속도 (m/s) · +Z 방향이 양수');ax.set_xlabel('한 주기 (%)');ax.legend(frameon=False);ax.grid(alpha=.15)
 ax=axes[1,col];q=m['peakDecomposition'][1]
 vals=[q['ankleZ'],q['rigidFootRotationZ'],q['remainderZ'],q['actualSkinZ']]
 ax.bar(['발목 이동','발 회전 성분','나머지','피부점 합계'],vals,color=['#1687ad','#be813d','#9a9a9a','#b96540'])
 ax.axhline(0,color='#666',lw=.8);ax.set_ylim(-5,3.8);ax.set_ylabel('부호 있는 앞뒤 평균 속도 (m/s)');ax.set_title(f"가장 큰 밀림 순간 {q['phase']*100:.1f}% · 속도 분해")
 for i,v in enumerate(vals):ax.text(i,v+(.15 if v>=0 else -.15),f'{v:+.2f}',ha='center',va='bottom' if v>=0 else 'top')
fig.suptitle('발목과 피부점이 서로 반대 방향 · 위치와 회전이 맞지 않음\n바닥 4mm 근접 가중 · 회전 분해는 기하학적 진단 / 접촉력 실측 아님',fontsize=15)
fig.tight_layout();fig.savefig(out/'cmu-foot-release-cause.png',dpi=150);plt.close(fig)
