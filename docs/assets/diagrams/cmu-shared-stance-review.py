"""M65 read-only review: measured geometry and actual frames, no target poses."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-shared-stance-review.json').read_text())
support=json.loads((root/'docs/05-validation/reports/cmu-shared-support-point.json').read_text())
layers=json.loads((root/'docs/05-validation/reports/cmu-shared-stance-layers.json').read_text())
assert report['status']=='observation-complete'
out=root/'docs/assets/images';font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';orange='#b96540';blue='#1687ad';green='#25816d'
diff=lambda a,b:[x-y for x,y in zip(a,b)]
span=lambda xs:max(xs)-min(xs)
def near(rows,t):return min(rows,key=lambda r:abs(r['phase']-t))
def runs(rows,side,patch,tol,seconds):
    groups=[];active=[]
    for p,q in zip(rows,rows[1:]):
        a,b=p['feet'][side][patch],q['feet'][side][patch]
        if a['minY']<=tol and b['minY']<=tol:
            dxz=[b['mean'][k]-a['mean'][k] for k in [0,2]]
            active.append((p,q,math.hypot(*dxz)))
        elif active:groups.append(active);active=[]
    if active:groups.append(active)
    return [{'start':g[0][0]['phase'],'end':g[-1][1]['phase'],'pathMm':sum(s[2] for s in g)*1000,
             'netXZmm':[1000*(g[-1][1]['feet'][side][patch]['mean'][k]-g[0][0]['feet'][side][patch]['mean'][k]) for k in [0,2]],
             'durationMs':1000*(g[-1][1]['phase']-g[0][0]['phase'])*seconds} for g in groups]
summary={'scope':'Geometry only; pelvis is not COM; stages are existing authored intervals, not force-detected events','results':[]}
for result in report['results']:
    m={'model':result['model'],'seconds':result['seconds'],'travel':result['travel'],'stages':{},'sides':{},
       'preservedStanceMm':result['preservedStanceMm'],'runtimeUnchanged':True}
    for side in ['r','l']:
        shift=.5 if side=='l' else 0;rows=[r for r in result['stance'][side] if .28+shift-1e-9<=r['phase']<=.58+shift+1e-9]
        knees=[r['feet'][side]['kneeDeg'] for r in rows];high=max(rows,key=lambda r:r['feet'][side]['kneeDeg'])
        low=min(rows,key=lambda r:r['feet'][side]['kneeDeg'])
        pmin=min(rows,key=lambda r:r['bones']['pelvis'][1]);pmax=max(rows,key=lambda r:r['bones']['pelvis'][1])
        m['sides'][side]={'kneeMinDeg':min(knees),'kneeMaxDeg':max(knees),'kneeMaxPhase':high['phase'],'kneeMinPhase':low['phase'],
            'pelvisMinPhase':pmin['phase'],'pelvisMaxPhase':pmax['phase'],'pelvisRangeMm':span([r['bones']['pelvis'][1] for r in rows])*1000,
            'effectiveLegRangeMm':span([r['feet'][side]['legLength'] for r in rows])*1000,
            'inwardSoleRangeMm':[min(r['feet'][side]['inwardMm'] for r in rows),max(r['feet'][side]['inwardMm'] for r in rows)],
            'nearGround':{p:{str(mm):runs(result['stance'][side],side,p,mm/1000,result['seconds']) for mm in [1,5,10]} for p in ['heel','toe']}}
        m['stages'][side]=[]
        for t in [.28,.34,.43,.50,.56,.58]:
            r=near(result['stance'][side],t+shift);f=r['feet'][side];H=r['bones']['thigh_'+side];P=r['bones']['pelvis']
            m['stages'][side].append({'phase':r['phase'],'nominal':t+shift,'kneeDeg':f['kneeDeg'],
                'pelvisYmm':P[1]*1000,'legMm':f['legLength']*1000,'soleInwardMm':f['inwardMm'],'ankleInwardMm':f['ankleInwardMm'],
                'soleAheadOfHipMm':(f['sole']['mean'][2]-H[2])*1000,
                'heelMinYmm':f['heel']['minY']*1000,'toeMinYmm':f['toe']['minY']*1000,
                'heelMeanYmm':f['heel']['mean'][1]*1000,'toeMeanYmm':f['toe']['mean'][1]*1000,
                'surfaceMinYmm':f['minY']*1000,'solePitchDeg':f['solePitchDeg']})
    summary['results'].append(m)
for m in summary['results']:
    layer=next(r for r in layers['results'] if r['model']==m['model'])
    def path_mm(rows,key):
        return 1000*sum(math.hypot(b[key][0]-a[key][0],b[key][2]-a[key][2]) for a,b in zip(rows,rows[1:]))
    m['layerPoint']=layer['vertex'];m['layerPathMm']={}
    for name,rows in layer['layers'].items():
        m['layerPathMm'][name]=path_mm([r for r in rows if .43-1e-8<=r['phase']<=.58+1e-8],'point')
    m['floorToCurrentXZmm']=max(1000*math.hypot(a['point'][0]-b['point'][0],a['point'][2]-b['point'][2]) for a,b in zip(layer['layers']['sharedFloor'],layer['layers']['currentM64']))
    m['fixedPointNearGround']=[]
    sr=next(r for r in support['results'] if r['model']==m['model'])
    for p in sr['points']:
        if abs(p['selectedAt']-(.5 if p['side']=='r' else 1))>1e-8:continue
        groups=[];active=[]
        for a,b in zip(p['rows'],p['rows'][1:]):
            if max(a['p'][1],b['p'][1])<=.001:
                if not active:active.append(a)
                active.append(b)
            elif active:groups.append(active);active=[]
        if active:groups.append(active)
        run=max(groups,key=lambda g:g[-1]['t']-g[0]['t'])
        m['fixedPointNearGround'].append({'side':p['side'],'vertex':p['vertex'],'start':run[0]['t'],'end':run[-1]['t'],
            'pathMm':path_mm(run,'p'),'durationMs':(run[-1]['t']-run[0]['t'])*sr['seconds']*1000,
            'heightRangeMm':[min(r['p'][1] for r in run)*1000,max(r['p'][1] for r in run)*1000]})
(root/'docs/05-validation/reports/cmu-shared-stance-review-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps([{k:m[k] for k in ['model','layerPathMm','fixedPointNearGround']} for m in summary['results']],ensure_ascii=False,indent=2))

# Same M64 model, phase progression; annotated coordinates come from rendering.
img=Image.new('RGB',(1540,1190),bg);d=ImageDraw.Draw(img)
d.text((28,18),'착지 → 지지 → 이탈 · 현재 동작을 그대로 검토',font=font(31),fill=ink)
d.text((28,65),'M65 관찰 완료 / 보정 없음 · 남성형 M64 실제 화면 · 기존 구간을 나눈 관찰용 단계',font=font(21),fill=muted)
phases=[.28,.34,.43,.50,.58];labels=['착지 부근','초기 지지','중간 지지','후반 지지','이탈 부근']
result=report['results'][0]
for row,view in enumerate(['front','side']):
    y=110+row*510
    for i,t in enumerate(phases):
        x=20+i*303;photo=Image.open(root/f'outputs/cmu-shared-stance-review/male-{view}-{round(t*100)}.png').convert('RGB')
        c=next(c for c in result['captures'] if c['phase']==t and c['view']==view);pd=ImageDraw.Draw(photo);pts=c['projected']
        if view=='front':
            h,g=pts['thigh_r'],pts['hipGround_r']
            pd.line((h[0],h[1],g[0],g[1]),fill=blue,width=2)
        chain=[pts[n+'_r'] for n in ['thigh','calf','foot','ball']]
        pd.line([tuple(p) for p in chain],fill=orange,width=3)
        for px,py in chain:pd.ellipse((px-4,py-4,px+4,py+4),fill=orange)
        photo=photo.resize((294,370));img.paste(photo,(x,y+42))
        d.text((x+22,y),labels[i]+f' {t:.0%}',font=font(21),fill=ink)
        stage=summary['results'][0]['stages']['r'][[0,1,2,3,5][i]]
        text=f"발바닥 안쪽 {stage['soleInwardMm']:.0f}mm" if view=='front' else f"무릎 굽힘 {stage['kneeDeg']:.1f}°"
        d.text((x+25,y+425),text,font=font(20),fill=ink)
d.text((28,1137),'주황: 오른다리 실제 관절 · 파랑: 같은 쪽 고관절 수직선(위치 비교용, 정답 착지선 아님)',font=font(20),fill=muted)
img.save(out/'cmu-shared-stance-review-sequence.png')

def panel(draw,rect,title,series,xrange,yrange,unit):
    x,y,w,h=rect;lo,hi=yrange;start,end=xrange
    draw.text((x,y-48),title,font=font(22),fill=ink)
    draw.text((x-52,y-20),unit,font=font(16),fill=muted)
    for j in range(5):
        v=lo+(hi-lo)*j/4;yy=y+h-j*h/4
        draw.line((x,yy,x+w,yy),fill='#d5ded5');draw.text((x-53,yy-9),f'{v:.0f}',font=font(15),fill=muted)
    for pairs,color in series:
        draw.line([(x+(t-start)/(end-start)*w,y+h-(v-lo)/(hi-lo)*h) for t,v in pairs],fill=color,width=4)
    for j in range(6):
        t=start+(end-start)*j/5
        draw.text((x+j*w/5-14,y+h+12),f'{t*100:.0f}',font=font(16),fill=muted)

# Correct the prior visual impression: flexion/extension DOES exist.
img=Image.new('RGB',(1320,850),bg);d=ImageDraw.Draw(img)
d.text((28,20),'무릎이 안 굽는 것이 원인은 아닙니다',font=font(30),fill=ink)
d.text((28,66),'현재 M64 관찰 · 오른발 28~58% / 주황 남성형 · 파랑 여성형 / 가로축 한 주기 %',font=font(20),fill=muted)
lines=[];height=[]
for r,color in zip(report['results'],[orange,blue]):
    rows=[v for v in r['stance']['r'] if .28<=v['phase']<=.58]
    lines.append(([(v['phase'],v['feet']['r']['kneeDeg']) for v in rows],color))
    base=rows[0]['bones']['pelvis'][1]
    height.append(([(v['phase'],1000*(v['bones']['pelvis'][1]-base)) for v in rows],color))
panel(d,(85,175,520,340),'무릎 굽힘',lines,(.28,.58),(20,60),'°')
panel(d,(765,175,520,340),'골반 높이 · 관찰 시작 대비',height,(.28,.58),(-40,60),'mm')
d.rounded_rectangle((28,600,1290,790),16,fill='#e4ede5')
d.text((48,617),'남성형: 착지 부근 41.7° → 약 41%에서 51.7° → 약 52%에서 23.6°',font=font(23),fill=ink)
d.text((48,662),'무릎 굽힘이 커지는 때 골반도 낮아지고, 이후 다리가 펴지며 골반이 올라갑니다.',font=font(22),fill=ink)
d.text((48,713),'다만 골반은 실제 무게중심이 아닙니다. 이 곡선만으로 체중 지지·추진력을 검증할 수 없습니다.',font=font(19),fill=muted)
d.text((28,812),'판정: 굽힘/펴짐 연결은 확인 · 정상 각도나 최적 자세 판정은 하지 않음',font=font(19),fill=muted)
img.save(out/'cmu-shared-stance-review-knee.png')

# Same material point and time interval across computation layers.
img=Image.new('RGB',(1380,1020),bg);d=ImageDraw.Draw(img)
d.text((28,20),'지지 후반 발끝 이동은 어느 단계에서 늘었나',font=font(30),fill=ink)
d.text((28,66),'같은 오른발 피부 점 · 주기 43~58% · 지면 X/Z 누적 경로 · 모든 단계에 같은 피부 가중치',font=font(20),fill=muted)
labels=[('cachedM56','공통화 전 저장 M56'),('sharedCore','공통 골반·다리 M58'),('currentM64','현재 M64')]
for col,m in enumerate(summary['results']):
    x=35+690*col;d.text((x,125),'남성형' if col==0 else '여성형',font=font(25),fill=ink)
    for j,(key,label) in enumerate(labels):
        y=180+j*85;value=m['layerPathMm'][key]
        d.text((x,y),label,font=font(21),fill=ink)
        d.rounded_rectangle((x+250,y,x+250+value/80*310,y+32),7,fill=green if j==0 else orange)
        d.text((x+250+value/80*310+12,y),f'{value:.1f}mm',font=font(20),fill=ink)
    d.text((x,465),f"추적 정점: {m['layerPoint']['mesh']} / {m['layerPoint']['id']}",font=font(18),fill=muted)
d.rounded_rectangle((28,525,1350,710),16,fill='#e4ede5')
d.text((48,545),'확인된 범위: 좌우 공통 골반·다리 재구성 단계에서 수평 이동 증가',font=font(25),fill=ink)
d.text((48,592),'이후 지면 높이 보정과 현재 접근 경로 보정은 이 구간의 수평 경로를 바꾸지 않습니다.',font=font(21),fill=ink)
d.text((48,637),'저장 M56도 가공된 동작입니다. 원시 실측과의 비교 또는 실제 마찰력 검사는 아닙니다.',font=font(19),fill=muted)
d.text((28,750),'구역 평균이 아닌 같은 피부 점 하나도 지면 1mm 이내에서 이동',font=font(24),fill=ink)
for col,m in enumerate(summary['results']):
    p=next(p for p in m['fixedPointNearGround'] if p['side']=='r');x=35+690*col
    d.text((x,806),f"{'남성형' if col==0 else '여성형'}: {p['start']:.1%}~{p['end']:.1%}",font=font(23),fill=ink)
    d.text((x,852),f"{p['durationMs']:.1f}ms 동안 {p['pathMm']:.1f}mm 이동",font=font(24),fill=orange)
d.text((28,927),'높이 1mm는 기하 관찰 기준입니다. 실제 접촉·미끄러짐의 물리적 판정과는 구분합니다.',font=font(20),fill=muted)
d.text((28,973),'다음 수정 제안: 공통 동작 재구성 뒤 지지점 제약을 재검토 · 이번에는 동작을 수정하지 않음',font=font(20),fill=ink)
img.save(out/'cmu-shared-stance-review-cause.png')
