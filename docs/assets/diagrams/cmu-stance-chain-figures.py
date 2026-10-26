"""M36 actual static captures and measured hip-knee-ankle geometry."""
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
d.text((25,15),'오른발 착지 한 장면 · 골반–무릎–발 연동',font=font(28),fill='#233b32')
d.text((25,58),'실제 구현 화면 · 35_17 약 43% · 주황선은 관절 연결을 보여주는 검사용 투시선',font=font(19),fill='#63736a')
for view,y,label in [('front',140,'정면 · 옆 꺾임 비교'),('side',760,'측면 · 무릎 굽힘 유지')]:
    d.text((25,y-42),label,font=font(22),fill='#233b32')
    for x,text in [(390,'현재 동작'),(870,'골반·무릎·발 연동')]:d.text((x,y),text,font=font(21),fill='#233b32',anchor='mt')
    im=Image.open(root/f'outputs/cmu-stance-chain/male-{view}.png').crop((0,35,1202,590));canvas.paste(im,(29,y+40))
d.text((25,1395),'한 장면 수치 검사 완료 · 자연스러움 검토 전 · 전체 구간 미적용',font=font(19),fill='#63736a')
canvas.save(out/'cmu-stance-chain-comparison.png')
r=json.loads((root/'docs/05-validation/reports/cmu-stance-chain.json').read_text())['results'][0]
prior=json.loads((root/'docs/05-validation/reports/cmu-stance-chain-prior.json').read_text())['rows'][0]
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf');plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
fig,axes=plt.subplots(1,3,figsize=(10,5.2));fig.set_facecolor('#f6f5f1')
for ax,data,title,color in zip(axes,[r['before'],prior,r['after']],['원래 동작','M35 · 발 위치만 목표','M36 · 연동 후보'],['#73847a','#b96540','#1687ad']):
    H,K,A=[data[k] for k in ['hip','knee','ankle']];origin=r['before']['hip'][0]
    ax.plot([H[0]-origin,A[0]-origin],[H[1],A[1]],'--',color='#aaa',lw=1)
    ax.plot([p[0]-origin for p in [H,K,A]],[p[1] for p in [H,K,A]],'-o',color=color,lw=3,ms=7)
    for p,name in [(H,'고관절'),(K,'무릎'),(A,'발목')]:ax.annotate(name,(p[0]-origin,p[1]),xytext=(8,2),textcoords='offset points')
    ax.set_title(title,fontsize=15);ax.set_xlim(-.06,.25);ax.set_ylim(.04,1.06);ax.set_aspect('equal');ax.axis('off')
    value=f"{data['frontalKneeMm']:.1f}mm" if data['frontalKneeMm']>=.001 else '<0.001mm'
    ax.text(.5,-.025,f'정면 옆 이탈 {value}\n무릎 굽힘 {data["bend"]:.1f}°',transform=ax.transAxes,ha='center',va='top',fontsize=13,color=color)
fig.suptitle('같은 장면의 관절 위치 측정 · 정상 자세 판정 아님',fontsize=17)
fig.subplots_adjust(top=.84,bottom=.16,wspace=.3);fig.savefig(out/'cmu-stance-chain-joints.png',dpi=150);plt.close(fig)
