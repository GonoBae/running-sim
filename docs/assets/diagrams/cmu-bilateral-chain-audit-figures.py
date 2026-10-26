"""M51 figures from read-only stage traces and actual M50 screenshots."""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
REPORT=ROOT/'docs/05-validation/reports'
OUT=ROOT/'docs/assets/images'
SRC=ROOT/'outputs/cmu-bilateral-chain-audit'
data=json.loads((REPORT/'cmu-bilateral-chain-audit.json').read_text(encoding='utf-8'))
male=data['results'][0]
def font(size):return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',size)
def text(d,xy,s,size=20,color='#233b32'):d.text(xy,s,font=font(size),fill=color)
def pair(model,side,u):return next(r for r in model['paired'] if r['side']==side and r['u']==u)
def new(height,title,subtitle):
 im=Image.new('RGB',(1200,height),'#faf9f6');d=ImageDraw.Draw(im)
 text(d,(30,22),title,30);text(d,(30,72),subtitle,18);return im,d

im,d=new(690,'① 몸이 옆으로 움직이는 단계가 다릅니다','검증 완료 · 기존 코드 단계별 관찰 / 남성형 · 보정 변경 없음')
for x,title,lines,color in [
 (30,'오른발 지지',['고관절 기준 다리 계산','골반 추가 이동 없음','오른발에만 해제·미끄러짐 보정'], '#e5eee9'),
 (625,'왼발 지지 · 오른다리 회수',['예전 골반 이동·높이 계산 실행','캐릭터 오른쪽으로 최대 35.1mm','높이도 최대 12.4mm 추가'], '#f3dfd5')]:
 d.rounded_rectangle((x,120,x+545,312),14,fill=color);text(d,(x+20,138),title,24)
 for i,s in enumerate(lines):text(d,(x+20,185+35*i),s,21)
left,top,w,h=90,365,1010,230
d.line((left,top,left,top+h,left+w,top+h),fill='#87958e',width=2)
for value in [0,-10,-20,-30,-40]:
 y=top-value/40*h;d.line((left,y,left+w,y),fill='#dfe3dd');text(d,(32,y-12),str(value),16)
for stage,color,width in [('travel','#83958c',3),('direction','#c76b49',4)]:
 points=[]
 for row in male['rows']:
  v=(row['stages'][stage]['pelvis'][0]-row['stages']['travel']['pelvis'][0])*1000
  points.append((left+row['phase']*w,top-v/40*h))
 d.line(points,fill=color,width=width)
for p in [0,.28,.58,.75,1]:text(d,(left+p*w-16,top+h+7),f'{p*100:.0f}%',16)
text(d,(112,335),'원본 이동 대비 추가 골반 X (mm) · 음수 = 캐릭터 오른쪽',18)
text(d,(610,635),'회색: 원본 이동 복원 직후 / 주황: 현재 최종',18)
im.save(OUT/'cmu-bilateral-chain-audit-pelvis.png')

im,d=new(820,'② 정면 방향을 맞춰도, 발끝 들림은 남습니다','실제 M50 · 각자의 착지 시작 / 남성형 · 양쪽 모두 발 최저점은 바닥 근처')
for i,(side,label,phase) in enumerate([('r','오른발 착지 · 주기 28%',.28),('l','왼발 착지 · 주기 75%',.75)]):
 x=30+i*595;text(d,(x,115),label,23)
 shot=Image.open(SRC/f'male-{side}-side.png').convert('RGB')
 # Crop the CURRENT (right-hand) comparison lane at a shared scale.
 shot=shot.crop((shot.width//2,0,shot.width,shot.height));shot.thumbnail((545,530));im.paste(shot,(x,155))
 f=pair(male,side,0)['stages']['direction']['feet'][side]
 gap=(f['toe']['mean'][1]-f['heel']['mean'][1])*1000
 text(d,(x,710),f'발끝 - 뒤꿈치 평균 높이: {gap:+.1f}mm',21)
 text(d,(x,749),f"발바닥 앞뒤 기울기: {f['skinPitch']:+.1f}°",21)
text(d,(30,790),'기본 자세에서 고정 선택한 피부 구역의 평균 · 실제 압력 중심/의학적 정상 범위가 아닙니다.',16)
im.save(OUT/'cmu-bilateral-chain-audit-landing.png')

im,d=new(675,'③ 착지 시작·중간·해제를 함께 봐야 합니다','검증 완료 · 남성형 실제 발바닥 피부 기준 / 수동 지지 구간을 같은 진행률로 비교')
rows=[]
for u,label in [(0,'착지 시작'),(.5,'지지 중간'),(1,'해제 끝')]:
 r=pair(male,'r',u)['stages']['direction']['feet']['r'];l=pair(male,'l',u)['stages']['direction']['feet']['l']
 rows.append((label,f"{r['skinYaw']:+.1f}°",f"{l['skinYaw']:+.1f}°",f"{r['skinPitch']:+.1f}°",f"{l['skinPitch']:+.1f}°"))
xs=[30,270,480,690,900];widths=[220,190,190,190,240]
headers=['지지 단계','오른발 방향','왼발 방향','오른발 앞뒤','왼발 앞뒤']
for ri,row in enumerate([headers]+rows):
 y=130+ri*78
 for x,w,s in zip(xs,widths,row):
  d.rectangle((x,y,x+w,y+68),fill='#e7ede8' if ri==0 else '#ffffff');text(d,(x+15,y+20),s,21)
text(d,(35,475),'착지 시작의 정면 방향은 개선됐지만, 해제 끝의 좌우 차이는 남아 있습니다.',22)
text(d,(35,520),'M50은 앞뒤 굽힘과 옆 기울기를 보존했습니다. 보존 검사는 이 차이도 그대로 통과시켰습니다.',19)
text(d,(35,572),'기준 동작의 착지 시작 무릎: 오른쪽 43.2° / 왼쪽 28.1°',22)
text(d,(35,613),'수동으로 정한 28%·75%가 실제로 대응하는 접촉 시점인지도 재검토해야 합니다.',19)
im.save(OUT/'cmu-bilateral-chain-audit-phases.png')

# Compact machine-readable conclusions, independently derived from trace JSON.
summary=[]
for model in data['results']:
 rows=model['rows'];extreme=min(rows,key=lambda r:r['stages']['chain']['pelvis'][0]-r['stages']['travel']['pelvis'][0])
 shifts=[[1000*(r['stages']['chain']['pelvis'][i]-r['stages']['travel']['pelvis'][i]) for i in range(3)]for r in rows]
 summary.append({'model':model['model'],'extraPelvisXmmRange':[min(s[0]for s in shifts),max(s[0]for s in shifts)],'extraPelvisYmmRange':[min(s[1]for s in shifts),max(s[1]for s in shifts)],'maxRightShiftPhase':extreme['phase'],'rightKneeAtMaxShiftDeg':extreme['stages']['direction']['feet']['r']['kneeFlex'],
  'paired':[{ 'u':r['u'],'side':r['side'],'phase':r['phase'],'foot':r['stages']['direction']['feet'][r['side']],'source':r['source'][r['side']]}for r in model['paired']]})
clip=json.loads((ROOT/'experiments/model-preview/review/data/cmu.json').read_text(encoding='utf-8'))[0]
raw=[]
for side,phase in [('r',.28),('l',.75)]:
 frame=54+91*phase;i=int(frame);u=frame-i
 def point(name):
  idx=clip['names'].index(name);a=clip['frames'][i]['p'][idx];b=clip['frames'][i+1]['p'][idx]
  return [x*(1-u)+y*u for x,y in zip(a,b)]
 def sub(a,b):return [x-y for x,y in zip(a,b)]
 H,K,A,B=[point(side+n)for n in ['hipjoint','femur','tibia','foot']];v=sub(B,A);h=sub(H,K);a=sub(A,K)
 raw.append({'side':side,'sourceZeroBasedFrame':frame,'method':'linear interpolation of original capture joint positions, independent of cycle rotation interpolation',
  'kneeFlexDeg':180-math.degrees(math.acos(sum(x*y for x,y in zip(h,a))/(math.hypot(*h)*math.hypot(*a)))),
  'footBonePitchDeg':math.degrees(math.atan2(v[1],math.hypot(v[0],v[2])))})
(REPORT/'cmu-bilateral-chain-summary.json').write_text(json.dumps({'models':summary,'originalCaptureAtAuthoredTouchdown':raw},indent=2),encoding='utf-8')
