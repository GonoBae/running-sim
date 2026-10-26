"""From repo root: python docs/assets/diagrams/plot-run-height.py (matplotlib).

M16 baseline was sampled before editing the clearance coefficient (0.055).
Current traces: experiments/model-preview/tests/run-contact.cjs, 1ms metrics,
3ms plot samples. Pelvis position is a render measurement, not measured COM.
"""
from pathlib import Path
import json
import os
os.environ.setdefault('MPLCONFIGDIR', str(Path('work/matplotlib').resolve()))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

font = Path('C:/Windows/Fonts/malgun.ttf')
if font.exists():
    font_manager.fontManager.addfont(str(font))
    plt.rcParams['font.family'] = 'Malgun Gothic'
else:
    plt.rcParams['font.family'] = ['Noto Sans CJK KR', 'AppleGothic', 'sans-serif']
plt.rcParams.update({'axes.unicode_minus': False, 'font.size': 11,
                     'axes.spines.top': False, 'axes.spines.right': False})
base = Path('docs/05-validation/reports')
before = json.loads((base/'run-height-before.json').read_text(encoding='utf-8'))['results']
after = json.loads((base/'run-contact.json').read_text(encoding='utf-8'))['results']
fig, axes = plt.subplots(1, 2, figsize=(12, 5.2), dpi=140, facecolor='#f6f5f1')
fig.subplots_adjust(left=.075, right=.97, top=.76, bottom=.29, wspace=.25)
fig.suptitle('급하게 떨어지던 높이 변화 줄이기', x=.075, y=.96, ha='left', fontsize=21, fontweight='bold')
fig.text(.075, .86, '실제 GLB 계산 결과 · 0.78초 한 주기 · 골반 높이는 시작 위치 기준 · 회색은 설계한 공중 구간', fontsize=10)
for ax, model, label in zip(axes, ['male', 'female'], ['남성형', '여성형']):
    old = next(r for r in before if r.get('model') == model)
    new = next(r for r in after if r.get('model') == model)
    for data, color, name in [(old, '#ce623d', '수정 전 M16'), (new, '#277c68', '수정 후 M17')]:
        trace = data.get('heightTrace', data.get('frames'))
        y0 = trace[0]['y']
        ax.plot([f['ms']/780*100 for f in trace], [(f['y']-y0)*100 for f in trace],
                color=color, lw=2.4, label=name)
    ax.set_facecolor('#f6f5f1')
    for a,b in [(32,50), (82,100)]: ax.axvspan(a,b,color='#27382e',alpha=.06)
    ax.set(xlim=(0,100), ylim=(-.3,8), xlabel='한 주기 (%)', title=label)
    ax.set_ylabel('시작 대비 골반 높이 (cm)')
    ax.grid(axis='y', alpha=.15)
    ax.legend(loc='upper left', frameon=False, fontsize=10)
    ax.text(0, -.37, f"높이 범위  {old['excursion']*100:.1f} → {new['excursion']*100:.1f}cm\n"
            f"최대 하강  {old['maxFallSpeed']:.2f} → {new['maxFallSpeed']:.2f}m/s", transform=ax.transAxes, fontsize=12)
fig.text(.075, .025, '검증 완료: 높이·접지·복원 수치  |  미검증: 전신 자연스러움  |  정상 달리기의 생체역학 기준을 뜻하지 않습니다.', fontsize=9, color='#59665c')
fig.savefig('docs/assets/images/basic-run-height-comparison.png', facecolor=fig.get_facecolor())
