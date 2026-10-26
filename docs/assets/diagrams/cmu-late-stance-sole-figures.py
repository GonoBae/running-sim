"""M54: independent skin measurements and real comparison-page captures."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]; SRC=ROOT/'outputs/cmu-late-stance-sole'; OUT=ROOT/'docs/assets/images'
DATA=json.loads((ROOT/'docs/05-validation/reports/cmu-late-stance-sole.json').read_text(encoding='utf-8'))
BG,INK,OLD,NEW='#faf9f6','#233b32','#bc6444','#16866d'
def font(size):return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',size)
def text(d,xy,s,size=20,color=INK):d.text(xy,s,font=font(size),fill=color)

im=Image.new('RGB',(1300,940),BG);d=ImageDraw.Draw(im)
text(d,(28,22),'발을 밀어내는 회전을 살리며 좌우 차이를 줄였습니다',30)
text(d,(28,70),'실제 남성형 · 주황: M53 / 초록: M54 · 실선: 오른발 / 점선: 왼발',19)
male=DATA['results'][0]
for col,(metric,label,low,high) in enumerate([('pitch','앞뒤 각도 · 뒤꿈치가 들릴수록 음수 (°)',-70,5),('bank','발의 길이축을 기준으로 한 옆 기울기 (°)',-50,25)]):
    x=78+650*col;y=165;w=525;h=270
    text(d,(x-10,y-45),label,19)
    def px(u):return x+(u-.25)/.85*w
    def py(v):return y+h-(v-low)/(high-low)*h
    d.rectangle((px(.25),y,px(.65),y+h),fill='#e6eee6')
    d.rectangle((px(.65),y,px(1),y+h),fill='#f3eee0')
    for v in ([-60,-40,-20,0] if metric=='pitch' else [-40,-20,0,20]):
        yy=py(v);d.line((x,yy,x+w,yy),fill='#d7ddd8');text(d,(x-42,yy-10),str(v),16)
    for side,dash in [('r',False),('l',True)]:
        start,duration=(.28,.30) if side=='r' else (.75,.34)
        for lane,color in [(0,OLD),(1,NEW)]:
            samples=[]
            for r in male['rows']:
                p=r['phase']
                if side=='l' and p<.75:p+=1
                u=(p-start)/duration
                if .25<=u<=1.1:samples.append((u,r['lanes'][lane]['feet'][side][metric]))
            points=[(px(u),py(v)) for u,v in sorted(samples)]
            if dash:
                for i in range(0,len(points)-1,3):d.line(points[i:i+2],fill=color,width=3)
            else:d.line(points,fill=color,width=3)
    for u in [.25,.5,.65,.85,1,1.1]:text(d,(px(u)-12,y+h+10),f'{u*100:g}',16)
    text(d,(x,y+h+44),'지지 진행률 % · 100% 이후: 기존 회수',17)
text(d,(28,520),'25~65%: 공통 밀어내기 기준 → 65~100%: 기존 자세로 복귀 → 회수는 유지',21)

headers=['지지 75%의 좌우 차이','남성형 · 기존 → 수정','여성형 · 기존 → 수정']
xs=[28,460,885];ws=[412,405,385]
rows=[headers]
for key,label,unit in [('pitchGapDeg','앞뒤 각도','°'),('bankGapDeg','길이축 기준 옆 기울기','°'),('heelHeightGapMm','뒤꿈치 평균 높이','mm'),('toeHeightGapMm','발끝 평균 높이','mm')]:
    row=[label]
    for result in DATA['results']:
        p=next(p for p in result['pairMetrics'] if p['u']==.75)
        row.append(f"{p['before'][key]:.2f}{unit} → {p['after'][key]:.2f}{unit}")
    rows.append(row)
for ri,row in enumerate(rows):
    yy=575+ri*58
    for x,w,s in zip(xs,ws,row):d.rectangle((x,yy,x+w,yy+50),fill='#e6ede7' if ri==0 else '#ffffff');text(d,(x+12,yy+13),s,18)
text(d,(28,887),'검증 완료: 남녀 730자세·M53 골반/착지 지면 좌표·회수 보존 / 지지 종료 순간의 차이는 남습니다.',17)
text(d,(28,917),'각도는 피부 구역으로 만든 발 기준축의 기하학적 측정값이며 임상적 발목 관절각이 아닙니다.',16)
im.save(OUT/'cmu-late-stance-sole-metrics.png')

for view,name in [('front','정면'),('side','측면')]:
    im=Image.new('RGB',(1080,1390),BG);d=ImageDraw.Draw(im)
    text(d,(28,22),f'양발 지지 후반 · {name} 확대 비교',30)
    text(d,(28,70),'실제 남성형 · 각자의 지지 75% · 같은 배율·기준 위치 / 자연스러움 검토 전',17)
    for row,(side,label,phase) in enumerate([('r','오른발','50.5%'),('l','왼발','0.5%')]):
        y=120+row*600;text(d,(28,y),f'{label} 지지 후반 · 주기 {phase}',23)
        for lane in [0,1]:
            x=28+530*lane;text(d,(x,y+40),'기존 M53' if lane==0 else 'M54 · 지지 후반 연결',21,OLD if lane==0 else NEW)
            im.paste(Image.open(SRC/f'close-{side}-{view}-{lane}.png').convert('RGB'),(x,y+76))
    text(d,(28,1330),'발을 세우는 회전 유지 · 골반·착지 기준점 지면 X/Z·발 최저 높이·회수 보존',18)
    text(d,(28,1364),'모든 발바닥 점의 고정은 아닙니다. 피부점 높이와 발끝 구역의 지면 위치 변화는 별도 기록했습니다.',16)
    im.save(OUT/f'cmu-late-stance-sole-{view}.png')

im=Image.new('RGB',(1320,1010),BG);d=ImageDraw.Draw(im)
text(d,(28,22),'지지 후반 · 정면 / 측면 재생 비교',30)
text(d,(28,68),'실제 남성형 · 각 칸 왼쪽 M53 / 오른쪽 M54 · 각자의 지지 75%',19)
for row,(phase,name) in enumerate([(505,'오른발 지지'),(5,'왼발 지지')]):
    for col,(view,label) in enumerate([('front','정면'),('side','측면')]):
        x=28+660*col;y=118+row*420;text(d,(x,y),f'{name} · {label}',22)
        shot=Image.open(SRC/f'male-{view}-{phase}.png').convert('RGB');shot.thumbnail((620,330));im.paste(shot,(x,y+42))
        text(d,(x+98,y+355),'기존 M53',18,OLD);text(d,(x+395,y+355),'수정 M54',18,NEW)
text(d,(28,958),'초기 착지 이후 정렬을 후반에 연결하고, 회수 시작 전에 기존 자세로 복귀합니다.',18)
text(d,(28,988),'수치 검사 완료 / 물리적 균형·모든 발바닥 접지·전체 자연스러움은 미검증입니다.',16)
im.save(OUT/'cmu-late-stance-sole-comparison.png')
