"""M31: stage checks and measured-coordinate plots; never changes animation assets."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
report=json.loads((root/'docs/05-validation/reports/cmu-transfer.json').read_text())
font_manager.fontManager.addfont('C:/Windows/Fonts/malgun.ttf')
plt.rcParams.update({'font.family':'Malgun Gothic','axes.unicode_minus':False,'font.size':11})
sets=lambda model:{r['stage']:r['rows'] for r in report['results'] if r['model']==model}
arr=lambda rows,key:np.array([r[key] for r in rows])
center=lambda points:(np.array(points['lh'])+points['rh'])/2
metrics={}
for model in ['male','female']:
 s=sets(model);cur=s['current'];raw=s['raw-transfer'];base=s['loop-transfer'];ankle=s['loop-ankle'];skin=s['loop-skin']
 allrows=[r for rows in s.values() for r in rows]
 poserr=lambda a,b:max(np.linalg.norm(np.array(x['target'][k])-y['target'][k])*1000 for x,y in zip(a,b) for k in x['target'])
 assert poserr(base,ankle)>1 # Existing ankle correction changes forefoot, so the stage test is sensitive.
 assert poserr(ankle,skin)<.001 and poserr(skin,cur)<.001
 for a,b in zip(skin,cur):
  delta=np.array(b['rootTarget'])-a['rootTarget'];assert np.linalg.norm(delta[[0,2]])<1e-8
  assert abs(delta[1]-b['contact']['offset'])<1e-8
 for row in cur:
  if row['contact']['support']:assert abs(row['soles'][row['contact']['support']]['minY'])<.001
 a=raw[0];S=a['source'];P=a['target'];distance=lambda p,x,y:float(np.linalg.norm(np.array(p[x])-p[y])*100)
 widths={'sourceHipWidthCm':distance(S,'lh','rh'),'targetHipWidthCm':distance(P,'lh','rh')}
 lengths={s:{'sourceThighCm':distance(S,s+'h',s+'k'),'targetThighCm':distance(P,s+'h',s+'k'),'sourceCalfCm':distance(S,s+'k',s+'a'),'targetCalfCm':distance(P,s+'k',s+'a')} for s in ['l','r']}
 support={}
 for side,sign,start,end in [('r',-1,.28,.58),('l',1,.75,1.09)]:
  rows=[a for a in cur if any(start<=p<=end for p in [a['phase'],a['phase']+1])]
  support[side]={g:min(sign*(np.array(a[g][side+'a'])-center(a[g]))[0]*100 for a in rows) for g in ['source','target']}
 rawroot=arr(cur,'rootRaw');targetroot=arr(cur,'rootTarget');ground=(targetroot-arr(skin,'rootTarget'))[:,1]*100
 metrics[model]={'stageSamples':len(allrows),'maxRootRotationErrorDegrees':max(a['orientationError'] for a in allrows),'maxHipAxisErrorDegrees':max(a['pelvisAxisError'] for a in allrows),'maxLegDirectionErrorDegrees':max(a['directional'][s][k] for a in allrows for s in ['l','r'] for k in ['thigh','calf']),
  'maxLengthDecompositionResidualMm':max(a['decomposition'][s]['lengthPredictionResidualMm'] for a in allrows for s in ['l','r']),**widths,'lengths':lengths,
  'maxExistingAnkleFootAngleDegrees':{s:max(a['directional'][s]['foot'] for a in cur) for s in ['l','r']},'supportAnkleOwnSideMinCm':support,'rawRootXYZSpanCm':(np.ptp(rawroot,axis=0)*100).tolist(),'currentRootXYZSpanCm':(np.ptp(targetroot,axis=0)*100).tolist(),'groundOffsetRangeCm':[float(min(ground)),float(max(ground))],
  'sourceHipCenterFromRootAtAMC1Cm':(center(S)*100).tolist(),'targetHipCenterFromRootAtAMC1Cm':(center(P)*100).tolist(),'stageChecks':'ankle changes forefoot; skin leaves joints unchanged; grounding changes only root Y and equals solver offset; estimated support surface within 1mm'}
summary={'scope':'M31 transfer diagnostics, not a clinical stability or naturalness verdict. 1062 stage poses +182 existing restored-travel poses. Integer frames only. Raw root and target pelvis are different rig landmarks.', 'metrics':metrics,'restoredMaxRootErrorMm':max(a['maxRootErrorMm'] for a in report['restored'])}
(root/'docs/05-validation/reports/cmu-transfer-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
# Actual app screenshot contact sheet, source ROOT aligned to target pelvis.
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1320,1160),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((25,15),'같은 순간 · 현재 모델 + 전달 전 원본 뼈대',font=font(30),fill='#233b32')
d.text((25,62),'남성형 실제 화면 · 주황 점선: 같은 입력 프레임 · 기존 보정 유지 / M28 꺼짐',font=font(20),fill='#63736a')
for col,(f,label) in enumerate([(26,'AMC 81 · 오른발 착지 추정'),(39,'AMC 94 · 오른발 지지 중'),(82,'AMC 137 · 왼발 지지 중')]):
 x=22+col*432;d.text((x,105),label,font=font(22),fill='#233b32')
 for view,y in [('front',145),('side',620)]:
  im=Image.open(root/f'outputs/cmu-transfer/{view}-{f}.png').convert('RGB');im.thumbnail((400,470));canvas.paste(im,(x+(400-im.width)//2,y))
d.text((25,1100),'위: 정면 / 아래: 측면 · 원본 root를 모델 pelvis에 맞춘 표시입니다.',font=font(20),fill='#63736a')
d.text((25,1131),'점선 발이 바닥 아래로 가는 것은 두 기준점·뼈 길이 차이이며, 모델 피부의 바닥 침범을 뜻하지 않습니다.',font=font(18),fill='#63736a')
canvas.save(out/'cmu-transfer-captures.png')
# Remove only hip midpoint offset to expose proportion/foot differences, same frames.
cur=sets('male')['current'];fig,axs=plt.subplots(2,3,figsize=(13,9));fig.set_facecolor('#f6f5f1')
for col,f in enumerate([26,39,82]):
 row=cur[f]
 for line,(axes,title) in enumerate([((0,1),'정면'),((0,2),'위에서 본 발 위치')]):
  ax=axs[line,col]
  for g,color,label,style in [('source','#c78626','전달 전 뼈대','--'),('target','#147dba','현재 모델 뼈대','-')]:
   points={k:(np.array(v)-center(row[g]))*100 for k,v in row[g].items()}
   for side in ['l','r']:
    a=np.array([points[side+k] for k in ['h','k','a','b']]);ax.plot(a[:,axes[0]],a[:,axes[1]],color=color,ls=style,lw=2,label=label if side=='l' else None)
    for joint,mark in [('h','o'),('k','o'),('a','s'),('b','^')]:q=points[side+joint];ax.scatter(q[axes[0]],q[axes[1]],marker=mark,s=28,color=color)
   if g=='target':
    for side in ['l','r']:
     q=(np.array(row['soles'][side]['lowestBandCenter'])-center(row[g]))*100
     ax.scatter(q[axes[0]],q[axes[1]],color='#8e4d8c',marker='D',s=40,label='모델 발 표면 최저 띠' if side=='l' else None)
  ax.axvline(0,color='#999',ls=':',lw=1);ax.grid(alpha=.16);ax.set_aspect('equal');ax.set_title(f"AMC {row['amcFrame']} · {title}");ax.set_xlabel('좌우 (cm)');ax.set_ylabel('높이 (cm)' if line==0 else '전후 (cm)')
  ax.set_xlim(-25,25)
  if line==0:ax.set_ylim(-105,6)
  else:ax.set_ylim(-60,60)
fig.suptitle('고관절 중점을 맞춰도 길이 비율·발 기준 때문에 위치는 달라집니다',fontsize=18,y=.985)
fig.legend(*axs[0,0].get_legend_handles_labels(),loc='upper center',bbox_to_anchor=(.5,.955),ncol=3,frameon=False)
fig.text(.5,.023,'○ 고관절/무릎 · □ 발목 · △ 앞발 관절 · ◇ 표면 최저점+1mm 띠의 중심(기하학적 대용점, 실측 접촉점 아님)',ha='center',fontsize=10)
fig.subplots_adjust(left=.06,right=.98,top=.87,bottom=.09,hspace=.29,wspace=.28);fig.savefig(out/'cmu-transfer-joints.png',dpi=150);plt.close(fig)
# Same input cycle isolates transfer from loop preparation; original travel restored in the reference.
fig,axs=plt.subplots(1,3,figsize=(15,4.8));fig.set_facecolor('#f6f5f1');phase=np.array([a['phase'] for a in cur])*100
axs[0].plot(phase,[r['sourceHipRoll'] for r in cur],color='#c78626',lw=3,label='전달 전 뼈대');axs[0].plot(phase,[r['targetHipRoll'] for r in cur],color='#147dba',ls='--',lw=2,label='현재 모델');axs[0].set_title('골반 기울기 · 추가 회전 없음');axs[0].set_ylabel('양 고관절 연결선의 정면 기울기 (°)');axs[0].legend(frameon=False,fontsize=10)
source=np.array([center(r['source'])+r['rootSource'] for r in cur]);source[:,:]+=arr(cur,'travel')
fixed=np.array([center(r['target'])+r['rootTarget'] for r in cur]);restored=np.array(next(a for a in report['restored'] if a['model']=='male')['rows']);restored=np.array([a['hipCenter'] for a in restored])
for pts,color,label,ls in [(source,'#c78626','전달 전 + 원본 이동','-'),(fixed,'#147dba','현재 제자리','-'),(restored,'#378f65','기존 몸 이동 복원 화면','--')]:
 axs[1].plot(phase,(pts[:,0]-pts[0,0])*100,color=color,label=label,ls=ls,lw=2)
axs[1].set_title('골반 중점 좌우 이동 · 화면별 차이');axs[1].set_ylabel('첫 프레임 대비 변화 (cm)');axs[1].legend(frameon=False,fontsize=9)
for pts,color,label,ls in [(source,'#c78626','전달 전 뼈대','-'),(fixed,'#147dba','현재 높이 보정 포함','-')]:axs[2].plot(phase,(pts[:,1]-pts[0,1])*100,color=color,label=label,ls=ls,lw=2)
axs[2].set_title('골반 중점 높이 · 원본과 달라짐');axs[2].set_ylabel('첫 프레임 대비 변화 (cm)');axs[2].legend(frameon=False,fontsize=9)
for ax in axs:ax.set_xlabel('같은 입력 주기 (%)');ax.grid(alpha=.18)
fig.suptitle('회전 전달은 일치하지만, 몸의 이동과 높이는 그대로 전달되지 않습니다',fontsize=18)
fig.text(.5,.025,'남성형 · 반복 가공 뒤 같은 입력으로 비교 · 복원 곡선은 기존 ?compare=travel 화면에서 직접 측정 · 안정성/자연스러움 점수 아님',ha='center',fontsize=10)
fig.subplots_adjust(left=.055,right=.985,top=.80,bottom=.19,wspace=.28);fig.savefig(out/'cmu-transfer-motion.png',dpi=150);plt.close(fig)
