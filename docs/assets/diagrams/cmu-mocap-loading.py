"""Combine real browser loading captures; source: verify-mocap-loading.cjs."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[3]
report = json.loads((root / 'docs/05-validation/reports/cmu-mocap-loading.json').read_text('utf-8'))
male = report['results'][0]['loading']
# Select an actual compositor frame presented after preview paint, before preparation completes.
frames = [f for f in report['frames'] if male['timeOrigin'] + male['preview'] <= f['timestamp'] * 1000 < male['timeOrigin'] + male['ready']]
preview = root / frames[0]['path']
canvas = Image.new('RGB', (1320, 800), '#f6f5f1')
draw = ImageDraw.Draw(canvas)
def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', size)
draw.text((24, 20), '모델을 먼저 표시하고, 달리기 비교를 준비합니다', font=font(28), fill='#233b32')
draw.text((24, 66), '실제 브라우저 확인 · 동작 보정 변경 없음 · 비교 준비 시간 단축은 남은 과제', font=font(18), fill='#63736a')
for i, (path, title) in enumerate([(preview, '① 약 0.6초: 모델 + 준비 안내'), (root / 'outputs/cmu-toe-slip-path/loading/male-ready.png', '② 약 30초: 양쪽 비교 준비 완료')]):
    x = 20 + i * 650
    draw.text((x, 110), title, font=font(23), fill='#233b32')
    img = Image.open(path).convert('RGB').crop((25, 190, 1255, 845))
    img.thumbnail((630, 560))
    canvas.paste(img, (x, 155))
draw.text((24, 540), '기존: 첫 표시 전 계산에 약 34초 → 수정: 준비 중에도 모델 표시', font=font(24), fill='#233b32')
draw.text((24, 595), '검사: 남녀 모델 · 36개 위상 × 양쪽 비교 · 골반/다리/발끝 위치 보존', font=font(21), fill='#233b32')
draw.text((24, 635), '추가 확인: 로딩 실패 안내 · 다시 불러오기 · 타입 검사·빌드 통과', font=font(21), fill='#233b32')
draw.text((24, 701), '모든 성능 수치는 이 장치의 Edge 한 회 측정값입니다. 사용자 탭의 동일 시간은 보장하지 않습니다.', font=font(18), fill='#63736a')
canvas.save(root / 'docs/assets/images/cmu-mocap-loading.png')
