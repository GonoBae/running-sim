"""M74: measured paths, actual browser captures, and a small-change diagram."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[3]
r = json.loads((root/'docs/05-validation/reports/cmu-support-join.json').read_text(encoding='utf-8'))
assert r['status'] == 'passed'
out = root/'docs/assets/images'
raw = root/'outputs/cmu-support-join'
font = lambda n: ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', n)
bg, ink, muted, orange, blue = '#f6f5f1', '#233b32', '#63736a', '#bc6842', '#1687ad'
summary = {k:v for k,v in r.items() if k!='results'}
summary['results'] = [{k:v for k,v in x.items() if k!='frames'} for x in r['results']]
(root/'docs/05-validation/reports/cmu-support-join-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

im = Image.new('RGB',(1400,790),bg)
d = ImageDraw.Draw(im)
d.text((32,22),'왼발 합류 / 줄어든 양은 작고, 이동은 남습니다',font=font(32),fill=ink)
d.text((32,75),'M74 실제 측정 · 주황 M73 / 파랑 M74 · 같은 피부점의 수평 누적 경로',font=font(21),fill=muted)
for mi,m in enumerate(r['results']):
    x, y, w, h = 85+mi*690, 198, 565, 260
    rows = [f for f in m['frames'] if .86-1e-9<=f['t']<=.93+1e-9]
    xx = lambda t: x+(t-.86)/.07*w
    yy = lambda v: y+h-v/18*h
    d.text((x-25,132),('남성형 · 작은 보정' if mi==0 else '여성형 · 기존 유지'),font=font(25),fill=ink)
    d.rectangle((xx(.88),y,xx(.93),y+h),fill='#e7eee7')
    for value in [0,6,12,18]:
        d.line((x,yy(value),x+w,yy(value)),fill='#ced8ce')
        d.text((x-35,yy(value)-12),str(value),font=font(18),fill=muted)
    for key,col in [('before',orange),('after',blue)]:
        total=0
        points=[(xx(rows[0]['t']),yy(0))]
        for a,b in zip(rows,rows[1:]):
            p,q=a[key]['l']['point'],b[key]['l']['point']
            total+=((p[0]-q[0])**2+(p[2]-q[2])**2)**.5*1000
            points.append((xx(b['t']),yy(total)))
        d.line(points,fill=col,width=4)
    for t in [86,88,90,93]:
        d.text((xx(t/100)-12,y+h+10),str(t),font=font(18),fill=muted)
    d.text((x-25,505),'가로 주기(%) / 세로 누적 이동(mm)',font=font(19),fill=muted)
    p=m['paths']['l']['join']
    d.text((x-25,551),f"합류 전체  {p['beforeMm']:.2f} → {p['afterMm']:.2f}mm",font=font(24),fill=ink)
    p=m['paths']['l']['nearGround']
    d.text((x-25,599),f"지면 근처  {p['beforeMm']:.2f} → {p['afterMm']:.2f}mm",font=font(23),fill=ink)
d.text((32,676),'두 선이 거의 겹칠 정도의 변화입니다. 정면·측면 외형 개선을 크게 주장하지 않습니다.',font=font(23),fill=ink)
d.text((32,723),'지면 근처: 78–93% 중 같은 피부점 높이 ≤ 1mm인 연속 표본 / 실제 마찰·접촉력 측정 아님',font=font(20),fill=muted)
im.save(out/'cmu-support-join-curves.png')

im = Image.new('RGB',(1400,920),bg)
d = ImageDraw.Draw(im)
d.text((32,22),'정면·측면 / 왼발 합류 구간 실제 화면',font=font(32),fill=ink)
d.text((32,72),'남성형 · 각 쌍 왼쪽 기존 M73 / 오른쪽 수정 M74 · 변화가 작은 비교입니다',font=font(21),fill=muted)
for row,t in enumerate([89,91]):
    y=130+row*342
    for col,view in enumerate(['front','side']):
        x=25+col*690
        d.text((x+15,y),f"{t}% · "+('정면' if col==0 else '측면'),font=font(23),fill=ink)
        d.text((x+180,y),'기존',font=font(20),fill=orange)
        d.text((x+515,y),'수정',font=font(20),fill=blue)
        photo=Image.open(raw/f'male-{view}-{t}.png').crop((245,240,960,545))
        photo.thumbnail((660,285))
        im.paste(photo,(x,y+40))
d.text((32,839),'발 방향·높이·골반 이동 유지 / 다리 뼈를 이동·늘리지 않고 고관절–무릎 회전으로 연결',font=font(21),fill=muted)
d.text((32,880),'수치·재생 검사 완료 / 실제 사람의 접촉력·자연스러움 검증 아님',font=font(20),fill=muted)
im.save(out/'cmu-support-join-comparison.png')

im = Image.new('RGB',(1400,690),bg)
d = ImageDraw.Draw(im)
d.text((32,22),'전신 비교 / 몸과 발 방향은 그대로',font=font(32),fill=ink)
d.text((32,72),'남성형 90% 실제 화면 · 각 쌍 왼쪽 M73 / 오른쪽 M74',font=font(21),fill=muted)
for col,view in enumerate(['front','side']):
    x=25+col*690
    d.text((x+20,118),'정면' if col==0 else '측면',font=font(23),fill=ink)
    photo=Image.open(raw/f'male-{view}-90.png').crop((245,65,960,545))
    photo.thumbnail((660,445))
    im.paste(photo,(x,166))
d.text((32,637),'초기 착지·오른발·범위 밖 회수: 기존 좌표와 일치 / 좌우 자세 차이 최대값 유지·평균 제곱근 감소',font=font(19),fill=muted)
im.save(out/'cmu-support-join-full.png')
print('M74 figures and summary generated.')
