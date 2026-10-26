import type {createRunningPose} from './running-pose';

type Pose = NonNullable<ReturnType<typeof createRunningPose>>;
export const legLiftPeriodMs=1200;

/** A smooth half-cycle lift per leg, in degrees. This is not a contact/gait solver. */
export function sampleLegLift(elapsedMs:number, target:number) {
  if(!Number.isFinite(elapsedMs)||elapsedMs<0||!Number.isFinite(target)||target<0)
    throw Error('Invalid leg lift sample');
  const phase=(elapsedMs%legLiftPeriodMs)/legLiftPeriodMs;
  const lift=target*(1-Math.cos(4*Math.PI*phase))/2;
  return {thigh_l:phase<.5?lift:0,thigh_r:phase>=.5?lift:0};
}

export function legLiftLimit(pose:Pose|undefined) {
  const legs=['thigh_l','thigh_r'].map(id=>pose?.definitions.find(j=>j.id===id));
  if(legs.some(j=>!j||j.min>0||j.max<0))return undefined;
  return Math.min(...legs.map(j=>j!.max));
}

/** One transient playback; pose.values always remain the user's editing values. */
export function createLegLiftMotion(pose:Pose) {
  let startedAt:number|undefined,target=0;
  let original:Record<string,number>={};
  let lastFrame:Record<string,number>|undefined;
  function stop() {
    if(startedAt===undefined)return;
    startedAt=undefined;
    pose.apply();
    lastFrame=undefined;
  }
  function tick(now:number) {
    if(startedAt===undefined)return;
    const frame={...original,...sampleLegLift(Math.max(0,now-startedAt),target)};
    const result=pose.applyFrame(frame);
    if(!result.ok){stop();throw Error(result.reason);}
    lastFrame=frame;
  }
  return {
    get playing(){return startedAt!==undefined;},
    get frame(){return lastFrame?{...lastFrame}:undefined;},
    start(value:number,now:number) {
      const limit=legLiftLimit(pose);
      if(limit===undefined||!Number.isInteger(value)||value<0||value>limit||!Number.isFinite(now))return false;
      stop();original={...pose.values};target=value;startedAt=now;
      tick(now);return true;
    },
    tick,stop,
  };
}
