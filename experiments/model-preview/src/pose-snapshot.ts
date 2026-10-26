import {poseDefinitionVersion, type PoseResult, type PoseValidation, type PoseValues} from './pose-values';

export type PoseSnapshot = Readonly<{
  schemaVersion:1;
  modelHash:string;
  poseDefinitionVersion:string;
  settingsRevision:number;
  unit:'deg';
  values:Readonly<PoseValues>;
}>;
export type PoseController = {
  definitionVersion:string;
  settingsRevision:number;
  values:Readonly<Record<string,number>>;
  validate:(candidate:unknown)=>PoseValidation;
  restore:(candidate:unknown)=>PoseResult;
};
export type PoseContext = {
  state:'ready'|'loading'|'error'|'unsupported';
  modelHash:string;
  loadId:number;
  settingsRevision:number;
  latestSettingsRevision:number;
  pose:PoseController | undefined;
};
function ready(c:PoseContext):PoseResult {
  if (c.state!=='ready' || !c.pose) return {ok:false,reason:'model-not-ready'};
  if (!/^[a-f0-9]{64}$/.test(c.modelHash) || !Number.isSafeInteger(c.loadId))
    return {ok:false,reason:'invalid-context'};
  if (c.pose.definitionVersion!==poseDefinitionVersion) return {ok:false,reason:'definition-mismatch'};
  if (!Number.isSafeInteger(c.settingsRevision) || c.settingsRevision<0 ||
      c.settingsRevision!==c.latestSettingsRevision || c.settingsRevision!==c.pose.settingsRevision)
    return {ok:false,reason:'settings-changed'};
  return {ok:true};
}

/** Validates imported/corrupted data without mutating the model or stored slot. */
export function validatePoseSnapshot(raw:unknown, context:PoseContext):PoseValidation {
  const available=ready(context);
  if (!available.ok) return available;
  if (!raw || typeof raw!=='object') return {ok:false,reason:'empty-or-invalid-snapshot'};
  const s=raw as Partial<PoseSnapshot>;
  if (s.schemaVersion!==1 || s.unit!=='deg') return {ok:false,reason:'unsupported-format'};
  if (s.modelHash!==context.modelHash) return {ok:false,reason:'model-mismatch'};
  if (s.poseDefinitionVersion!==context.pose!.definitionVersion) return {ok:false,reason:'definition-mismatch'};
  if (s.settingsRevision!==context.settingsRevision) return {ok:false,reason:'settings-changed'};
  return context.pose!.validate(s.values);
}

/** One page-lifetime slot. The caller supplies fresh load/settings state each time. */
export function createPoseSnapshotStore(getContext:()=>PoseContext) {
  let saved:PoseSnapshot|null=null;
  function stillCurrent(before:PoseContext):boolean {
    const after=getContext();
    return ready(after).ok && before.pose===after.pose && before.modelHash===after.modelHash &&
      before.loadId===after.loadId && before.settingsRevision===after.settingsRevision;
  }
  return {
    getSnapshot:()=>saved,
    availability():{save:PoseResult;restore:PoseResult} {
      const context=getContext(), available=ready(context);
      return {save:available.ok?context.pose!.validate(context.pose!.values):available,
        restore:validatePoseSnapshot(saved,context)};
    },
    save():PoseResult {
      const context=getContext(), available=ready(context);
      if (!available.ok) return available;
      const checked=context.pose!.validate(context.pose!.values);
      if (!checked.ok) return checked;
      if (!stillCurrent(context)) return {ok:false,reason:'context-changed'};
      saved=Object.freeze({schemaVersion:1,modelHash:context.modelHash,
        poseDefinitionVersion:context.pose!.definitionVersion,settingsRevision:context.settingsRevision,
        unit:'deg',values:Object.freeze({...checked.values})});
      return {ok:true};
    },
    restore():PoseResult {
      const context=getContext(), checked=validatePoseSnapshot(saved,context);
      if (!checked.ok) return checked;
      if (!stillCurrent(context)) return {ok:false,reason:'context-changed'};
      return context.pose!.restore(checked.values);
    },
  };
}
