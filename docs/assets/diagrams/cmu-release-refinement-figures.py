"""M45 actual preview capture and ground-frame same-vertex velocity comparison."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

root=Path(__file__).resolve().parents[3]
out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1260,1460),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((25,15),'오른발 해제 좌우·발끝 보정 · 실제 비교 화면',font=font(28),fill='#233b32')
d.text((25,58),'해제 중 54% 장면 · 주황 오른다리 / 파랑 왼다리 · 구현·수치 검사 완료',font=font(20),fill='#63736a')
for view,y,label in [('front',140,'정면'),('side',770,'측면')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,t in [(390,'기존 M44'),(870,'좌우·발끝 보정 M45')]:
        d.text((x,y),t,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-release-refinement/{view}-release.png').crop((0,35,1202,590))
    canvas.paste(im,(29,y+40))
d.text((25,1410),'자연스러움 검토 전 · 좌우·발끝 개선 / 앞뒤 일부 악화 · 완전 접지 전',font=font(21),fill='#9a4a30')
canvas.save(out/'cmu-release-refinement-comparison.png')

flow=Image.new('RGB',(1260,270),'#f6f5f1');d=ImageDraw.Draw(flow)
for i,lines in enumerate([['M44 기준 유지','오른발 해제만'],['좌우 경로 최대 8mm','발끝 추가 최대 8도'],['발목·무릎 재계산','바닥 높이 재검사'],['양끝 M44 연결','골반·회수 유지']]):
    x=20+i*310
    d.rounded_rectangle((x,45,x+280,175),radius=14,fill='#e4ece6',outline='#8ba194',width=2)
    for j,t in enumerate(lines):d.text((x+140,77+j*38),t,font=font(21),fill='#233b32',anchor='mt')
    if i<3:d.text((x+295,92),'→',font=font(25),fill='#233b32',anchor='mt')
d.text((25,218),'M45 구현 흐름 · 골반·왼다리·상체는 M44 유지 / 전체 접지 해결 전',font=font(22),fill='#63736a')
flow.save(out/'cmu-release-refinement-flow.png')

r=json.loads((root/'docs/05-validation/reports/cmu-release-refinement-slip.json').read_text(encoding='utf-8'))
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf')
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,2,figsize=(12,7),sharex=True);fig.set_facecolor('#f6f5f1')
for col,m in enumerate(r['results']):
    for lane,color in zip(m['lanes'],['#b96540','#1687ad']):
        rows=lane['bands'][1]['rows'];x=[v['phase']*100 for v in rows]
        for row,key in [(0,'rmsX'),(1,'rmsZ')]:
            axes[row,col].plot(x,[v[key] for v in rows],color=color,lw=2,label='기존 M44' if lane['name']=='M44' else '좌우·발끝 보정 M45')
    axes[0,col].set_title(('남성형' if col==0 else '여성형')+' · 오른발',fontsize=16)
    axes[0,col].legend(frameon=False)
    for row,label in [(0,'좌우 RMS (m/s)'),(1,'앞뒤 RMS (m/s)')]:
        ax=axes[row,col];ax.set_ylabel(label);ax.grid(alpha=.15);ax.set_xlim(28,58);ax.set_ylim(bottom=0)
        ax.axvspan(32,40,color='#b96540',alpha=.06)
        ax.axvspan(40,46,color='#1687ad',alpha=.17)
        ax.axvspan(46,58,color='#b96540',alpha=.06)
    axes[1,col].set_xlabel('한 주기 (%) · 파랑: 고정 / 옅은 주황: 연결·해제')
fig.suptitle('좌우 밀림 감소 / 앞뒤 밀림 일부 증가\n같은 피부점의 지면 속도 · 바닥 4mm 근접 가중 · 접촉력 실측 아님',fontsize=16)
fig.tight_layout();fig.savefig(out/'cmu-release-refinement-speed.png',dpi=150);plt.close(fig)

# Same chosen material vertex, including unchanged endpoint heights.
p=json.loads((root/'docs/05-validation/reports/cmu-release-refinement.json').read_text(encoding='utf-8'))
b=json.loads((root/'docs/05-validation/reports/cmu-pivot-release.json').read_text(encoding='utf-8'))
fig,axes=plt.subplots(1,2,figsize=(12,4));fig.set_facecolor('#f6f5f1')
for i,(m,old) in enumerate(zip(p['results'],b['results'])):
    for data,label,color in [(old,'기존 M44','#b96540'),(m,'M45 보정','#1687ad')]:
        rows=[r for r in data['rows'] if .45<=r['phase']<=.59]
        axes[i].plot([r['phase']*100 for r in rows],[r['pivot'][1]*1000 for r in rows],label=label,color=color,lw=2)
    axes[i].axvspan(47,57,color='#1687ad',alpha=.08);axes[i].set_title('남성형' if i==0 else '여성형');axes[i].set_xlabel('한 주기 (%) · 옅은 영역은 중간 높이 집계');axes[i].set_ylabel('선택한 발끝 지점 높이 (mm)');axes[i].grid(alpha=.15);axes[i].legend(frameon=False)
fig.suptitle('중간 높이는 감소 / 양끝 기존 자세의 뜸은 유지',fontsize=16);fig.tight_layout();fig.savefig(out/'cmu-release-refinement-height.png',dpi=150);plt.close(fig)
