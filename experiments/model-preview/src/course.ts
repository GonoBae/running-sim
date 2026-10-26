export const COURSE_ID='gimhae-lotte-garden-b';
export const COURSE_REVISION='d-ebb99e9a6425';
export const COURSE_URL='/courses/lotte-garden-d-v1.json';
export type Point=[number,number];
export type CourseDraft={id:string;revision:string;startDistanceM:number;direction:'forward'|'reverse';laps:number;goal?:{type:'distance';distanceM:number};paceSecondsPerKm?:number};
export type CourseHistory={id:string;revision:string;geometry:{type:'LineString';coordinates:Point[]};previous?:CourseHistory};
export type CourseAsset=CourseHistory & {schemaVersion:1;name:string;context:{kind:string;coordinates:Point[]}[];landmarks:{label:string;coordinate:Point}[];source:{attribution:string;licenseUrl:string;snapshotTimeUTC:string;verification?:{method:string;geometrySha256:string;snapshotTimeUTC:string|null;fetchedAtUTC:string;segments:number;wayCount:number;lapLengthM:number;distanceScale:number;fieldAccuracyVerified:boolean};correction?:{id:string;baseRevision:string;from:Point;to:Point;removedCoordinate:Point;oldRangeM:[number,number];maxStartSnapM:number;beforeLengthM:number;afterLengthM:number;shorterByM:number}}};
const radius=6371008.8,rad=Math.PI/180;
export const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function normalizeCourseDraft(value:unknown):CourseDraft|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Partial<CourseDraft>;
 if(typeof v.id!=='string'||typeof v.revision!=='string'||!finite(v.startDistanceM)||v.startDistanceM<0||!finite(v.laps)||!Number.isInteger(v.laps)||v.laps<1||v.laps>100||(v.direction!=='forward'&&v.direction!=='reverse'))return null;
 if(v.goal!==undefined&&(!v.goal||v.goal.type!=='distance'||!validGoalDistance(v.goal.distanceM)))return null;
 if(v.paceSecondsPerKm!==undefined&&!validPace(v.paceSecondsPerKm))return null;
 return {id:v.id,revision:v.revision,startDistanceM:v.startDistanceM,direction:v.direction,laps:v.laps,...(v.goal?{goal:{type:'distance' as const,distanceM:v.goal.distanceM}}:{}),...(v.paceSecondsPerKm!==undefined?{paceSecondsPerKm:v.paceSecondsPerKm}:{})};
}
export const validPace=(s:unknown):s is number=>finite(s)&&Number.isInteger(s)&&s>=60&&s<=1800;
export const paceLabel=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} /km`;
export function durationLabel(seconds:number){const s=Math.round(seconds),m=Math.floor(s/60);return m>=60?`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${m}:${String(s%60).padStart(2,'0')}`;}
export const validGoalDistance=(m:unknown):m is number=>finite(m)&&Number.isInteger(m)&&m>=10&&m<=100000&&m%10===0;
export const totalDistanceM=(course:Pick<Course,'lengthM'>,d:CourseDraft)=>d.goal?.distanceM??course.lengthM*d.laps;
export const goalLabel=(d:CourseDraft)=>d.goal?`${(d.goal.distanceM/1000).toFixed(2)} km`:`${d.laps}바퀴`;
export function distanceM(a:Point,b:Point){
 const h=Math.sin((b[1]-a[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
 return 2*radius*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function createCourse(asset:CourseAsset,options:{distanceScale?:number}={}){
 const distanceScale=options.distanceScale??1;
 if(!finite(distanceScale)||distanceScale<=0)throw Error('거리 보정 배율이 올바르지 않습니다.');
 if(asset?.schemaVersion!==1||!asset.id||!asset.revision||asset.geometry?.type!=='LineString')throw Error('코스 자료 형식을 확인할 수 없습니다.');
 const points=asset.geometry.coordinates;
 if(!Array.isArray(points)||points.length<4||points.some(p=>!Array.isArray(p)||p.length!==2||!finite(p[0])||!finite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('코스 좌표가 올바르지 않습니다.');
 if(points[0][0]!==points.at(-1)![0]||points[0][1]!==points.at(-1)![1])throw Error('한 바퀴의 시작과 끝이 연결되지 않았습니다.');
 if(new Set(points.slice(0,-1).map(p=>p.join(','))).size!==points.length-1)throw Error('코스에 중복 위치가 있습니다.');
 const origin=points[0],cos=Math.cos(origin[1]*rad);
 const project=(p:Point):Point=>[(p[0]-origin[0])*rad*radius*cos,(p[1]-origin[1])*rad*radius];
 const local=points.map(project),cumulative=[0];
 for(let i=1;i<points.length;i++){
  const segment=distanceM(points[i-1],points[i]);if(segment<.001)throw Error('코스 선분 길이가 올바르지 않습니다.');
  cumulative.push(cumulative[i-1]+segment);
 }
 const mapLengthM=cumulative.at(-1)!,lengthM=mapLengthM*distanceScale;
 if(!Number.isFinite(lengthM)||lengthM<=0)throw Error('코스 길이를 계산할 수 없습니다.');
 const orient=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a:Point,b:Point,c:Point)=>Math.abs(orient(a,b,c))<1e-8&&c[0]>=Math.min(a[0],b[0])-1e-8&&c[0]<=Math.max(a[0],b[0])+1e-8&&c[1]>=Math.min(a[1],b[1])-1e-8&&c[1]<=Math.max(a[1],b[1])+1e-8;
 for(let i=0;i<local.length-1;i++)for(let j=i+2;j<local.length-1;j++){
  if(i===0&&j===local.length-2)continue;
  const [a,b,c,d]=[local[i],local[i+1],local[j],local[j+1]];
  if((orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw Error('코스가 교차하거나 겹쳐 있습니다.');
 }
 const planar=local.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-local[i][0],p[1]-local[i][1]),0);
 if(Math.abs(planar-mapLengthM)/mapLengthM>.005)throw Error('지도 변환 거리 오차가 큽니다.');
 // Saved startDistanceM, pointAt and nearest always use original map chainage.
 const wrap=(s:number)=>((s%mapLengthM)+mapLengthM)%mapLengthM;
 function pointAt(s:number):Point{
  const value=wrap(s);let i=1;while(i<cumulative.length-1&&cumulative[i]<value)i++;
  const t=(value-cumulative[i-1])/(cumulative[i]-cumulative[i-1]);
  return [local[i-1][0]+t*(local[i][0]-local[i-1][0]),local[i-1][1]+t*(local[i][1]-local[i-1][1])];
 }
 function nearest(p:Point){
  let best={distance:Infinity,startDistanceM:0,point:local[0]};
  for(let i=1;i<local.length;i++){
   const a=local[i-1],b=local[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
   const q:Point=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(q[0]-p[0],q[1]-p[1]);
   if(distance<best.distance)best={distance,startDistanceM:wrap(cumulative[i-1]+t*(cumulative[i]-cumulative[i-1])),point:q};
  }return best;
 }
 function issue(draft:CourseDraft|null):string{
  const d=normalizeCourseDraft(draft);
  if(!d)return '지도에서 출발점을 선택해주세요.';
  if(d.id!==asset.id||d.revision!==asset.revision)return '저장된 코스 자료가 변경되었습니다. 출발점을 다시 선택해주세요.';
  if(d.startDistanceM>=mapLengthM)return '출발점이 경로 범위를 벗어났습니다. 다시 선택해주세요.';
  return '';
 }
 return {asset,local,project,cumulative,mapLengthM,lengthM,distanceScale,pointAt,nearest,issue,
  atTravel:(draft:CourseDraft,m:number)=>pointAt(draft.startDistanceM+(draft.direction==='forward'?m:-m)/distanceScale)};
}
export type Course=ReturnType<typeof createCourse>;
/** Preserve physical starts across B/C/D. Only the confirmed plaza detour may snap. */
export function migrateCourseDraft(course:Course,draft:CourseDraft|null):CourseDraft|null{
 const d=normalizeCourseDraft(draft);let p=course.asset.previous;
 if(!d||d.revision===course.asset.revision)return null;
 for(let i=0;p&&p.revision!==d.revision&&i<16;i++)p=p.previous;
 if(!p||d.id!==p.id||d.revision!==p.revision)return null;
 const previous=createCourse({...course.asset,...p});
 if(previous.issue(d))return null;
 const q=previous.pointAt(d.startDistanceM),oldOrigin=p.geometry.coordinates[0];
 const localOrigin=course.project(oldOrigin),newCos=Math.cos(course.asset.geometry.coordinates[0][1]*rad),oldCos=Math.cos(oldOrigin[1]*rad);
 const position:Point=[localOrigin[0]+q[0]*newCos/oldCos,localOrigin[1]+q[1]],hit=course.nearest(position);
 if(hit.distance>.01){
  const correction=course.asset.source.correction,base=course.asset.previous;
  if(!correction||!base||base.revision!==correction.baseRevision||hit.distance>correction.maxStartSnapM)return null;
  const reference=createCourse({...course.asset,...base});
  // All current revisions share an origin; refuse an unexpected coordinate-frame change.
  if(base.geometry.coordinates[0].some((v,i)=>v!==course.asset.geometry.coordinates[0][i]))return null;
  const oldHit=reference.nearest(position),[from,to]=correction.oldRangeM;
  if(oldHit.distance>.01||oldHit.startDistanceM<from-.01||oldHit.startDistanceM>to+.01)return null;
 }
 return {...d,id:course.asset.id,revision:course.asset.revision,startDistanceM:hit.startDistanceM};
}
