import {lengthFields,type LengthId} from './body-dimensions';
export const localLab = import.meta.env.DEV && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
export const categoryDefaults = {
  upperarm: {label:'어깨', enabled:true, min:-25, max:45, initial:0},
  lowerarm: {label:'팔꿈치', enabled:true, min:45, max:120, initial:80},
  thigh: {label:'고관절', enabled:true, min:-15, max:65, initial:0},
  calf: {label:'무릎', enabled:true, min:0, max:120, initial:5},
};
export type Category = keyof typeof categoryDefaults;
export type ModelType = 'male'|'female';
export const builtInModels = {
  male: {label:'남성형', url:'/models/runner-male.glb', hash:'2a5f6609bb2f6b2833fcf385ad88fefe1139c7e83deb65fdcf8718dce26700d4'},
  female: {label:'여성형', url:'/models/runner-female.glb', hash:'fa58d9bf54263cedc3439065316a60d84d4d5ce9e918614ac43c8211266991f6'},
};
export const supportedHashes = new Set([
  '6fb12de1c339ab304588702507125a7799e78916f0628c779e163a24269268f2',
  ...Object.values(builtInModels).map(m=>m.hash),
]);
export type Settings = {
  version:1; revision:number; updatedAt:string;
  categories: typeof categoryDefaults;
  models: Record<ModelType,{enabled:boolean; source:string}>;
  heightEnabled:boolean;
  lengths:Record<LengthId,boolean>;
};
export const settingsKey='running-sim.lab.settings.v1';
export function defaults(): Settings {
  return {version:1,revision:0,updatedAt:'',categories:structuredClone(categoryDefaults),models:{male:{enabled:true,source:'builtin'},female:{enabled:true,source:'builtin'}},heightEnabled:true,lengths:Object.fromEntries(lengthFields.map(f=>[f.id,true])) as Record<LengthId,boolean>};
}
export function validateSettings(raw: Settings): Settings {
  if(!raw||raw.version!==1)throw Error('설정 형식이 올바르지 않습니다.');
  const result=defaults();
  for(const key of Object.keys(categoryDefaults) as Category[]) {
    const c=raw.categories?.[key],cap=categoryDefaults[key];
    if(!c||typeof c.enabled!=='boolean'||![c.min,c.max,c.initial].every(Number.isInteger)||c.min<cap.min||c.max>cap.max||c.min>=c.max||c.initial<c.min||c.initial>c.max)throw Error(`${cap.label}: 허용 범위 안에서 최소 ≤ 기본 ≤ 최대를 설정하세요.`);
    result.categories[key]={...cap,enabled:c.enabled,min:c.min,max:c.max,initial:c.initial};
  }
  for(const key of ['male','female'] as ModelType[]) {
    const m=raw.models?.[key];
    if(!m||typeof m.enabled!=='boolean'||(m.source!=='builtin'&&!/^[a-f0-9]{64}$/.test(m.source)))throw Error('모델 설정이 올바르지 않습니다.');
    result.models[key]={...m};
  }
  if(!result.models.male.enabled&&!result.models.female.enabled)throw Error('최소 한 모델을 사용자에게 제공해야 합니다.');
  if(typeof raw.heightEnabled!=='boolean')throw Error('높이 설정이 올바르지 않습니다.');
  result.heightEnabled=raw.heightEnabled;
  // Existing version-one settings predate length controls; retain their other policies.
  if(raw.lengths!==undefined)for(const f of lengthFields){
    if(typeof raw.lengths?.[f.id]!=='boolean')throw Error('부위 길이 설정이 올바르지 않습니다.');
    result.lengths[f.id]=raw.lengths[f.id];
  }
  result.revision=Number.isSafeInteger(raw.revision)&&raw.revision>=0?raw.revision:0;
  result.updatedAt=typeof raw.updatedAt==='string'?raw.updatedAt:'';
  return result;
}
export function readSettings():Settings {
  if(!localLab)return defaults();
  const raw=localStorage.getItem(settingsKey);
  return raw?validateSettings(JSON.parse(raw)):defaults();
}
export function saveSettings(value:Settings) {
  if(!localLab)throw Error('로컬 시험에서만 설정을 변경할 수 있습니다.');
  const clean=validateSettings(value);
  const current=readSettings();
  if(current.revision!==value.revision)throw Error('다른 화면에서 설정이 변경되었습니다. 새로고침 후 다시 적용하세요.');
  clean.revision=current.revision+1;clean.updatedAt=new Date().toISOString();
  localStorage.setItem(settingsKey,JSON.stringify(clean));return clean;
}

export type StoredModel={hash:string; name:string; bytes:number; blob:Blob; createdAt:string};
async function database() {
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open('running-sim-lab',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('models',{keyPath:'hash'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
export async function storeModel(file:File):Promise<StoredModel> {
  if(!localLab)throw Error('로컬 시험 전용 기능입니다.');
  if(file.size>30*1024*1024)throw Error('시험 파일은 30MB 이하 GLB만 등록할 수 있습니다.');
  const buffer=await file.arrayBuffer(),header=new DataView(buffer);
  if(buffer.byteLength<20||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==buffer.byteLength)throw Error('올바른 GLB 2.0 파일을 선택하세요.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  const entry={hash,name:file.name,bytes:file.size,blob:new Blob([buffer]),createdAt:new Date().toISOString()};
  const db=await database();
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('models','readwrite');tx.objectStore('models').put(entry);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  return entry;
}
export async function storedModels():Promise<StoredModel[]> {
  const db=await database();
  try{return await new Promise((resolve,reject)=>{const req=db.transaction('models').objectStore('models').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}
}
export async function modelBuffer(type:ModelType,settings:Settings):Promise<{buffer:ArrayBuffer;name:string}> {
  const source=settings.models[type].source;
  if(source==='builtin'){
    const response=await fetch(builtInModels[type].url);if(!response.ok)throw Error(`${builtInModels[type].label} GLB 파일을 찾을 수 없습니다.`);
    return {buffer:await response.arrayBuffer(),name:`runner-${type}.glb`};
  }
  if(!localLab)throw Error('배포용 모델 저장소가 연결되지 않았습니다.');
  const m=(await storedModels()).find(m=>m.hash===source);
  if(!m||!supportedHashes.has(m.hash))throw Error('검증된 등록 모델을 찾을 수 없습니다.');
  return {buffer:await m.blob.arrayBuffer(),name:m.name};
}
