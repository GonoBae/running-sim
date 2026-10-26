"""M24 figures from real captures and diagnostic JSON; no generated anatomy."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
root=Path(__file__).resolve().parents[3];images=root/'docs/assets/images'
font='C:/Windows/Fonts/malgun.ttf';font_manager.fontManager.addfont(font)
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
bg='#f6f5f1';ink='#263c40'
def board(suffix,title,subtitle):
    out=Image.new('RGB',(1100,650),bg);d=ImageDraw.Draw(out)
    def text(x,y,t,n):d.text((x,y),t,font=ImageFont.truetype(font,n),fill=ink)
    text(24,18,title,28);text(24,62,subtitle,17)
    for i,state in enumerate(['before','after']):
        x=24+i*540;text(x,100,'기존 가중치' if i==0 else '발목 주변 가중치 평활화',22)
        im=Image.open(images/f'cmu-ankle-weights-{state}{suffix}.png').crop((360,140,710,480)).resize((500,486));out.paste(im,(x,143))
    out.save(images/f'cmu-ankle-weights-comparison{suffix}.png')
board('','피부 접힘 · 같은 자세에서 비교','실제 남성형 127_06 · 주기 30.67% · 골반 / 관절 위치 / 회전은 동일')
board('-map','같은 발목의 가중치 분포','파랑: 종아리 영향 100% → 노랑: 발 영향 100% · 회색은 표시 대상 밖')

audit=json.loads((root/'docs/05-validation/reports/cmu-lower-chain-audit.json').read_text(encoding='utf-8'))
case=audit['results'][0]
fig,axes=plt.subplots(1,4,figsize=(11,5),facecolor=bg,sharey=True)
edges=[(1,4),(1,2),(2,3),(4,5),(5,6)]
for ax,phase in zip(axes,[0,.25,.5,.75]):
    t=min(case['trace'],key=lambda x:abs(x['phase']-phase));ax.set_facecolor(bg)
    for key,color,label in [('sourceChain','#26846a','원본 뼈대'),('targetChain','#d26140','우리 모델')]:
        ps=t[key]
        for j,(a,b) in enumerate(edges):ax.plot([ps[a][0],ps[b][0]],[ps[a][1],ps[b][1]],color=color,lw=2,marker='o',ms=3,label=label if j==0 else None)
    ax.set_title(f"주기 {phase*100:.0f}%");ax.set_xlim(-.29,.29);ax.set_ylim(-1.05,.08);ax.set_aspect('equal');ax.axvline(0,c='#cdd6cf',lw=1);ax.grid(alpha=.2);ax.set_xlabel('좌우 (m)')
axes[0].set_ylabel('고관절 중앙 기준 높이 (m)');fig.suptitle('골반 → 무릎 → 발목 · 원근 왜곡 없는 정면 비교',fontsize=17)
fig.legend(*axes[0].get_legend_handles_labels(),loc='lower center',ncol=2,frameon=False,bbox_to_anchor=(.5,.03))
fig.text(.5,.01,'남성형 35_17 · 고관절 중앙 정렬 / 원본 다리 길이만 모델에 맞춤 · 고관절 폭과 뼈 길이 비율 차이는 유지',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.10,1,.95));fig.savefig(images/'cmu-lower-chain-comparison.png',dpi=140);plt.close(fig)

trials=json.loads((root/'docs/05-validation/reports/cmu-ankle-weight-trials.json').read_text(encoding='utf-8'))
keys=['original','pivotFront10mm','pivotBack10mm','pivotUp10mm','pivotDown10mm','smooth10'];labels=['기존','중심 앞 1cm','뒤 1cm','위 1cm','아래 1cm','가중치만 수정']
fig,axes=plt.subplots(2,2,figsize=(11,6),facecolor=bg)
for ax,c in zip(axes.flat,trials):
    ax.set_facecolor(bg);vals=[next(t['min'] for t in c['trials'] if t['name']==k) for k in keys]
    bars=ax.bar(labels,vals,color=['#d26140']+['#9aa9af']*4+['#26846a']);ax.bar_label(bars,fmt='%.2f',fontsize=9);ax.set_ylim(0,.8);ax.set_title(('남성형 ' if c['model']=='male' else '여성형 ')+c['clip']);ax.tick_params(axis='x',labelsize=9);ax.grid(axis='y',alpha=.2)
fig.suptitle('관절 중심 이동 vs 가중치만 변경 · 대조 실험',fontsize=17)
fig.text(.5,.01,'최소 피부 면적비 · 1에 가까울수록 덜 압축 · 2프레임 간격 탐색 / 정상 인체 위치를 결정하는 검사가 아님',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.04,1,.95));fig.savefig(images/'cmu-ankle-weight-trials.png',dpi=140);plt.close(fig)

r=json.loads((root/'docs/05-validation/reports/cmu-ankle-weights.json').read_text(encoding='utf-8'))
fig,ax=plt.subplots(figsize=(11,3.6),facecolor=bg);ax.set_facecolor(bg)
for i,c in enumerate(r['results']):
    label=('남 ' if c['model']=='male' else '여 ')+c['clip']
    for offset,key,color in [(-.17,'before','#d26140'),(.17,'after','#26846a')]:
        val=c[key]['min'];ax.bar(i+offset,val,width=.3,color=color);ax.text(i+offset,val+.015,f'{val:.3f}',ha='center',fontsize=11)
ax.set_xticks(range(4),[('남 ' if c['model']=='male' else '여 ')+c['clip'] for c in r['results']]);ax.set_ylim(0,1.05);ax.axhline(1,c='#9aa9af',ls='--');ax.grid(axis='y',alpha=.2)
ax.set_title('최종 검사 · 같은 568개 삼각형 × 668자세',fontsize=17);fig.text(.5,.025,'주황: 기존 / 초록: 수정 · 최소 면적비 / 0.5프레임 간격 · 피부 압축 개선 확인, 전체 자연스러움은 검토 전',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.08,1,1));fig.savefig(images/'cmu-ankle-weight-metrics.png',dpi=140);plt.close(fig)
frames=[Image.open(root/f'outputs/cmu-ankle-weights/frame-{i:02}.png').resize((992,744)).convert('P',palette=Image.Palette.ADAPTIVE) for i in range(24)]
timing=[(round((i+1)*75.833333/24)-round(i*75.833333/24))*10 for i in range(24)]
frames[0].save(images/'cmu-ankle-weights-preview.gif',save_all=True,append_images=frames[1:],duration=timing,loop=0,disposal=2)
