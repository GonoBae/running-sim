"""M32 read-only hip-anchor and ipsilateral hip projection audit from M31 measurements.
No pose, rig, model or runtime changes. All input/runtime hashes must still match.
"""
from pathlib import Path
import json,hashlib,math
import numpy as np
root=Path(__file__).resolve().parents[3]
path=root/'docs/05-validation/reports/cmu-transfer.json';previous=json.loads(path.read_text())
for name,expected in previous['hashes'].items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==expected,('stale M31 measurement',name)
clip=json.loads((root/'experiments/model-preview/review/data/cmu.json').read_text())[0];assert clip['id']=='35_17'
center=lambda row,group:(np.array(row[group]['lh'])+row[group]['rh'])/2
delta=np.array(clip['frames'][-1]['p'][0])-clip['frames'][0]['p'][0];yaw=-math.atan2(delta[0],delta[2]);c,s=math.cos(yaw),math.sin(yaw)
heading=np.array([[c,0,s],[0,1,0],[-s,0,c]])
def rotation(q):
 x,y,z,w=np.array(q)/np.linalg.norm(q)
 return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
models=[]
for model in ['male','female']:
 stages={a['stage']:a['rows'] for a in previous['results'] if a['model']==model};rows=stages['current'];raw=stages['raw-transfer']
 restored=next(a['rows'] for a in previous['restored'] if a['model']==model)
 # Two differently placed rig origins induce a rotating lever-arm difference.
 # Check it is a constant offset in the source root frame, across every raw frame.
 local=[]
 for i,row in enumerate(raw):
  R=heading@rotation(clip['frames'][i]['q'][0]);local.append(R.T@(center(row,'source')-center(row,'target')))
 local=np.array(local);rigidResidual=float(np.max(np.linalg.norm(local-local[0],axis=1))*1000);assert rigidResidual<.001
 source=np.array([center(r,'source')+r['rootSource']+np.array(r['travel']) for r in rows])
 fixed=np.array([center(r,'target')+r['rootTarget'] for r in rows]);rest=np.array([r['hipCenter'] for r in restored])
 offset=np.array([center(r,'source')-center(r,'target') for r in rows]);drift=offset-offset[0]
 sourceChange=source-source[0];fixedChange=fixed-fixed[0];restChange=rest-rest[0]
 error=sourceChange-restChange
 # Horizontal root translation is identical in the restored view. The residual
 # hip-midpoint motion must equal the rotating origin-offset difference.
 horizontalResidual=float(np.max(np.abs(error[:,[0,2]]-drift[:,[0,2]]))*1000);assert horizontalResidual<.001
 rootGap=np.array([np.array(r['rootSource'])+r['travel']-restored[i]['root'] for i,r in enumerate(rows)])
 decompositionResidual=float(np.max(np.abs(error-(drift+rootGap-rootGap[0])))*1000);assert decompositionResidual<.001
 samples=[];windows={'r':(.28,.58),'l':(.75,1.09)};translationError=0
 for i,row in enumerate(rows):
  feet={}
  for side,sign in [('r',-1),('l',1)]:
   lo,hi=windows[side];support=any(lo<=phase<=hi for phase in [row['phase'],row['phase']+1])
   inward={g:{joint:float(-sign*(row[g][side+joint][0]-row[g][side+'h'][0])*100) for joint in ['a','b']} for g in ['source','target']}
   inward['target']['surface']=float(-sign*(row['soles'][side]['lowestBandCenter'][0]-row['target'][side+'h'][0])*100)
   # Reference-only coordinate identity: translating the whole body cannot
   # alter foot minus ipsilateral hip. No transformed pose is saved or replayed.
   shift=offset[i]
   for point in [np.array(row['target'][side+'a']),np.array(row['soles'][side]['lowestBandCenter'])]:
    hip=np.array(row['target'][side+'h']);translationError=max(translationError,float(np.linalg.norm(((point+shift)-(hip+shift))-(point-hip))*1000))
   feet[side]={'supportEstimated':support,'insideCm':inward}
  samples.append({'f':row['f'],'amcFrame':row['amcFrame'],'phase':row['phase'],'sourceHip':source[i].tolist(),'fixedHip':fixed[i].tolist(),'restoredHip':rest[i].tolist(),'anchorOffset':offset[i].tolist(),'anchorDrift':drift[i].tolist(),'feet':feet})
 assert translationError<.000001
 summary={}
 for side in ['r','l']:
  support=[r['feet'][side] for r in samples if r['feet'][side]['supportEstimated']]
  summary[side]={'samples':len(support),'sourceAnkleInsideCm':[min(a['insideCm']['source']['a'] for a in support),max(a['insideCm']['source']['a'] for a in support)],'targetAnkleInsideCm':[min(a['insideCm']['target']['a'] for a in support),max(a['insideCm']['target']['a'] for a in support)],'targetSurfaceInsideCm':[min(a['insideCm']['target']['surface'] for a in support),max(a['insideCm']['target']['surface'] for a in support)]}
 metrics={'rawRigidOffsetResidualMm':rigidResidual,'restoredHorizontalDecompositionResidualMm':horizontalResidual,'fullMotionDecompositionResidualMm':decompositionResidual,'translationInvariantResidualMm':translationError,'anchorDriftXYZRangeCm':(np.ptp(drift,axis=0)*100).tolist(),'anchorDriftXYZMaxFromStartCm':(np.max(np.abs(drift),axis=0)*100).tolist(),'support':summary}
 models.append({'model':model,'metrics':metrics,'rows':samples})
report={'scope':'M32 read-only reanalysis of hash-verified M31 measurements. 35_17 only; original root positions restored for source travel. User hip vertical is a comparison reference, not a normative landing target. No correction or counterfactual animation.',
 'input':{'path':'docs/05-validation/reports/cmu-transfer.json','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'measurementTime':previous['testedAt']},'runtimeHashes':previous['hashes'],'coordinateContract':{'x':'common fixed heading, horizontal lateral component','y':'up','z':'forward','midpoint':'(left hip + right hip)/2','insideCm':'-sideSign*(footX-ipsilateralHipX)*100, left sign +1, right -1','surface':'mean of target foot surface vertices within 1mm of lowest sampled point; geometric proxy, not force-plate center','window':'existing authored support estimates; no true contact timing validation'},'models':models}
(root/'docs/05-validation/reports/cmu-hip-center.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps([{a['model']:a['metrics']} for a in models],indent=2))
