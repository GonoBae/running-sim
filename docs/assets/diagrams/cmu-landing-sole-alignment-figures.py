"""M53: measured skin-region plots and actual browser screenshots."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
SRC=ROOT/'outputs/cmu-landing-sole-alignment'; OUT=ROOT/'docs/assets/images'
DATA=json.loads((ROOT/'docs/05-validation/reports/cmu-landing-sole-alignment.json').read_text(encoding='utf-8'))
BG,INK,OLD,NEW='#faf9f6','#233b32','#bc6444','#16866d'
def font(size): return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',size)
def text(d,xy,s,size=20,color=INK): d.text(xy,s,font=font(size),fill=color)

for view,name in [('front','정면'),('side','측면')]:
    im=Image.new('RGB',(1080,1390),BG);d=ImageDraw.Draw(im)
    text(d,(28,22),f'양발 착지 초기 · {name} 확대 비교',30)
    text(d,(28,70),'실제 남성형 화면 · 같은 배율·기준 위치 · 수치 검사 완료 / 자연스러움 검토 전',17)
    for row,(side,label,phase) in enumerate([('r','오른발',28),('l','왼발',75)]):
        y=120+row*600
        text(d,(28,y),f'{label} 착지 · 주기 {phase}%',23)
        for lane in [0,1]:
            x=28+530*lane
            text(d,(x,y+40),'기존 M52' if lane==0 else 'M53 · 착지 초기 교정',21,OLD if lane==0 else NEW)
            im.paste(Image.open(SRC/f'close-{side}-{view}-{lane}.png').convert('RGB'),(x,y+76))
    text(d,(28,1330),'골반 이동·착지점 지면 X/Z·발 최저 높이 유지 / 발목 위치는 다리 연동으로 조절',18)
    text(d,(28,1364),'발바닥 피부 구역의 수평 목표입니다. 실제 접촉 압력·의학적 정상 각도를 판정하지 않습니다.',16)
    im.save(OUT/f'cmu-landing-sole-alignment-{view}.png')

im=Image.new('RGB',(1300,880),BG);d=ImageDraw.Draw(im)
text(d,(28,22),'같은 착지 단계에서 좌우 차이를 줄였습니다',30)
text(d,(28,70),'남성형 · 피부 구역 측정 · 주황: 기존 M52 / 초록: 수정 M53',19)
male=DATA['results'][0]
xs=[28,340,650,960]; widths=[292,290,290,310]
headers=['착지 순간','오른발 기존 → 수정','왼발 기존 → 수정','좌우 차이 기존 → 수정']
paired={s:next(r for r in male['landmarks'] if r['side']==s and r['u']==0) for s in ['r','l']}
table=[headers]
for metric,label,unit in [('tilt','옆 기울기','°'),('toeHeelMm','발끝−뒤꿈치 높이','mm')]:
    values={s:[paired[s]['lanes'][i]['feet'][s][metric] for i in [0,1]] for s in ['r','l']}
    table.append([label,*[f'{values[s][0]:+.1f}{unit} → 약 0' for s in ['r','l']],f"{abs(values['r'][0]-values['l'][0]):.1f}{unit} → 약 0"])
for row,values in enumerate(table):
    y=120+row*67
    for x,w,s in zip(xs,widths,values):
        d.rectangle((x,y,x+w,y+58),fill='#e6ede7' if row==0 else '#ffffff');text(d,(x+12,y+17),s,17)

for col,(metric,label,low,high) in enumerate([('tilt','발바닥 옆 기울기 (°)',-18,18),('toeHeelMm','발끝−뒤꿈치 높이 (mm)',-30,18)]):
    x=78+650*col;y=408;w=525;h=236
    text(d,(x,y-47),label,22)
    def py(v):return y+h-(v-low)/(high-low)*h
    d.rectangle((x,y,x+w*.5,y+h),fill='#edf1e9')
    for v in ([ -15,0,15] if metric=='tilt' else [-30,-15,0,15]):
        yy=py(v);d.line((x,yy,x+w,yy),fill='#d8dfd9');text(d,(x-43,yy-11),str(v),16)
    for side,dash in [('r',False),('l',True)]:
        start,duration=(.28,.30) if side=='r' else (.75,.34)
        for lane,color in [(0,OLD),(1,NEW)]:
            points=[]
            for r in male['rows']:
                u=(r['phase']-start)/duration
                if 0<=u<=.5:points.append((x+u/.5*w,py(r['lanes'][lane]['feet'][side][metric])))
            if dash:
                for i in range(0,len(points)-1,3):d.line(points[i:i+2],fill=color,width=3)
            elif len(points)>1:d.line(points,fill=color,width=3)
    for u in [0,.125,.25,.375,.5]:text(d,(x+u/.5*w-10,y+h+10),f'{u*100:g}',16)
    text(d,(x,y+h+42),'지지 진행률 % · 실선: 오른발 / 점선: 왼발',17)
text(d,(28,736),'착지~지지 25%: 수평 기준 적용 → 25~50%: 기존 자세로 연결 → 후반 밀어내기·회수 유지',20)
text(d,(28,780),'여성형도 착지 초기 옆 기울기·발끝/뒤꿈치 차이 감소를 확인했습니다. 남녀 730자세 검사 통과.',18)
text(d,(28,820),'같은 피부점의 지면 X/Z와 발 최저 높이 보존. 회전 때문에 해당 피부점 자체의 높이는 최대 5.07mm 변합니다.',17)
text(d,(28,850),'수동 지지 구간·기본 남녀 모델·35_17 한 주기 검증이며, 전체 달리기 품질 통과를 뜻하지 않습니다.',16)
im.save(OUT/'cmu-landing-sole-alignment-metrics.png')

im=Image.new('RGB',(1320,1010),BG);d=ImageDraw.Draw(im)
text(d,(28,22),'양발 · 정면 / 측면 비교 재생',30)
text(d,(28,68),'실제 남성형 · 각 칸 왼쪽 M52 / 오른쪽 M53 · 동일 시점',19)
for row,(phase,name) in enumerate([(280,'오른발 착지'),(750,'왼발 착지')]):
    for col,(view,label) in enumerate([('front','정면'),('side','측면')]):
        x=28+660*col;y=118+row*420;text(d,(x,y),f'{name} · {label}',22)
        shot=Image.open(SRC/f'male-{view}-{phase}.png').convert('RGB');shot.thumbnail((620,330));im.paste(shot,(x,y+42))
        text(d,(x+98,y+355),'기존 M52',18,OLD);text(d,(x+395,y+355),'수정 M53',18,NEW)
text(d,(28,958),'골반 위치·회전과 기존 착지점 지면 좌표 유지 / 발 방향은 유지하고 착지 초기의 기울기만 교정',18)
text(d,(28,988),'발목 피부 접힘 전체·지지 후반의 좌우 차이·물리적 균형은 미검증 또는 이번 범위 밖입니다.',16)
im.save(OUT/'cmu-landing-sole-alignment-comparison.png')
