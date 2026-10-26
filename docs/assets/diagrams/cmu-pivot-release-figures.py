"""M44 actual preview capture and ground-frame same-vertex velocity comparison."""
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
d.text((25,15),'오른발 해제 지지점 연동 · 실제 비교 화면',font=font(28),fill='#233b32')
d.text((25,58),'해제 중 54% 장면 · 주황 오른다리 / 파랑 왼다리 · 구현·수치 검사 완료',font=font(20),fill='#63736a')
for view,y,label in [('front',140,'정면'),('side',770,'측면')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,t in [(390,'기존 M42'),(870,'지지점 연동 M44')]:
        d.text((x,y),t,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-pivot-release/{view}-release.png').crop((0,35,1202,590))
    canvas.paste(im,(29,y+40))
d.text((25,1410),'자연스러움 검토 전 · 앞뒤 밀림 감소 / 좌우 밀림 잔존 · 완전 접지 전',font=font(21),fill='#9a4a30')
canvas.save(out/'cmu-pivot-release-comparison.png')

flow=Image.new('RGB',(1260,270),'#f6f5f1');d=ImageDraw.Draw(flow)
for i,lines in enumerate([['M42 해제 끝','낮은 피부점 선택'],['같은 점의 경로','발 회전 반영'],['발목 목표 재계산','고관절·무릎 연동'],['양끝 M42 연결','골반·회수 유지']]):
    x=20+i*310
    d.rounded_rectangle((x,45,x+280,175),radius=14,fill='#e4ece6',outline='#8ba194',width=2)
    for j,t in enumerate(lines):d.text((x+140,77+j*38),t,font=font(21),fill='#233b32',anchor='mt')
    if i<3:d.text((x+295,92),'→',font=font(25),fill='#233b32',anchor='mt')
d.text((25,218),'M44 구현 흐름 · 골반·왼다리·상체는 M42 유지 / 전체 접지 해결 전',font=font(22),fill='#63736a')
flow.save(out/'cmu-pivot-release-flow.png')

r=json.loads((root/'docs/05-validation/reports/cmu-pivot-release-slip.json').read_text(encoding='utf-8'))
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf')
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,2,figsize=(12,7),sharex=True);fig.set_facecolor('#f6f5f1')
for col,m in enumerate(r['results']):
    for lane,color in zip(m['lanes'],['#b96540','#1687ad']):
        rows=lane['bands'][1]['rows'];x=[v['phase']*100 for v in rows]
        for row,key in [(0,'rmsX'),(1,'rmsZ')]:
            axes[row,col].plot(x,[v[key] for v in rows],color=color,lw=2,label='기존 M42' if lane['name']=='M42' else '지지점 연동 M44')
    axes[0,col].set_title(('남성형' if col==0 else '여성형')+' · 오른발',fontsize=16)
    axes[0,col].legend(frameon=False)
    for row,label in [(0,'좌우 RMS (m/s)'),(1,'앞뒤 RMS (m/s)')]:
        ax=axes[row,col];ax.set_ylabel(label);ax.grid(alpha=.15);ax.set_xlim(28,58);ax.set_ylim(bottom=0)
        ax.axvspan(32,40,color='#b96540',alpha=.06)
        ax.axvspan(40,46,color='#1687ad',alpha=.17)
        ax.axvspan(46,58,color='#b96540',alpha=.06)
    axes[1,col].set_xlabel('한 주기 (%) · 파랑: 고정 / 옅은 주황: 연결·해제')
fig.suptitle('해제 구간 앞뒤 밀림 감소 / 좌우 밀림 잔존\n같은 피부점의 지면 속도 · 바닥 4mm 근접 가중 · 접촉력 실측 아님',fontsize=16)
fig.tight_layout();fig.savefig(out/'cmu-pivot-release-speed.png',dpi=150);plt.close(fig)
