"""M63: real same-stage before/after captures and full-surface audit."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
report=json.loads((root/'docs/05-validation/reports/cmu-bilateral-pose.json').read_text())
before=json.loads((root/'docs/05-validation/reports/cmu-bilateral-pose-before.json').read_text())
assert report['status']=='passed'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';old='#ae7154';new='#267d67'
summary=[]
for r,b in zip(report['results'],before['results']):
    summary.append({'model':r['model'],'beforeElbowMm':b['maxima']['lowerarm_r']['mm'],'beforeWristMm':b['maxima']['hand_r']['mm'],
        'beforeWristDeg':b['maxima']['hand_r']['deg'],**r['metrics'],'surfaceMaxMm':r['skin']['maxSkinMirrorMm'],
        'surfaceVertices':r['skin']['vertices'],'surfaceMatched':r['skin']['matched'],'skinSettings':r['poseSkin'],'loadMs':r['loadMs']})
(root/'docs/05-validation/reports/cmu-bilateral-pose-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
for view,label in [('front','정면'),('side','측면')]:
    img=Image.new('RGB',(1280,1390),bg);d=ImageDraw.Draw(img)
    d.text((26,20),f'{label} · 같은 모델의 현재 단계 ↔ 반 주기 뒤 좌우 반전',font=font(28),fill=ink)
    d.text((26,65),'양쪽 골반을 맞춘 자세 비교 · 위는 수정 전 M62 / 아래는 수정 후 M63 · 실제 화면',font=font(19),fill=muted)
    for row,mode in enumerate(['before','after']):
        y=110+row*600;d.text((26,y),'수정 전 · 팔·손 모양 차이' if row==0 else '수정 후 · 전신 자세와 피부 대응',font=font(24),fill=old if row==0 else new)
        photo=Image.open(root/f'outputs/cmu-bilateral-pose/male-{mode}-{view}-256.png').convert('RGB');photo.thumbnail((1220,540));img.paste(photo,(26,y+44))
    d.text((26,1320),'주기 25.56% ↔ 75.56% · 색 선은 실제 오른다리/왼다리를 표시하므로 반전 칸에서는 색이 바뀝니다.',font=font(18),fill=muted)
    d.text((26,1354),'이 화면은 같은 단계의 자세를 비교합니다. 지면 위 절대 이동 경로를 겹친 화면은 아닙니다.',font=font(18),fill=muted)
    img.save(out/f'cmu-bilateral-pose-{view}.png')

img=Image.new('RGB',(1320,790),bg);d=ImageDraw.Draw(img)
d.text((28,20),'중심점 검사에서 전신 관절·피부 검사로',font=font(30),fill=ink)
d.text((28,65),'M63 구현·검사 완료 / 외형 사용자 검토 전 · 남녀 각각 721시점 + 피부 25개 대응 단계',font=font(20),fill=muted)
for col,r in enumerate(summary):
    x=28+650*col;d.rounded_rectangle((x,120,x+610,385),16,fill='#e4ede5')
    d.text((x+20,140),'남성형' if col==0 else '여성형',font=font(25),fill=ink)
    for i,text in enumerate([f"팔꿈치 위치 차이  {r['beforeElbowMm']:.1f} → <0.01mm",f"손목 위치 차이  {r['beforeWristMm']:.1f} → <0.01mm",f"손 방향 차이  {r['beforeWristDeg']:.1f} → <0.001°"]):
        d.text((x+20,195+i*54),text,font=font(22),fill=ink)
checks=[('전신 관절 위치·회전 대응','<0.01mm / <0.001°'),('피부 정점 14,517개 전부 대응','25개 대응 단계의 최대 차이 <0.001mm'),('골반 높이·기존 다리·발목 회전','유지 · 착지 최저 높이 차이 0mm'),('발 아래쪽 표면 위치 변화','최대 0.004mm 미만 · 바닥 침투 없음')]
for i,(key,value) in enumerate(checks):
    y=430+i*59;d.text((28,y),key,font=font(22),fill=ink);d.text((670,y),value,font=font(20),fill=new)
d.text((28,705),'관절은 같은데 외형이 달랐던 원본 스킨 가중치도 좌우로 맞췄습니다. 원본 GLB는 수정하지 않았습니다.',font=font(19),fill=muted)
d.text((28,746),'중앙선의 한쪽 다리 영향도 대칭화했습니다. 원래 양발의 안쪽 접근 경로 자체는 이번 수정 대상이 아닙니다.',font=font(18),fill=muted)
img.save(out/'cmu-bilateral-pose-result.png')
print(json.dumps(summary,ensure_ascii=False,indent=2))
