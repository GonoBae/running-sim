"""Assemble unchanged screenshot crops: CMU 35_17, male, front, frame 45.

Before is a preserved pre-M18 capture; do not regenerate it with corrected code.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

images = Path(__file__).resolve().parent.parent / 'images'
font = 'C:/Windows/Fonts/malgun.ttf'
canvas = Image.new('RGB', (1100, 660), '#f6f5f1')
draw = ImageDraw.Draw(canvas)
def label(x, y, text, size=23, color='#263c40'):
    draw.text((x, y), text, font=ImageFont.truetype(font, size), fill=color)

label(36, 22, '어깨 전달 보정 · 실제 화면 비교', 30)
label(36, 70, 'CMU 35_17 · 남성형 · 정면 · 동일 프레임 45', 18)
for x, state, title, caption in [
    (36, 'before', '수정 전', '원본의 기본 어깨 기울기까지 복사'),
    (568, 'after', '수정 후', '우리 모델의 기본 어깨 방향 유지'),
]:
    label(x, 112, title, 24)
    shot = Image.open(images / f'cmu-shoulder-{state}.png')
    crop = shot.crop((690, 290, 930, 510)).resize((480, 440), Image.Resampling.LANCZOS)
    canvas.paste(crop, (x, 151))
    label(x, 605, caption, 20)
canvas.save(images / 'cmu-shoulder-comparison.png')
