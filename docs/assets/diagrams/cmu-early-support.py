"""M73: measured fixed skin-point paths and labelled actual browser captures."""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
r=json.loads((root/'docs/05-validation/reports/cmu-early-support.json').read_text(encoding='utf-8'))
assert r['status']=='passed'
out=root/'docs/assets/images';raw=root/'outputs/cmu-early-support'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';orange='#bc6842';blue='#1687ad'
summary={k:v for k,v in r.items() if k!='results'}
summary['results']=[{k:v for k,v in x.items() if k!='frames'} for x in r['results']]
for x in summary['results']:
    x['reductionPercent']={s:{k:100*(1-v['afterMm']/v['beforeMm']) for k,v in x['paths'][s].items()} for s in ['r','l']}
(root/'docs/05-validation/reports/cmu-early-support-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

im=Image.new('RGB',(1400,850),bg);d=ImageDraw.Draw(im)
d.text((30,20),'착지 초반의 발바닥 이동 / 같은 재질점으로 비교',font=font(31),fill=ink)
d.text((30,67),'M73 실제 측정 · 주황 기존 M71 / 파랑 수정 M73 · 전체 28–43% / 양발은 반 주기 맞춤',font=font(20),fill=muted)
for mi,m in enumerate(r['results']):
    for si,s in enumerate(['r','l']):
        x=90+si*690;y=165+mi*315;w=560;h=180;shift=.5 if s=='l' else 0
        rows=[f for f in m['frames'] if .28+shift-1e-9<=f['t']<=.43+shift+1e-9]
        xx=lambda t:x+(t-shift-.28)/.15*w
        yy=lambda v:y+h-v/80*h
        d.rectangle((xx(.30+shift),y,xx(.36+shift),y+h),fill='#e1ece3')
        for v in [0,20,40,60,80]:
            d.line((x,yy(v),x+w,yy(v)),fill='#d3ddd5')
            d.text((x-34,yy(v)-10),str(v),font=font(16),fill=muted)
        for key,col in [('before',orange),('after',blue)]:
            total=0;points=[(xx(rows[0]['t']),yy(0))]
            for a,b in zip(rows,rows[1:]):
                p=a[key][s]['point'];q=b[key][s]['point']
                total+=((p[0]-q[0])**2+(p[2]-q[2])**2)**.5*1000
                points.append((xx(b['t']),yy(total)))
            d.line(points,fill=col,width=4)
        label=('남성형' if mi==0 else '여성형')+' · '+('오른발' if s=='r' else '왼발')
        total=m['paths'][s]['all'];d.text((x-25,y-40),label+f" / {total['beforeMm']:.1f} → {total['afterMm']:.1f}mm",font=font(23),fill=ink)
        for t in [28,30,36,43]:d.text((x+(t-28)/15*w-12,y+h+12),str(t),font=font(16),fill=muted)
        d.text((x,y+h+42),'가로 주기(%) / 세로 누적 수평 경로(mm) / 초록: 지지점 유지',font=font(16),fill=muted)
d.text((30,766),'착지 초반 28–38% 이동 93.5–95.7% 감소 / 합류 포함 전체 구간 75.6–82.2% 감소',font=font(23),fill=ink)
d.text((30,808),'36–43%에는 기존 지지점으로 합류하는 이동이 남습니다. 완전 고정·물리 접촉 검증을 뜻하지 않습니다.',font=font(19),fill=muted)
im.save(out/'cmu-early-support-curves.png')

im=Image.new('RGB',(1400,780),bg);d=ImageDraw.Draw(im)
d.text((30,20),'정면·측면 / 양발의 같은 착지 단계 비교',font=font(31),fill=ink)
d.text((30,68),'M73 남성형 실제 캡처 · 각 쌍 왼쪽 기존 / 오른쪽 수정 · 오른발 31% / 왼발 81%',font=font(20),fill=muted)
for row,t in enumerate([31,81]):
    y=125+row*285
    for col,view in enumerate(['front','side']):
        x=25+col*690
        d.text((x,y),('오른발' if row==0 else '왼발')+' · '+('정면' if col==0 else '측면'),font=font(22),fill=ink)
        d.text((x+180,y),'기존',font=font(20),fill=orange);d.text((x+515,y),'수정',font=font(20),fill=blue)
        photo=Image.open(raw/f'male-{view}-{t}.png').crop((270,280,930,545))
        photo.thumbnail((660,250));im.paste(photo,(x,y+38))
d.text((30,725),'고관절 위치·골반·몸 높이 유지 / 허벅지·종아리 회전으로 발 위치를 연결 / 발이 향하는 방향 유지',font=font(20),fill=muted)
im.save(out/'cmu-early-support-comparison.png')

im=Image.new('RGB',(1400,680),bg);d=ImageDraw.Draw(im)
d.text((30,20),'전신 비교 / 상체와 회수 동작 유지',font=font(31),fill=ink)
d.text((30,67),'M73 실제 남성형 34% · 각 쌍 왼쪽 기존 / 오른쪽 수정 · 구현·수치·재생 검사 완료 / 외형 검토 전',font=font(19),fill=muted)
for col,view in enumerate(['front','side']):
    x=25+col*690;d.text((x+25,114),'정면' if col==0 else '측면',font=font(22),fill=ink)
    d.text((x+145,150),'기존',font=font(20),fill=orange);d.text((x+510,150),'수정',font=font(20),fill=blue)
    photo=Image.open(raw/f'male-{view}-34.png').crop((245,65,960,545))
    photo.thumbnail((660,445));im.paste(photo,(x,184))
d.text((30,635),'남녀 2,002시점: 골반·몸 높이·상체 위치 변화 0mm / 발 방향 <0.001° / 구간 밖 다리 위치 변화 0mm',font=font(19),fill=muted)
im.save(out/'cmu-early-support-full.png')
print('M73 figures and summary generated.')
