import {Matrix4, Quaternion, Vector3} from 'three';

function basis(forward,up){
  const z=forward.clone().normalize(),x=up.clone().cross(z).normalize();
  if(x.lengthSq()<.5)throw new Error('Degenerate foot frame');
  const y=z.clone().cross(x).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}

// A single bone direction leaves axial twist unspecified. Match the foot plane
// too. Target world-up is a neutral rig proxy, not a measured sole normal.
export function alignFootFrame(targetForward,sourceForward,sourceToeForward){
  const lateral=sourceToeForward.clone().cross(sourceForward).normalize();
  const sourceUp=sourceForward.clone().cross(lateral).normalize();
  return basis(sourceForward,sourceUp).multiply(basis(targetForward,new Vector3(0,1,0)).invert());
}
