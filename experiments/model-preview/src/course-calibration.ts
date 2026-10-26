// Historical M91 experiment, withdrawn in M92. Never import from the application.
import {COURSE_ID,createCourse,type CourseAsset,type CourseDraft} from './course.ts';

// User's observed route/start/direction, not GPS-surveyed anchor coordinates.
export const FIELD_REFERENCE={id:'field-bc-v1',courseId:COURSE_ID,courseRevision:'c-3471370ec877',
 startDistanceM:1121.8640021884382,direction:'reverse' as const,targetM:4000,completedLaps:3};
export function courseCalibration(asset:CourseAsset){
 if(asset.id!==FIELD_REFERENCE.courseId||asset.revision!==FIELD_REFERENCE.courseRevision)throw Error('거리 보정 기준과 코스 버전이 다릅니다.');
 const raw=createCourse(asset);
 const b=raw.nearest(raw.project(asset.landmarks[1].coordinate)).startDistanceM;
 const c=raw.nearest(raw.project(asset.landmarks[2].coordinate)).startDistanceM;
 if(!(b<c&&c<FIELD_REFERENCE.startDistanceM))throw Error('B·C 거리 기준을 확인할 수 없습니다.');
 const targetMapDistanceM=FIELD_REFERENCE.startDistanceM-(b+c)/2+FIELD_REFERENCE.completedLaps*raw.mapLengthM;
 const distanceScale=FIELD_REFERENCE.targetM/targetMapDistanceM;
 const threeKmAfterBM=3000/distanceScale-(FIELD_REFERENCE.startDistanceM-b+2*raw.mapLengthM);
 return {id:FIELD_REFERENCE.id,distanceScale,targetMapDistanceM,referenceStartDistanceM:FIELD_REFERENCE.startDistanceM,
  mapLapM:raw.mapLengthM,calibratedLapM:raw.mapLengthM*distanceScale,bMapDistanceM:b,cMapDistanceM:c,threeKmAfterBM,
  fourKmMapDistanceM:(b+c)/2,surveyed:false};
}
export function createCalibratedCourse(asset:CourseAsset){return createCourse(asset,{distanceScale:courseCalibration(asset).distanceScale});}
export const matchesFieldReference=(d:CourseDraft)=>d.direction===FIELD_REFERENCE.direction&&Math.abs(d.startDistanceM-FIELD_REFERENCE.startDistanceM)<.01;
