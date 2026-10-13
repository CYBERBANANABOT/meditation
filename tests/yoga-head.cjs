'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({window:{},console});
for(const path of ['assets/yoga-asanas.js','assets/yoga-rig.js',
  'assets/yoga-program.js','assets/yoga-head.js']){
  vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
}
const {YogaHead:head,YogaRig:rig,YogaAsanas:asanas,
  YogaProgram:program}=context.window;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const len=a=>Math.hypot(...a);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const near=(a,b,tol=.001)=>Math.abs(a-b)<tol;
test('Two eyes stay outside the head on an orthonormal pose-space frame',()=>{
  for(const pose of ['mountain','salute','fold','cobra','dog','warrior1L',
    'warrior2L','warrior2R','triangleL','triangleR','butterfly',
    'bridge','twistL','twistR','savasana']){
    const j=rig.solve(asanas.poses[pose]);
    const f=head.compute(j,pose,pose,12,30);
    assert.equal(f.eyes.length,2);
    for(const vector of [f.up,f.right,f.forward])assert(near(len(vector),1),pose);
    assert(Math.abs(dot(f.up,f.right))<.0001,pose+' head axes not orthogonal');
    assert(Math.abs(dot(f.forward,f.up))<.0001,pose+' face not perpendicular');
    assert(near(len(sub(f.eyes[0],f.eyes[1])),.142),pose+' eye spacing changed');
    for(const eye of f.eyes){
      assert(dot(sub(eye,j.head),f.forward)>.15,pose+' eye behind skull');
      const crown=dot(sub(eye,j.head),f.up);
      assert(crown>.005&&crown<.05,pose+' eye drifted to crown/chin');
    }
  }
});
test('Left and right Warrior II gaze in opposite directions, head eyes turn with it',()=>{
  const left=rig.solve(asanas.poses.warrior2L),right=rig.solve(asanas.poses.warrior2R);
  const a=head.compute(left,'warrior2L','warrior1L',12,40);
  const b=head.compute(right,'warrior2R','warrior1R',12,40);
  assert(a.forward[0]>.2,'Left warrior does not glance toward front');
  assert(b.forward[0]<-.2,'Right warrior does not turn oppositely');
  for(const face of [a,b]){
    assert(dot(sub(face.eyes[0],face.eyes[1]),face.right)<-.14,
      'Eyes did not follow turned head axes');
  }
  const start=head.compute(left,'warrior2L','warrior1L',0,40);
  const finish=head.compute(left,'warrior2L','warrior1L',6,40);
  assert(Math.abs(start.forward[0])<.01,'Head snapped at pose boundary');
  assert(finish.forward[0]>.2,'Head failed to complete turn');
});
test('Moving the camera never changes eye positions in world space',()=>{
  const j=rig.solve(asanas.poses.mountain);
  const a=head.compute(j,'mountain','mountain',8,40);
  const b=head.compute(j,'mountain','mountain',8,40);
  assert.deepEqual(a.eyes,b.eyes);
  const turned=head.frame(j,Math.PI/2);
  assert(turned.forward[0]>.99,'Face fails 90 degree head turn');
  assert(Math.abs(turned.eyes[0][2]-turned.eyes[1][2])>.13,
    'Eye pair did not rotate with head');
});
test('Gaze axes remain well-formed through every stage and its transition',()=>{
  for(let i=0;i<program.movements.length;i++){
    const m=program.movements[i],previous=program.movements[i-1]?.pose||'mountain';
    for(const seconds of [0,.5,1.5,2.5,4.5,9,m.duration]){
      const j=rig.solve(asanas.sample(m.pose,seconds,m.duration,previous));
      const f=head.compute(j,m.pose,previous,seconds,m.duration);
      for(const point of f.eyes)assert(point.every(Number.isFinite));
      assert(near(dot(f.forward,f.right),0,.0001));
    }
  }
});

test('Facial direction never flips across any transition sampled at 60 FPS',()=>{
  let worst=1,worstAt='';
  for(let i=0;i<program.movements.length;i++){
    const movement=program.movements[i],
      previous=program.movements[i-1]?.pose||'mountain';
    let last=null;
    const seconds=Math.min(12,movement.duration);
    for(let tick=0;tick<=seconds*60;tick++){
      const t=tick/60;
      const j=rig.solve(asanas.sample(movement.pose,t,movement.duration,previous));
      const face=head.compute(j,movement.pose,previous,t,movement.duration);
      if(last){
        const cosine=dot(face.forward,last.forward);
        if(cosine<worst){worst=cosine;worstAt=movement.pose+' at '+t;}
        assert(cosine>.985,movement.pose+' face flipped at '+t+' (dot '+cosine+')');
      }
      last=face;
    }
  }
  assert(worst>.985,worstAt+' unstable face orientation');
});
test('Face remains on intended side in inverted, prone and supine poses',()=>{
  for(const pose of ['mountain','fold','plank','cobra','dog','bridge',
    'supine','twistL','twistR','savasana']){
    const j=rig.solve(asanas.poses[pose]);
    const f=head.compute(j,pose,pose,10,30);
    // Face turns up when lying on the back; down in downward dog/plank.
    if(['bridge','supine','twistL','twistR','savasana'].includes(pose))
      assert(f.forward[1]>.1,pose+': eyes on back-of-head side');
    if(['plank','dog'].includes(pose))
      assert(f.forward[1]<-.15,pose+': face unexpectedly upwards');
    for(const eye of f.eyes)
      assert(dot(sub(eye,j.head),f.forward)>.15,pose+': eye not on face surface');
  }
});
test('Continuity when entering stage from previous pose',()=>{
  for(let i=1;i<program.movements.length;i++){
    const old=program.movements[i-1],current=program.movements[i];
    const beforeOld=program.movements[i-2]?.pose||'mountain';
    const lastJ=rig.solve(asanas.sample(old.pose,old.duration,old.duration,beforeOld));
    const nextJ=rig.solve(asanas.sample(current.pose,0,current.duration,old.pose));
    const f1=head.compute(lastJ,old.pose,beforeOld,old.duration,old.duration);
    const f2=head.compute(nextJ,current.pose,old.pose,0,current.duration);
    assert(dot(f1.forward,f2.forward)>.995,
      old.pose+' -> '+current.pose+': face snaps at boundary');
    assert(Math.hypot(...sub(f1.eyes[0],f2.eyes[0]))<.06,
      old.pose+' -> '+current.pose+': eye jumped at boundary');
  }
});

test('Eye placement and face orientation stay continuous for 28-second recline',()=>{
  const m=program.movements.find(m=>m.pose==='bridge');
  let last=null,lowest=1;
  for(let i=0;i<=28*60;i++){
    const t=i/60,j=rig.solve(asanas.sample('bridge',t,m.duration,'staff'));
    const f=head.compute(j,'bridge','staff',t,m.duration,last);
    for(const eye of f.eyes){
      const offset=sub(eye,j.head),crown=dot(offset,f.up);
      assert(crown>.005&&crown<.05,'Eye drifted to crown at '+t);
      assert(dot(offset,f.forward)>.15,'Eye moved behind face at '+t);
    }
    if(last){
      const similarity=dot(f.forward,last.forward);
      lowest=Math.min(lowest,similarity);
      assert(similarity>.99,'Face unexpectedly rotated at '+t);
    }
    last=f;
  }
  assert(lowest>.99);
  const resting=rig.solve(asanas.poses.constructiveRest);
  const f=head.compute(resting,'bridge','staff',14,55);
  assert(resting.head[2]<resting.hip[2],'Supine head should be behind torso');
  assert(f.forward[1]>.9,'Supine face should be pointing upwards');
});

test('Supine spinal twist gaze turns away from the bent knee',()=>{
  for(const [pose,sign] of [['twistL',1],['twistR',-1]]){
    const joints=rig.solve(asanas.poses[pose]);
    const face=head.compute(joints,pose,pose,20,40);
    assert(sign*face.forward[0]>.15,pose+' head looks toward twisted knee');
    assert(face.forward[1]>.75,pose+' head does not face upwards');
  }
});
