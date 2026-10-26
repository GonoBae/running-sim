"""Actual A/B benchmark plots and browser captures. Run from any directory."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops

root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-mocap-preparation.json').read_text('utf-8'))
assert report.get('status')=='passed', 'Generate verified figures only after the complete A/B test passes'
for model in ['male','female']:
    for view in ['front','side']:
        a=Image.open(root/f'outputs/cmu-preparation/{model}-original-{view}.png')
        b=Image.open(root/f'outputs/cmu-preparation/{model}-batch-{view}.png')
        assert ImageChops.difference(a,b).getbbox() is None, 'Same-phase rendered poses must match'
font=lambda n: ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1'; ink='#233b32'; muted='#63736a'; before='#b96540'; after='#16877a'
img=Image.new('RGB',(1280,870),bg);d=ImageDraw.Draw(img)
d.text((28,20),'달리기 동작 그대로, 발바닥 계산을 묶어서 처리',font=font(28),fill=ink)
d.text((28,65),'M56 성능 후속 · 실제 반복 측정·자세 검사 완료 · 표본 수와 보정 공식 유지',font=font(19),fill=muted)
for x,title,caption,color in [(28,'기존: 피부 점마다 반복','각 점에서 같은 뼈 변환을 다시 계산',before),(680,'수정: 같은 자세에서 공유','뼈 변환은 한 번, 다음 자세에서는 새로 계산',after)]:
 d.rounded_rectangle((x,112,x+570,233),radius=12,fill='#e8ede6')
 d.text((x+18,128),title,font=font(24),fill=color)
 d.text((x+18,177),caption,font=font(19),fill=ink)
d.text((617,151),'→',font=font(28),fill=ink)
d.text((28,267),'비교 준비 시간 · 남녀 각각 3회 중앙값',font=font(25),fill=ink)
scale=850/40
for i,s in enumerate(report['summary']):
 y=328+i*176
 name='남성형' if s['model']=='male' else '여성형'
 d.text((28,y),name,font=font(23),fill=ink)
 for j,(key,label,color) in enumerate([('originalMs','기존',before),('batchMs','수정',after)]):
  seconds=s[key]/1000;top=y+j*64
  d.text((150,top+6),label,font=font(21),fill=color)
  d.rounded_rectangle((225,top,225+seconds*scale,top+42),radius=5,fill=color)
  d.text((238+seconds*scale,top+5),f'{seconds:.2f}초',font=font(23),fill=color)
 d.text((1050,y+58),f'{s["reductionPercent"]:.1f}% 감소',font=font(20),fill=after)
d.text((28,706),'보존: 남녀 전 주기 730개 위상 × 양쪽 비교 · 전체 뼈와 발바닥 피부 점',font=font(22),fill=ink)
d.text((28,753),'별도 계산 검사: 2,112개 점에서 기존 Three.js 결과와 좌표 차이 0',font=font(21),fill=ink)
d.text((28,808),'로컬 Edge / 새 컨텍스트 / 같은 서버. 장치별 시간은 달라지며 추가 대기 시간은 남습니다.',font=font(17),fill=muted)
img.save(root/'docs/assets/images/cmu-preparation-performance.png')

img=Image.new('RGB',(1320,870),bg);d=ImageDraw.Draw(img)
d.text((22,18),'실제 화면 · 왼쪽 기존 계산 / 오른쪽 묶음 계산',font=font(27),fill=ink)
for row,view in enumerate(['front','side']):
 y=76+row*390;d.text((22,y),'남성형 · 정면' if view=='front' else '남성형 · 측면',font=font(22),fill=ink)
 for col,variant in enumerate(['original','batch']):
  capture=Image.open(root/f'outputs/cmu-preparation/male-{variant}-{view}.png').convert('RGB');capture.thumbnail((640,340));img.paste(capture,(20+col*650,y+39))
img.save(root/'docs/assets/images/cmu-preparation-poses.png')
