"""M86: derive and draw an UNCONFIRMED outer walking-loop candidate.
Offline only: preserved M85 OSM snapshot -> node graph -> outer face.
No snapping, gap filling, park-boundary substitution, or application mutation.
"""
from pathlib import Path
from collections import defaultdict
import json, math, hashlib, html, argparse

parser=argparse.ArgumentParser()
parser.add_argument('--candidate',choices=['A','B'],default='A')
candidate=parser.parse_args().candidate
stem='course-candidate' if candidate=='A' else 'course-candidate-b'

R=Path(__file__).resolve().parents[3]
source=R/'docs/05-validation/reports/course-source.json'
data=json.loads(source.read_text(encoding='utf8'))
paths=[e for e in data['elements'] if e['id'] in set(data['inParkPathIds'])]
nodes={};adj=defaultdict(set);edge_ways=defaultdict(set)
for way in paths:
    assert len(way['nodes'])==len(way['geometry'])
    for n,p in zip(way['nodes'],way['geometry']):
        point=(p['lon'],p['lat'])
        assert n not in nodes or nodes[n]==point
        nodes[n]=point
    for a,b in zip(way['nodes'],way['nodes'][1:]):
        adj[a].add(b);adj[b].add(a);edge_ways[tuple(sorted((a,b)))].add(way['id'])
# Remove dead-end paths, keeping only cycles and connecting edges.
while True:
    leaves=[n for n,v in adj.items() if len(v)<2]
    if not leaves:break
    for n in leaves:
        for b in adj[n]:adj[b].discard(n)
        del adj[n]
mx=111195*math.cos(math.radians(35.1829));my=111195
xy={n:((p[0]-128.8266)*mx,(p[1]-35.1829)*my) for n,p in nodes.items()}
order={n:sorted(v,key=lambda b:math.atan2(xy[b][1]-xy[n][1],xy[b][0]-xy[n][0])) for n,v in adj.items()}
seen=set();faces=[]
for a in sorted(adj):
    for b in sorted(adj[a]):
        if (a,b) in seen:continue
        first=(a,b);u,v=first;ring=[]
        while (u,v) not in seen:
            seen.add((u,v));ring.append(u);ns=order[v];u,v=v,ns[(ns.index(u)-1)%len(ns)]
        if (u,v)==first:
            area=sum(xy[a][0]*xy[b][1]-xy[b][0]*xy[a][1] for a,b in zip(ring,ring[1:]+ring[:1]))/2
            faces.append((area,ring))
# The largest exterior face is a candidate, not an assertion of the running track.
area,ring=min(faces,key=lambda f:f[0])
origin=13502643198  # Northwest bend: coordinate ordering only, NOT a chosen start.
i=ring.index(origin);ring=ring[i:]+ring[:i];ring.append(ring[0])
original_ring=ring.copy()
old_section=[];new_section=[]
if candidate=='B':
    # User correction: 1 -> winding inner path -> 4; exclude location 5.
    # Keep A's 1/2/3/4 arc exactly. Use the actual continuous OSM way 5836
    # from marker 4 to its west junction, then the existing short path to 1.
    marker4=13502643239
    inner=next(e for e in paths if e['id']==1471465836)['nodes']
    curve=inner[inner.index(marker4):]
    west_join=curve[-1]
    fixed=ring[:ring.index(marker4)+1]
    original_return=ring[ring.index(west_join):]
    old_section=ring[ring.index(marker4):]
    new_section=curve+original_return[1:]
    ring=fixed+new_section[1:]
coords=[nodes[n] for n in ring]
def haversine(a,b):
    lon1,lat1=map(math.radians,a);lon2,lat2=map(math.radians,b)
    h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 2*6371008.8*math.atan2(math.sqrt(h),math.sqrt(1-h))
length=sum(haversine(a,b) for a,b in zip(coords,coords[1:]))
planar=sum(math.dist(xy[a],xy[b]) for a,b in zip(ring,ring[1:]))
way_ids=sorted(set(w for a,b in zip(ring,ring[1:]) for w in edge_ways[tuple(sorted((a,b)))]))
# Independent polygon simplicity check, including collinear overlap/touch.
def intersects(a,b,c,d):
    def orient(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    def on(p,q,r):return min(p[0],q[0])-1e-8<=r[0]<=max(p[0],q[0])+1e-8 and min(p[1],q[1])-1e-8<=r[1]<=max(p[1],q[1])+1e-8
    x,y,z,w=orient(a,b,c),orient(a,b,d),orient(c,d,a),orient(c,d,b)
    if x*y<0 and z*w<0:return True
    return any(abs(t)<1e-8 and on(p,q,r) for t,p,q,r in [(x,a,b,c),(y,a,b,d),(z,c,d,a),(w,c,d,b)])
cross=[];N=len(ring)-1
for i in range(N):
    for j in range(i+1,N):
        if j==i+1 or (i==0 and j==N-1):continue
        if intersects(xy[ring[i]],xy[ring[i+1]],xy[ring[j]],xy[ring[j+1]]):cross.append([i,j])
checks={
 'closed':ring[0]==ring[-1],
 'distinctVerticesExceptClosure':len(set(ring[:-1]))==N,
 'everySegmentExistsInSource':all(tuple(sorted((a,b))) in edge_ways for a,b in zip(ring,ring[1:])),
 'noRepeatedUndirectedSegments':len(set(tuple(sorted(e)) for e in zip(ring,ring[1:])))==N,
 'noSelfIntersections':not cross,
 'allCoordinatesFinite':all(math.isfinite(v) for p in coords for v in p),
 'noExplicitAccessProhibitionInSelectedWayTags':all(e['tags'].get('access') not in ['no','private'] and e['tags'].get('foot') not in ['no','private'] for e in paths if e['id'] in way_ids),
 'planarVsSphericalLengthWithinHalfPercent':abs(planar-length)/length<.005,
}
if candidate=='B':
    checks['marker5Excluded']=13485008407 not in ring
    checks['originalArc1234Unchanged']=ring[:len(fixed)]==fixed
    checks['innerCurveUsesWay1471465836']=all(1471465836 in edge_ways[tuple(sorted((a,b)))] for a,b in zip(curve,curve[1:]))
assert all(checks.values()),checks
markers=[(1,13502643198,'서쪽 윗모서리'),(2,13502643218,'동쪽 윗모서리'),(3,13502643207,'동쪽 아랫모서리'),(4,13502643239,'남쪽 굽은 길'),(5,13485008407,'서쪽 아랫모서리')]
report={
 'status':'candidate-awaiting-user-route-confirmation','milestone':'M86','date':'2026-10-22','candidateId':candidate,
 'source':{'file':'course-source.json','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'snapshotTimeUTC':data['source']['snapshotTimeUTC'],'attribution':data['source']['attribution'],'license':'ODbL-1.0','licenseUrl':data['source']['licenseUrl']},
 'selectionMethod':'Largest exterior face of the preserved pedestrian graph.' if candidate=='A' else 'User correction: replace 1-5-4 with the connected winding path from 1 to 4 via OSM way 1471465836; preserve arc 1-2-3-4. This inferred inner branch awaits user confirmation.',
 'geometry':{'type':'LineString','coordinates':coords},'orderedNodeIds':ring,
 'segments':[{'from':a,'to':b,'wayIds':sorted(edge_ways[tuple(sorted((a,b)))])} for a,b in zip(ring,ring[1:])],
 'ways':[{'id':e['id'],'version':e['version'],'timestamp':e['timestamp'],'tags':e['tags'],'url':f"https://www.openstreetmap.org/way/{e['id']}"} for e in paths if e['id'] in way_ids],
 'computedSphericalLengthM':length,'computedPlanarLengthM':planar,'lengthRelativeDifference':abs(planar-length)/length,
 'uniqueVertices':N,'sourceWayCount':len(way_ids),'geometryChecks':checks,
 'markers':[{'number':n,'nodeId':node,'label':label} for n,node,label in markers],
 'notVerified':{'userRouteMatch':True,'dedicatedRunningTrack':True,'surveyedDistance':True,'onSiteAccess':True,'surfaceAndElevation':True},
 'coordinateListOriginIsNotUserStart':True,'userStart':None,'userDirection':None,'userLaps':None,'applicationChanged':False,
}
if candidate=='B':report['supersedes']={'candidate':'A','reason':'User rejected west outer detour via marker 5','previousReport':'course-candidate.json'}
(R/f'docs/05-validation/reports/{stem}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')

# Figure: north-up, metric aspect ratio, orange continuous loop, numbered landmarks.
INK='#263e32';MUTED='#63766b';ORANGE='#dc653e';BG='#f6f7f2'
def txt(x,y,s,size=18,color=INK,weight=400):return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}">{html.escape(s)}</text>'
def rect(x,y,w,h,fill='white',stroke='#dfe5db',r=16):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'
park=next(e for e in data['elements'] if e['id']==data['park']['osmId'])
mapx,mapy,mapw,maph=28,150,1000,588
allpoints=[nodes[n] for n in original_ring]+[(p['lon'],p['lat']) for p in park['geometry']]
lonmin=min(p[0] for p in allpoints)-.00035;lonmax=max(p[0] for p in allpoints)+.00035
latmin=min(p[1] for p in allpoints)-.00035;latmax=max(p[1] for p in allpoints)+.00035
scale=min(mapw/((lonmax-lonmin)*mx),maph/((latmax-latmin)*my));cx=(lonmin+lonmax)/2;cy=(latmin+latmax)/2
def pos(p):return (mapx+mapw/2+(p[0]-cx)*mx*scale,mapy+maph/2-(p[1]-cy)*my*scale)
def pts(points):return ' '.join(f'{x:.2f},{y:.2f}' for x,y in map(pos,points))
title='후보 A · 공원 외곽 한 바퀴' if candidate=='A' else '수정 후보 B · ①에서 굽은 길을 따라 ④로'
s=txt(28,48,title,30,INK,700)+rect(1120,22,292,39,'#f7ead5','none',19)+txt(1141,49,'평소 코스와 일치 여부 확인 전',16,'#946025',600)
s+=txt(28,85,'주황색 선이 이번 후보입니다. 번호는 위치 설명용이며 출발점·진행 방향은 정하지 않았습니다.' if candidate=='A' else '⑤를 지나는 바깥길을 제외했습니다. ①·②·③·④는 이전 지도와 같은 위치입니다.',19,MUTED)
s+=f'<path d="M28,120 h45" stroke="{ORANGE}" stroke-width="7"/>'+txt(84,126,'한 바퀴 후보',16)
if candidate=='B':s+=f'<path d="M264,120 h45" stroke="#00847d" stroke-width="7"/>'+txt(320,126,'수정한 ①–④',16)+'<path d="M520,120 h45" stroke="#a3a9a2" stroke-width="3" stroke-dasharray="7 6"/>'+txt(578,126,'제외한 ⑤ 경유 구간',16)
else:s+=f'<path d="M264,120 h45" stroke="#aab9aa" stroke-width="2"/>'+txt(320,126,'다른 보행로',16)+rect(494,108,22,18,'#dfebd7','none',3)+txt(528,126,'공원 영역',16)
s+=f'<defs><clipPath id="map"><rect x="{mapx}" y="{mapy}" width="{mapw}" height="{maph}" rx="16"/></clipPath></defs><g clip-path="url(#map)">'
s+=rect(mapx,mapy,mapw,maph,'#edf1e9','none')+f'<polygon points="{pts([(p["lon"],p["lat"]) for p in park["geometry"]])}" fill="#dfebd7" stroke="#bed2b2"/>'
for e in data['elements']:
    g=e.get('geometry',[]);t=e['tags']
    if len(g)<2:continue
    points=[(p['lon'],p['lat']) for p in g]
    if t.get('building'):s+=f'<polygon points="{pts(points)}" fill="#dce2d6"/>'
    if t.get('highway'):
        c='#aab9aa' if e['id'] in set(data['inParkPathIds']) else '#c5cebf'
        if t.get('area')=='yes':s+=f'<polygon points="{pts(points)}" fill="#dce4d5" stroke="{c}"/>'
        else:s+=f'<polyline points="{pts(points)}" fill="none" stroke="{c}" stroke-width="{1.5 if t["highway"] in ["footway","path","pedestrian"] else 4}"/>'
if candidate=='B':s+=f'<polyline points="{pts([nodes[n] for n in old_section])}" fill="none" stroke="#929e92" stroke-width="3" stroke-dasharray="7 6"/>'
s+=f'<polyline points="{pts(coords)}" fill="none" stroke="white" stroke-width="12" stroke-linejoin="round"/><polyline points="{pts(coords)}" fill="none" stroke="{ORANGE}" stroke-width="7" stroke-linejoin="round"/>'
if candidate=='B':s+=f'<polyline points="{pts([nodes[n] for n in new_section])}" fill="none" stroke="#00847d" stroke-width="7" stroke-linejoin="round"/>'
s+='</g>'
for n,node,label in markers:
    color='#929e92' if candidate=='B' and n==5 else ORANGE
    x,y=pos(nodes[node]);s+=f'<circle cx="{x:.2f}" cy="{y:.2f}" r="18" fill="{color}" stroke="white" stroke-width="3"/>'+txt(round(x-5.5,2),round(y+6,2),str(n),18,'white',700)
s+=txt(975,183,'N',20,INK,600)+'<path d="M983,193 l-6,15 h12 Z" fill="#263e32"/>'
s+=f'<path d="M53,707 h{100*scale:.2f}" stroke="{INK}" stroke-width="3"/>'+txt(53,696,'100 m',14)
s+=rect(1060,150,352,588)+txt(1083,190,'이 길이 맞는지 봐주세요',22,INK,600)
for i,(n,node,label) in enumerate(markers):
    color='#929e92' if candidate=='B' and n==5 else ORANGE
    label='이번 후보에서 제외' if candidate=='B' and n==5 else label
    y=240+i*53;s+=f'<circle cx="1097" cy="{y-6}" r="15" fill="{color}"/>'+txt(1092,y,str(n),16,'white',700)+txt(1125,y,label,18)
s+=rect(1082,511,308,96,'#f7ead5','none',12)+txt(1100,542,'지도 좌표로 계산한 후보 길이',16,'#946025')+txt(1100,580,f'약 {length/1000:.2f} km',27,INK,700)
s+=txt(1083,638,'실측 거리 · 러닝 트랙 확인 전',16,MUTED)+txt(1083,668,'길의 연결만 지도에서 확인했습니다.',15,MUTED)+txt(1083,700,'공원 경계를 코스로 바꾸지 않았습니다.',14,MUTED)
s+=rect(28,762,1384,67,'white','#dfe5db',12)+txt(49,790,'확인할 부분: 남쪽 ③→④→⑤ 구간과 서쪽 ⑤→① 구간도 평소 뛰는 길인가요?' if candidate=='A' else '초록색으로 표시한 ①–④의 구불구불한 길이 말씀하신 구간인가요?',21,INK,600)+txt(49,815,'번호는 위치 설명용입니다. 출발점·진행 방향·바퀴 수는 아직 설정하지 않았습니다.',15,MUTED)
s+=txt(28,866,'M86 검토용 지도 · 자료 시점 2026-10-22 · © OpenStreetMap contributors · ODbL · openstreetmap.org/copyright',14,MUTED)
svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="890" viewBox="0 0 1440 890"><rect width="1440" height="890" fill="{BG}"/><g font-family="Malgun Gothic, sans-serif">{s}</g></svg>'
(R/f'docs/assets/diagrams/{stem}.svg').write_text(svg,encoding='utf8')
print(json.dumps({'lengthM':length,'vertices':N,'ways':len(way_ids),'checks':checks},ensure_ascii=False))
