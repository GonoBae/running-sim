import {Quaternion, Vector3} from 'three';

// M76: centimetres ABOVE the accepted M75 knee path. Clip phases describe
// forward swing, not a force-plate measurement or a medical joint limit.
export const LEG_HEIGHT = Object.freeze({min: 0, max: 10, step: 1, default: 0, start: .84, peak: 1.04, end: 1.28});
const wrap = t => ((t % 1) + 1) % 1;
const smooth = u => u * u * u * (10 + u * (-15 + 6 * u));

export function legHeightWeight(phase) {
  let t = wrap(phase);
  if (t < LEG_HEIGHT.start) t += 1;
  if (t >= LEG_HEIGHT.end) return 0;
  return t <= LEG_HEIGHT.peak
    ? smooth((t - LEG_HEIGHT.start) / (LEG_HEIGHT.peak - LEG_HEIGHT.start))
    : smooth((LEG_HEIGHT.end - t) / (LEG_HEIGHT.end - LEG_HEIGHT.peak));
}

export function createLegHeight(baseline) {
  function apply(lane, probe, phase, centimetres = LEG_HEIGHT.default) {
    if (!Number.isFinite(centimetres) || centimetres < LEG_HEIGHT.min || centimetres > LEG_HEIGHT.max)
      throw new RangeError('Knee height must be between 0 and 10 cm.');
    // Always start from the accepted motion, so seeking and slider changes
    // cannot accumulate rotations. Zero is an exact bypass.
    const result = baseline.apply(lane, probe, phase), changes = [];
    if (centimetres === 0) return {...result, legHeight: changes};
    for (const side of ['r', 'l']) {
      const weight = legHeightWeight(phase - (side === 'l' ? .5 : 0));
      if (weight === 0) continue;
      const hip = lane.model.getObjectByName('thigh_' + side);
      const knee = lane.model.getObjectByName('calf_' + side);
      const foot = lane.model.getObjectByName('foot_' + side);
      const local = bone => lane.group.worldToLocal(bone.getWorldPosition(new Vector3()));
      const offset = local(knee).sub(local(hip)), radius = Math.hypot(offset.y, offset.z);
      const rise = centimetres * .01 * weight, y = offset.y + rise;
      if (offset.z <= 0 || y >= 0 || Math.abs(y) >= radius)
        throw new RangeError('Knee lift is outside the verified forward swing arc.');
      const angle = Math.acos(-y / radius) - Math.atan2(offset.z, -offset.y);
      const axis = new Vector3(-1, 0, 0).applyQuaternion(lane.group.getWorldQuaternion(new Quaternion()));
      const turn = new Quaternion().setFromAxisAngle(axis, angle);
      const parent = hip.parent.getWorldQuaternion(new Quaternion()).normalize();
      const oldFootParent = foot.parent.getWorldQuaternion(new Quaternion()).normalize();
      const oldFoot = foot.quaternion.clone();
      hip.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent)).normalize();
      lane.model.updateMatrixWorld(true);
      // The thigh carries the bent lower leg with it; no translation/stretch
      // of bones, no knee re-solve, and no inward/outward foot displacement.
      foot.quaternion.copy(foot.parent.getWorldQuaternion(new Quaternion()).normalize().invert()
        .multiply(oldFootParent).multiply(oldFoot)).normalize();
      lane.model.updateMatrixWorld(true);
      changes.push({side, weight, riseCm: rise * 100, thighTurnDeg: angle * 180 / Math.PI});
    }
    return {...result, legHeight: changes};
  }
  return {apply, baseline, options: LEG_HEIGHT};
}

// Critically damped live input: changing the target retains velocity instead
// of restarting a blend on every pointer event. Paused editing is immediate.
export function createHeightTransition(initial = 0) {
  let value = initial, velocity = 0, target = initial;
  return {
    get value() { return value; },
    set(next, immediate = false) {
      target = next;
      if (immediate) { value = target; velocity = 0; }
    },
    tick(dt) {
      const omega = 30, x = value - target, c = velocity + omega * x, decay = Math.exp(-omega * dt);
      value = target + (x + c * dt) * decay;
      velocity = (velocity - omega * c * dt) * decay;
      // Extreme slider reversals must stay inside the verified interval.
      if (value < LEG_HEIGHT.min || value > LEG_HEIGHT.max) { value = Math.max(LEG_HEIGHT.min, Math.min(LEG_HEIGHT.max, value)); velocity = 0; }
      if (Math.abs(value - target) < 1e-4 && Math.abs(velocity) < .001) { value = target; velocity = 0; }
      return value;
    }
  };
}
