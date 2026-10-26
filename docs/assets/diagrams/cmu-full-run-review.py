"""M72: actual browser captures and measured geometry; no generated runner art."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-full-run-review.json').read_text())
archive=json.loads((root/'docs/05-validation/reports/cmu-shared-release.json').read_text())
assert report['status']=='observation-complete'
raw=root/'outputs/cmu-full-run-review';out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#253c35';muted='#60736c';orange='#c36c43';blue='#1987a6';grid='#d8e0da'
def canvas(size,title,subtitle):
    im=Image.new('RGB',size,bg);d=ImageDraw.Draw(im)
    d.text((30,20),title,font=font(31),fill=ink)
    d.text((30,68),subtitle,font=font(19),fill=muted)
    return im,d
def photo(im,path,box):
    p=Image.open(path);p.thumbnail((box[2],box[3]))
    im.paste(p,(box[0]+(box[2]-p.width)//2,box[1]))
def span(v): return max(v)-min(v)
def movement(rows,side,key,near=None):
    pairs=[(a,b) for a,b in zip(rows,rows[1:]) if near is None or
           (abs(a['legs'][side][key][1])<=near and abs(b['legs'][side][key][1])<=near)]
    return sum(math.hypot(*(b['legs'][side][key][k]-a['legs'][side][key][k] for k in [0,2]))*1000 for a,b in pairs)
def near_segments(rows,side,key,threshold=.001):
    groups=[];group=[]
    for r in rows:
        if abs(r['legs'][side][key][1])<=threshold: group.append(r)
        elif group: groups.append(group);group=[]
    if group:groups.append(group)
    return [{'from':g[0]['t'],'to':g[-1]['t'],'pathMm':movement(g,side,key)} for g in groups]

summary={'status':'review-complete; proposals not approved','runtimeFilesUnchanged':len(report['runtimeHashes']),'models':[]}
for r in report['results']:
    a=r['rows'];result={'model':r['model'],'armArchiveErrorDeg':r['armErrorDeg'],'wristArchiveErrorMm':r['wristPathErrorMm']}
    result['torsoExcursionDeg']={k:span([x[k] for x in a]) for k in ['chestYaw','hipYaw','relativeYaw']}
    result['sourceExcursionDeg']={k:span([x['source'][k] for x in a]) for k in ['chestYawDeg','hipYawDeg','relativeYawDeg']}
    result['floorMinMm']=min(x['legs'][s]['minY'] for x in a for s in ['r','l'])*1000
    result['arm']={k:{'min':min(x['arms']['r'][k] for x in a),'max':max(x['arms']['r'][k] for x in a)} for k in ['swing','outward','elbow','wristBend']}
    result['earlySupport']={}
    for s in ['r','l']:
        shift=.5 if s=='l' else 0
        early=[x for x in r['support'][s] if x['t']<.38+shift]
        points=[x['legs'][s]['earlyContactPoint'] for x in early]
        seg=near_segments(early,s,'earlyContactPoint')
        event=a[280+(500 if s=='l' else 0)]
        inward=(event['bones']['foot_'+s][0]-event['bones']['thigh_'+s][0])*(1 if s=='r' else -1)*1000
        result['earlySupport'][s]={'vertex':r['earlyIds'][s],'nearSegments':seg,'nearPathMm':sum(x['pathMm'] for x in seg),
                                  'xSpanMm':span([p[0] for p in points])*1000,'zSpanMm':span([p[2] for p in points])*1000,
                                  'heightMm':[min(p[1] for p in points)*1000,max(p[1] for p in points)*1000],
                                  'ankleInwardFromHipAt28pctMm':inward}
    result['releaseKneeDeg']={str(t):a[round(t*1000)]['legs']['r']['knee'] for t in [.55,.58,.61,.64,.68,.72]}
    old=next(v for v in archive['results'] if v['model']==r['model'])
    result['m68KneeArchiveDifferenceDeg']=max(abs(x['legs'][s]['knee']-old['cycle'][i][s]['kneeAfter']) for i,x in enumerate(a) for s in ['r','l'])
    summary['models'].append(result)
(root/'docs/05-validation/reports/cmu-full-run-review-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

im,d=canvas((1440,995),'현재 전신 동작 / 달리기는 보이지만, 자연스러움은 아직 검토 중',
            'M72 관찰 · M71 실제 화면 · 남성형 한 주기 / 동작 변경 없음 / 정상 러닝 판정 아님')
for row,view in enumerate(['front','side']):
    y=120+row*405
    d.text((25,y),'정면' if row==0 else '측면',font=font(22),fill=ink)
    for i,t in enumerate([0,167,333,500,667,833]):
        x=15+i*238
        d.text((x+82,y+30),f'{t/10:g}%',font=font(19),fill=muted)
        photo(im,raw/f'male-{view}-{t}.png',(x,y+60,232,330))
d.text((30,945),'유지할 개선: 양쪽 대응 · 손목 연결 · 팔 앞뒤 움직임 / 우선 점검: 착지 초반과 발을 뗀 뒤의 연결',font=font(21),fill=ink)
im.save(out/'cmu-full-run-review-sequence.png')

im,d=canvas((1440,925),'우선순위 1 / 착지 초반에 남은 지면 이동',
            '검증 완료: 동일 피부점 추적 · 주황 오른발 / 파랑 왼발(반 주기 정렬) · 1mm 이내 구간만 이동 합산')
# Draw a timing diagram using actual existing constants, not normative gait events.
x0=160;x1=1360;left=.28;right=.68
xx=lambda t:x0+(t-left)/(right-left)*(x1-x0)
for lo,hi,label,col in [(.28,.38,'현재 고정 범위 밖','#e4b79e'),(.38,.43,'진입 연결','#eed9bc'),(.43,.55,'수평 지지점 고정','#a8c9b6'),(.55,.68,'해제·회수 연결','#b5d6df')]:
    d.rectangle((xx(lo),125,xx(hi),173),fill=col);d.text((xx(lo)+8,136),label,font=font(18),fill=ink)
for t in [.28,.38,.43,.55,.68]:d.text((xx(t)-17,182),str(round(t*100))+'%',font=font(17),fill=muted)
d.text((30,222),'발은 약 28%부터 바닥 가까이에 있지만, 기존 고정 계산은 38%부터 시작합니다.',font=font(22),fill=ink)
for mi,r in enumerate(report['results']):
    x=90+mi*700;y=330;w=560;h=265
    d.text((x-30,280),'남성형' if mi==0 else '여성형',font=font(24),fill=ink)
    # Displacement relative to that foot at 28% on the world ground plane.
    for value in [-20,-10,0,10,20,30]:
        yy=y+h-(value+20)/50*h
        d.line((x,yy,x+w,yy),fill=grid);d.text((x-38,yy-10),str(value),font=font(16),fill=muted)
    for side,col in [('r',orange),('l',blue)]:
        shift=.5 if side=='l' else 0
        rows=[f for f in r['support'][side] if f['t']<.38+shift]
        start=rows[0]['legs'][side]['earlyContactPoint']
        # Separate x (solid) and z (small dots) to expose backtracking.
        for dim in [0,2]:
            pts=[(x+(f['t']-shift-.28)/.10*w,y+h-((f['legs'][side]['earlyContactPoint'][dim]-start[dim])*1000+20)/50*h) for f in rows]
            if dim==0:d.line(pts,fill=col,width=3)
            else:
                for px,py in pts[::3]:d.ellipse((px-2,py-2,px+2,py+2),fill=col)
    for t in [28,30,32,34,36,38]:d.text((x+(t-28)/10*w-10,y+h+10),str(t),font=font(16),fill=muted)
    d.text((x,y+h+40),'주기(%) / 수평 변위(mm) · 실선 좌우 / 점선 앞뒤',font=font(17),fill=muted)
    s=summary['models'][mi]['earlySupport']
    d.text((x-25,690),f"지면 1mm 이내 누적 경로: {s['r']['nearPathMm']:.1f} / {s['l']['nearPathMm']:.1f}mm",font=font(23),fill=ink)
    d.text((x-25,736),f"28% 발목의 고관절 대비 안쪽 위치: {s['r']['ankleInwardFromHipAt28pctMm']:.1f}mm",font=font(20),fill=muted)
d.text((30,803),'관찰: 바닥 가까이 있는 발의 재질점이 움직입니다. 누적 경로는 한쪽으로 밀린 거리와 다릅니다.',font=font(21),fill=ink)
d.text((30,848),'제안·미구현: 착지 초반 지지점과 고관절–무릎–발 연결부터 비교 / 안쪽 위치는 기존 요구와의 차이이며 의학적 판정 아님',font=font(18),fill=muted)
im.save(out/'cmu-full-run-review-contact.png')

im,d=canvas((1440,910),'우선순위 2 / 발을 뗀 뒤 무릎 굽힘이 잠시 둔해집니다',
            'M71 실제 측면 · 오른발 / 왼발은 반 주기 뒤 대응 · 현재 M68 굽힘 곡선을 그대로 사용 중')
for i,t in enumerate([55,58,61,64,68,72]):
    x=15+i*238
    d.text((x+85,117),f'{t}%',font=font(20),fill=muted)
    p=Image.open(raw/f'release-side-{t}.png').crop((40,300,520,680))
    p.thumbnail((225,220));im.paste(p,(x+(232-p.width)//2,152))
    k=report['results'][0]['rows'][t*10]['legs']['r']['knee']
    d.text((x+65,382),f'굽힘 {k:.1f}°',font=font(19),fill=ink)
x=110;y=470;w=1180;h=250
px=lambda t:x+(t-.55)/.2*w
py=lambda v:y+h-(v-30)/40*h
d.rectangle((px(.58),y,px(.64),y+h),fill='#eadbca')
for v in [30,40,50,60,70]:
    d.line((x,py(v),x+w,py(v)),fill=grid);d.text((x-45,py(v)-10),str(v),font=font(17),fill=muted)
for mi,r in enumerate(report['results']):
    rows=[f for f in r['rows'] if .55<=f['t']<=.75]
    d.line([(px(f['t']),py(f['legs']['r']['knee'])) for f in rows],fill=orange if mi==0 else blue,width=4)
for t in [.55,.58,.61,.64,.68,.72,.75]:d.text((px(t)-12,y+h+12),str(round(t*100)),font=font(17),fill=muted)
d.text((160,441),'현재 무릎 굽힘(°) · 주황 남성형 / 파랑 여성형',font=font(20),fill=ink)
d.text((150,490),'58–64% 약 45.5ms / 굽힘 증가 1.1–1.3°',font=font(22),fill=ink)
d.text((150,530),'그 뒤 64–72% 약 60.7ms / 약 18.8–18.9° 증가',font=font(20),fill=muted)
d.text((30,801),'관찰: 역방향 굽힘은 없지만, 거의 같은 굽힘으로 올라갔다가 뒤늦게 접히는 연결이 남아 있습니다.',font=font(21),fill=ink)
d.text((30,846),'제안·미구현: 해제 곡선의 속도 분포 비교 / 지연 구간이 정상 범위를 벗어난다는 임상적 판단은 하지 않습니다.',font=font(18),fill=muted)
im.save(out/'cmu-full-run-review-release.png')

im,d=canvas((1440,660),'몸통은 연결되어 있습니다 / 팔·손의 고정된 모양은 후순위',
            '실제 측정과 시각적 인상을 구분합니다. 몸통 흔들림을 추가하는 제안은 보류합니다.')
r=report['results'][0];a=r['rows'];x=95;y=190;w=660;h=285
for v in [-15,0,15]:
    yy=y+h-(v+15)/30*h;d.line((x,yy,x+w,yy),fill=grid);d.text((x-36,yy-10),str(v),font=font(17),fill=muted)
for key,col in [('chestYaw',orange),('hipYaw',blue)]:
    d.line([(x+f['t']*w,y+h-(f[key]+15)/30*h) for f in a],fill=col,width=3)
d.text((95,130),'주황 어깨선 / 파랑 고관절선 · 수평 방향각(°)',font=font(21),fill=ink)
for t in [0,.25,.5,.75,1]:d.text((x+t*w-12,y+h+12),str(round(t*100)),font=font(17),fill=muted)
d.text((95,530),'회전 폭: 현재 21.17° / 14.25°',font=font(23),fill=ink)
d.text((95,570),'35_17 기준 21.52° / 14.41° · 동일한 회전 곡선이라는 뜻은 아님',font=font(17),fill=muted)
for yi,title,sub in [
    (145,'팔 앞뒤 움직임 유지','양쪽 범위 34.21° / M70 저장 결과와 일치'),
    (260,'팔꿈치·팔의 옆 각도는 단조로움','굽힘 범위 11.26° / 옆 벌림 약 14°로 일정'),
    (375,'손목과 손가락은 고정된 모양','큰 꺾임은 개선 / 손가락 간격·엄지 외형은 후순위')
]:
    d.rounded_rectangle((820,yi-10,1400,yi+84),radius=15,fill='#e8ede7')
    d.text((840,yi),title,font=font(23),fill=ink);d.text((840,yi+42),sub,font=font(18),fill=muted)
d.text((820,520),'제안: 원본 팔꿈치·옆 방향 전달부터 확인',font=font(22),fill=ink)
d.text((820,560),'숫자가 작다는 이유만으로 진폭을 늘리지는 않음',font=font(18),fill=muted)
im.save(out/'cmu-full-run-review-upper.png')
print(json.dumps(summary,ensure_ascii=False,indent=2))
