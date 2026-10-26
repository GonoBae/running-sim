import {totalDistanceM,validPace,type Course,type CourseDraft} from './course.ts';

export type CycleTravel={seconds:number;distanceM:number};
const checked=(n:number)=>{if(!Number.isFinite(n)||n<0)throw new RangeError('재생 값은 0 이상의 유한한 수여야 합니다.');return n;};
/** Retiming keeps the same stride travel and joint trajectory at each gait phase. */
export function cycleDuration(cycle:CycleTravel,paceSecondsPerKm?:number){
 if(paceSecondsPerKm===undefined)return cycle.seconds;
 if(!validPace(paceSecondsPerKm))throw new RangeError('목표 페이스 범위를 확인해주세요.');
 return cycle.distanceM*paceSecondsPerKm/1000;
}
/** Time, gait phase and course distance share one clock. No predicted record. */
export function createCoursePlayback(course:Course,input:CourseDraft,cycle:CycleTravel){
 const issue=course.issue(input);if(issue)throw new Error(issue);
 if(!(checked(cycle.seconds)>0)||!(checked(cycle.distanceM)>0))throw new RangeError('동작의 시간과 전진 거리가 필요합니다.');
 const draft={...input},cycleSeconds=cycleDuration(cycle,draft.paceSecondsPerKm),speedMps=draft.paceSecondsPerKm===undefined?cycle.distanceM/cycle.seconds:1000/draft.paceSecondsPerKm,totalM=totalDistanceM(course,draft),duration=totalM/speedMps;
 let elapsed=0,playing=false,rate=1;
 function frame(){
  const complete=elapsed>=duration,distanceM=complete?totalM:elapsed*speedMps;
  const position=course.atTravel(draft,distanceM);
  // Keep positions on the original polyline; only the viewing heading is softened.
  const before=course.atTravel(draft,distanceM-1.5),after=course.atTravel(draft,distanceM+1.5);
  const heading=Math.atan2(after[0]-before[0],-(after[1]-before[1]));
  return {elapsed,duration,distanceM,totalM,speedMps,cycleSeconds,paceSecondsPerKm:draft.paceSecondsPerKm??1000/speedMps,targetPace:draft.paceSecondsPerKm!==undefined,rate,playing,complete,phase:(elapsed/cycleSeconds)%1,
   completedLaps:Math.floor((distanceM+1e-8)/course.lengthM),
   position,heading,progress:distanceM/totalM};
 }
 return {frame,play(){if(elapsed>=duration)elapsed=0;playing=true;},pause(){playing=false;},reset(){elapsed=0;playing=false;},
  seek(seconds:number){elapsed=Math.min(duration,checked(seconds));playing=false;},
  setRate(value:number){if(![1,2,4].includes(value))throw new RangeError('지원하지 않는 재생 배속입니다.');rate=value;},
  tick(seconds:number){checked(seconds);if(playing){elapsed=Math.min(duration,elapsed+seconds*rate);if(elapsed>=duration)playing=false;}return frame();}};
}
export type RunFrame=ReturnType<ReturnType<typeof createCoursePlayback>['frame']>;
