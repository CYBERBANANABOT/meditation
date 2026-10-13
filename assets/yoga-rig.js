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
const lengths=Object.freeze({torso:.91,neck:.39,upperArm:.50,forearm:.46,thigh:.55,shin:.50,hipSpan:.32,shoulderSpan:.58});
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
function solve(input){
  for(const k of keys)if(!assertFinite(input[k]))throw Error('Invalid pose landmark '+k);
  const out={};
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
    const shoulderJoint=plus(out.shoulder,[sgn*lengths.shoulderSpan/2,0,0]);
    const elbowName=prefix+'Elbow',wristName=prefix+'Wrist';
    const arm=legOrArm(shoulderJoint,input[wristName],input[elbowName],
      lengths.upperArm,lengths.forearm,groundKeys.has(wristName));
    out[elbowName]=arm.middle;out[wristName]=arm.end;
    const hipJoint=plus(out.hip,[sgn*lengths.hipSpan/2,0,0]);
    const kneeName=prefix+'Knee',ankleName=prefix+'Ankle';
    const leg=legOrArm(hipJoint,input[ankleName],input[kneeName],
      lengths.thigh,lengths.shin,groundKeys.has(ankleName));
    out[kneeName]=leg.middle;out[ankleName]=leg.end;
  }
  return out;
}
function metrics(p){
  const torso=length(v(p.shoulder,p.hip)),neck=length(v(p.head,p.shoulder));
  const bones={},contacts={};
  for(const [prefix,sgn] of [['left',-1],['right',1]]){
    const shoulder=plus(p.shoulder,[sgn*lengths.shoulderSpan/2,0,0]);
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
window.YogaRig=Object.freeze({solve,metrics,lengths});
})();