"""M50: compose actual local browser captures, no generated model imagery."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
SRC=ROOT/'outputs/cmu-left-ankle-direction'
OUT=ROOT/'docs/assets/images'
def font(size): return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',size)
def text(draw,xy,value,size=20,color='#233b32'): draw.text(xy,value,font=font(size),fill=color)

for view,label in [('front','정면'),('side','측면')]:
    im=Image.new('RGB',(1120,750),'#faf9f6');d=ImageDraw.Draw(im)
    text(d,(30,20),f'왼발 착지 방향 · {label} 확대',30)
    text(d,(30,65),'실제 남성형 · 주기 75% / 같은 착지 단계 · 자연스러움 사용자 검토 전',17)
    for lane in [0,1]:
        x=30+550*lane
        text(d,(x,115),'기존 M48' if lane==0 else 'M50 · 왼발 방향 교정',23)
        im.paste(Image.open(SRC/f'close-75-{view}-{lane}.png').convert('RGB'),(x,160))
    text(d,(30,680),'발 앞쪽 방향: -17.36° → 약 0° · 앞뒤 굽힘·기존 기울기 유지',19)
    text(d,(30,716),'파란선: 종아리–발목–발 앞쪽 / 숫자는 바닥 투영 방향이며 의학적 정상 관절각이 아닙니다.',16)
    im.save(OUT/f'cmu-left-ankle-direction-{view}.png')

im=Image.new('RGB',(1320,860),'#faf9f6');d=ImageDraw.Draw(im)
text(d,(28,20),'양발 · 같은 순간의 정면과 측면',30)
text(d,(28,68),'각 칸 왼쪽: 기존 M48 / 오른쪽: M50 · 실제 남성형 화면',19)
for row,(phase,label) in enumerate([(75,'왼발 착지'),(28,'오른발 착지 · 보존')]):
    for col,(view,name) in enumerate([('front','정면'),('side','측면')]):
        x=28+col*660;y=115+row*355
        text(d,(x,y),f'{label} / {name}',21)
        shot=Image.open(SRC/f'male-{view}-{phase}.png').convert('RGB')
        shot.thumbnail((620,305))
        im.paste(shot,(x,y+37))
text(d,(28,828),'검증 완료: 착지 지점 X/Z·골반·오른발·범위 밖 회수 보존 / 피부 접힘 전체·물리 접지는 미검증',17)
im.save(OUT/'cmu-left-ankle-direction-comparison.png')
