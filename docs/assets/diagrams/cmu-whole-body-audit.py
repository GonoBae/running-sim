"""M59: figures from unmodified browser poses; no generated anatomy."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
data=json.loads((root/'docs/05-validation/reports/cmu-whole-body-audit.json').read_text())
out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';orange='#b96540';blue='#1687ad'
sub=lambda a,b:[x-y for x,y in zip(a,b)]
length=lambda p:math.sqrt(sum(x*x for x in p))
def flex(a,b,c):
    u,v=sub(a,b),sub(c,b)
    return 180-math.degrees(math.acos(max(-1,min(1,sum(x*y for x,y in zip(u,v))/length(u)/length(v)))))
def span(v):return max(v)-min(v)
def corr(a,b):
    aa=[x-sum(a)/len(a) for x in a];bb=[x-sum(b)/len(b) for x in b]
    return sum(x*y for x,y in zip(aa,bb))/length(aa)/length(bb)
summary={'scope':'Model geometry, not measured human force or clinical ranges','results':[]}
for result in data['results']:
    rows=result['rows'];seconds=result['seconds'];dt=seconds/364
    for row in rows:
        b=row['bones'];mid=[(x+y)/2 for x,y in zip(b['thigh_r'],b['thigh_l'])]
        torso=sub(b['neck_01'],mid);shoulders=sub(b['upperarm_l'],b['upperarm_r'])
        row['metrics']={'lean':math.degrees(math.atan2(torso[2],torso[1])),
                        'lateralLean':math.degrees(math.atan2(torso[0],torso[1])),
                        'shoulderTilt':math.degrees(math.atan2(shoulders[1],abs(shoulders[0]))),
                        'shoulderYaw':math.degrees(math.atan2(-shoulders[2],shoulders[0]))}
        for s in ['r','l']:
            for key,n1,n2,n3 in [('elbow','upperarm','lowerarm','hand'),('knee','thigh','calf','foot')]:
                row['metrics'][key+'_'+s]=flex(*[b[n+'_'+s] for n in [n1,n2,n3]])
            for key,n1,n2 in [('armSwing','upperarm','lowerarm'),('thighSwing','thigh','calf')]:
                u=sub(b[n2+'_'+s],b[n1+'_'+s])
                row['metrics'][key+'_'+s]=math.degrees(math.atan2(u[2],-u[1]))
    m={'model':result['model'],'poseErrorMm':result['poseErrorMm'],'seconds':seconds,'cadenceFromCycle':120/seconds}
    vals=lambda k:[r['metrics'][k] for r in rows[:-1]]
    for key in ['lean','lateralLean','shoulderTilt','shoulderYaw','elbow_r','elbow_l','knee_r','knee_l','armSwing_r','armSwing_l']:
        v=vals(key);m[key]={'min':min(v),'max':max(v),'range':span(v)}
    for ax,name in [(0,'pelvisLateralResidualMm'),(1,'pelvisVerticalMm'),(2,'pelvisForwardResidualMm')]:
        delta=rows[-1]['bones']['pelvis'][ax]-rows[0]['bones']['pelvis'][ax]
        m[name]=span([r['bones']['pelvis'][ax]-delta*r['phase'] for r in rows])*1000
    m['pelvisVerticalActualMm']=span([r['bones']['pelvis'][1] for r in rows])*1000
    # Decompose the observed secondary rise: final Y = core Y + heightShift.
    detail=result['heightDetail']
    lo=min(range(121),key=lambda i:detail[i]['y'])
    hi=max(range(lo,len(detail)),key=lambda i:detail[i]['y'])
    m['secondaryRise']={'start':detail[lo]['phase'],'end':detail[hi]['phase'],
        'durationMs':(detail[hi]['phase']-detail[lo]['phase'])*seconds*1000,
        'finalRiseMm':(detail[hi]['y']-detail[lo]['y'])*1000,
        'correctionRiseMm':(detail[hi]['shift']-detail[lo]['shift'])*1000,
        'halfCycleHeightGapMm':max(abs(r['y']-r['halfY'])*1000 for r in detail)}
    m['secondaryRise']['coreRiseMm']=m['secondaryRise']['finalRiseMm']-m['secondaryRise']['correctionRiseMm']
    m['armLegSameSideCorrelation']={s:corr(vals('armSwing_'+s),vals('thighSwing_'+s)) for s in ['r','l']}
    m['elbowHalfCycleGapDeg']=max(abs(rows[i]['metrics']['elbow_r']-rows[(i+182)%364]['metrics']['elbow_l']) for i in range(364))
    m['armSwingHalfCycleGapDeg']=max(abs(rows[i]['metrics']['armSwing_r']-rows[(i+182)%364]['metrics']['armSwing_l']) for i in range(364))
    m['upperMirrorGapMm']={}
    for part in ['upperarm','lowerarm','hand']:
        gaps=[]
        for i in range(364):
            r,l=rows[i],rows[(i+182)%364]
            rp=sub(r['bones'][part+'_r'],r['bones']['pelvis']);lp=sub(l['bones'][part+'_l'],l['bones']['pelvis']);lp[0]*=-1
            gaps.append(length(sub(rp,lp))*1000)
        m['upperMirrorGapMm'][part]=max(gaps)
    # Track the SAME neutral-selected skin patch across frames. A changing low
    # surface centroid cannot distinguish rolling from tangential sliding.
    m['nearGround']={}
    for s in ['r','l']:
        m['nearGround'][s]={}
        for patch in ['heel','toe']:
            per={}
            for tol in [.001,.005,.010]:
                runs=[];active=[]
                for i in range(364):
                    p,q=rows[i]['feet'][s][patch],rows[i+1]['feet'][s][patch]
                    if p['minY']<=tol and q['minY']<=tol:
                        delta=sub(q['mean'],p['mean']);speed=math.hypot(delta[0],delta[2])/dt
                        active.append({'index':i,'speed':speed,'distanceMm':speed*dt*1000})
                    elif active:runs.append(active);active=[]
                if active:runs.append(active)
                per[str(round(tol*1000))]=[{
                    'start':run[0]['index']/364,'end':(run[-1]['index']+1)/364,
                    'pathMm':sum(v['distanceMm'] for v in run),'maxSpeedMps':max(v['speed'] for v in run),
                    'netXZmm':[1000*(rows[run[-1]['index']+1]['feet'][s][patch]['mean'][k]-rows[run[0]['index']]['feet'][s][patch]['mean'][k]) for k in [0,2]]
                } for run in runs]
            m['nearGround'][s][patch]=per
    m['airborneFractionAt5mm']=sum(min(r['feet'][s]['surfaceMin'] for s in ['r','l'])>.005 for r in rows[:-1])/364
    summary['results'].append(m)
(root/'docs/05-validation/reports/cmu-whole-body-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')

# Actual captured M58, current model only. Each view shares the same camera.
img=Image.new('RGB',(1480,1110),bg);d=ImageDraw.Draw(img)
d.text((28,18),'M59 · 전신 검토 — 현재 동작 그대로',font=font(31),fill=ink)
d.text((28,66),'남성형 실제 화면 · 35_17 가공 M58 · 보정 없음 · 발목은 사용자 확인 완료',font=font(21),fill=muted)
for row,view in enumerate(['front','side']):
    y=112+row*478
    d.text((28,y),'정면' if view=='front' else '측면',font=font(23),fill=ink)
    for i,phase in enumerate([.28,.43,.64,.78,.93]):
        photo=Image.open(root/f"outputs/cmu-whole-body-audit/male-{view}-{round(phase*100)}.png")
        photo=photo.resize((286,344))
        x=20+i*290;img.paste(photo,(x,y+43))
        d.text((x+95,y+399),f'{phase:.0%}',font=font(22),fill=ink)
d.text((28,1070),'주기 위치 표시입니다. 실제 착지·지지 시점은 접촉력 없이 확정할 수 없습니다.',font=font(19),fill=muted)
img.save(out/'cmu-whole-body-sequence.png')

# Overlay actual body geometry for matching stages; no invented target pose.
img=Image.new('RGB',(1320,690),bg);d=ImageDraw.Draw(img)
d.text((28,20),'하체가 같아져도 상체까지 같아진 것은 아닙니다',font=font(30),fill=ink)
d.text((28,66),'남성형 측면 좌표 · 골반 정렬 · 주황 오른쪽 / 파랑 반 주기 뒤 왼쪽',font=font(20),fill=muted)
r=data['results'][0]
for i,phase in enumerate([.03,.28,.43,.64]):
    idx=round(phase*364);x=100+i*308;top=185
    d.text((x-10,120),f'{phase:.0%} ↔ {(phase+.5)%1:.0%}',font=font(22),fill=ink)
    for side,j,color,width in [('r',idx,orange,7),('l',(idx+182)%364,blue,3)]:
        b=r['rows'][j]['bones'];P=b['pelvis']
        xy=lambda n:(x+100+(b[n][2]-P[2])*270,top-(b[n][1]-P[1])*270+130)
        for chain in [[f'upperarm_{side}',f'lowerarm_{side}',f'hand_{side}'],[f'thigh_{side}',f'calf_{side}',f'foot_{side}',f'ball_{side}'],['neck_01','pelvis']]:
            ps=[xy(n) for n in chain];d.line(ps,fill=color,width=width)
            for px,py in ps:d.ellipse((px-4,py-4,px+4,py+4),fill=color)
d.text((28,604),'같은 단계의 팔꿈치 굽힘 차이 최대 '+f"{summary['results'][0]['elbowHalfCycleGapDeg']:.1f}°",font=font(23),fill=ink)
d.text((28,650),'관찰 결과: 팔의 좌우 진폭·모양이 남아 있습니다. 전신 완전 대칭이 정답이라는 뜻은 아닙니다.',font=font(19),fill=muted)
img.save(out/'cmu-whole-body-upper.png')

def panel(draw,rect,title,series,yrange,unit):
    x,y,w,h=rect;draw.text((x,y-39),title,font=font(22),fill=ink)
    lo,hi=yrange
    for j in range(5):
        v=lo+(hi-lo)*j/4;yy=y+h-j*h/4
        draw.line((x,yy,x+w,yy),fill='#d5ded5');draw.text((x-58,yy-10),f'{v:.0f}',font=font(15),fill=muted)
    draw.text((x-55,y-35),unit,font=font(16),fill=muted)
    for values,color in series:
        draw.line([(x+i/(len(values)-1)*w,y+h-(v-lo)/(hi-lo)*h) for i,v in enumerate(values)],fill=color,width=3)
    for j in range(5):draw.text((x+j*w/4-10,y+h+8),str(j*25),font=font(16),fill=muted)
img=Image.new('RGB',(1380,950),bg);d=ImageDraw.Draw(img)
d.text((28,18),'전신 주기 측정 · 원인과 정상 여부는 분리합니다',font=font(30),fill=ink)
d.text((28,66),'남성형 모델 좌표 · 가로축 한 주기 % · 주황 오른쪽 / 파랑 왼쪽',font=font(20),fill=muted)
rows=data['results'][0]['rows'];m=summary['results'][0]
panel(d,(85,160,550,250),'팔과 다리의 앞뒤 방향',[
 ([r['metrics']['armSwing_r'] for r in rows],orange),
 ([r['metrics']['thighSwing_r'] for r in rows],blue)],(-80,80),'°')
d.text((90,455),'이 그래프만: 주황 오른팔 / 파랑 오른다리',font=font(17),fill=muted)
panel(d,(785,160,550,250),'팔꿈치 굽힘',[
 ([r['metrics']['elbow_r'] for r in rows],orange),
 ([rows[(i+182)%364]['metrics']['elbow_l'] for i in range(365)],blue)],(50,130),'°')
d.text((790,455),'왼팔은 반 주기 이동하여 같은 단계로 비교',font=font(17),fill=muted)
pelvis=[r['bones']['pelvis'][1]*1000 for r in rows];pmin=min(pelvis)
panel(d,(85,580,550,235),'골반 높이 변화 · 최저점을 0으로',[
 ([v-pmin for v in pelvis],ink)],(0,max(120,math.ceil(span(pelvis)/20)*20)),'mm')
panel(d,(785,580,550,235),'상체 전후 기울기 · 고관절 중점→목',[
 ([r['metrics']['lean'] for r in rows],ink)],(-10,30),'°')
d.text((28,888),f"상하 이동 {m['pelvisVerticalActualMm']:.1f}mm · 좌우 잔여 이동 폭 {m['pelvisLateralResidualMm']:.1f}mm",font=font(22),fill=ink)
d.text((28,926),'수치가 크거나 작다는 이유만으로 교정하지 않습니다. 힘·균형·개인별 최적값은 측정하지 않았습니다.',font=font(18),fill=muted)
img.save(out/'cmu-whole-body-curves.png')

img=Image.new('RGB',(1360,880),bg);d=ImageDraw.Draw(img)
d.text((28,20),'먼저 볼 부분: 몸 높이에 짧은 추가 솟음이 있습니다',font=font(29),fill=ink)
d.text((28,65),'남성형 10~16% 구간 · 실제 골반 높이 = 공통 동작 높이 + 지면 높이 보정',font=font(20),fill=muted)
x,y,w,h=110,160,1120,300
samples=data['results'][0]['heightDetail'];base=samples[0]
series=[
 ([(r['y']-base['y'])*1000 for r in samples],ink,'최종 높이'),
 ([(r['y']-r['shift']-base['y']+base['shift'])*1000 for r in samples],blue,'지면 보정 전'),
 ([(r['shift']-base['shift'])*1000 for r in samples],orange,'지면 보정값')]
for value in [-20,-10,0,10,20]:
    yy=y+h-(value+20)/40*h;d.line((x,yy,x+w,yy),fill='#d5ded5');d.text((38,yy-12),str(value),font=font(18),fill=muted)
for values,color,label in series:
    d.line([(x+(r['phase']-.1)/.06*w,y+h-(v+20)/40*h) for r,v in zip(samples,values)],fill=color,width=4)
for value in range(10,17):d.text((x+(value-10)/6*w-12,y+h+10),str(value),font=font(18),fill=muted)
d.text((26,120),'mm',font=font(18),fill=muted);d.text((565,500),'한 주기 위치 (%)',font=font(19),fill=muted)
for xx,(_,color,label) in zip([110,465,855],series):
    d.line((xx,555,xx+35,555),fill=color,width=5);d.text((xx+48,540),label,font=font(21),fill=color)
for i,mm in enumerate(summary['results']):
    e=mm['secondaryRise'];name='남성형' if i==0 else '여성형'
    d.text((28,612+i*47),f"{name}: {e['durationMs']:.1f}ms 동안 최종 +{e['finalRiseMm']:.1f}mm = 동작 {e['coreRiseMm']:.1f}mm + 보정 {e['correctionRiseMm']:.1f}mm",font=font(23),fill=ink)
d.text((28,734),'확인: 하체 좌우 대칭과 별개로, 높이 보정값이 짧은 역방향 상승을 만듭니다.',font=font(22),fill=ink)
d.text((28,781),'제안: 발목 회전과 양발 동작을 유지하며, 이 높이 연결부터 작은 비교로 검토합니다.',font=font(21),fill=ink)
d.text((28,834),'현재 동작은 수정하지 않았습니다. 높이 보정 제거 시 지면 침투 가능성도 함께 검증해야 합니다.',font=font(18),fill=muted)
img.save(out/'cmu-whole-body-height.png')

img=Image.new('RGB',(1320,770),bg);d=ImageDraw.Draw(img)
d.text((28,20),'다음 검토: 지면 가까이에서 발 표면이 움직입니다',font=font(29),fill=ink)
d.text((28,66),'남성형 · 같은 발끝 피부 구역을 추적 · 높이 5mm 이내 구간 표시 · 접촉력 측정 아님',font=font(19),fill=muted)
top=math.ceil(max(r['feet'][s]['toe']['minY']*1000 for r in rows for s in ['r','l'])/20)*20
panel(d,(95,175,530,330),'발끝 구역 최저 높이',[
 ([r['feet'][s]['toe']['minY']*1000 for r in rows],color) for s,color in [('r',orange),('l',blue)]],(0,top),'mm')
# Plot the right toe path during the long near-ground interval, not end-to-end displacement.
run=max(m['nearGround']['r']['toe']['5'],key=lambda r:r['end']-r['start'])
subset=[r for r in rows if run['start']-1e-9<=r['phase']<=run['end']+1e-9]
p0=subset[0]['feet']['r']['toe']['mean']
xy=[((r['feet']['r']['toe']['mean'][0]-p0[0])*1000,(r['feet']['r']['toe']['mean'][2]-p0[2])*1000) for r in subset]
d.text((755,136),'같은 오른발끝 구역의 지면 궤적',font=font(22),fill=ink)
X,Y,W,H=760,190,480,295
for val in [-60,-40,-20,0,20]:
    xx=X+(val+60)/80*W;d.line((xx,Y,xx,Y+H),fill='#d5ded5');d.text((xx-14,Y+H+13),str(val),font=font(16),fill=muted)
for val in [-40,-20,0,20]:
    yy=Y+H-(val+40)/60*H;d.line((X,yy,X+W,yy),fill='#d5ded5');d.text((X-42,yy-10),str(val),font=font(16),fill=muted)
coords=[(X+(xx+60)/80*W,Y+H-(zz+40)/60*H) for xx,zz in xy];d.line(coords,fill=orange,width=4)
for point,color in [(coords[0],ink),(coords[-1],blue)]:
    xx,yy=point;d.ellipse((xx-6,yy-6,xx+6,yy+6),fill=color)
d.text((775,545),f"주기 {run['start']:.0%}~{run['end']:.0%} · 누적 이동 {run['pathMm']:.0f}mm",font=font(21),fill=ink)
d.text((775,580),'가로 좌우 / 세로 앞뒤 (mm) · 검정 시작 / 파랑 끝',font=font(16),fill=muted)
d.text((28,635),'동일 피부 구역의 이동은 확인했습니다. 접촉점의 구름·피부 변형·실제 미끄러짐은 분리 확인이 필요합니다.',font=font(20),fill=ink)
d.text((28,685),'1 / 5 / 10mm 조건을 함께 기록했습니다. 5mm는 관찰용 기준이며 실제 착지 판정값이 아닙니다.',font=font(19),fill=muted)
d.text((28,727),'우선순위 제안: 몸 높이 연결 → 접지점 이동 → 팔·상체 모양과 박자.',font=font(22),fill=ink)
img.save(out/'cmu-whole-body-contact.png')
print(json.dumps([{'model':r['model'],'secondaryRise':r['secondaryRise'],'elbowHalfCycleGapDeg':r['elbowHalfCycleGapDeg']} for r in summary['results']],ensure_ascii=False,indent=2))
