"""M89: replace only B's northeast tip with the existing OSM short connector.
Source snapshot and B evidence remain immutable. No invented/straightened edges.
"""
from pathlib import Path
import json, math, hashlib
R=Path(__file__).resolve().parents[3]
s=json.loads((R/'docs/05-validation/reports/course-source.json').read_text(encoding='utf8'))
b=json.loads((R/'docs/05-validation/reports/course-candidate-b.json').read_text(encoding='utf8'))
ways={w['id']:w for w in s['elements'] if w['id'] in s['inParkPathIds']}
nodes={n:[p['lon'],p['lat']] for w in ways.values() for n,p in zip(w['nodes'],w['geometry'])}
edges={tuple(sorted((a,z))) for w in ways.values() for a,z in zip(w['nodes'],w['nodes'][1:])}
old=b['orderedNodeIds']; connector=list(reversed(ways[1471465834]['nodes']))
i,j=old.index(connector[0]),old.index(connector[-1]); ring=old[:i]+connector+old[j+1:]
coords=[nodes[n] for n in ring]
def distance(a,z):
    lon,lat,lon2,lat2=map(math.radians,[*a,*z])
    h=math.sin((lat2-lat)/2)**2+math.cos(lat)*math.cos(lat2)*math.sin((lon2-lon)/2)**2
    return 2*6371008.8*math.asin(math.sqrt(h))
length=sum(distance(a,z) for a,z in zip(coords,coords[1:]))
checks={'closed':ring[0]==ring[-1], 'uniqueVertices':len(set(ring[:-1]))==len(ring)-1,
 'everySegmentExistsInSource':all(tuple(sorted((a,z))) in edges for a,z in zip(ring,ring[1:])),
 'northeastTipRemoved':13502643218 not in ring,
 'onlyNortheastChanged':ring[:i]==old[:i] and ring[i+len(connector):]==old[j+1:],
 'shorter':length<b['computedSphericalLengthM']}
assert all(checks.values()),checks
used={tuple(sorted((a,z))) for a,z in zip(ring,ring[1:])}
ids=[w['id'] for w in ways.values() if any(tuple(sorted((a,z))) in used for a,z in zip(w['nodes'],w['nodes'][1:]))]
markers=[dict(m) for m in b['markers'] if m['number']!=5]
markers[1].update(nodeId=connector[0],label='동쪽 윗갈림길')
report={'milestone':'M89','status':'implemented-user-requested-shortcut','source':b['source'],
 'selectionMethod':'Replace northeast tip 13502643222 → 13502643218 → 13502643217 with existing way 1471465834; all other B edges retained.',
 'geometry':{'type':'LineString','coordinates':coords},'orderedNodeIds':ring,'markers':markers,
 'ways':[{'id':n,'tags':ways[n]['tags']} for n in ids], 'geometryChecks':checks,
 'computedSphericalLengthM':length,'previousLengthM':b['computedSphericalLengthM'],
 'shorterByM':b['computedSphericalLengthM']-length,
 'oldSectionNodes':old[i:j+1],'newSectionNodes':connector,
 'notVerified':['surveyed distance','on-site access','surface/elevation'],
 'supersedes':'course-candidate-b.json'}
(R/'docs/05-validation/reports/course-route-c.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
# North-up evidence zoom: source roads and actual new connector, not decorative artwork.
def panel(x,title,section,color):
    def p(n):return (x+35+(nodes[n][0]-128.8288)*700000*math.cos(math.radians(35.184)),85+(35.1841-nodes[n][1])*700000)
    def pts(ns):return ' '.join(f'{a:.2f},{z:.2f}' for a,z in map(p,ns))
    heading=f'<text x="{x+20}" y="48" font-size="23" fill="#294632">{title}</text>'
    t=f'<rect x="{x}" y="70" width="470" height="290" rx="16" fill="#edf1e9"/>'
    for w in ways.values():
        t+=f'<polyline points="{pts(w["nodes"])}" fill="none" stroke="#bdcbb8" stroke-width="2"/>'
    t+=f'<polyline points="{pts([old[i-1]]+section+[old[j+1]])}" fill="none" stroke="{color}" stroke-width="7" stroke-linejoin="round"/>'
    for n in [connector[0],connector[-1]]:
        a,z=p(n);t+=f'<circle cx="{a}" cy="{z}" r="6" fill="white" stroke="{color}" stroke-width="3"/>'
    return heading+f'<g clip-path="url(#clip{x})">{t}</g>'
svg='<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="435" viewBox="0 0 1020 435"><rect width="1020" height="435" fill="#fafbf8"/><defs>'
for x in [20,530]:svg+=f'<clipPath id="clip{x}"><rect x="{x}" y="10" width="470" height="350"/></clipPath>'
svg+='</defs><g font-family="Malgun Gothic,sans-serif">'+panel(20,'이전 B · 끝 모서리 경유',old[i:j+1],'#c58d70')+panel(530,'변경 C · 짧은 연결길',connector,'#3e7560')
svg+=f'<text x="30" y="393" font-size="18" fill="#294632">구현 경로 · {length/1000:.3f} km / 이전보다 {report["shorterByM"]:.1f} m 짧음 · 나머지 구간 유지</text><text x="30" y="421" font-size="13" fill="#63766b">지도 계산 거리 · 실측 미검증 · © OpenStreetMap contributors / ODbL · 원본 way 1471465834</text></g></svg>'
(R/'docs/assets/diagrams/course-shortcut.svg').write_text(svg,encoding='utf8')
print(json.dumps({'lengthM':length,'shorterByM':report['shorterByM'],'checks':checks}))
