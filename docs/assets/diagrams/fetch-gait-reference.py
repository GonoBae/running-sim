# Documentation data extraction. Requires h5py, numpy, requests. Run from repository root.
# Public CC0 file; HTTP ranges cached in ignored work/; no application modifications.
import sys,io,pathlib,json
import requests,h5py
class Remote(io.RawIOBase):
 def __init__(self):
  self.pos=0; self.size=1532987696; self.block=262144; self.session=requests.Session(); self.count=0
  self.cache=pathlib.Path('work/gait-research/blocks');self.cache.mkdir(exist_ok=True,parents=True)
 def readable(self):return True
 def seekable(self):return True
 def tell(self):return self.pos
 def seek(self,offset,whence=0):
  self.pos=offset if whence==0 else self.pos+offset if whence==1 else self.size+offset
  return self.pos
 def readinto(self,b):
  data=self.read(len(b));b[:len(data)]=data;return len(data)
 def read(self,n=-1):
  if n<0:n=self.size-self.pos
  n=min(n,self.size-self.pos);result=bytearray()
  while len(result)<n:
   index=self.pos//self.block;start=index*self.block;path=self.cache/str(index)
   if not path.exists():
    end=min(start+self.block,self.size)-1
    r=self.session.get('https://ndownloader.figshare.com/files/28998063',headers={'Range':f'bytes={start}-{end}'},timeout=40)
    r.raise_for_status()
    assert r.status_code==206 and r.headers['Content-Range'].startswith(f'bytes {start}-'),r.headers
    path.write_bytes(r.content);self.count+=1
   data=path.read_bytes();off=self.pos-start;take=min(n-len(result),len(data)-off)
   assert take>0
   result.extend(data[off:off+take]);self.pos+=take
  return bytes(result)


import numpy as np
with Remote() as r,h5py.File(r,'r') as f:
 g=f['Normalized/AB01/Run/s2x0/i0']
 events=g['events/StrideDetails'][:].T
 left=events[:,3]==1
 print('events',events[:5].tolist(),'left',int(left.sum()),flush=True)
 arrays={}
 for name in ['HipAngles','PelvisAngles','KneeAngles','AnkleAngles']:
  arrays[name]=g['jointAngles/'+name][:][left,0,:]
  print(name,arrays[name].shape,flush=True)
 arrays['ThighAbsolute']=arrays['HipAngles']-arrays['PelvisAngles']
 markers={}
 for name in ['LGT','LKNE','LKNEM','LANK','LANKM','LHEE','LTOE','LASI','LPSI']:
  markers[name]=g['markers/'+name][0,:,:].tolist();print(name,flush=True)
 data={'source':'https://doi.org/10.6084/m9.figshare.14558184.v1','license':'CC0','fileId':28998063,'fileSize':1532987696,'publisherMd5':'e62fb9cd3aa8dba5b81a5c9f59e5c910','fullFileChecksumVerified':False,'extraction':'HTTP range reads; h5py; MATLAB dimensions reversed by HDF5','participant':'AB01','condition':'Run/s2x0/i0','commandedSpeedMs':2.060804,'speedSource':'Dataset README page 9, AB01 nominal 2.0 row; commanded, not measured instantaneous speed','side':'left','strideCount':int(left.sum()),'strideTimesSeconds':(events[left,2]/100).tolist(),'phase':np.linspace(0,1,150).tolist(),'mean':{k:np.mean(v,axis=0).tolist() for k,v in arrays.items()},'std':{k:np.std(v,axis=0,ddof=1).tolist() for k,v in arrays.items()},'firstLeftStride':{k:v[0].tolist() for k,v in arrays.items()},'markersFirstLeftStride':markers,'events':events.tolist()}
 assert all(np.isfinite(v).all() for v in arrays.values())
 pathlib.Path('docs/05-validation/reports/gait-reference-ab01.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
 print('done',r.count,'new blocks',flush=True)
