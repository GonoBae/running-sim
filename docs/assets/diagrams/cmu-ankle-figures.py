"""Compose actual browser captures and plot the M23 diagnostic JSON (no mockups)."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

root=Path(__file__).resolve().parents[3]
images=root/'docs/assets/images'
font='C:/Windows/Fonts/malgun.ttf'
font_manager.fontManager.addfont(font)
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':10})
bg='#f6f5f1'; ink='#263c40'
def board(name,title,subtitle,states,crop,size):
    out=Image.new('RGB',(1100,size[1]+176),bg);d=ImageDraw.Draw(out)
    def text(x,y,t,n): d.text((x,y),t,font=ImageFont.truetype(font,n),fill=ink)
    text(24,16,title,27);text(24,59,subtitle,16)
    for i,(state,label) in enumerate(states):
        x=24+i*(1052//len(states)+12)
        text(x,96,label,21)
        shot=Image.open(images/f'cmu-ankle-{name}-{state}-bones.png').crop(crop).resize(size)
        out.paste(shot,(x,133))
    text(24,size[1]+141,'파랑: 종아리 뼈   /   주황: 발 뼈   ·   실제 렌더링에 진단용 뼈대를 겹친 화면',15)
    out.save(images/f'cmu-ankle-{name}-comparison.png')

board('overview','발목 기준 보정 · 실제 전후','남성형 35_17 · 주기 25% · 회전 기준 오류 수정 / 외형 최종 검토 전',
      [('before','이전 · 발을 따로 정렬'),('after','수정 · 종아리 기준 상대 회전')],(350,40,850,570),(500,530))
board('skin','피부 접힘은 남아 있습니다','남성형 127_06 · 주기 30.67% · 같은 종아리 자세 / 카메라를 발목에 맞춘 비교',
      [('before','이전'),('after','회전 기준 수정'),('neutral','진단용 · 발목만 중립')],(340,80,850,600),(330,337))

report=json.loads((root/'docs/05-validation/reports/cmu-ankle-relative.json').read_text(encoding='utf-8'))
case=report['results'][0]
fig,axes=plt.subplots(2,3,figsize=(11,5.6),facecolor=bg,sharex=True)
colors={'source':'#808c90','before':'#d26140','after':'#147965'}
for row,side in enumerate(['l','r']):
    for col,label in enumerate(['앞뒤 굽힘 X','비틀림 Y','옆 기울기 Z']):
        ax=axes[row,col];ax.set_facecolor(bg)
        for key in colors:
            ax.plot([t['phase']*100 for t in case['trace']],
                    [next(a for a in t['angles'] if a['side']==side)[key][col] for t in case['trace']],
                    color=colors[key],label={'source':'원본 상대 회전 (모델 기준으로 변환)','before':'이전 전달','after':'수정 전달'}[key],
                    lw=4 if key=='source' else 1.6,ls='--' if key=='after' else '-')
        ax.set_title(('왼쪽 · ' if row==0 else '오른쪽 · ')+label);ax.grid(alpha=.15);ax.set_ylabel('°')
        if row==1: ax.set_xlabel('한 주기 (%)')
fig.suptitle('종아리–발 상대 회전 · 남성형 35_17',fontsize=17,y=.99)
fig.legend(*axes[0,0].get_legend_handles_labels(),loc='lower center',ncol=3,frameon=False,bbox_to_anchor=(.5,.035))
fig.text(.5,.005,'중립 모델 좌표 · Euler XZY · 가공한 반복 동작의 비교이며 임상 관절각/권장 범위가 아닙니다.',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.10,1,.95));fig.savefig(images/'cmu-ankle-rotations.png',dpi=140);plt.close(fig)

fig,axes=plt.subplots(1,2,figsize=(11,3.8),facecolor=bg)
labels=[('남' if c['model']=='male' else '여')+' '+c['clip'] for c in report['results']]
for ax,key,title in zip(axes,['worstP05','min'],['각 시점 하위 5% 면적비 중 최솟값','단일 삼각형의 최소 면적비 · 악화 표본 포함']):
    ax.set_facecolor(bg)
    for j,(mode,color) in enumerate([('beforeSkin','#d26140'),('afterSkin','#147965')]):
        vals=[c[mode][key] for c in report['results']];bars=ax.bar([i+(j-.5)*.34 for i in range(4)],vals,width=.32,color=color,label='이전' if j==0 else '수정')
        ax.bar_label(bars,fmt='%.2f',fontsize=9)
    ax.set_xticks(range(4),labels);ax.set_ylim(0,1.1);ax.axhline(1,c='#9aa7a2',ls='--');ax.set_title(title,fontsize=12);ax.legend(frameon=False);ax.grid(axis='y',alpha=.15)
fig.suptitle('피부 변형 검사 · 회전 기준만 고쳐도 모든 면이 개선되지는 않음',fontsize=16)
fig.text(.5,.025,'면적비 1 = 같은 종아리 자세에서 발목만 중립으로 둔 표면 · 작을수록 압축 · 전체 부피/관통 판정 아님',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.08,1,.93));fig.savefig(images/'cmu-ankle-skin-metrics.png',dpi=140);plt.close(fig)

frames=[Image.open(root/f'outputs/cmu-ankle/frame-{i:02}.png').resize((992,720)).convert('P',palette=Image.Palette.ADAPTIVE) for i in range(24)]
timing=[(round((k+1)*75.833333/24)-round(k*75.833333/24))*10 for k in range(24)]
frames[0].save(images/'cmu-ankle-preview.gif',save_all=True,append_images=frames[1:],duration=timing,loop=0,disposal=2)
