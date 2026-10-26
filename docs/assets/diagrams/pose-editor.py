"""M81 native flow diagram and contact sheet of actual browser captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
source=root/'outputs/pose-editor'
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="340" viewBox="0 0 1120 340">
<rect width="1120" height="340" rx="20" fill="#f7f8f5"/><g font-family="Malgun Gothic,sans-serif" fill="#294632">
<text x="28" y="45" font-size="25" font-weight="bold">몸 위에서 바꾼 값으로, 다시 달리기</text>
<text x="28" y="76" font-size="15" fill="#748074">M81 · 기존 신체·달리기 유지 / 새 입력을 기존 두 자세 설정에 연결</text>'''
for i,(title,a,b) in enumerate([
 ('01 다리·아래팔 잡기','보이는 피부만 선택','움직이던 러너 일시정지'),
 ('02 위아래 드래그','다리: 더 높이 / 낮게','팔: 더 굽히기 / 펴기'),
 ('03 같은 설정값','leg / elbow만 갱신','양쪽 공통 · 신체 값 유지'),
 ('04 재생으로 확인','기존 기본 동작에 반영','코스 → 백테스팅 값 유지')]):
 x=28+i*273
 svg+=f'<rect x="{x}" y="113" width="243" height="143" rx="14" fill="white" stroke="#d5dfd6"/><text x="{x+15}" y="150" font-size="18" font-weight="bold">{title}</text><text x="{x+15}" y="190" font-size="15">{a}</text><text x="{x+15}" y="222" font-size="14">{b}</text>'
 if i<3:svg+=f'<text x="{x+248}" y="193" font-size="21">→</text>'
svg+='<text x="28" y="300" font-size="16">다리는 선택한 쪽 들림 확인 시점 · 아래팔은 현재 시점 / Esc로 시작 값·시점 복원</text></g></svg>'
(root/'docs/assets/diagrams/pose-editor.svg').write_text(svg,encoding='utf-8')
if all((source/name).exists() for name in ['male-base-front.png','male-base-side.png','mobile.png']):
 sheet=Image.new('RGB',(1000,1190),'#f7f8f5');d=ImageDraw.Draw(sheet)
 font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',25)
 small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
 d.text((25,20),'실제 구현 화면 · 자세 직접 조절',font=font,fill='#294632')
 for name,label,xy,limit in [('male-base-front.png','정면 · 다리 +5cm / 팔 +10°',(20,105),(610,485)),('male-base-side.png','측면 · 다리 +5cm / 팔 +10°',(20,675),(610,485)),('mobile.png','모바일 · 터치 입력 후',(650,105),(330,1000))]:
  x,y=xy;d.text((x,y-35),label,font=small,fill='#748074');im=Image.open(source/name).convert('RGB');im.thumbnail(limit);sheet.paste(im,xy)
 sheet.save(root/'docs/assets/images/pose-editor-screen.png')
