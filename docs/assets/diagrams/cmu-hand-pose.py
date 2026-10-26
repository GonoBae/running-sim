"""M71 measured wrist axes, labelled browser captures, and compact test summary."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[3]
report=json.loads((root/'docs/05-validation/reports/cmu-hand-pose.json').read_text(encoding='utf-8'))
assert report['status']=='passed'
raw=root/'outputs/cmu-hand-pose';out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';orange='#b96540';blue='#1687ad'
summary={k:v for k,v in report.items() if k!='results'}
summary['results']=[{k:v for k,v in r.items() if k!='frames'} for r in report['results']]
(root/'docs/05-validation/reports/cmu-hand-pose-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

im=Image.new('RGB',(1400,650),bg);d=ImageDraw.Draw(im)
d.text((30,20),'손목은 아래팔의 기본 연결로',font=font(32),fill=ink)
d.text((30,70),'M71 실제 관절 측정 · 주황 M70 / 파랑 M71 · 양손 대응 확인 / 외형 검토 전',font=font(21),fill=muted)
for mi,r in enumerate(report['results']):
    x=85+mi*690;y=180;w=560;h=280
    bend=r['hands']['r']['afterBendDeg'][0]
    d.text((x-25,125),('남성형' if mi==0 else '여성형')+f' · 38–44° → {bend:.1f}°',font=font(26),fill=ink)
    proj=lambda t,v:(x+t*w,y+h-v/50*h)
    for value in [0,10,20,30,40,50]:
        yy=proj(0,value)[1];d.line((x,yy,x+w,yy),fill='#d3ddd5')
        d.text((x-36,yy-11),str(value),font=font(18),fill=muted)
    for key,col in [('before',orange),('after',blue)]:
        d.line([proj(f['t'],f[key]['r']['bend']) for f in r['frames']],fill=col,width=4)
    for t in [0,.25,.5,.75,1]:
        d.text((x+t*w-12,y+h+12),str(round(t*100)),font=font(18),fill=muted)
    d.text((x+70,y+h+47),'가로: 주기(%) · 세로: 아래팔–손바닥 길이축 각도(°)',font=font(17),fill=muted)
d.text((30,565),'관측: 손가락 회전은 기본 펼친 모양 그대로 / 손목 전달값에 큰 꺾임이 남아 있었음',font=font(22),fill=ink)
d.text((30,609),'손목은 모델 기본 상대 회전으로 고정합니다. 손 전체는 기존 아래팔을 따라 계속 움직이며, 권장 운동 각도가 아닙니다.',font=font(18),fill=muted)
im.save(out/'cmu-hand-pose-curves.png')

im=Image.new('RGB',(1400,840),bg);d=ImageDraw.Draw(im)
d.text((30,20),'양손 근접 비교',font=font(32),fill=ink)
d.text((30,70),'M71 실제 캡처 · 외형 검토 전 / 오른손 15% · 왼손 65% / 각 쌍은 같은 카메라 · 손목 위치 유지',font=font(20),fill=muted)
for col,label in enumerate(['오른손 · 기존','오른손 · 수정','왼손 · 기존','왼손 · 수정']):
    d.text((90+col*325,115),label,font=font(23),fill=orange if col%2==0 else blue)
for row,model in enumerate(['male','female']):
    y=170+row*300
    d.text((20,y+85),'남성형' if row==0 else '여성형',font=font(19),fill=ink)
    for si,side in enumerate(['r','l']):
        for lane in [0,1]:
            photo=Image.open(raw/f'{model}-close-{side}-{lane}.png').crop((365,60,835,510))
            photo.thumbnail((300,265));im.paste(photo,(90+(si*2+lane)*325+(300-photo.width)//2,y))
d.text((30,792),'손가락은 손바닥 쪽으로 모은 시안입니다. 꽉 쥐는 힘이나 피부 충돌을 계산한 모양은 아닙니다.',font=font(20),fill=muted)
im.save(out/'cmu-hand-pose-close.png')

im=Image.new('RGB',(1400,710),bg);d=ImageDraw.Draw(im)
d.text((30,20),'정면·측면 / 팔과 다리는 그대로, 손만 수정',font=font(31),fill=ink)
d.text((30,67),'M71 실제 남성형 65% / 각 쌍의 왼쪽 기존 · 오른쪽 수정 / 사용자 외형 검토 전',font=font(20),fill=muted)
for col,view in enumerate(['front','side']):
    x=25+col*690;y=115
    d.text((x+25,y),'정면' if col==0 else '측면',font=font(22),fill=ink)
    d.text((x+115,y+34),'기존',font=font(21),fill=orange);d.text((x+485,y+34),'수정',font=font(21),fill=blue)
    photo=Image.open(raw/f'male-{view}-65.png').crop((245,65,960,545))
    photo.thumbnail((660,445));im.paste(photo,(x,y+65))
d.text((30,659),'M70 저장 동작·2,002시점 검사: 팔 움직임 / 골반·다리 위치 / 발 방향 / 몸 높이 유지',font=font(21),fill=muted)
im.save(out/'cmu-hand-pose-comparison.png')
print('M71 figures and summary generated.')
