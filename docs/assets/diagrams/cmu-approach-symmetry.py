"""M61: actual M60 skin paths in three reference frames; no pose correction."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3]
data=json.loads((root/'docs/05-validation/reports/cmu-approach-symmetry.json').read_text())
assert data['status']=='observed'
out=root/'docs/assets/images';font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
bg='#f6f5f1';ink='#233b32';muted='#63736a';right='#b96540';left='#1687ad'
summary={'status':'passed','scope':'M60 observation only; same-stage approach 10–28% vs 60–78%; actor right/left','results':[]}
for result in data['results']:
    pairs=result['pairs']
    def coordinate(p,key,side,frame):
        pose=p[key];x=pose['feet'][side]['center'][0]
        if frame=='pelvis':x-=pose['bones']['pelvis'][0]
        if frame=='torso':x-=pose['shoulderMid'][0]
        return x*(1 if side=='r' else -1)*1000
    curves={}
    for frame in ['ground','pelvis','torso']:
        curves[frame]={}
        for key,s in [('right','r'),('left','l')]:
            origin=coordinate(pairs[0],key,s,frame)
            curves[frame][s]=[coordinate(p,key,s,frame)-origin for p in pairs]
    m={'model':result['model'],'curves':curves,'travelMm':[v*1000 for v in result['travel']]}
    m['skinPelvisMirrorMm']=max(abs(sum(p[k]['feet'][s]['center'][0]-p[k]['bones']['pelvis'][0] for k,s in [('right','r'),('left','l')]))*1000 for p in pairs)
    m['bonePelvisMirrorMm']=max(abs(sum(p[k]['bones']['foot_'+s][0]-p[k]['bones']['pelvis'][0] for k,s in [('right','r'),('left','l')]))*1000 for p in pairs)
    m['skinScreenMirrorPx']=max(abs(sum(p[k]['projected']['surface_'+s][0]-p[k]['projected']['pelvis'][0] for k,s in [('right','r'),('left','l')])) for p in pairs)
    m['torsoMirrorOffsetMm']=max(abs(sum(p[k]['feet'][s]['center'][0]-p[k]['shoulderMid'][0] for k,s in [('right','r'),('left','l')]))*1000 for p in pairs)
    m['headMirrorOffsetMm']=max(abs(sum(p[k]['feet'][s]['center'][0]-p[k]['bones']['head'][0] for k,s in [('right','r'),('left','l')]))*1000 for p in pairs)
    m['pelvisScreenRangePx']=max(p[k]['projected']['pelvis'][0] for p in pairs for k in ['right','left'])-min(p[k]['projected']['pelvis'][0] for p in pairs for k in ['right','left'])
    m['groundInwardMm']={s:curves['ground'][s][-1] for s in ['r','l']}
    m['pelvisInwardMm']={s:curves['pelvis'][s][-1] for s in ['r','l']}
    m['torsoInwardMm']={s:curves['torso'][s][-1] for s in ['r','l']}
    m['driftPredictionMm']=-2*result['travel'][0]*(.28-.10)*1000
    m['driftResidualMm']=abs((m['groundInwardMm']['l']-m['groundInwardMm']['r'])-m['driftPredictionMm'])
    assert m['skinPelvisMirrorMm']<.001 and m['bonePelvisMirrorMm']<.001
    assert m['skinScreenMirrorPx']<.001 and m['pelvisScreenRangePx']<.001
    assert m['driftResidualMm']<.001
    summary['results'].append(m)
(root/'docs/05-validation/reports/cmu-approach-symmetry-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')

img=Image.new('RGB',(1440,790),bg);d=ImageDraw.Draw(img)
d.text((28,20),'M61 · 골반 기준만으로는 전체 동작을 판정할 수 없습니다',font=font(28),fill=ink)
d.text((28,65),'현재 M60 남성형 · 실제 발끝/뒤꿈치 고정 피부 구역의 중점 · 갈색 본인 오른발 / 파랑 본인 왼발',font=font(18),fill=muted)
m=summary['results'][0]
for j,(frame,title) in enumerate([('ground','지면 기준 · 실제 경로 차이'),('pelvis','골반 기준 · 다리 경로 대응'),('torso','상체 중심 기준 · 차이 남음')]):
    x,y,w,h=75+j*475,185,385,320
    d.text((x-25,125),title,font=font(22),fill=ink)
    for v in [-20,0,20,40,60]:
        yy=y+h-(v+20)/80*h;d.line((x,yy,x+w,yy),fill='#d5ded5');d.text((x-40,yy-10),str(v),font=font(16),fill=muted)
    for s,color,width in [('r',right,6),('l',left,3)]:
        values=m['curves'][frame][s]
        d.line([(x+i/(len(values)-1)*w,y+h-(v+20)/80*h) for i,v in enumerate(values)],fill=color,width=width)
    for v in [0,50,100]:d.text((x+v/100*w-10,y+h+12),str(v),font=font(16),fill=muted)
    d.text((x,y+h+57),f"오른 {m['curves'][frame]['r'][-1]:.1f} / 왼 {m['curves'][frame]['l'][-1]:.1f}mm",font=font(23),fill=ink)
d.text((28,615),'세 그래프 모두 접근 시작 위치를 0으로 정렬 · 세로 +는 안쪽 이동 / 가로 접근 진행률 %',font=font(20),fill=muted)
d.text((28,665),'지면 X 경로: 한 주기 43.2mm의 몸 이동 성분이 접근량 차이 15.5mm를 설명합니다.',font=font(21),fill=ink)
d.text((28,709),'화면: 카메라가 골반을 따라갑니다. 발-골반 화면 경로는 같고, 상체 중심은 좌우 대응하지 않습니다.',font=font(20),fill=ink)
d.text((28,750),'같은 단계: 본인 오른발 10~28% ↔ 본인 왼발 60~78% · 현재 동작 보정 없음',font=font(18),fill=muted)
img.save(out/'cmu-approach-symmetry-frames.png')

# Crop only the current M60 model from real captures; no generated poses.
img=Image.new('RGB',(1280,1110),bg);d=ImageDraw.Draw(img)
d.text((28,20),'실제 화면 · 같은 단계의 오른발과 왼발',font=font(30),fill=ink)
d.text((28,65),'본인 기준 오른쪽은 화면 왼쪽 다리 · 본인 기준 왼쪽은 화면 오른쪽 다리',font=font(19),fill=muted)
for row,(side,label,color) in enumerate([('r','본인 오른발 접근',right),('l','본인 왼발 접근 · 반 주기 뒤',left)]):
    top=105+row*485;d.text((28,top),label,font=font(23),fill=color)
    for col,phase in enumerate([.10,.18,.24,.28]):
        current=phase+(.5 if side=='l' else 0);path=root/f'outputs/cmu-approach-symmetry/male-front-{round(current*100)}.png'
        photo=Image.open(path).convert('RGB')
        pair=min(data['results'][0]['pairs'],key=lambda p:abs(p['phase']-phase))
        pose=pair['right' if side=='r' else 'left'];center=pose['projected']['pelvis'][0]
        # The crop is fixed around the tracked pelvis, identical in both rows.
        photo=photo.crop((round(center)-185,0,round(center)+185,photo.height))
        photo.thumbnail((285,405));x=28+col*310;img.paste(photo,(x,top+37))
        d.text((x+85,top+448),f'{current:.0%}',font=font(20),fill=ink)
d.text((28,1080),'실제 모델 자세는 그대로입니다. 골반에 대한 다리 대응과 상체를 포함한 외형은 구분해 봐야 합니다.',font=font(18),fill=muted)
img.save(out/'cmu-approach-symmetry-captures.png')

img=Image.new('RGB',(1280,600),bg);d=ImageDraw.Draw(img)
d.text((28,20),'같은 착지 단계 · 상체 중심과 골반 중심',font=font(29),fill=ink)
d.text((28,65),'남성형 28% ↔ 78% · 골반을 맞추고 왼쪽 좌표를 좌우 반사 · 실제 관절 좌표',font=font(19),fill=muted)
pair=data['results'][0]['pairs'][-1]
for col,(label,scale) in enumerate([('정면 전체',190),('상체 중심 확대',450)]):
    ox,oy=(320,340) if col==0 else (965,520);d.text((ox-135,113),label,font=font(23),fill=ink)
    for k,s,color,width in [('right','r',right,7),('left','l',left,3)]:
        p=pair[k];P=p['bones']['pelvis'];sign=1 if s=='r' else -1
        point=lambda xyz:(ox+(xyz[0]-P[0])*sign*scale,oy-(xyz[1]-P[1])*scale)
        if col==0:
            names=['pelvis','thigh_'+s,'calf_'+s,'foot_'+s,'ball_'+s];ps=[point(p['bones'][n]) for n in names];d.line(ps,fill=color,width=width)
        ps=[point(P),point(p['shoulderMid']),point(p['bones']['head'])]
        d.line(ps,fill=color,width=width)
        for x,y in ps:d.ellipse((x-5,y-5,x+5,y+5),fill=color)
    d.line((ox,155,ox,535),fill='#a9b7ac',width=1)
d.text((30,165),'갈색: 오른발 단계',font=font(18),fill=right)
d.text((30,195),'파랑: 왼발 단계 반사',font=font(18),fill=left)
d.text((28,555),'관찰: 발목 경로는 겹치지만 상체 중심선은 겹치지 않습니다. 상체를 포함한 주기 연결이 다음 검토 대상입니다.',font=font(19),fill=ink)
img.save(out/'cmu-approach-symmetry-torso.png')
print(json.dumps([{k:v for k,v in r.items() if k!='curves'} for r in summary['results']],ensure_ascii=False,indent=2))
