"""Run inspect-cmu-arms.cjs first. Assemble actual screenshot crops and a loop GIF."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[3]
source = root / 'outputs/cmu-loop'
dest = root / 'docs/assets/images'
font = 'C:/Windows/Fonts/malgun.ttf'
def label(draw, xy, text, size=20):
    draw.text(xy,text,font=ImageFont.truetype(font,size),fill='#263c40')

board=Image.new('RGB',(1120,760),'#f6f5f1')
d=ImageDraw.Draw(board)
label(d,(28,18),'팔 간격 확인 · 실제 화면 · CMU 35_17',28)
label(d,(28,62),'정면의 같은 네 시점 · 팔 자세는 변경하지 않음',18)
for row,model in enumerate(['male','female']):
    y=108+row*300
    label(d,(28,y),'남성형' if row==0 else '여성형',20)
    for k in range(4):
        shot=Image.open(source/f'{model}-front-{k}.png')
        crop=shot.crop((700,300,920,500)).resize((242,220),Image.Resampling.LANCZOS)
        x=28+k*275
        label(d,(x,y+30),f'{25*k}% 주기',16)
        board.paste(crop,(x,y+58))
label(d,(28,716),'일부 시점에서 팔·손과 몸통이 매우 가까움 · 관통 여부는 별도 검사 필요',18)
board.save(dest/'cmu-loop-arms.png')

frames=[Image.open(source/f'loop-{k:02}.png').resize((992,608)).convert('P',palette=Image.Palette.ADAPTIVE) for k in range(24)]
# GIF uses centiseconds. Distribute 0.75833 seconds across the 24 frames.
timing=[(round((k+1)*75.833333/24)-round(k*75.833333/24))*10 for k in range(24)]
frames[0].save(dest/'cmu-loop-preview.gif',save_all=True,append_images=frames[1:],duration=timing,loop=0,disposal=2)
