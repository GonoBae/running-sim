"""Publish the requested C shortcut; retain B geometry for exact start migration."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[3]
c=json.loads((R/'docs/05-validation/reports/course-route-c.json').read_text(encoding='utf8'))
previous=json.loads((R/'experiments/model-preview/public/courses/lotte-garden-b-v1.json').read_text(encoding='utf8'))
s=json.loads((R/'docs/05-validation/reports/course-source.json').read_text(encoding='utf8'))
assert all(c['geometryChecks'].values())
revision='c-'+hashlib.sha256(json.dumps(c['geometry'],sort_keys=True).encode()).hexdigest()[:12]
context=[]
for e in s['elements']:
 g=e.get('geometry',[]);t=e['tags']
 if len(g)<2:continue
 kind='park' if e['id']==s['park']['osmId'] else 'building' if t.get('building') else 'area' if t.get('area')=='yes' else 'path' if t.get('highway') in ['footway','path','pedestrian'] else 'road' if t.get('highway') else None
 if kind:context.append({'kind':kind,'coordinates':[[p['lon'],p['lat']] for p in g]})
asset={'schemaVersion':1,'id':'gimhae-lotte-garden-b','revision':revision,'name':'김해 롯데가든파크','userRouteConfirmedOn':'2026-10-22',
 'source':{'attribution':s['source']['attribution'],'licenseUrl':s['source']['licenseUrl'],'snapshotTimeUTC':s['source']['snapshotTimeUTC'],'wayIds':[w['id'] for w in c['ways']]},
 'previous':{k:previous[k] for k in ['id','revision','geometry']},
 'geometry':c['geometry'],'context':context,'landmarks':[{'label':m['label'],'coordinate':c['geometry']['coordinates'][c['orderedNodeIds'].index(m['nodeId'])]} for m in c['markers']]}
p=R/'experiments/model-preview/public/courses/lotte-garden-c-v1.json';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(asset,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(revision,p.stat().st_size)
