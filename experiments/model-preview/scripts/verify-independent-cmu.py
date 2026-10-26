"""M30 independent check: pinned external BVH + separate NumPy ASF matrices.
No runtime source, asset or correction is modified.
"""
from pathlib import Path
import json,re,hashlib,itertools,math
import numpy as np
root=Path(__file__).resolve().parents[3]
read=lambda p:(root/p).read_text(encoding='utf-8-sig')
c=json.loads(read('experiments/model-preview/review/data/cmu.json'))[0]
bvh=json.loads(read('outputs/cmu-independent/bvh-samples.json'))
asf=read('data/raw/cmu/35.asf');amc=read('data/raw/cmu/35_17.amc')
scale=.0254/float(re.search(r':units[\s\S]*?length\s+([\d.]+)',asf)[1])
bones={}
for block in re.findall(r'begin([\s\S]*?)end',asf.split(':bonedata')[1].split(':hierarchy')[0]):
 f={a[0]:a[1:] for line in block.splitlines() if (a:=line.strip().split())}
 bones[f['name'][0]]={'direction':np.array(f['direction'],float),'length':float(f['length'][0]),'axis':list(map(float,f['axis'][:3])),'axisOrder':f['axis'][3],'dof':f.get('dof',[])}
for line in asf.split(':hierarchy')[1].splitlines():
 a=line.split()
 if a and a[0] in ['root',*bones]:
  for child in a[1:]:bones[child]['parent']=a[0]
root_section=asf.split(':root')[1].split(':bonedata')[0]
root_order=re.search(r'order\s+([^\n]+)',root_section)[1].split()
assert root_order==['TX','TY','TZ','RX','RY','RZ']
assert re.search(r'orientation\s+0\s+0\s+0',root_section)
frames=[]
for line in amc.splitlines():
 a=line.split()
 if not a or a[0].startswith(('#',':')):continue
 if len(a)==1 and a[0].isdigit():frames.append({})
 else:frames[-1][a[0]]=list(map(float,a[1:]))
def axis_rotation(axis,degrees):
 t=math.radians(degrees);co,si=math.cos(t),math.sin(t)
 return {'X':np.array([[1,0,0],[0,co,-si],[0,si,co]]),'Y':np.array([[co,0,si],[0,1,0],[-si,0,co]]),'Z':np.array([[co,-si,0],[si,co,0],[0,0,1]])}[axis]
def fixed_axes(channels,values,reverse=False):
 m=np.eye(3)
 for ch,v in zip(channels,values):
  r=axis_rotation(ch[-1].upper(),v)
  m=m@r if reverse else r@m
 return m
# Analytic convention checks, independent of quaternion code.
assert np.allclose(axis_rotation('X',90)@np.array([0,1,0]),[0,0,1])
assert np.allclose(fixed_axes(['rx','ry','rz'],[90,90,0])@np.array([0,1,0]),[1,0,0])
assert not np.allclose(fixed_axes(['rx','ry','rz'],[90,90,0],True)@np.array([0,1,0]),[1,0,0])
def reconstruct(reverse=False,invert_basis=False):
 poses=[]
 for frame in frames:
  pos={'root':np.array(frame['root'][:3])*scale};rot={'root':fixed_axes(root_order[3:],frame['root'][3:],reverse)}
  def solve(n):
   if n in pos:return
   bone=bones[n];parent=bone['parent'];solve(parent)
   C=fixed_axes(list(bone['axisOrder']),bone['axis'],reverse)
   M=fixed_axes(bone['dof'],frame.get(n,[]),reverse)
   rot[n]=rot[parent]@(C.T@M@C if invert_basis else C@M@C.T)
   pos[n]=pos[parent]+rot[n]@bone['direction']*bone['length']*scale
  for n in bones:solve(n)
  poses.append([pos[n] for n in c['names']])
 return np.array(poses)
P=np.array([f['p'] for f in c['frames']]);Q=np.array([f['q'] for f in c['frames']]);names=c['names']
# BVH first frame is synthetic T-pose. No fitted rotation, translation or axis swap.
B=np.array([[f['points'][n] for n in names] for f in bvh['rows'][1:]])*scale
BQ=np.array([[f['rotations'][n] for n in names] for f in bvh['rows'][1:]])
assert len(frames)==167 and len(bvh['rows'])==168
lower=['root','lhipjoint','lfemur','ltibia','lfoot','ltoes','rhipjoint','rfemur','rtibia','rfoot','rtoes'];ix=[names.index(n) for n in lower]
def metrics(A,B):
 e=np.linalg.norm(A-B,axis=-1)*1000
 return {'rmsMm':float(np.sqrt(np.mean(e**2))),'maxMm':float(e.max())}
comparison=metrics(P[:,ix],B[:,ix]);np_result=reconstruct();numpy_check=metrics(P,np_result)
assert comparison['maxMm']<.01,comparison
assert numpy_check['maxMm']<1e-6,numpy_check
q1=Q[:,ix]/np.linalg.norm(Q[:,ix],axis=-1,keepdims=True);q2=BQ[:,ix]/np.linalg.norm(BQ[:,ix],axis=-1,keepdims=True)
rotation_degrees=np.degrees(2*np.arccos(np.clip(np.abs((q1*q2).sum(-1)),0,1)))
assert rotation_degrees.max()<.001
controls={}
controls['skip_missing_Tpose']=metrics(P[:,ix],np.array([[f['points'][n] for n in lower] for f in bvh['rows'][:-1]])*scale)
controls['one_frame_late']=metrics(P[:-1,ix],B[1:,ix])
controls['reverse_rotation_order']=metrics(reconstruct(reverse=True)[:,ix],B[:,ix])
controls['reverse_basis_sandwich']=metrics(reconstruct(invert_basis=True)[:,ix],B[:,ix])
# Translation-free handedness/axis discrimination: same origin, no fitting.
Pc=P[:,ix]-P[:,0,None];Bc=B[:,ix]-B[:,0,None]
axis_trials=[]
for perm in itertools.permutations(range(3)):
 for signs in itertools.product([-1,1],repeat=3):
  candidate=Bc[:,:,perm]*np.array(signs);m=metrics(Pc,candidate)
  axis_trials.append({'permutation':list(perm),'signs':list(signs),**m})
axis_trials.sort(key=lambda a:a['rmsMm'])
assert axis_trials[0]['permutation']==[0,1,2] and axis_trials[0]['signs']==[1,1,1]
controls['mirror_X']=metrics(Pc,Bc*np.array([-1,1,1]))
controls['Y_Z_swap']=metrics(Pc,Bc[:,:,[0,2,1]])
swap=[names.index(('r'+n[1:]) if n.startswith('l') else ('l'+n[1:]) if n.startswith('r') and n!='root' else n) for n in lower]
controls['left_right_names_swapped']=metrics(Pc,B[:,swap]-B[:,0,None])
assert all(x['rmsMm']>1 for x in controls.values()),controls
# Neutral ASF offsets independently match BVH fixed hip/limb offsets.
neutral={s:(bones[s+'hipjoint']['direction']*bones[s+'hipjoint']['length']*scale).tolist() for s in ['l','r']}
assert neutral['l'][0]>0 and neutral['r'][0]<0
# Display heading: derived once from raw root travel, applied equally to both.
delta=P[-1,0]-P[0,0];yaw=-math.degrees(math.atan2(delta[0],delta[2]));H=axis_rotation('Y',yaw)
Ap=P@H.T;Ab=B@H.T
center=lambda a:(a[:,names.index('lhipjoint')]+a[:,names.index('rhipjoint')])/2
Cp=center(Ap);Cb=center(Ab)
rows=[]
for f in range(len(P)):
 rows.append({'amcFrame':f+1,'bvhFrame':f+2,'current':{n:Ap[f,names.index(n)].tolist() for n in lower},'external':{n:Ab[f,names.index(n)].tolist() for n in lower},'errorsMm':{n:float(np.linalg.norm(P[f,names.index(n)]-B[f,names.index(n)])*1000) for n in lower},'relativeAnkles':{side:{'current':(Ap[f,names.index(side+'tibia')]-Cp[f]).tolist(),'external':(Ab[f,names.index(side+'tibia')]-Cb[f]).tolist()} for side in ['l','r']}})
# Original chosen running cycle, estimated windows used only to reproduce crossing metric.
support={}
for side,sign,start,end in [('r',-1,.28,.58),('l',1,.75,1.09)]:
 indices=[54+k for k in range(91) if any(start<=p<=end for p in [k/91,k/91+1])]
 support[side]={source:float(min(sign*rows[f]['relativeAnkles'][side][source][0] for f in indices)*100) for source in ['current','external']}
# Differences outside scope: external branching bone offsets are zero, unlike ASF.
upper_differences={n:metrics(P[:,names.index(n)],B[:,names.index(n)]) for n in ['thorax','lwrist','rwrist']}
paths=['data/raw/cmu/35.asf','data/raw/cmu/35_17.amc','data/raw/cmu-independent/35_17.bvh','data/raw/cmu-independent/READMEFIRST.txt','experiments/model-preview/review/data/cmu.json','experiments/model-preview/review/mocap.js','experiments/model-preview/review/cyclic-motion.js','experiments/model-preview/review/stance-width.js','experiments/model-preview/node_modules/three/examples/jsm/loaders/BVHLoader.js']
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
report={'scope':'M30 independent lower-chain validation only. Third-party amc2bvh conversion loaded by Three.js BVHLoader, plus separate NumPy fixed-axis ASF calculation. No motion correction or runtime changes. No force-plate/clinical validation.',
 'sources':{'bvh':bvh['source'],'readme':'https://github.com/una-dinosauria/cmu-mocap/blob/09a07f54f3bbb58797325f009282d0b2048a2871/READMEFIRST.txt','vicon':'https://graphics.cs.cmu.edu/nsp/course/cs229/info/ACCLAIMdef.html'},'hashes':hashes,'asfUnitsToMetres':scale,'mapping':{n:bvh['map'][n] for n in lower},'endpointRule':'ASF bone endpoint = first child origin of corresponding BVH bone; root is special. Lower-chain offsets all present.',
 'frames':len(P),'pointsPerFrame':len(lower),'bvhTposeFramesSkipped':1,'bvhFrameTime':bvh['dt'],'comparison':comparison,'maxWorldRotationErrorDegrees':float(rotation_degrees.max()),'numpyCheck':numpy_check,'axisTrials':axis_trials,'controls':controls,'neutralHipOffsetsMetres':neutral,'displayYawDegrees':yaw,'supportAnkleOwnSideMinCm':support,'excludedUpperBodyDifferences':upper_differences,'rows':rows}
(root/'docs/05-validation/reports/cmu-independent.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['frames','pointsPerFrame','comparison','maxWorldRotationErrorDegrees','numpyCheck','controls','supportAnkleOwnSideMinCm','excludedUpperBodyDifferences']},indent=2))
