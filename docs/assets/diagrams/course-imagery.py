"""Scientific comparison figure; original rasters stay in outputs/course-imagery.
Fetch Esri tiles with course-imagery-fetch.py; Kakao evidence is a saved visible UI capture.
No pixel fit or length scale is applied to the service geometry.
"""
from pathlib import Path
import json,math,shutil
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[3];out=R/'outputs/course-imagery';images=R/'docs/assets/images';reports=R/'docs/05-validation/reports'
g=json.loads((out/'esri-georeference.json').read_text());base=json.loads((R/'experiments/model-preview/public/courses/lotte-garden-c-v1.json').read_text(encoding='utf8'));fixed=json.loads((R/'experiments/model-preview/public/courses/lotte-garden-d-v1.json').read_text(encoding='utf8'))
saved_evidence=reports/'course-imagery-evidence.json'
saved=json.loads(saved_evidence.read_text(encoding='utf8')) if saved_evidence.exists() else None
if saved and g['tiles']!=saved['esri']['georeference']['tiles']:
 raise ValueError('Imagery tiles changed since the reviewed evidence. Inspect the new imagery before regenerating.')
original=Image.open(out/'esri-mosaic.jpg');points=base['geometry']['coordinates']
def pixel(p):return ((6378137*math.radians(p[0])-g['left3857'])/g['resolution3857'],(g['top3857']-6378137*math.log(math.tan(math.pi/4+math.radians(p[1])/2)))/g['resolution3857'])
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
fig=Image.new('RGB',(1300,600),'#f8faf6');draw=ImageDraw.Draw(fig)
draw.text((28,18),'남동쪽 연결 오류 · 항공사진 대조',font=font(28),fill='#243b33')
draw.text((28,60),'넓은 광장의 보행로 연결점이 러닝 트랙 경로에 섞여 있었습니다.',font=font(19),fill='#53645d')
box=(1600,1030,1950,1180);scale=1.7
for x,title,coords,color in [(28,'수정 전 · 광장 안쪽으로 33.93 m',points[28:31],'#ed673e'),(668,'수정 후 · 트랙을 따라 28.78 m',[points[28],points[30]],'#00bda7')]:
 crop=original.crop(box).resize((595,255));d=ImageDraw.Draw(crop)
 px=[((pixel(p)[0]-box[0])*scale,(pixel(p)[1]-box[1])*scale) for p in coords]
 d.line(px,fill=color,width=5)
 for cx,cy in [px[0],px[-1]]:d.ellipse((cx-6,cy-6,cx+6,cy+6),fill='white',outline=color,width=3)
 fig.paste(crop,(x,140));draw.text((x,103),title,font=font(22),fill=color)
draw.text((28,422),'한 바퀴 1,187.30 → 1,182.14 m   ·   4 km 도착 위치 약 20.6 m 차이',font=font(24),fill='#243b33')
draw.text((28,465),'확인된 국소 오류만 수정 · 출발 위치/사용자 설정 유지 · 현장 거리 차이 전체 해결은 미검증',font=font(19),fill='#806344')
draw.text((28,513),'Esri World Imagery / Vantor · 2025-12-22 · 원본 해상도 0.5 m / 제공 위치 정확도 8.47 m',font=font(17),fill='#53645d')
draw.text((28,547),'항공영상: Esri, Vantor, Earthstar Geographics, GIS User Community · 기존 경로: © OpenStreetMap contributors / ODbL',font=font(16),fill='#53645d')
fig.save(images/'course-imagery-detail.png')
# Overview keeps the whole park and named corners visible; no imagery alignment fit.
unit=json.loads((reports/'course-imagery-unit.json').read_text(encoding='utf8'))
overview=Image.new('RGB',(1300,960),'#f8faf6');od=ImageDraw.Draw(overview)
od.text((28,18),'전체 경로와 남은 차이 · 수정 후 D',font=font(28),fill='#243b33')
od.text((28,63),'좌표를 항공사진에 그대로 투영 · 청록: 수정 경로 / 주황: 제거한 우회',font=font(19),fill='#53645d')
overview.paste(original.resize((1300,722)),(0,110))
def screen(p):
 x,y=pixel(p);return x*1300/original.width,110+y*722/original.height
od.line([screen(p) for p in fixed['geometry']['coordinates']],fill='#00d4b7',width=3)
od.line([screen(p) for p in points[28:31]],fill='#ff7844',width=4)
def label(p,text,offset,color):
 x,y=screen(p);tx,ty=x+offset[0],y+offset[1]
 od.line((x,y,tx,ty),fill=color,width=2);od.ellipse((x-5,y-5,x+5,y+5),fill=color,outline='white',width=2)
 bounds=od.textbbox((tx,ty),text,font=font(19));od.rounded_rectangle((bounds[0]-7,bounds[1]-5,bounds[2]+7,bounds[3]+5),radius=6,fill='#f8faf6')
 od.text((tx,ty),text,font=font(19),fill=color)
for i,l in enumerate(fixed['landmarks'][:4]):label(l['coordinate'],'ABCD'[i],[(-35,-45),(-4,-48),(25,10),(-45,-45)][i],'#233c34')
origin=points[0];rad=math.pi/180
def lonlat(local):return [origin[0]+local[0]/(6371008.8*math.cos(origin[1]*rad)*rad),origin[1]+local[1]/(6371008.8*rad)]
remaining=unit['observedStartAfterM']
for a,b in zip(fixed['geometry']['coordinates'],fixed['geometry']['coordinates'][1:]):
 h=math.sin((b[1]-a[1])*rad/2)**2+math.cos(a[1]*rad)*math.cos(b[1]*rad)*math.sin((b[0]-a[0])*rad/2)**2
 length=2*6371008.8*math.asin(math.sqrt(h))
 if remaining<=length:
  label([a[i]+(b[i]-a[i])*remaining/length for i in [0,1]],'기존 출발 · 반시계',(25,-25),'#b25429');break
 remaining-=length
for km,offset,text in [(3,(-195,12),'3 km · 아직 B 전 51.9 m'),(4,(-230,22),'4 km · 아직 C 전 5.0 m')]:
 p=next(m['after'] for m in unit['milestones'] if m['km']==km);label(lonlat(p),text,offset,'#6553b8')
od.text((28,851),'확인: 국소 우회 제거 5.15 m/바퀴   |   미해결: 사용자 설명의 3 km·4 km 도착점 차이 전체',font=font(21),fill='#243b33')
od.text((28,891),'서쪽 기존 출발점·반시계 기준 · 항공사진도 측량 자료는 아님 · 위치 정확도 메타데이터 8.47 m',font=font(18),fill='#806344')
od.text((28,927),'Esri / Vantor / Earthstar Geographics / GIS User Community · © OpenStreetMap contributors / ODbL',font=font(16),fill='#53645d')
overview.save(images/'course-imagery-overview.png')
for src,dest in [('kakao-aerial.png','course-imagery-kakao-aerial.png'),('kakao-measure.png','course-imagery-kakao-measure.png')]:
 if (out/src).exists():shutil.copyfile(out/src,images/dest)
 elif not (images/dest).exists():raise FileNotFoundError(f'Missing saved visible screenshot: {dest}')
# Preserve acquisition metadata and numeric evidence, not the large research raster.
meta=saved['esri']['acquisition'] if saved else next(r['attributes'] for r in json.loads((out/'esri-identify.json').read_text())['results'] if r['layerId']==0)
kakao=saved['kakao'] if saved else json.loads((out/'kakao-trace.json').read_text(encoding='utf8'))
report={'milestone':'M93','status':'local-geometry-error-confirmed-and-corrected','esri':{'service':'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer','acquisition':meta,'georeference':g},'kakao':kakao,'correction':fixed['source']['correction'],'wholeFieldDifferenceExplained':False,'coordinateFitApplied':False,'manualDistanceScaleApplied':False}
(reports/'course-imagery-evidence.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('figure and source evidence generated')
