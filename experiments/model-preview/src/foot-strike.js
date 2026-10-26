import {createHeightTransition} from '../review/leg-height.js';
import {createMidfootTransition} from './midfoot.js';

// Preview targets relative to the measured sole patches, not clinical limits.
export const FOOT_STRIKES=Object.freeze({
 original:Object.freeze({label:'기본 동작',amount:0,pitchDeg:0}),
 heel:Object.freeze({label:'뒤꿈치',amount:1,pitchDeg:10}),
 midfoot:Object.freeze({label:'미드풋',amount:1,pitchDeg:0}),
 forefoot:Object.freeze({label:'앞꿈치',amount:1,pitchDeg:-10}),
});

// Retain both current value and velocity when switching during playback.
export function createFootStrikeTransition(){
 const amount=createMidfootTransition(),pitch=createHeightTransition(5);
 return {get value(){return amount.value;},get pitchDeg(){return pitch.value*2-10;},
  set(mode,immediate=false){const spec=FOOT_STRIKES[mode];if(!spec)throw Error('Unknown foot strike.');amount.set(spec.amount,immediate);pitch.set((spec.pitchDeg+10)/2,immediate);},
  tick(dt){amount.tick(dt);pitch.tick(dt);}};
}
