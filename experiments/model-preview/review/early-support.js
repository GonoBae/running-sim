import {createSharedSupport} from './shared-support.js';

// M73: this clip's early contact only. The original touchdown and the pose at
// .43 are unchanged; the existing mid-stance, release and swing run afterwards.
// The held material point is picked at .30, but anchored at its .28 location.
export const EARLY_SUPPORT_WINDOW=Object.freeze({
 start:.28,holdStart:.30,holdEnd:.36,end:.43,selectedAt:.30,anchorAt:.28,
});

export function createEarlySupport(baseline,lane,probe,travel){
 const right=createSharedSupport(baseline,lane,probe,travel,EARLY_SUPPORT_WINDOW);
 const left=createSharedSupport(right,lane,probe,travel,{...EARLY_SUPPORT_WINDOW,side:'l'});
 return {apply:left.apply,right,left,baseline,options:EARLY_SUPPORT_WINDOW};
}
