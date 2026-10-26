"""M28 actual browser captures + measured frontal-chain decomposition; no AI imagery."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
out=root/'docs/assets/images'
report=json.loads((root/'docs/05-validation/reports/cmu-stance-width.json').read_text(encoding='utf-8'))
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
canvas=Image.new('RGB',(1060,870),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((30,18),'35_17 · 실패한 디딤 폭 실험 이력',font=font(28),fill='#233b32')
d.text((30,61),'실제 정면 화면 · 같은 주기 37.5% · 남성형 · 사용자 검토 반려 / 기본 적용 해제',font=font(16),fill='#63736a')
for i,(key,title) in enumerate([('before','보정 전'),('after','반려한 결과 · 한 주기 내내 바깥 회전')]):
 im=Image.open(out/f'cmu-stance-{key}.png').convert('RGB').crop((130,10,470,610)).resize((335,592))
 x=30+i*520;d.text((x,110),title,font=font(20),fill='#233b32');canvas.paste(im,(x+65,150))
 m=report['results'][0]['sideMetrics']['r'];value=m['beforeMin' if key=='before' else 'afterMin']*100
 d.text((x+38,754),f'오른발 지지 구간 최소 위치: {value:+.2f}cm',font=font(20),fill='#a34836' if i==0 else '#26765e')
d.text((30,801),'금색: 골반 중심선   분홍: 오른다리   파랑: 왼다리   +: 자기 쪽 / -: 반대쪽',font=font(18),fill='#233b32')
d.text((30,836),'원본의 골반 회전·이동 유지 · 발 방향 유지 · 그림은 물리적 안정성의 검증이 아닙니다.',font=font(16),fill='#63736a')
canvas.save(out/'cmu-stance-comparison.png')
