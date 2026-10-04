import {localLab} from './settings';
import {joints} from './running-pose';
import {lengthFields,type LengthId} from './body-dimensions';
export type UsageEvent={id:string;at:number;visitor:string;kind:'visit'|'configuration_applied';revision:number;model?:string;hash?:string;heightCm?:number;pose?:Record<string,number>;bodyRecipe?:string;lengthsCm?:Record<LengthId,number>};
const prefix='running-sim.lab.event.';
const presence='running-sim.lab.presence.';
const preview=new URLSearchParams(location.search).get('admin-preview')==='1';
export function events():UsageEvent[]{
  return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).flatMap(k=>{
    try{
      const e=JSON.parse(localStorage.getItem(k)!);
      if(e.lengthsCm&&(!lengthFields.every(f=>Number.isFinite(e.lengthsCm[f.id]))||typeof e.bodyRecipe!=='string'))return [];
      return e&&typeof e.id==='string'&&Number.isFinite(e.at)&&typeof e.visitor==='string'&&['visit','configuration_applied'].includes(e.kind)&&Number.isSafeInteger(e.revision)&&(!e.pose||(typeof e.pose==='object'&&!Array.isArray(e.pose)&&Object.values(e.pose).every(v=>typeof v==='number'&&Number.isFinite(v))))?[e as UsageEvent]:[];
    }catch{return [];}
  }).sort((a,b)=>a.at-b.at);
}
export function record(data:Omit<UsageEvent,'id'|'at'|'visitor'>) {
  if(!localLab||preview||location.pathname.startsWith('/admin'))return;
  let visitor=localStorage.getItem('running-sim.lab.visitor');
  if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('running-sim.lab.visitor',visitor);}
  const item={...data,id:crypto.randomUUID(),at:Date.now(),visitor};
  localStorage.setItem(prefix+item.id,JSON.stringify(item));
  for(const old of events().slice(0,-2000))localStorage.removeItem(prefix+old.id);
}
export function startVisit(revision:number) {
  if(!localLab||preview)return;
  record({kind:'visit',revision});
  const id=crypto.randomUUID();
  const beat=()=>{if(document.visibilityState==='visible')localStorage.setItem(presence+id,JSON.stringify({at:Date.now(),visitor:localStorage.getItem('running-sim.lab.visitor')}));else localStorage.removeItem(presence+id);};
  beat();const timer=setInterval(beat,30000);
  document.addEventListener('visibilitychange',beat);
  addEventListener('pagehide',()=>{clearInterval(timer);localStorage.removeItem(presence+id);},{once:true});
}
export function activeVisitors(){
  const now=Date.now(),visitors=new Set<string>();
  for(const key of Object.keys(localStorage).filter(k=>k.startsWith(presence))){
    try{const item=JSON.parse(localStorage.getItem(key)!);if(now-item.at<90000&&item.visitor)visitors.add(item.visitor);}catch{/* Ignore incomplete local records. */}
  }
  return visitors.size;
}
export function ranked(items:UsageEvent[],kind:'pose'|'body') {
  const groups=new Map<string,{label:string;count:number}>();
  for(const item of items.filter(e=>e.kind==='configuration_applied')){
    // Separate model and config versions; pose/body mixtures are not merged silently.
    const fields=kind==='pose'?Object.entries(item.pose??{}).sort(([a],[b])=>a.localeCompare(b)):[];
    const lengths=item.lengthsCm?lengthFields.map(f=>[f.id,Math.round(item.lengthsCm![f.id])]):[];
    const key=JSON.stringify([item.hash,item.revision,kind==='pose'?fields:[item.bodyRecipe,Math.round((item.heightCm??0)/5)*5,lengths]]);
    const label=kind==='pose'?`${item.model} · v${item.revision} · ${fields.map(([k,v])=>`${joints.find(j=>j.id===k)?.label??k} ${v}°`).join(' / ')}`:`${item.model} · 높이 ${Math.round((item.heightCm??0)/5)*5}cm 구간 · v${item.revision}`;
    const dimensions=kind==='body'?(item.lengthsCm?' · '+lengthFields.map(f=>`${f.label} ${Math.round(item.lengthsCm![f.id])}cm`).join(' / '):' · 부위 길이 기록 전'):'';
    const group=groups.get(key)??{label:label+dimensions,count:0};group.count++;groups.set(key,group);
  }
  return [...groups.values()].sort((a,b)=>b.count-a.count).slice(0,5);
}
