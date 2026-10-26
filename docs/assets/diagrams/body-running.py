"""M79 documentation: diagram and unaltered browser capture contact sheet."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
out=root/'docs/assets/images'
source=root/'outputs/body-running'
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',24)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
sheet=Image.new('RGB',(1200,1320),'#f7f8f5');draw=ImageDraw.Draw(sheet)
for i,(name,label) in enumerate([('male-front','남성형 · 정면'),('male-side','남성형 · 측면'),('female-front','여성형 · 정면'),('female-side','여성형 · 측면')]):
 x,y=20+(i%2)*600,20+(i//2)*650
 draw.text((x,y),label,font=font,fill='#294632')
 draw.text((x,y+36),'실제 화면 · 신체 변경 / 다리 +5cm / 팔 +10°',font=small,fill='#748074')
 pic=Image.open(source/(name+'.png')).convert('RGB');pic.thumbnail((560,550));sheet.paste(pic,(x,y+78))
sheet.save(out/'body-running-views.png')
Image.open(source/'male-front.png').convert('RGB').save(out/'body-running-screen.png')
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 430" width="1120" height="430">
<rect width="1120" height="430" rx="22" fill="#f7f8f5"/><g font-family="Malgun Gothic, sans-serif" fill="#294632">
<text x="32" y="48" font-size="26" font-weight="bold">신체 설정이 달리기에 전달되는 순서</text>
<text x="32" y="80" font-size="15" fill="#748074">M79 · 구현 / 현재 두 모델의 기능·기하 검사 · 인체 물리 검증 아님</text>'''
cards=[('01 신체 재구성','피부 + 뼈 길이','전체 크기 함께 적용'),('02 기본 동작 전달','확정된 관절 회전','새 길이로 움직임'),('03 바닥 높이 맞춤','새 발바닥 높이 측정','몸의 수직 위치 조절'),('04 자세 입력 적용','다리: 실제 cm','팔: 굽힘 각도 차이')]
for i,(title,a,b) in enumerate(cards):
 x=32+i*273
 svg+=f'<rect x="{x}" y="122" width="237" height="146" rx="15" fill="white" stroke="#d5dfd6"/><text x="{x+18}" y="160" font-size="19" font-weight="bold">{title}</text><text x="{x+18}" y="201" font-size="16">{a}</text><text x="{x+18}" y="232" font-size="16">{b}</text>'
 if i<3:svg+=f'<text x="{x+246}" y="201" font-size="24" fill="#819779">→</text>'
svg+='''<rect x="32" y="306" width="1056" height="90" rx="14" fill="#e5eddd"/><text x="55" y="340" font-size="18">기본 신체: 기존 동작 그대로 / 체형 변경: 이전 체형의 준비 결과 교체</text><text x="55" y="373" font-size="16">수평 몸 이동은 다리 길이 배율 반영 · 발바닥 높이 유지와 발 고정·마찰 검증은 구분</text></g></svg>'''
(root/'docs/assets/diagrams/body-running.svg').write_text(svg,encoding='utf-8')
