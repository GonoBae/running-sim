import {Vector3, Quaternion} from 'three';
import {solve} from './stance-chain.js';
import {contactEnvelope} from './stance-contact.js';

const position = bone => bone.getWorldPosition(new Vector3());
const rotation = bone => bone.getWorldQuaternion(new Quaternion()).normalize();

// Derive the foot's own axes while the GLB is in its neutral pose. This avoids
// assuming matching local XYZ axes on the two ankles or mirroring right Euler angles.
export function neutralFootAxes(foot, toe) {
  const forward = position(toe).sub(position(foot)).normalize();
  const lateral = new Vector3(0, 1, 0).cross(forward).normalize();
  const inverse = rotation(foot).invert();
  return {forward: forward.applyQuaternion(inverse), lateral: lateral.applyQuaternion(inverse)};
}

export function createLeftAnkleDirection(anchor, axes) {
  const forward = axes.forward.clone().applyQuaternion(anchor.footQ);
  // M49 found similar lateral-axis inclinations on both feet but a large left
  // heading difference. Correct that heading only; leveling the entire foot
  // would change a second, unconfirmed degree of freedom.
  const anchorYaw = Math.atan2(forward.x, forward.z);
  const targetYaw = 0; // sagittal experiment target, not a medical prescription
  const target = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), targetYaw-anchorYaw).multiply(anchor.footQ);
  return {window: anchor.window, anchorYaw, targetYaw, target, axes};
}

// Fresh M48 pose in. Reorient the left foot about its existing material contact
// patch, then solve the entire leg. Pelvis/root and the other leg are untouched.
export function applyLeftAnkleDirection(lane, phase, plan) {
  const weight = contactEnvelope(phase, plan.window).weight;
  if (!weight) return {weight: 0};
  const by = name => lane.bones.find(b => b.name === name + '_l');
  const hip = by('thigh'), knee = by('calf'), foot = by('foot'), toe = by('ball');
  const patch = lane.contactPlans.find(p => p.window.side === 'l').patch;
  const targetPoint = patch.read(), floor = lane.readSurface('l').min;
  const oldFoot = rotation(foot), oldToe = rotation(toe);
  // Correct the captured touchdown reference by a fixed world-up rotation.
  // Do not keep zeroing instantaneous projected heading: near toe-off the foot
  // becomes steep and that projection can demand a large, spurious extra turn.
  const yawDelta = plan.targetYaw - plan.anchorYaw;
  // A world-up rotation preserves both forward elevation and lateral-axis
  // elevation exactly, including during the entry/release blend.
  const footQ = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), yawDelta*weight).multiply(oldFoot).normalize();
  const toeQ = footQ.clone().multiply(oldFoot.clone().invert()).multiply(oldToe);
  const goal = position(foot), upper = position(knee).sub(position(hip)), kneeX = position(knee).x;
  let residual = Infinity, kneeClamp = 0;
  for (let i = 0; i < 12; i++) {
    const reach = position(hip).distanceTo(position(knee)) + position(knee).distanceTo(position(foot));
    if (position(hip).distanceTo(goal) >= reach) throw Error(`Left ankle target outside reach: phase=${phase}, iteration=${i}, excessMm=${(position(hip).distanceTo(goal)-reach)*1000}`);
    const result = solve(lane.model, hip, knee, foot, goal, footQ, 0, upper, kneeX);
    kneeClamp = Math.max(kneeClamp, Math.abs(result.kneeClamp));
    toe.quaternion.copy(rotation(toe.parent).invert().multiply(toeQ));
    lane.model.updateMatrixWorld(true);
    const point = patch.read(), dy = floor - lane.readSurface('l').min;
    const dx = targetPoint.x - point.x, dz = targetPoint.z - point.z;
    residual = Math.hypot(dx, dy, dz);
    if (residual < 1e-8) break;
    goal.add(new Vector3(dx, dy, dz));
  }
  return {weight, residual, kneeClamp, targetPoint: lane.group.worldToLocal(targetPoint).toArray()};
}
