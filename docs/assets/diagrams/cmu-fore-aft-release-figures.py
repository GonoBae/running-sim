"""M46 actual frames, measured velocities, preservation of toe clearance."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1260,1460),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((25,15),'오른발 해제 앞뒤 밀림 재보정 · 실제 비교',font=font(28),fill='#233b32')
d.text((25,58),'해제 중 54% 장면 · 주황 오른다리 / 파랑 왼다리 · 구현·수치 검사 완료',font=font(20),fill='#63736a')
for view,y,label in [('front',140,'정면'),('side',770,'측면')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,t in [(390,'기존 M45'),(870,'앞뒤 보정 M46')]:d.text((x,y),t,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-fore-aft-release/{view}-release.png').crop((0,35,1202,590));canvas.paste(im,(29,y+40))
d.text((25,1410),'좌우·발끝 높이·골반·회수 유지 / 앞뒤 밀림 감소 · 자연스러움 검토 전',font=font(21),fill='#63736a')
canvas.save(out/'cmu-fore-aft-release-comparison.png')
flow=Image.new('RGB',(1260,270),'#f6f5f1');d=ImageDraw.Draw(flow)
for i,lines in enumerate([['M45 기준 샘플','같은 피부점 속도'],['지면 근접 가중','앞뒤 곡선 계산'],['앞뒤 최대 약 3mm','고관절·무릎 연동'],['양끝 M45 연결','좌우·높이·골반 유지']]):
    x=20+i*310;d.rounded_rectangle((x,45,x+280,175),radius=14,fill='#e4ece6',outline='#8ba194',width=2)
    for j,t in enumerate(lines):d.text((x+140,77+j*38),t,font=font(21),fill='#233b32',anchor='mt')
    if i<3:d.text((x+295,92),'→',font=font(25),fill='#233b32',anchor='mt')
d.text((25,218),'M46 구현 흐름 · 다른 체형/동작·실제 접촉력은 미검증',font=font(22),fill='#63736a')
flow.save(out/'cmu-fore-aft-release-flow.png')
read=lambda n:json.loads((root/f'docs/05-validation/reports/{n}.json').read_text(encoding='utf-8'))
slip=read('cmu-fore-aft-release-slip');m44=read('cmu-pivot-release-slip');pose=read('cmu-fore-aft-release');old=read('cmu-release-refinement')
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(2,2,figsize=(12,7));fig.set_facecolor('#f6f5f1')
for i,m in enumerate(slip['results']):
    datasets=[(m44['results'][i]['lanes'][1],'M44 증가 전','#888','--'),(m['lanes'][0],'기존 M45','#b96540','-'),(m['lanes'][1],'앞뒤 보정 M46','#1687ad','-')]
    for lane,label,color,style in datasets:
        rows=[v for v in lane['bands'][1]['rows'] if v['phase']>=.46]
        axes[0,i].plot([r['phase']*100 for r in rows],[r['rmsZ'] for r in rows],label=label,color=color,ls=style,lw=2)
    axes[0,i].set_title(('남성형' if i==0 else '여성형')+' · 앞뒤 밀림 감소');axes[0,i].set_ylabel('앞뒤 피부점 RMS 속도 (m/s)');axes[0,i].legend(frameon=False)
    for data,label,color in [(old,'기존 M45','#b96540'),(pose,'M46 · 높이 유지','#1687ad')]:
        rows=[v for v in data['results'][i]['rows'] if .46<=v['phase']<=.58]
        axes[1,i].plot([r['phase']*100 for r in rows],[r['pivot'][1]*1000 for r in rows],label=label,color=color,lw=2,ls='--' if data is pose else '-')
    axes[1,i].set_ylabel('선택 발끝 지점 높이 (mm)');axes[1,i].set_title('발끝 높이 유지 · 두 곡선 겹침');axes[1,i].legend(frameon=False)
    for ax in axes[:,i]:ax.grid(alpha=.15);ax.set_xlim(46,58);ax.set_xlabel('한 주기 (%)')
fig.suptitle('실제 모델 측정 · 앞뒤 속도는 4mm 지면 근접 가중 / 접촉력 실측 아님',fontsize=15)
fig.tight_layout();fig.savefig(out/'cmu-fore-aft-release-metrics.png',dpi=150);plt.close(fig)
