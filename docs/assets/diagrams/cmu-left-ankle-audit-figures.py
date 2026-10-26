"""Compose actual M48 ankle captures; no geometry or pose edits."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'outputs/cmu-left-ankle-audit'
OUT = ROOT / 'docs/assets/images'
FONT = 'C:/Windows/Fonts/malgun.ttf'

def font(size):
    return ImageFont.truetype(FONT, size)

def sheet(name, title, subtitle, cards, note):
    canvas = Image.new('RGB', (1120, 760), '#faf9f6')
    draw = ImageDraw.Draw(canvas)
    draw.text((32, 24), title, font=font(28), fill='#182e35')
    draw.text((32, 70), subtitle, font=font(17), fill='#58686b')
    for i, (filename, label, detail) in enumerate(cards):
        x = 32 + i * 550
        draw.text((x, 118), label, font=font(23), fill='#182e35')
        canvas.paste(Image.open(SRC / filename).convert('RGB'), (x, 160))
        draw.text((x, 670), detail, font=font(17), fill='#9b422c')
    draw.text((32, 720), note, font=font(16), fill='#58686b')
    canvas.save(OUT / name)

sheet('cmu-left-ankle-audit-comparison.png', '양발 모두 적용되지만, 왼발 방향이 다릅니다',
      '검증 완료 · 실제 남성형 화면 / 같은 착지 단계 · 보정 변경 없음', [
          ('male-close-r-0-front-current.png', '오른발 · 착지 시작 (주기 28%)', '바닥에 투영한 발 앞쪽 방향: +2.0°'),
          ('male-close-l-0-front-current.png', '왼발 · 착지 시작 (주기 75%)', '바닥에 투영한 발 앞쪽 방향: -17.4°'),
      ], '주황선: 종아리–발목–발 앞쪽 뼈 연결 / 각도는 의학적 관절각·정상 판정이 아닙니다.')

sheet('cmu-left-ankle-audit-weights.png', '피부 가중치를 바꿔도 발 뼈의 방향은 같습니다',
      '검증 완료 · 왼발 지지 중간 (주기 92%) / 뼈 자세를 고정한 별도 검사 화면', [
          ('male-close-l-0.5-front-current.png', '현재 피부 가중치', '이 장면의 표면 차이: 최대 5.98mm'),
          ('male-close-l-0.5-front-original.png', 'GLB 원래 피부 가중치', '뼈 위치 차이: 0mm'),
      ], '가중치는 표면에 영향을 줍니다. 남은 피부 접힘의 원인 전체를 확정한 검사는 아닙니다.')
