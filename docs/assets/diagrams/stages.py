"""M78: actual browser captures -> two-column document contact sheet (no image synthesis)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[3]
source = root / 'outputs/stages'
dest = root / 'docs/assets/images'
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 24)
small = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 18)
sheet = Image.new('RGB', (1200, 1200), '#f7f8f5')
draw = ImageDraw.Draw(sheet)
for i, (file, title, status) in enumerate([
    ('body.png', '01 신체 세팅', '실제 구현 · 외형/길이'),
    ('pose-front.png', '02 자세 세팅', '실제 구현 · 기본 달리기/팔/다리'),
    ('course.png', '03 코스 세팅', '준비 화면 · 코스 기능 미구현'),
    ('backtest.png', '04 백테스팅', '준비 화면 · 계산 기능 미구현'),
]):
    x, y = 20 + (i % 2) * 600, 20 + (i // 2) * 590
    draw.text((x, y), title, font=font, fill='#294632')
    draw.text((x, y + 37), status, font=small, fill='#748074')
    picture = Image.open(source / file).convert('RGB')
    picture.thumbnail((560, 490))
    sheet.paste(picture, (x, y + 75))
sheet.save(dest / 'stages-overview.png')
picture = Image.open(source / 'pose-front.png').convert('RGB')
picture.save(dest / 'stages-pose.png')
