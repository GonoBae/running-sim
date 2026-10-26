"""M52 figures from the recorded numerical test and actual browser captures."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'outputs/cmu-pelvis-reference-restore'
OUT = ROOT / 'docs/assets/images'
DATA = json.loads((ROOT / 'docs/05-validation/reports/cmu-pelvis-reference-restore.json').read_text(encoding='utf-8'))
BG, INK, OLD, NEW = '#faf9f6', '#233b32', '#bc6444', '#16866d'
def font(size): return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', size)
def text(d, xy, value, size=20, color=INK): d.text(xy, value, font=font(size), fill=color)

im = Image.new('RGB', (1300,935), BG); d = ImageDraw.Draw(im)
text(d,(30,22),'왼발 지지에만 더해지던 몸 이동을 제거했습니다',30)
text(d,(30,72),'수치 검사 완료 · 주황: 기존 M50 / 초록: 수정 M52 · 0 = 연동 보정 직전 골반 위치',19)
for col, result in enumerate(DATA['results']):
    x = 80 + 640*col
    name = '남성형' if result['model']=='male' else '여성형'
    text(d,(x,119),name,24)
    for row,(axis,label,limit) in enumerate([(0,'추가 좌우 이동 (mm)',40),(1,'추가 높이 (mm)',15)]):
        y=208+row*350; w=525; h=178
        text(d,(x,y-44),label,20)
        low,high=(-limit,0) if axis==0 else (0,limit)
        def py(v):return y+h-(v-low)/(high-low)*h
        for start,end in [(0,.09),(.75,1)]:d.rectangle((x+start*w,y,x+end*w,y+h),fill='#edf1e9')
        for value in ([0,-10,-20,-30,-40] if axis==0 else [0,5,10,15]):
            yy=py(value);d.line((x,yy,x+w,yy),fill='#d8dfd9');text(d,(x-48,yy-11),str(value),16)
        for lane,color,width in [(0,OLD,3),(1,NEW,4)]:
            points=[]
            for r in result['rows']:
                delta=(r['lanes'][lane]['bones']['pelvis']['p'][axis]-r['diagnostics'][lane]['reference'][axis])*1000
                points.append((x+r['phase']*w,py(delta)))
            d.line(points,fill=color,width=width)
        for p in [0,.28,.58,.75,1]:text(d,(x+p*w-12,y+h+8),f'{p*100:.0f}',16)
        text(d,(x+w-20,y+h+35),'주기 %',15)
        key='X' if axis==0 else 'Y'
        text(d,(x,y+h+63),f"최대 {result['metrics']['before'+key+'mm']:.1f}mm → 수치상 0mm",21)
text(d,(30,870),'기준: 원본 수평 이동 + 기존 접지 높이. 기존 골반 회전과 왼발의 착지점·방향은 유지했습니다.',18)
text(d,(30,904),'옅은 배경: 왼발 지지 구간 / 전체 달리기의 자연스러움·발바닥 들림 차이는 검토가 남아 있습니다.',17)
im.save(OUT/'cmu-pelvis-reference-restore-chart.png')

im=Image.new('RGB',(1320,1030),BG);d=ImageDraw.Draw(im)
text(d,(28,20),'같은 순간 · 정면 / 측면 재생 비교',30)
text(d,(28,67),'실제 남성형 화면 · 각 칸 왼쪽 M50 / 오른쪽 M52 · 자연스러움 사용자 검토 전',19)
for row,(phase,label) in enumerate([(920,'왼발 지지 · 오른다리 회수 · 주기 92%'),(430,'오른발 지지 · 기존 동작 유지 · 주기 43%')]):
    for col,(view,name) in enumerate([('front','정면'),('side','측면')]):
        x=28+660*col;y=116+row*425
        text(d,(x,y),name+' · '+label,19)
        shot=Image.open(SRC/f'male-{view}-{phase}.png').convert('RGB');shot.thumbnail((620,340))
        im.paste(shot,(x,y+44))
        text(d,(x+100,y+360),'기존 M50',18,OLD);text(d,(x+395,y+360),'수정 M52',18,NEW)
text(d,(28,979),'왼발 지지: 몸 기준 복원 + 발 위치를 유지하는 다리 재계산 / 공중 다리: 몸을 따라 이동, 상대 자세 유지',17)
text(d,(28,1006),'골반 회전·발목 기울기·좌우 접지 시점은 이번 수정에 포함하지 않았습니다.',16)
im.save(OUT/'cmu-pelvis-reference-restore-comparison.png')
