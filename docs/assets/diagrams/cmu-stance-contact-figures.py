from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[3];out=root/'docs/assets/images'
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',n)
# Same source frames, no pose/image manipulation. Crop lower body for inspection.
canvas=Image.new('RGB',(1320,1010),'#f6f5f1');d=ImageDraw.Draw(canvas)
d.text((30,18),'M47 · 착지 전에 정렬하고, 디딘 뒤 옆으로 이동하지 않도록',font=font(28),fill='#233b32')
d.text((30,64),'실제 모델 캡처 · 각 칸 왼쪽 M46 / 오른쪽 수정 · 자연스러움 사용자 검토 전',font=font(20),fill='#63736a')
for row,view in enumerate(['front','side']):
 for col,(phase,title) in enumerate([(28,'오른발 착지'),(43,'오른발 지지 중'),(75,'왼발 착지')]):
  x=col*440;y=120+row*430
  d.text((x+20,y),('정면' if row==0 else '측면')+' · '+title,font=font(23),fill='#233b32')
  im=Image.open(root/f'outputs/cmu-stance-contact/male-{view}-{phase}.png')
  for j,(lo,hi) in enumerate([(245,455),(690,900)]):
   crop=im.crop((lo,220,hi,555));canvas.paste(crop,(x+10+j*210,y+55))
  d.text((x+112,y+30),'기존',font=font(18),fill='#b96540',anchor='mt');d.text((x+322,y+30),'수정',font=font(18),fill='#1687ad',anchor='mt')
d.text((30,985),'35_17 · 골반 궤적 유지 / 좌우 접지 경로 수정 / 앞뒤 완전 고정은 아님',font=font(17),fill='#63736a')
canvas.save(out/'cmu-stance-contact-comparison.png')
flow=Image.new('RGB',(1280,330),'#f6f5f1');d=ImageDraw.Draw(flow)
for row,(label,items,color) in enumerate([('기존 문제',['안쪽으로 착지','땅에 닿은 뒤 바깥 이동','발을 떼기 전 고정 해제'],'#eeddd3'),('수정 방식',['착지 전 같은 쪽으로 정렬','지지점·발 옆방향 유지','발을 뗀 뒤 회수에 연결'],'#dcebe7')]):
 y=25+row*155;d.text((20,y+35),label,font=font(22),fill='#233b32')
 for i,item in enumerate(items):
  x=160+i*365;d.rounded_rectangle((x,y,x+330,y+100),radius=10,fill=color);d.text((x+165,y+37),item,font=font(20),fill='#233b32',anchor='mt')
  if i<2:d.text((x+347,y+35),'→',font=font(24),fill='#233b32',anchor='mt')
flow.save(out/'cmu-stance-contact-flow.png')
