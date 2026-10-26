"""M60 figures from real browser measurements and captures."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3];dest=root/'docs/assets/images'
data=json.loads((root/'docs/05-validation/reports/cmu-body-height.json').read_text())
assert data['status']=='passed'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';old='#a5816a';new='#247c66'
def rise(values):
    low=values[0];maximum=0
    for v in values:low=min(low,v);maximum=max(maximum,v-low)
    return maximum*1000
summary=[]
for r in data['results']:
    summary.append({'model':r['model'],'beforeRiseMm':rise([p['beforeY'] for p in r['detail']]),
        'afterRiseMm':rise([p['afterY'] for p in r['detail']]),
        'maxLandingGapMm':max(p['afterMm'] for p in r['landing']),
        'minModifiedFlightGapMm':min(min(p['floors'][1].values())*1000 for p in r['rows'] if .101<=p['phase']%.5<=.239),
        'maxBodyDeltaMm':r['metrics']['maxDeltaMm']})
(root/'docs/05-validation/reports/cmu-body-height-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')

def chart(d,box,rows,xlim,ylim,title,origin,unit='mm',bands=False):
    x,y,w,h=box;d.text((x,y-42),title,font=font(23),fill=ink)
    lo,hi=ylim
    X=lambda t:x+(t-xlim[0])/(xlim[1]-xlim[0])*w
    Y=lambda v:y+h-(v-lo)/(hi-lo)*h
    if bands:
        for a,b in [(.10,.24),(.60,.74)]:d.rectangle((X(a),y,X(b),y+h),fill='#e3eee3')
    for j in range(5):
        v=lo+(hi-lo)*j/4;yy=Y(v);d.line((x,yy,x+w,yy),fill='#d5ded5');d.text((x-54,yy-10),f'{v:g}',font=font(17),fill=muted)
    ticks=6 if xlim[1]-xlim[0]<.1 else 5
    for j in range(ticks+1):
        t=xlim[0]+(xlim[1]-xlim[0])*j/ticks;xx=X(t);d.text((xx-12,y+h+12),f'{t*100:g}',font=font(17),fill=muted)
    d.text((x-54,y-36),unit,font=font(17),fill=muted)
    for key,color,width in [('beforeY',old,4),('afterY',new,4)]:
        d.line([(X(r['phase']),Y((r[key]-origin)*1000)) for r in rows],fill=color,width=width)

img=Image.new('RGB',(1320,1080),bg);d=ImageDraw.Draw(img)
d.text((28,20),'M60 · 짧은 추가 상승을 공중 구간 안에서 연결',font=font(30),fill=ink)
d.text((28,68),'구현·수치 검사 완료 · 갈색 기존 M58 / 초록 수정 M60 · 남성형 실제 좌표',font=font(20),fill=muted)
r=data['results'][0];base=min(v['beforeY'] for v in r['rows'])
chart(d,(95,164,1130,260),r['rows'],(0,1),(0,80),'전체 주기 · 연한 초록 구간만 높이 변경',base,bands=True)
d.text((445,470),'10~24% / 60~74% · 관절 회전 그대로',font=font(20),fill=ink)
chart(d,(95,580,1130,265),r['detail'],(.1,.16),(-15,15),'문제 구간 확대 · 시작 높이를 0으로',r['detail'][0]['beforeY'])
for i,s in enumerate(summary):
    label='남성형' if i==0 else '여성형'
    d.text((28,920+i*43),f"{label}: 추가 상승 {s['beforeRiseMm']:.1f}mm → {s['afterRiseMm']:.1f}mm · 전체 높이 변경 최대 {s['maxBodyDeltaMm']:.1f}mm",font=font(23),fill=ink)
d.text((28,1027),'10~16% 구간의 이전 최저점 대비 최대 되솟음입니다. 전체 상하 운동을 없앤 것이 아닙니다.',font=font(18),fill=muted)
img.save(dest/'cmu-body-height-curves.png')

img=Image.new('RGB',(1320,650),bg);d=ImageDraw.Draw(img)
d.text((28,20),'착지·지지 높이와 발목 회전을 함께 검사했습니다',font=font(28),fill=ink)
d.text((28,66),'남녀 양발 · 독립 피부 정점 계산 · 기존 착지·지지 표본의 높이 차이 0mm',font=font(20),fill=muted)
for j,r in enumerate(data['results']):
    x,y,w,h=105+j*650,180,470,240
    label='남성형' if j==0 else '여성형';d.text((x,y-35),label,font=font(23),fill=ink)
    for k in range(5):
        v=k*.01;yy=y+h-v/.04*h;d.line((x,yy,x+w,yy),fill='#d5ded5');d.text((x-58,yy-10),f'{v:.2f}',font=font(17),fill=muted)
    for side,width,color in [('r',6,old),('l',3,new)]:
        rows=[p for p in r['landing'] if p['side']==side]
        d.line([(x+p['u']*w,y+h-p['afterMm']/.04*h) for p in rows],fill=color,width=width)
        for p in rows:
            px,py=x+p['u']*w,y+h-p['afterMm']/.04*h
            d.ellipse((px-4,py-4,px+4,py+4),fill=color)
    for k in range(5):d.text((x+k*w/4-10,y+h+10),str(k*25),font=font(16),fill=muted)
    d.text((x+60,y+h+44),'검사 구간 진행률 (%)',font=font(18),fill=muted)
d.text((28,110),'발 피부 최저 높이 (mm) · 갈색 오른발 / 초록 왼발',font=font(18),fill=muted)
d.text((28,520),'바닥 침투 없음 · 착지·지지 표본 최대 간격 0.04mm 미만 · 관절 회전 차이 <0.001°',font=font(23),fill=ink)
d.text((28,563),'검사 구간: 오른발 28~56% / 왼발 반 주기 뒤 · 1mm 이내 표본도 전 주기 별도 대조',font=font(18),fill=muted)
d.text((28,605),'공중 구간의 발 높이는 몸 높이와 함께 바뀝니다. 실제 마찰·수평 미끄러짐 교정은 포함하지 않습니다.',font=font(18),fill=muted)
img.save(dest/'cmu-body-height-contact.png')

img=Image.new('RGB',(1280,1380),bg);d=ImageDraw.Draw(img)
d.text((26,20),'실제 비교 · 왼쪽 기존 / 오른쪽 높이 연결',font=font(29),fill=ink)
for i,view in enumerate(['front','side']):
    y=83+i*615;d.text((26,y),'정면 · 주기 13.7%' if i==0 else '측면 · 같은 순간',font=font(22),fill=ink)
    photo=Image.open(root/f'outputs/cmu-body-height/male-{view}-137.png').convert('RGB');photo.thumbnail((1220,570));img.paste(photo,(30,y+40))
d.text((26,1325),'몸 전체의 수직 이동만 바뀝니다. 회전·상대 자세·좌우/앞뒤 이동은 그대로입니다.',font=font(19),fill=muted)
img.save(dest/'cmu-body-height-comparison.png')
print(json.dumps(summary,ensure_ascii=False,indent=2))
