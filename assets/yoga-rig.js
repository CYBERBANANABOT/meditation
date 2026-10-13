/* Fixed-length mannequin rig for 3D yoga demonstration.
 * Important: schematic kinematics, NOT medically verified pose biomechanics.
 * All measurements are visual scene units. No external dependencies.
 */
(()=>{
'use strict';
const v=(a,b)=>a.map((x,i)=>x-b[i]);
const plus=(a,b)=>a.map((x,i)=>x+b[i]);
const times=(p,k)=>p.map(x=>x*k);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=p=>Math.hypot(...p);
const unit=p=>{const d=length(p);return d<1e-8?[0,1,0]:times(p,1/d);};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
// Spherical interpolation of segment orientation, including antiparallel
// bones. Interpolating unsolved joint targets caused elbows and knees to
// snap through the IK singularity during transitions.
function slerpDirection(a,b,t){
  const from=unit(a),to=unit(b),cosine=clamp(dot(from,to),-1,1);
  if(cosine>.9995)return unit(mix(from,to,t));
  if(cosine<-.9995){
    const reference=Math.abs(from[0])<.85?[1,0,0]:[0,0,1];
    const tangent=unit(v(reference,times(from,dot(reference,from))));
    return plus(times(from,Math.cos(Math.PI*t)),times(tangent,Math.sin(Math.PI*t)));
  }
  const angle=Math.acos(cosine),denom=Math.sin(angle);
  return unit(plus(times(from,Math.sin((1-t)*angle)/denom),
    times(to,Math.sin(t*angle)/denom)));
}
const solvedKeyframes=new WeakMap();
const lengths=Object.freeze({torso:.91,neck:.39,upperArm:.50,forearm:.46,thigh:.55,shin:.50,hipSpan:.32,shoulderSpan:.58});
const axisFor=p=>{
 const up=unit(v(p.shoulder,p.hip)),base=[1,0,0],
   perpendicular=unit(cross(base,up)),yaw=p.torsoYaw||0;
 const x=unit(plus(times(base,Math.cos(yaw)),
   times(perpendicular,-Math.sin(yaw))));
 return {x,y:up,z:unit(cross(x,up))};
};
const socket=(p,side)=>plus(p.shoulder,times(axisFor(p).x,
  (side==='left'?-1:1)*lengths.shoulderSpan/2));
const keys=['hip','shoulder','head','leftKnee','rightKnee','leftAnkle','rightAnkle','leftElbow','rightElbow','leftWrist','rightWrist'];
const groundKeys=new Set(['leftWrist','rightWrist','leftAnkle','rightAnkle']);
const assertFinite=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
function legOrArm(start,endTarget,kneeTarget,L1,L2,ground){
  let end=[...endTarget];
  let axis=v(end,start),dist=length(axis),max=L1+L2-.004,min=Math.abs(L1-L2)+.015;
  // Maintain mat contact while bringing an unreachable target back into
  // the anatomically possible range of the two connected wooden pieces.
  if(ground&&end[1]<=.26){
    const dy=end[1]-start[1];
    if(Math.abs(dy)<=max){
      const h=Math.hypot(axis[0],axis[2]);
      const allowed=Math.sqrt(Math.max(0,max*max-dy*dy));
      if(h>allowed&&h>1e-7){
        end[0]=start[0]+axis[0]*allowed/h;
        end[2]=start[2]+axis[2]*allowed/h;
      }
    }
  }
  axis=v(end,start);dist=length(axis);
  if(dist>max){end=plus(start,times(unit(axis),max));dist=max;axis=v(end,start);}
  if(dist<min){end=plus(start,times(unit(axis),min));dist=min;axis=v(end,start);}
  const forward=unit(axis);
  const a=(L1*L1-L2*L2+dist*dist)/(2*dist);
  const rise=Math.sqrt(Math.max(0,L1*L1-a*a));
  let bend=v(kneeTarget,plus(start,times(forward,a)));
  bend=v(bend,times(forward,dot(bend,forward)));
  if(length(bend)<.025){
    bend=cross(forward,Math.abs(forward[0])<.8?[1,0,0]:[0,0,1]);
  }
  const middle=plus(plus(start,times(forward,a)),times(unit(bend),rise));
  return {middle,end};
}
// Both elbows share a deterministic, outward/backward bend pole.
// A wrist can move freely in space, but may not pass through the chest,
// and a hinge may not bend toward the anatomically wrong side.
function armIK(shoulder,wristTarget,sign,axes){
  const L1=lengths.upperArm,L2=lengths.forearm;
  const sideways=axes.x,facing=axes.z;
  const center=plus(shoulder,times(sideways,-sign*lengths.shoulderSpan/2));
  const end=[...wristTarget];
  // Enforce the correct side of the *rotating* ribcage, not world X.
  const reach=sign*dot(v(end,center),sideways);
  if(reach<.42){
    const correction=plus(end,times(sideways,sign*(.42-reach)));
    end.splice(0,3,...correction);
  }
  if(end[1]<.105)end[1]=.105;
  let axis=v(end,shoulder),dy=axis[1],max=L1+L2-.005;
  if(end[1]<=.26&&Math.abs(dy)<max){
    // Preserve supporting palm height whenever the shoulder can reach.
    const reach=Math.sqrt(max*max-dy*dy),horizontal=Math.hypot(axis[0],axis[2]);
    if(horizontal>reach&&horizontal>1e-8){
      end[0]=shoulder[0]+axis[0]*reach/horizontal;
      end[2]=shoulder[2]+axis[2]*reach/horizontal;
    }
  }
  axis=v(end,shoulder);
  let dist=length(axis),min=.46;
  // Prevent both overextension and collapsing elbow fully into itself.
  if(dist>max){const p=plus(shoulder,times(unit(axis),max));end.splice(0,3,...p);dist=max;}
  if(dist<min){const p=plus(shoulder,times(unit(axis),min));end.splice(0,3,...p);dist=min;}
  const forward=unit(v(end,shoulder));
  const along=(L1*L1-L2*L2+dist*dist)/(2*dist);
  const height=Math.sqrt(Math.max(0,L1*L1-along*along));
  const pole=plus(times(sideways,sign*.48),times(facing,-.72));
  let bend=v(pole,times(forward,dot(pole,forward)));
  if(length(bend)<.01){
    const side=times(sideways,sign);bend=v(side,times(forward,dot(side,forward)));
  }
  const elbow=plus(plus(shoulder,times(forward,along)),times(unit(bend),height));
  return {middle:elbow,end};
}
function solve(input){
  for(const k of keys)if(!assertFinite(input[k]))throw Error('Invalid pose landmark '+k);
  // Already-articulated transition frames must never be solved a second
  // time; that would re-introduce bend-pole flips into the renderer.
  if(input.__rigged===true){
    if(metrics(input).maxError>.001)throw Error('Invalid articulated frame');
    return {...Object.fromEntries(keys.map(k=>[k,input[k].slice()])),
      torsoYaw:input.torsoYaw||0,pelvisYaw:input.pelvisYaw||0};
  }
  const out={torsoYaw:input.torsoYaw||0,pelvisYaw:input.pelvisYaw||0};
  out.hip=[...input.hip];
  // The shoulders are rigidly connected to the torso; neck cannot stretch.
  const trunk=unit(v(input.shoulder,out.hip));
  out.shoulder=plus(out.hip,times(trunk,lengths.torso));
  let headAxis=unit(v(input.head,input.shoulder));
  // Avoid an inverted neck when moving from prone to supine.
  if(dot(headAxis,trunk)<-.25)headAxis=trunk;
  out.head=plus(out.shoulder,times(headAxis,lengths.neck));
  for(const left of [true,false]){
    const prefix=left?'left':'right',sgn=left?-1:1;
    const shoulderJoint=socket(out,prefix);
    const elbowName=prefix+'Elbow',wristName=prefix+'Wrist';
    const arm=armIK(shoulderJoint,input[wristName],sgn,axisFor(out));
    out[elbowName]=arm.middle;out[wristName]=arm.end;
    const hipJoint=plus(out.hip,[sgn*lengths.hipSpan/2,0,0]);
    const kneeName=prefix+'Knee',ankleName=prefix+'Ankle';
    const leg=legOrArm(hipJoint,input[ankleName],input[kneeName],
      lengths.thigh,lengths.shin,groundKeys.has(ankleName));
    out[kneeName]=leg.middle;out[ankleName]=leg.end;
  }
  return out;
}
function keyframe(pose){
  let joints=solvedKeyframes.get(pose);
  if(!joints){joints=solve(pose);solvedKeyframes.set(pose,joints);}
  return joints;
}
// Forward-kinematic interpolation of the complete articulated skeleton.
// Shoulder and hip sockets remain rigidly connected to the torso/pelvis,
// with exactly constant arm/leg segment lengths throughout every frame.
function blend(a,b,t){
  const start=keyframe(a),end=keyframe(b),u=clamp(t,0,1),e=u*u*(3-2*u);
  const out={hip:mix(start.hip,end.hip,e),
    torsoYaw:(start.torsoYaw||0)*(1-e)+(end.torsoYaw||0)*e,
    pelvisYaw:(start.pelvisYaw||0)*(1-e)+(end.pelvisYaw||0)*e};
  function bone(aRoot,aTip,bRoot,bTip,boneLength,newRoot){
    const dir=slerpDirection(v(aTip,aRoot),v(bTip,bRoot),e);
    return plus(newRoot,times(dir,boneLength));
  }
  out.shoulder=bone(start.hip,start.shoulder,end.hip,end.shoulder,lengths.torso,out.hip);
  out.head=bone(start.shoulder,start.head,end.shoulder,end.head,lengths.neck,out.shoulder);
  for(const [side,sign] of [['left',-1],['right',1]]){
    const shoulderOffset=times(axisFor(out).x,sign*lengths.shoulderSpan/2);
    const hipOffset=[sign*lengths.hipSpan/2,0,0];
    const oldShoulder=socket(start,side);
    const newShoulder=socket(end,side);
    const currentShoulder=plus(out.shoulder,shoulderOffset);
    // Follow the continuous FK wrist path, but rebuild elbow with
    // the same anatomical pole and no-crossing rule as static poses.
    const fkElbow=bone(oldShoulder,start[side+'Elbow'],
      newShoulder,end[side+'Elbow'],lengths.upperArm,currentShoulder);
    const fkWrist=bone(start[side+'Elbow'],start[side+'Wrist'],
      end[side+'Elbow'],end[side+'Wrist'],lengths.forearm,fkElbow);
    const arm=armIK(currentShoulder,fkWrist,sign,axisFor(out));
    out[side+'Elbow']=arm.middle;out[side+'Wrist']=arm.end;
    const oldHip=plus(start.hip,hipOffset),newHip=plus(end.hip,hipOffset);
    const currentHip=plus(out.hip,hipOffset);
    out[side+'Knee']=bone(oldHip,start[side+'Knee'],
      newHip,end[side+'Knee'],lengths.thigh,currentHip);
    out[side+'Ankle']=bone(start[side+'Knee'],start[side+'Ankle'],
      end[side+'Knee'],end[side+'Ankle'],lengths.shin,out[side+'Knee']);
  }
  Object.defineProperty(out,'__rigged',{value:true});
  return out;
}
function metrics(p){
  const torso=length(v(p.shoulder,p.hip)),neck=length(v(p.head,p.shoulder));
  const bones={},contacts={};
  for(const [prefix,sgn] of [['left',-1],['right',1]]){
    const shoulder=socket(p,prefix);
    const hip=plus(p.hip,[sgn*lengths.hipSpan/2,0,0]);
    bones[prefix+'UpperArm']=length(v(p[prefix+'Elbow'],shoulder));
    bones[prefix+'Forearm']=length(v(p[prefix+'Wrist'],p[prefix+'Elbow']));
    bones[prefix+'Thigh']=length(v(p[prefix+'Knee'],hip));
    bones[prefix+'Shin']=length(v(p[prefix+'Ankle'],p[prefix+'Knee']));
    contacts[prefix+'HandY']=p[prefix+'Wrist'][1];
    contacts[prefix+'FootY']=p[prefix+'Ankle'][1];
  }
  const maxError=Math.max(Math.abs(torso-lengths.torso),Math.abs(neck-lengths.neck),
    ...Object.keys(bones).map(k=>{
      const name=k.replace(/^left|^right/,'');
      return Math.abs(bones[k]-(name==='UpperArm'?lengths.upperArm:
        name==='Forearm'?lengths.forearm:name==='Thigh'?lengths.thigh:lengths.shin));
    }));
  return {torso,neck,bones,maxError,contacts,shoulderSpan:lengths.shoulderSpan};
}
window.YogaRig=Object.freeze({solve,blend,metrics,lengths,axisFor,socket});
})();