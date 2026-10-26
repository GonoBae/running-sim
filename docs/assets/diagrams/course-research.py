"""M85 public-geometry research: normalize a saved Overpass response.
Online retrieval is explicit (--fetch); offline figures use the recorded report.
This script does not publish a route or change application code.
"""
from pathlib import Path
import json, hashlib, urllib.request, urllib.parse, argparse
ROOT=Path(__file__).resolve().parents[3]
QUERY='[out:json][timeout:25];(way(35.1808,128.8232,35.1851,128.8303)["highway"];nwr(35.1808,128.8232,35.1851,128.8303)["leisure"];way(35.1808,128.8232,35.1851,128.8303)["building"];);out meta geom;'
ENDPOINT='https://overpass-api.de/api/interpreter'
if __name__=='__main__':
 args=argparse.ArgumentParser();args.add_argument('--fetch',action='store_true');opts=args.parse_args()
 rawpath=ROOT/'outputs/course-research/overpass.json'
 if opts.fetch:
  request=urllib.request.Request(ENDPOINT+'?'+urllib.parse.urlencode({'data':QUERY}),headers={'User-Agent':'RunningSim-Research/1.0 (local course feasibility review)'})
  with urllib.request.urlopen(request,timeout=40) as response: data=response.read()
  rawpath.parent.mkdir(parents=True,exist_ok=True);rawpath.write_bytes(data)
 raw=json.loads(rawpath.read_text(encoding='utf8'))
 allowed={'name','name:en','highway','footway','leisure','sport','building','area','surface','bridge','layer','access','foot','tunnel'}
 elements=[{k:v for k,v in e.items() if k in {'type','id','version','timestamp','nodes','geometry','bounds','lat','lon','members'}}|{'tags':{k:v for k,v in e.get('tags',{}).items() if k in allowed}} for e in raw['elements']]
 park=next(e for e in elements if e['type']=='way' and e['id']==1471465808)
 polygon=[(p['lon'],p['lat']) for p in park['geometry']]
 def inside(x,y):
  odd=False
  for a,b in zip(polygon,polygon[1:]+polygon[:1]):
   if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:odd=not odd
  return odd
 paths=[e for e in elements if e['tags'].get('highway') in {'footway','path','pedestrian'} and e['tags'].get('area')!='yes']
 inpark=[e for e in paths if any(inside(p['lon'],p['lat']) for p in e.get('geometry',[]))]
 report={'status':'geometry-retrieved-route-unconfirmed','checkedDate':'2026-10-22','source':{'provider':'OpenStreetMap via Overpass API','endpoint':ENDPOINT,'query':QUERY,'bboxSouthWestNorthEast':[35.1808,128.8232,35.1851,128.8303],'snapshotTimeUTC':raw['osm3s']['timestamp_osm_base'],'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','licenseUrl':'https://www.openstreetmap.org/copyright','rawSha256':hashlib.sha256(rawpath.read_bytes()).hexdigest()},
 'park':{'osmType':'way','osmId':1471465808,'url':'https://www.openstreetmap.org/way/1471465808','representativeLatLon':[35.1828979,128.8266217],'representativePointMeaning':'Nominatim search point, NOT start or survey control','version':park['version'],'updatedAt':park['timestamp']},
 'counts':{'returnedElements':len(elements),'pedestrianLineWaysInQuery':len(paths),'pedestrianLineWaysWithVertexInsidePark':len(inpark),'trackOrRunningTaggedElements':sum(e['tags'].get('leisure')=='track' or e['tags'].get('sport') in {'running','athletics'} for e in elements)},
 'inParkPathIds':[e['id'] for e in inpark],
 'validation':{'allGeometryCoordinatesFiniteAndInRange':all(-90<=p['lat']<=90 and -180<=p['lon']<=180 for e in elements for p in e.get('geometry',[])),'parkRingClosed':park['nodes'][0]==park['nodes'][-1],'parkBoundaryIsNotRunningRoute':True,'runningLoopSelected':False,'surveyedLengthM':None,'computedLoopLengthM':None,'elevationVerified':False},
 'currentStateAudit':{'method':'Source inspection, not a new runtime test','files':['experiments/model-preview/src/stage-state.ts','experiments/model-preview/src/stages.js'],'preservedFields':['model','scale','ratios.torso','ratios.shoulders','ratios.upperArm','ratios.forearm','ratios.thigh','ratios.shin','leg','elbow','lean','strike'],'storage':'sessionStorage / running-sim.stages.v1','courseFieldExists':False},
 'elements':elements}
 out=ROOT/'docs/05-validation/reports/course-source.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report['counts']));print(report['validation'])
