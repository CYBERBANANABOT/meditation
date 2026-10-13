/* Camera-independent eye placement attached to the mannequin's head.
 * A named pose determines gaze, not the device camera. All vectors use
 * world coordinates; head and eyes share the same orthonormal local frame.
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
// The warrior's gaze turns toward the leading arm; lying and inverted
// poses aim appropriately up or toward the mat.
const yaw={warrior2L:.36,warrior2R:-.36,triangleL:.48,triangleR:-.48,
  twistL:-.23,twistR:.23};
function target(name){
  if(name==='fold'||name==='dog'||name==='child')return norm([0,-1,.18]);
  if(name==='catcow'||name==='table'||name==='cat'||name==='cow')
    return norm([0,-.4,1]);
  if(name==='plank'||name==='half')return norm([0,-.22,1]);
  if(name==='bridge'||name==='supine'||name==='savasana'||name==='twistL'||name==='twistR')
    return norm([Math.sin(yaw[name]||0),1,.12]);
  if(name==='cobra')return norm([0,.12,1]);
  const angle=yaw[name]||0;
  return [Math.sin(angle),0,Math.cos(angle)];
}
function frame(joints,direction){
  const up=norm(sub(joints.head,joints.shoulder));
  let projected=sub(direction,scale(up,dot(direction,up)));
  if(len(projected)<.0001){
    // Never derive orientation from camera position or screen axes.
    const ref=Math.abs(up[2])<.9?[0,0,1]:[0,1,0];
    projected=sub(ref,scale(up,dot(ref,up)));
  }
  const forward=norm(projected),right=norm(cross(up,forward));
  const center=add(add(joints.head,scale(forward,.166)),scale(up,.035));
  const eyes=[
    add(center,scale(right,-.071)),
    add(center,scale(right,.071))
  ];
  return {right,up,forward,eyes};
}
function compute(joints,pose,previous,elapsed,duration){
  const moveSeconds=Math.min(5,Math.max(1,duration*.30));
  const x=clamp(elapsed/moveSeconds,0,1),blend=x*x*(3-2*x);
  const before=target(previous||pose),after=target(pose);
  const gaze=norm(add(scale(before,1-blend),scale(after,blend)));
  return frame(joints,gaze);
}
window.YogaHead=Object.freeze({compute,frame,target});
})();