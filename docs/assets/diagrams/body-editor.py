"""M80: native SVG flow; contact sheet from unchanged real browser captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
out=root/'docs/assets/images'
source=root/'outputs/body-editor'
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 300" width="1120" height="300">
<rect width="1120" height="300" rx="20" fill="#f7f8f5"/><g font-family="Malgun Gothic,sans-serif" fill="#294632">
<text x="28" y="43" font-size="25" font-weight="bold">설정창 대신, 신체 위에서 조절</text>
<text x="28" y="75" font-size="15" fill="#748074">M80 · 사용자 확정 / 구현 화면 및 입력 검사 · 자세 회전 조작은 별도</text>'''
for i,(title,a,b) in enumerate([
 ('01 부위 잡기','보이는 피부 또는 화살표','가려진 반대쪽은 선택 제외'),
 ('02 길이 조절','부위 방향으로 드래그','치수 표시 · 제한 · Esc 취소'),
 ('03 같은 신체 값','피부와 뼈대 함께 변경','전체 크기는 화면 안 ↕'),
 ('04 달리기에 전달','기존 다리 들림 · 팔 굽힘','신체 → 자세 → 코스 → 백테스팅')]):
 x=28+i*273
 svg+=f'<rect x="{x}" y="112" width="243" height="149" rx="14" fill="white" stroke="#d5dfd6"/><text x="{x+16}" y="149" font-size="18" font-weight="bold">{title}</text><text x="{x+16}" y="191" font-size="15">{a}</text><text x="{x+16}" y="222" font-size="13">{b}</text>'
 if i<3:svg+=f'<text x="{x+248}" y="192" font-size="21">→</text>'
svg+='</g></svg>'
(root/'docs/assets/diagrams/body-editor.svg').write_text(svg,encoding='utf-8')
if (source/'desktop-selected.png').exists() and (source/'mobile-selected.png').exists():
 font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',24)
 small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
 sheet=Image.new('RGB',(1280,900),'#f7f8f5');d=ImageDraw.Draw(sheet)
 d.text((24,20),'실제 구현 화면 · 신체를 직접 잡아 조절',font=font,fill='#294632')
 d.text((24,57),'왼쪽: 데스크톱 / 오른쪽: 모바일 터치 후 · 숫자 설정은 접힌 상태',font=small,fill='#748074')
 for name,xy,limit in [('desktop-selected',(16,110),(880,760)),('mobile-selected',(914,105),(350,760))]:
  im=Image.open(source/(name+'.png')).convert('RGB');im.thumbnail(limit);sheet.paste(im,xy)
 sheet.save(out/'body-editor-screen.png')
 Image.open(source/'desktop-selected.png').convert('RGB').save(out/'body-editor-desktop.png')
