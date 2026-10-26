import {lengthFields, type LengthId} from './body-dimensions';
import {normalizeCourseDraft,type CourseDraft} from './course';

export const stages = ['body', 'pose', 'course', 'backtest'] as const;
export type Stage = typeof stages[number];
export type StageState = {version:1; model:'male'|'female'; scale:number; ratios:Record<LengthId,number>; leg:number; elbow:number; lean:number; strike:'original'|'midfoot'|'heel'|'forefoot';course:CourseDraft|null};
export const stateKey = 'running-sim.stages.v1';
const bound = (n:unknown,min:number,max:number,fallback:number) => typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
export function normalizeState(input:unknown):StageState {
  const v = input && typeof input==='object' && 'version' in input && input.version===1 ? input as Partial<StageState> : {};
  return {version:1,model:v.model==='female'?'female':'male',scale:bound(v.scale,.9,1.1,1),
    ratios:Object.fromEntries(lengthFields.map(f=>[f.id,bound(v.ratios?.[f.id],.85,1.15,1)])) as Record<LengthId,number>,
    leg:bound(v.leg,0,10,0),elbow:bound(v.elbow,-20,20,0),lean:bound(v.lean,-10,15,0),strike:v.strike==='midfoot'||v.strike==='heel'||v.strike==='forefoot'?v.strike:'original',course:normalizeCourseDraft(v.course)};
}
export function route(path:string):Stage {
  const name=path.replace(/\/$/,'').slice(1);
  if(stages.includes(name as Stage))return name as Stage;
  return path.startsWith('/review/')||path.startsWith('/gait-compare')?'pose':'body';
}
export function hasCustomBody(state:StageState){return Math.abs(state.scale-1)>1e-8||Object.values(state.ratios).some(v=>Math.abs(v-1)>1e-8);}
