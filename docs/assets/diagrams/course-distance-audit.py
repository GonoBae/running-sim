"""M90 read-only independent distance audit; application geometry is not calibrated.
UI start recovered from observed SVG cx/cy on 2026-10-22, reverse, goal 5km.
Independent spherical lengths use atan2(cross, dot) of unit Earth vectors.
"""
from pathlib import Path
import json,math
R=Path(__file__).resolve().parents[3]
a=json.loads((R/'experiments/model-preview/public/courses/lotte-garden-c-v1.json').read_text(encoding='utf8'))
geo=a['geometry']['coordinates'];rad=math.pi/180;earth=6371008.8
def vector(p):
    lon,lat=[v*rad for v in p];return (math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat))
def distance(p,q):
    u,v=vector(p),vector(q);cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    return earth*math.atan2(math.hypot(*cross),sum(x*y for x,y in zip(u,v)))
def project(p):return ((p[0]-geo[0][0])*rad*earth*math.cos(geo[0][1]*rad),(p[1]-geo[0][1])*rad*earth)
local=list(map(project,geo));cum=[0]
for p,q in zip(geo,geo[1:]):cum.append(cum[-1]+distance(p,q))
length=cum[-1];start=1121.8640021884382
def point(s):
    s%=length
    for i in range(1,len(cum)):
        if s<=cum[i]:
            t=(s-cum[i-1])/(cum[i]-cum[i-1]);return tuple(u+(v-u)*t for u,v in zip(local[i-1],local[i]))
milestones=[{'km':k,'localEN':point(start-1000*k),'completedLaps':int(1000*k/length)} for k in range(1,6)]
corners={letter:cum[geo.index(l['coordinate'])] for letter,l in zip('ABCD',a['landmarks'])}
corner_comparison=[{'km':3,'corner':'B','distanceToCornerM':start-corners['B']+2*length},
                   {'km':4,'corner':'C','distanceToCornerM':start-corners['C']+3*length}]
for item in corner_comparison:item['currentMarkerBeforeCornerM']=item['distanceToCornerM']-item['km']*1000
app=json.loads((R/'docs/05-validation/reports/course-route-c.json').read_text(encoding='utf8'))['computedSphericalLengthM']
report={'status':'internal-distance-check-passed-field-match-unresolved','milestone':'M90','date':'2026-10-22',
 'method':'Independent 3D unit-vector central angle atan2(cross,dot); does not import application distance formula.',
 'assetRevision':a['revision'],'computedM':length,'applicationM':app,'differenceM':abs(length-app),
 'localPlanarM':sum(math.dist(p,q) for p,q in zip(local,local[1:])),
 'observedUI':{'startSVG':[64.11096675409313,284.54804336669207],'startDistanceM':start,'direction':'reverse','goalKm':5},
 'milestones':milestones,'roundingUsedForDistance':False,
 'userReport':{'1km':'비슷함','2km':'실제보다 살짝 뒤임','3km':'B 코너 꺾은 후 조금 더 뛰면 3키로','4km':'C 코너 꺾고 다음 직선 중간까지 가면 4키로','5km':'더 가서 오른쪽에 길 나있는 부분'},
 'confirmedCorners':{'3km':'B','4km':'C'},'cornerComparison':corner_comparison,
 'unresolved':['exact 3km/4km position beyond the confirmed corners','5km junction','field route coordinate/distance correspondence','NRC track vs mapped line'],
 'calibrationApplied':False,'notAnIndependentSurvey':True}
assert abs(length-app)<.001
(R/'docs/05-validation/reports/course-distance-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
sx=1.75;ox=50;oy=175
def xy(p):return ox+p[0]*sx,oy-p[1]*sx
def pts(points):return ' '.join(f'{x:.2f},{y:.2f}' for x,y in map(xy,points))
svg='<svg xmlns="http://www.w3.org/2000/svg" width="1190" height="610" viewBox="0 0 1190 610"><rect width="1190" height="610" fill="#f6f8f2"/><g font-family="Malgun Gothic,sans-serif">'
svg+='<text x="24" y="34" font-size="23" fill="#294632">사용자 확인: 3 km는 B 이후 · 4 km는 C 이후</text><text x="24" y="63" font-size="15" fill="#6b7968">현재 출발점 / 반시계 방향 · 보라색 숫자 = 지도 계산 · 실제 도착점의 정밀 좌표는 미확정</text>'
svg+='<defs><clipPath id="map"><rect x="20" y="80" width="840" height="440" rx="14"/></clipPath></defs><g clip-path="url(#map)"><rect x="20" y="80" width="840" height="440" fill="#edf1e9"/>'
for f in a['context']:
    ps=pts(list(map(project,f['coordinates'])));closed=f['kind'] in ['park','building','area']
    svg+=f'<{"polygon" if closed else "polyline"} points="{ps}" fill="{"#e0ead8" if closed else "none"}" stroke="#c5d0bd" stroke-width="1.5"/>'
svg+=f'<polyline points="{pts(local)}" fill="none" stroke="#3e7560" stroke-width="5" stroke-linejoin="round"/>'
for s in [50,300,650,950]:
    p,q=point(start-s),point(start-s-3);x,y=xy(p);xx,yy=xy(q);angle=math.degrees(math.atan2(yy-y,xx-x))
    svg+=f'<path d="M-8,-6 L0,0 L-8,6" transform="translate({x},{y}) rotate({angle})" fill="none" stroke="#3e7560" stroke-width="3"/>'
svg+='</g>'
for letter,l in zip('ABCD',a['landmarks']):
    x,y=xy(project(l['coordinate']));svg+=f'<rect x="{x-15}" y="{y-39}" width="30" height="26" rx="7" fill="#dce6d5"/><text x="{x}" y="{y-20}" text-anchor="middle" font-size="18" fill="#294632" font-weight="700">{letter}</text>'
    if letter in ['B','C']:svg+=f'<circle cx="{x}" cy="{y}" r="17" fill="none" stroke="#d45c39" stroke-width="3"/>'
x,y=xy(point(start));svg+=f'<circle cx="{x}" cy="{y}" r="8" fill="#d45c39" stroke="white" stroke-width="3"/><text x="{x+12}" y="{y-12}" font-size="17" fill="#ad4e31">출발</text>'
for m in milestones:
    x,y=xy(m['localEN']);k=m['km'];svg+=f'<circle cx="{x}" cy="{y}" r="14" fill="#5454a8" stroke="white" stroke-width="3"/><text x="{x}" y="{y+6}" text-anchor="middle" font-size="17" fill="white">{k}</text>'
for i,(title,caption) in enumerate([('1 km','비슷함'),('2 km','표시가 실제보다 뒤'),('3 km · B 확인','B를 지난 뒤 조금'),('4 km · C 확인','C 다음 직선 중간'),('5 km','오른쪽 갈림길 · 미확정')]):
    yy=126+i*76;svg+=f'<text x="889" y="{yy}" font-size="20" fill="#5454a8">{title} · 사용자 설명</text><text x="889" y="{yy+29}" font-size="16" fill="#294632">{caption}</text>'
svg+=f'<text x="24" y="550" font-size="17" fill="#294632">현재 지도: 3 km는 B 약 {corner_comparison[0]["currentMarkerBeforeCornerM"]:.0f} m 전 / 4 km는 C 약 {corner_comparison[1]["currentMarkerBeforeCornerM"]:.0f} m 전 → 현장 설명과 차이 확인</text><text x="24" y="578" font-size="15" fill="#8b6738">지도 계산 검산은 일치 ({length:.3f} m/바퀴). 실제 거리와의 대응 원인은 미확정 · 임의 거리 보정 없음.</text><text x="24" y="601" font-size="12" fill="#6b7968">© OpenStreetMap contributors / ODbL · 경로 C · 원본/생성: course-distance-audit.py · 사용자 위치 설명은 GPS 측정값이 아님</text></g></svg>'
(R/'docs/assets/diagrams/course-distance-audit.svg').write_text(svg,encoding='utf8')
print(json.dumps({'independentLengthM':length,'deltaM':abs(length-app),'milestones':milestones}))
