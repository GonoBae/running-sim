"""M27 actual orthographic captures, explicitly comparing different clips."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[3]
images=[Image.open(root/f'docs/assets/images/cmu-step-width-{clip}.png').convert('RGB') for clip in ['35','127']]
w,h=images[0].size
canvas=Image.new('RGB',(w*2+60,h+155),'#f6f5f1')
draw=ImageDraw.Draw(canvas)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',25)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
for i,(im,title,sub) in enumerate(zip(images,['현재 사용 · 35_17','사용 제외 · 127_06'],['주기 43% · 추정 오른발 지지 중간','주기 33% · 추정 오른발 지지 중간'])):
    x=20+i*(w+20)
    draw.text((x+20,12),title,font=font,fill='#233b32')
    draw.text((x+20,50),sub,font=small,fill='#63736a')
    canvas.paste(im,(x,85))
draw.text((30,h+101),'금색 점선 = 골반 중점의 수직선 · 분홍 = 오른다리 · 파랑 = 왼다리',font=small,fill='#233b32')
draw.text((30,h+129),'서로 다른 동작의 실제 캡처이며, 전체 자연스러움과 정상 디딤 폭을 보증하는 비교는 아닙니다.',font=small,fill='#63736a')
canvas.save(root/'docs/assets/images/cmu-step-width-comparison.png')
