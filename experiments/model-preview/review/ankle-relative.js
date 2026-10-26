// Use the SAME alignment as the calf, so a zero source ankle rotation keeps
// the target's neutral ankle. Independently aligning the foot adds a fixed bend.
// calfRest maps target calf-local coordinates into the source rest frame.
// neutralFoot is the target foot's neutral local rotation (relative to its calf).
export function retargetAnkle(sourceCalf,sourceFoot,calfRest,neutralFoot){
  const relative=sourceCalf.clone().invert().multiply(sourceFoot);
  return calfRest.clone().invert().multiply(relative).multiply(calfRest).multiply(neutralFoot).normalize();
}
