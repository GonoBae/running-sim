"""M64: real rendered comparison and measured fixed-surface paths (Pillow)."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
report=json.loads((root/'docs/05-validation/reports/cmu-shared-approach.json').read_text())
assert report['status']=='passed'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';old='#b56b48';new='#218372'
summary=[]
for r in report['results']:
    b=r['approach'][0]['fixedSurfaceBefore']['excessMm'];a=r['approach'][0]['fixedSurfaceAfter']['excessMm']
    summary.append({'model':r['model'],'beforeExtraMm':b,'afterExtraMm':a,'reductionPercent':100*(1-a/b),'window':r['window'],**r['metrics'],'skin':r['skin']})
(root/'docs/05-validation/reports/cmu-shared-approach-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')

img=Image.new('RGB',(1280,1510),bg);d=ImageDraw.Draw(img)
d.text((28,20),'착지 전 좌우 왕복 · 정면과 측면',font=font(30),fill=ink)
d.text((28,67),'M64 실제 구현 화면 · 같은 시각 비교 · 왼쪽 기존 M63 / 오른쪽 수정 M64',font=font(20),fill=muted)
for i,(view,label) in enumerate([('front','정면'),('side','측면')]):
    y=115+i*635
    d.text((28,y),label+' · 주기 98%',font=font(24),fill=ink)
    photo=Image.open(root/f'outputs/cmu-shared-approach/male-{view}-980.png').convert('RGB');photo.thumbnail((1224,575));img.paste(photo,(28,y+43))
d.text((28,1400),'고관절 위치·몸 높이·발목 회전을 유지하며 무릎과 발을 함께 옮겼습니다.',font=font(21),fill=new)
d.text((28,1445),'착지점과 지지 구간은 이전 위치입니다. 고관절 바로 아래로 새 착지점을 만든 실험은 아닙니다.',font=font(19),fill=muted)
img.save(out/'cmu-shared-approach-comparison.png')

img=Image.new('RGB',(1320,1110),bg);d=ImageDraw.Draw(img)
d.text((28,20),'같은 발 피부 지점을 계속 추적한 접근 경로',font=font(30),fill=ink)
d.text((28,65),'수정 전  ━ 주황     수정 후  ━ 초록  ·  같은 쪽 고관절 기준 / +는 안쪽 / 양발은 반 주기 차',font=font(20),fill=muted)
for col,r in enumerate(report['results']):
    x=70+650*col;top=190;w=540;h=385;rows=r['approach'][0]['path'];start=rows[0]['t'];end=rows[-1]['t']
    lo=-40;hi=110
    xy=lambda t,v:(x+(t-start)/(end-start)*w,top+h-(v-lo)/(hi-lo)*h)
    d.text((x,125),'남성형' if col==0 else '여성형',font=font(25),fill=ink)
    d.text((x,165),'고관절 대비 좌우 위치 (mm)',font=font(16),fill=muted)
    for val in [-40,-20,0,20,40,60,80,100]:
        y=xy(start,val)[1];d.line((x,y,x+w,y),fill='#cdd9d2',width=1);d.text((x-48,y-11),str(val),font=font(16),fill=muted)
    for frac in [0,.25,.5,.75,1]:
        t=start+(end-start)*frac;xx=xy(t,0)[0];d.text((xx-22,top+h+12),f'{t*100:.0f}%',font=font(16),fill=muted)
    for key,color in [('fixedBefore',old),('fixedAfter',new)]:
        d.line([xy(p['t'],p[key]*1000) for p in rows],fill=color,width=4)
    s=summary[col]
    d.text((x,top+h+56),f"왕복 거리  {s['beforeExtraMm']:.1f} → {s['afterExtraMm']:.1f} mm",font=font(23),fill=ink)
    d.text((x,top+h+96),f"{s['reductionPercent']:.1f}% 감소 · 양발 각각 검사",font=font(23),fill=new)
d.text((28,730),'왕복 거리 = 전체 좌우 이동 거리 - 시작점에서 끝점까지의 순이동',font=font(22),fill=ink)
d.text((28,775),'남성형 발당 1,117개 / 여성형 1,122개의 같은 피부 정점 평균 · 구간당 401시점',font=font(20),fill=muted)
d.text((28,827),'발목 관절의 좌우 역행은 제거됐습니다. 보존한 발 회전 때문에 피부 경로에는 작은 역행이 남습니다.',font=font(20),fill=muted)
d.rounded_rectangle((28,892,1290,1068),16,fill='#e4ede5')
for i,text in enumerate(['전신 좌우 대응 유지: 관절 <0.01mm · 피부 <0.001mm',
                         '발 세계 방향·종아리 대비 회전 유지: <0.001° · 몸/골반 위치 변화 0mm',
                         '착지·지지 위치 변화 0mm · 바닥 침투 없음 · 접근 중 앞뒤 변화 최대 4.01mm']):
    d.text((48,910+i*48),text,font=font(22),fill=ink)
img.save(out/'cmu-shared-approach-path.png')

img=Image.new('RGB',(1280,530),bg);d=ImageDraw.Draw(img)
d.text((28,20),'이번 작은 수정의 구조',font=font(30),fill=ink)
items=[('M63 동작 재생','골반·몸 높이·상체 그대로'),('접근 구간만 연결','안쪽 ↔ 바깥쪽 왕복 감소'),('허벅지·무릎 연동','높이·길이·발목 방향 유지')]
for i,(title,desc) in enumerate(items):
    x=28+420*i;d.rounded_rectangle((x,115,x+380,275),16,fill='#e4ede5')
    d.text((x+20,140),title,font=font(25),fill=ink);d.text((x+20,196),desc,font=font(20),fill=muted)
    if i<2:d.text((x+385,170),'→',font=font(28),fill=new)
d.text((28,325),'적용 구간: 오른발 약 87% → 다음 25~28% / 왼발은 반 주기 뒤',font=font(24),fill=ink)
d.text((28,378),'구간 양끝 위치·속도·곡률 연결 · 남녀 관절 721시점 / 전신 피부 25개 대응 단계 검사',font=font(20),fill=muted)
d.text((28,433),'구현·수치·재생 검사 완료 / 자연스러움 사용자 검토 전 · 실제 힘·기록 효과는 검증하지 않음',font=font(19),fill=muted)
img.save(out/'cmu-shared-approach-flow.png')
print(json.dumps([{k:v for k,v in r.items() if k in ['model','beforeExtraMm','afterExtraMm','reductionPercent']} for r in summary],ensure_ascii=False))
