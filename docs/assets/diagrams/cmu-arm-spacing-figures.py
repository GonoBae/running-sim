"""Assemble matched real captures; preserve source screenshots."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
images=root/'docs/assets/images'
font='C:/Windows/Fonts/malgun.ttf'
def board(title,subtitle,items,crop,height=640):
    out=Image.new('RGB',(1100,height),'#f6f5f1');d=ImageDraw.Draw(out)
    def text(x,y,t,size):d.text((x,y),t,font=ImageFont.truetype(font,size),fill='#263c40')
    text(28,18,title,28);text(28,64,subtitle,18)
    for x,(name,label) in zip([28,568],items):
        text(x,107,label,22)
        shot=Image.open(images/name).crop(crop)
        out.paste(shot,(x,150))
    return out
board('팔 간격 보정 · 실제 화면 비교','CMU 35_17 · 남성형 · 같은 주기 25% · 어깨 높이와 앞뒤 흔들림 유지',[
    ('cmu-arm-spacing-before.png','보정 끔'),('cmu-arm-spacing-after.png','보정 켬')],(350,60,850,520),640).save(images/'cmu-arm-spacing-comparison.png')
board('발목 휨 · 외형 검토 미통과','현재 화면을 다시 촬영 · M20 축 검사 통과를 외형 교정 완료로 취급하지 않음',[
    ('cmu-ankle-recheck-1.png','주기 25%'),('cmu-ankle-recheck-3.png','주기 75%')],(350,110,850,540),610).save(images/'cmu-ankle-recheck.png')
frames=[Image.open(root/f'outputs/cmu-arm-spacing/frame-{k:02}.png').resize((992,664)).convert('P',palette=Image.Palette.ADAPTIVE) for k in range(24)]
timing=[(round((k+1)*75.833333/24)-round(k*75.833333/24))*10 for k in range(24)]
frames[0].save(images/'cmu-arm-spacing-preview.gif',save_all=True,append_images=frames[1:],duration=timing,loop=0,disposal=2)
