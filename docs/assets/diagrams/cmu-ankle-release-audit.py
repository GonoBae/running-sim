"""Read-only stage measurements and actual matched-phase browser captures.
Run after inspect-cmu-ankle-release.cjs. No runtime/model changes.
"""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[3]
data=json.loads((root/'docs/05-validation/reports/cmu-ankle-release-audit.json').read_text('utf-8'))
assert data['status']=='observed-no-motion-change'
period=91/120
def angle(a,b):
    aa=math.sqrt(sum(v*v for v in a));bb=math.sqrt(sum(v*v for v in b))
    return 2*math.acos(min(1,abs(sum(x*y for x,y in zip(a,b)))/(aa*bb)))*180/math.pi
def series(result,side,stage):
    rows=[r for r in result['stages'] if r['side']==side]
    def q(row):
        return row['sourceRelative'] if stage=='source' else next(s['relative'][side] for s in row['stages'] if s['stage']==stage)
    return [{'v':(a['v']+b['v'])/2,'speed':angle(q(a),q(b))/((b['v']-a['v'])*.12*period)}
            for a,b in zip(rows,rows[1:])]

summary={'scope':'M56 read-only; authored release intervals r .58-.70, l 1.09-1.21; calf-relative quaternion angular increments, not Euler heading','durationSeconds':.12*period,'status':'verified-observation-no-correction','models':[]}
for result in data['results']:
    values={}
    for side in ['r','l']:
        values[side]={}
        for stage in ['source','retarget','preContact','contact','swing','leftDirection','landingSole','lateSole','toePath']:
            curve=series(result,side,stage)
            values[side][stage]={'peakDegPerSecond':max(p['speed'] for p in curve),'pathDeg':sum(p['speed'] for p in curve)*.12/120*period}
        # Observe identical foot motion after the direction stage: later stance
        # and toe-path corrections have zero contribution in this release window.
        assert abs(values[side]['leftDirection']['peakDegPerSecond']-values[side]['toePath']['peakDegPerSecond'])<.001
        assert abs(values[side]['source']['peakDegPerSecond']-values[side]['retarget']['peakDegPerSecond'])<.001
    summary['models'].append({'model':result['model'],'stages':values,'leftRightPeakRatio':values['l']['toePath']['peakDegPerSecond']/values['r']['toePath']['peakDegPerSecond'],'regression':result['regression']})
(root/'docs/05-validation/reports/cmu-ankle-release-summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),'utf-8')

font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';right='#b96540';left='#1687ad';source='#7d8c83'
img=Image.new('RGB',(1280,1080),bg);d=ImageDraw.Draw(img)
d.text((28,22),'왼발의 방향 보정이 풀릴 때 회전 속도가 커집니다',font=font(29),fill=ink)
d.text((28,68),'M57 관찰 완료 · M56 실제 화면의 단계별 측정 · 동작 수정 없음',font=font(20),fill=muted)
d.text((28,117),'왼발 최대 회전 속도 · 남성형 · 종아리 대비 발의 총 회전',font=font(23),fill=ink)
labels=[('가공 원본','source'),('모델 적용','retarget'),('접지 보정 뒤','contact'),('왼발 방향 보정 뒤','leftDirection')]
v=summary['models'][0]['stages']['l']
for i,(label,key) in enumerate(labels):
    x=28+i*312
    d.rounded_rectangle((x,161,x+288,278),radius=10,fill='#e7eee7')
    d.text((x+16,177),label,font=font(21),fill=ink)
    d.text((x+16,220),f"{v[key]['peakDegPerSecond']:.0f}°/초",font=font(28),fill=left if i==3 else muted)
    if i<3:d.text((x+289,202),'→',font=font(22),fill=muted)
d.text((28,306),'접지 회전 제약이 100% → 0%로 풀리는 시간: 양발 모두 0.091초',font=font(21),fill=ink)
d.text((28,340),'왼발은 접지 회전 해제에 더해, 착지 방향 보정도 같은 시간에 풀립니다.',font=font(20),fill=muted)

x0,y0,w,h=110,440,1060,345
for value in range(0,1201,300):
    y=y0+h-value/1200*h;d.line((x0,y,x0+w,y),fill='#d5ded5')
    d.text((26,y-14),str(value),font=font(18),fill=muted)
for value in range(0,101,25):
    x=x0+w*value/100;d.line((x,y0,x,y0+h),fill='#e3e8df')
    d.text((x-12,y0+h+12),str(value),font=font(18),fill=muted)
d.text((28,400),'°/초',font=font(19),fill=muted)
for side,stage,color in [('r','toePath',right),('l','contact',source),('l','toePath',left)]:
    curve=series(data['results'][0],side,stage)
    d.line([(x0+p['v']*w,y0+h-p['speed']/1200*h) for p in curve],fill=color,width=4)
for x,label,color in [(120,'오른발 현재',right),(445,'왼발 방향 보정 직전',source),(850,'왼발 현재',left)]:
    d.line((x,858,x+36,858),fill=color,width=5);d.text((x+45,842),label,font=font(20),fill=color)
d.text((490,813),'각 발의 해제 진행률 (%)',font=font(20),fill=ink)
for i,s in enumerate(summary['models']):
    d.text((28,905+i*43),f"{'남성형' if i==0 else '여성형'}: 오른발 {s['stages']['r']['toePath']['peakDegPerSecond']:.0f} / 왼발 {s['stages']['l']['toePath']['peakDegPerSecond']:.0f}°/초  →  왼발 {s['leftRightPeakRatio']:.2f}배",font=font(22),fill=ink)
d.text((28,1025),'수동 지정 구간의 표본 최대값입니다. 임상 정상 범위·피부 문제 전체·교정 완료 판정은 아닙니다.',font=font(17),fill=muted)
img.save(root/'docs/assets/images/cmu-ankle-release-metrics.png')

img=Image.new('RGB',(1380,1110),bg);d=ImageDraw.Draw(img)
d.text((24,20),'같은 해제 진행률 50% · 현재 M56 양발 실제 화면',font=font(29),fill=ink)
d.text((24,66),'뼈대 투시선과 피부를 함께 관찰 · 정면 / 측면 · 남성형 · 수정 전',font=font(20),fill=muted)
for row,view in enumerate(['front','side']):
    top=115+row*485
    for col,side in enumerate(['r','l']):
        x=35+col*680
        label=('오른발' if side=='r' else '왼발')+' · '+('정면' if view=='front' else '측면')
        d.text((x,top),label,font=font(24),fill=right if side=='r' else left)
        capture=Image.open(root/f'outputs/cmu-ankle-release/male-{side}-0.5-{view}.png').convert('RGB')
        capture.thumbnail((610,430));img.paste(capture,(x+115,top+42))
d.text((24,1070),'위치는 각 발목 중심으로 확대했습니다. 좌우 화면은 같은 순간이 아니라 같은 해제 단계입니다.',font=font(18),fill=muted)
img.save(root/'docs/assets/images/cmu-ankle-release-poses.png')
print(json.dumps(summary,ensure_ascii=False))
