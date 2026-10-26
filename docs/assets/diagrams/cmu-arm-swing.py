"""M70 measured arm curves and labelled, otherwise unmodified browser captures."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-arm-swing.json').read_text(encoding='utf-8'))
assert report['status']=='passed'
raw=root/'outputs/cmu-arm-swing';out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';orange='#b96540';blue='#1687ad'
summary={k:v for k,v in report.items() if k!='results'}
summary['results']=[]
for r in report['results']:
    ranges={}
    for key in ['before','after']:
        a=[f[key]['r']['swing'] for f in r['frames']]
        ranges[key]={'minDegrees':min(a),'maxDegrees':max(a),'spanDegrees':max(a)-min(a)}
    summary['results'].append({k:v for k,v in r.items() if k!='frames'}|{'ranges':ranges})
(root/'docs/05-validation/reports/cmu-arm-swing-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
im=Image.new('RGB',(1400,690),bg);d=ImageDraw.Draw(im)
d.text((30,22),'한쪽 팔만 복제하면서 빠진 흔들림을 반영',font=font(31),fill=ink)
d.text((30,72),'M70 측정 결과 · 주황 M69 / 파랑 M70 / 회색 기존 왼팔을 반 주기 맞춘 값',font=font(21),fill=muted)
for mi,r in enumerate(report['results']):
    x=85+mi*690;y=180;w=560;h=310
    a=summary['results'][mi]['ranges']
    title=('남성형' if mi==0 else '여성형')+f" · 앞뒤 범위 {a['before']['spanDegrees']:.1f}° → {a['after']['spanDegrees']:.1f}°"
    d.text((x-25,126),title,font=font(23),fill=ink)
    proj=lambda t,z:(x+t*w,y+h-(z+50)/60*h)
    for value in [-50,-40,-30,-20,-10,0,10]:
        yy=proj(0,value)[1];d.line((x,yy,x+w,yy),fill='#d3ddd5')
        d.text((x-48,yy-12),str(value),font=font(18),fill=muted)
    for key,color in [('rawLeftShifted','#aab4ae'),('before',orange),('after',blue)]:
        pts=[proj(f['t'],f[key]['r']['swing'] if key in ['before','after'] else f[key]) for f in r['frames']]
        d.line(pts,fill=color,width=4)
    for t in [0,.25,.5,.75,1]:
        d.text((x+t*w-12,y+h+14),str(round(t*100)),font=font(18),fill=muted)
    d.text((x+80,y+h+47),'가로: 주기(%) · 세로: 몸통 기준 위팔 각도(°)',font=font(18),fill=muted)
d.text((30,588),'확인된 원인: 기존 오른팔 전달값 약 28°만 공유 / 몸통 연결 단계에서 추가 감소 없음',font=font(22),fill=ink)
d.text((30,632),'35_17을 모델에 전달한 M56 캐시를 사용한 합성입니다. 음수는 뒤쪽이며, 정상 러닝의 권장 각도가 아닙니다.',font=font(19),fill=muted)
im.save(out/'cmu-arm-swing-curves.png')

im=Image.new('RGB',(1400,1270),bg);d=ImageDraw.Draw(im)
d.text((30,20),'정면·측면 / 같은 시각의 실제 비교',font=font(31),fill=ink)
d.text((30,67),'M69 기존 → M70 수정 · 남성형 65% · 여성형 15% / 수치·재생 검사 완료 · 외형 검토 전',font=font(20),fill=muted)
for row,(model,phase) in enumerate([('male',65),('female',15)]):
    y=115+row*540
    for col,view in enumerate(['front','side']):
        x=25+col*690
        d.text((x+25,y),('남성형' if row==0 else '여성형')+' · '+('정면' if col==0 else '측면'),font=font(22),fill=ink)
        d.text((x+115,y+34),'기존',font=font(21),fill=orange)
        d.text((x+485,y+34),'수정',font=font(21),fill=blue)
        # Both lanes, whole-body crop. Preserve geometry/proportions.
        photo=Image.open(raw/f'{model}-{view}-{phase}.png').crop((245,65,960,545))
        photo.thumbnail((660,445));im.paste(photo,(x,y+65))
d.text((30,1225),'손 모양은 기존 그대로입니다. 뒷팔 범위가 조금 늘어난 결과이며, 전체 자연스러움의 완료 판정은 아닙니다.',font=font(19),fill=muted)
im.save(out/'cmu-arm-swing-comparison.png')
print(json.dumps([r['ranges'] for r in summary['results']],indent=2))
