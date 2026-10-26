import {Quaternion, Vector3} from 'three';
import {createHeightTransition} from './leg-height.js';

// A bounded preview offset, not a population-wide anatomical range.
// Preserve the captured flexion waveform instead of freezing the elbow.
export const ELBOW_BEND = Object.freeze({min: -20, max: 20, step: 1, default: 0});
const degrees = 180 / Math.PI;
const position = bone => bone.getWorldPosition(new Vector3());

export function readElbowFlex(model, side) {
  const shoulder = position(model.getObjectByName('upperarm_' + side));
  const elbow = position(model.getObjectByName('lowerarm_' + side));
  const wrist = position(model.getObjectByName('hand_' + side));
  return elbow.sub(shoulder).angleTo(wrist.sub(position(model.getObjectByName('lowerarm_' + side)))) * degrees;
}

export function createElbowBend(baseline) {
  function apply(lane, probe, phase, legCm = 0, offsetDeg = ELBOW_BEND.default) {
    if (!Number.isFinite(offsetDeg) || offsetDeg < ELBOW_BEND.min || offsetDeg > ELBOW_BEND.max)
      throw new RangeError('Elbow offset must be between -20 and +20 degrees.');
    // Keep the accepted running and leg-height settings as the starting pose.
    const prior = baseline.apply(lane, probe, phase, legCm), changes = [];
    for (const side of ['r', 'l']) {
      const model = lane.model, shoulder = model.getObjectByName('upperarm_' + side);
      const elbow = model.getObjectByName('lowerarm_' + side), hand = model.getObjectByName('hand_' + side);
      const E = position(elbow), upper = E.clone().sub(position(shoulder)).normalize();
      const forearm = position(hand).sub(E).normalize(), baseDeg = upper.angleTo(forearm) * degrees;
      if (offsetDeg !== 0) {
        // Use the EXISTING arm bend plane. Raw local Euler axes have different
        // signs on the two sides, so copying one axis would twist one forearm.
        const axis = upper.clone().cross(forearm);
        if (axis.lengthSq() < 1e-8 || baseDeg + offsetDeg <= 0 || baseDeg + offsetDeg >= 180)
          throw new RangeError('Elbow bend plane is undefined or target crosses the straight arm.');
        const turn = new Quaternion().setFromAxisAngle(axis.normalize(), offsetDeg / degrees);
        const parent = elbow.parent.getWorldQuaternion(new Quaternion()).normalize();
        elbow.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent)).normalize();
        // The hand follows its forearm. Keep wrist and finger LOCAL rotations,
        // rather than counter-rotating the wrist into another awkward angle.
        model.updateMatrixWorld(true);
      }
      changes.push({side, baseDeg, actualDeg: readElbowFlex(model, side), offsetDeg});
    }
    return {...prior, elbowBend: changes};
  }
  return {apply, baseline, options: ELBOW_BEND};
}

// Reuse the tested 0..10 transition by mapping the -20..20 degree input.
// This controller is independent of the leg-height controller.
export function createElbowTransition() {
  const state = createHeightTransition(5);
  return {
    get value() { return state.value * 4 - 20; },
    set(value, immediate = false) { state.set((value + 20) / 4, immediate); },
    tick(dt) { return state.tick(dt) * 4 - 20; }
  };
}
