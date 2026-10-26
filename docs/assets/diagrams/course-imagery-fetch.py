from pathlib import Path
import urllib.request,json,math,concurrent.futures,io,hashlib
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[3];out=R/'outputs/course-imagery';out.mkdir(parents=True,exist_ok=True)
asset=json.loads((R/'experiments/model-preview/public/courses/lotte-garden-c-v1.json').read_text(encoding='utf8'))
if not (out/'esri-service.json').exists():
 (out/'esri-service.json').write_bytes(urllib.request.urlopen('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson',timeout=25).read())
service=json.loads((out/'esri-service.json').read_text())
level=19;res=next(l['resolution'] for l in service['tileInfo']['lods'] if l['level']==level);origin=service['tileInfo']['origin'];tile=256
def merc(p):return (6378137*math.radians(p[0]),6378137*math.log(math.tan(math.pi/4+math.radians(p[1])/2)))
coords=list(map(merc,asset['geometry']['coordinates']));pad=30
xmin=min(p[0] for p in coords)-pad;xmax=max(p[0] for p in coords)+pad;ymin=min(p[1] for p in coords)-pad;ymax=max(p[1] for p in coords)+pad
col0=math.floor((xmin-origin['x'])/(res*tile));col1=math.floor((xmax-origin['x'])/(res*tile));row0=math.floor((origin['y']-ymax)/(res*tile));row1=math.floor((origin['y']-ymin)/(res*tile))
records=[]
def fetch(rc):
 row,col=rc;name=f'esri-{level}-{row}-{col}.jpg';p=out/name;u=f'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{level}/{row}/{col}?blankTile=false'
 if not p.exists():p.write_bytes(urllib.request.urlopen(u,timeout=25).read())
 data=p.read_bytes();return row,col,Image.open(io.BytesIO(data)).convert('RGB'),{'url':u,'file':name,'sha256':hashlib.sha256(data).hexdigest()}
canvas=Image.new('RGB',((col1-col0+1)*tile,(row1-row0+1)*tile))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for row,col,img,rec in pool.map(fetch,[(r,c) for r in range(row0,row1+1) for c in range(col0,col1+1)]):canvas.paste(img,((col-col0)*tile,(row-row0)*tile));records.append(rec)
left=origin['x']+col0*tile*res;top=origin['y']-row0*tile*res
def pixel(p):x,y=merc(p);return ((x-left)/res,(top-y)/res)
canvas.save(out/'esri-mosaic.jpg',quality=95)
draw=ImageDraw.Draw(canvas);draw.line(list(map(pixel,asset['geometry']['coordinates'])),fill='#ff4e36',width=4)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',22)
for i,p in enumerate(asset['geometry']['coordinates'][:-1]):
 if i%5==0:
  x,y=pixel(p);draw.ellipse((x-4,y-4,x+4,y+4),fill='white');draw.text((x+6,y+5),str(i),font=font,fill='yellow',stroke_width=2,stroke_fill='black')
draw.rectangle((0,canvas.height-42,canvas.width,canvas.height),fill='white');draw.text((10,canvas.height-35),'Current OSM route · Source: Esri, Vantor, Earthstar Geographics, GIS User Community',font=font,fill='black')
canvas.save(out/'esri-overlay.png')
meta={'source':service['copyrightText'],'level':level,'resolution3857':res,'left3857':left,'top3857':top,'width':canvas.width,'height':canvas.height,'tiles':records}
(out/'esri-georeference.json').write_text(json.dumps(meta,indent=2),encoding='utf8');print({k:v for k,v in meta.items() if k!='tiles'});print('tiles',len(records))
