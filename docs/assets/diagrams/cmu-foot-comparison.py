"""Preserved before + current camera-matched captures; no synthetic pose edits."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
images=root/'docs/assets/images'
canvas=Image.new('RGB',(1040,660),'#f6f5f1')
d=ImageDraw.Draw(canvas)
font='C:/Windows/Fonts/malgun.ttf'
def label(x,y,text,size=22):
    d.text((x,y),text,font=ImageFont.truetype(font,size),fill='#263c40')
label(28,20,'발 방향 기준 교정 · 실제 화면',28)
label(28,65,'같은 모델·카메라·주기 0% · 바닥 접지 보정 전',18)
for x,state,title,caption in [(28,'before','수정 전','발이 향하는 방향만 대응'),(548,'after','수정 후','앞 방향 + 위 방향을 함께 대응')]:
    label(x,112,title)
    shot=Image.open(images/f'cmu-foot-{state}.png')
    crop=shot.crop((490,360,730,615)).resize((432,459),Image.Resampling.LANCZOS)
    canvas.paste(crop,(x,153))
    label(x,626,caption,19)
canvas.save(images/'cmu-foot-comparison.png')
