/* Stable head-local eye orientation for the wooden yoga instructor.
 * A neck axis fixes head tilt. A separate, smoothly animated yaw fixes the
 * facial/front side. Never project an arbitrary world gaze across the neck:
 * the old projection had a singularity and flipped eyes 180 degrees.
 * No camera coordinates participate in this calculation.
 */
(()=>{
'use strict';
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const scale=(a,k)=>a.map(x=>x*k);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(...a);
const norm=a=>scale(a,1/(len(a)||1));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// All angles are in the *head's local coordinates*, not world-space gaze
// vectors. In supine poses the face points upward rather than into the mat.
const yaw=Object.freeze({
 warrior2L:.36,warrior2R:-.36,
 triangleL:.48,triangleR:-.48,
 twistL:.23,twistR:-.23
});
const angleForPose=name=>yaw[name]||0;
function frame(joints,angle=0,previousFrame=null){
  const up=norm(sub(joints.head,joints.shoulder));
  // Transport the original body's left-right axis onto the neck plane.
  // For the whole yoga program the neck moves in YZ; world X stays
  // perpendicular, even when looking down or lying on the back.
  let baseRight=sub([1,0,0],scale(up,up[0]));
  if(len(baseRight)<.001){
    // Fallback only for a physically sideways (X-aligned) neck.
    const alternate=[0,0,1];
    baseRight=sub(alternate,scale(up,dot(alternate,up)));
  }
  baseRight=norm(baseRight);
  // Transport head-right from the last frame if its projection would
  // otherwise switch signs near an axis singularity.
  if(previousFrame&&dot(baseRight,previousFrame.right)<0)
    baseRight=scale(baseRight,-1);
  const baseForward=norm(cross(baseRight,up));
  const forward=norm(add(scale(baseForward,Math.cos(angle)),
    scale(baseRight,Math.sin(angle))));
  const right=norm(cross(up,forward));
  const center=add(add(joints.head,scale(forward,.166)),scale(up,.024));
  const eyes=[add(center,scale(right,-.071)),add(center,scale(right,.071))];
  return {right,up,forward,eyes};
}
function compute(joints,pose,previous,elapsed,duration,previousFrame=null){
  const seconds=Math.min(5,Math.max(1,duration*.30));
  const t=clamp(elapsed/seconds,0,1),ease=t*t*(3-2*t);
  const before=angleForPose(previous||pose),after=angleForPose(pose);
  // Unwrapped angle interpolation guarantees that a look up to the
  // ceiling never abruptly becomes a look down into the mat.
  return frame(joints,before+(after-before)*ease,previousFrame);
}
window.YogaHead=Object.freeze({compute,frame,angleForPose});
})();