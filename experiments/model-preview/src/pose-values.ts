export const poseDefinitionVersion = 'running-pose-v1';
export const poseIds = ['upperarm_l','lowerarm_l','thigh_l','calf_l',
  'upperarm_r','lowerarm_r','thigh_r','calf_r'] as const;
export type PoseId = typeof poseIds[number];
export type PoseValues = Record<PoseId, number>;
export type PoseResult = {ok:true} | {ok:false; reason:string};
export type PosePolicy = {id:string; enabled:boolean; min:number; max:number; initial:number};
export type PoseValidation = {ok:true; values:PoseValues} | {ok:false; reason:string};

/** Strict restore boundary: never round, clamp, or fill missing joints. */
export function validatePoseValues(raw:unknown, policies:readonly PosePolicy[], continuous=false):PoseValidation {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) return {ok:false,reason:'invalid-values'};
  const keys=Object.keys(raw);
  if (keys.length!==poseIds.length || !poseIds.every(id=>Object.hasOwn(raw,id)))
    return {ok:false,reason:'invalid-joints'};
  const values={} as PoseValues;
  for (const id of poseIds) {
    const policy=policies.find(p=>p.id===id), value=(raw as Record<string,unknown>)[id];
    if (!policy || typeof value!=='number' || !Number.isFinite(value) || (!continuous && !Number.isInteger(value)) ||
        value<policy.min || value>policy.max || (!policy.enabled && value!==policy.initial))
      return {ok:false,reason:'invalid-angle'};
    values[id]=value;
  }
  return {ok:true,values};
}
