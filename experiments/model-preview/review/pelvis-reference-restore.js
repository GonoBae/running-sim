import {Vector3, Quaternion} from 'three';
import {solve, chainMotionWeight} from './stance-chain.js';

const position = bone => bone.getWorldPosition(new Vector3());
const rotation = bone => bone.getWorldQuaternion(new Quaternion()).normalize();

// Record AFTER source horizontal travel + existing grounding, BEFORE M38/M39
// body translation. This is a moving reference, not a frozen world-space pelvis.
export function capturePelvisReference(lane) {
  return position(lane.bones.find(b => b.name === 'pelvis'));
}

// M50 supplies the reviewed contact target. Remove only its extra translation;
// preserve pelvic rotation, foot orientation and the other leg's body-relative
// pose. Re-solve the support leg, rather than dragging its planted foot along.
export function restorePelvisReference(lane, phase, reference) {
  const by = name => lane.bones.find(b => b.name === name);
  const pelvis = by('pelvis');
  if (chainMotionWeight(phase, 'l') === 0) return {active:false, reference:reference.toArray()};
  const hip = by('thigh_l'), knee = by('calf_l'), foot = by('foot_l'), toe = by('ball_l');
  const patch = lane.contactPlans.find(p => p.window.side === 'l').patch;
  const targetPoint = patch.read(), floor = lane.readSurface('l').min;
  const footQ = rotation(foot), toeQ = rotation(toe), goal = position(foot);
  const upper = position(knee).sub(position(hip));
  const removed = position(pelvis).sub(reference);
  const parent = lane.model.parent;
  lane.model.position.add(parent.worldToLocal(reference.clone()).sub(parent.worldToLocal(position(pelvis))));
  lane.model.updateMatrixWorld(true);
  let residual = Infinity, iterations = 0;
  for (let i = 0; i < 10; i++) {
    solve(lane.model, hip, knee, foot, goal, footQ, 0, upper);
    toe.quaternion.copy(rotation(toe.parent).invert().multiply(toeQ));
    lane.model.updateMatrixWorld(true);
    const point = patch.read();
    const delta = new Vector3(targetPoint.x-point.x, floor-lane.readSurface('l').min, targetPoint.z-point.z);
    residual = delta.length(); iterations = i+1;
    if (residual < 1e-8) break;
    goal.add(delta);
  }
  return {active:true, reference:reference.toArray(), removed:removed.toArray(), residual, iterations};
}
