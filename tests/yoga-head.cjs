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
      assert(dot(sub(eye,j.head),f.up)>.02,pose+' eye moved off face');
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
  const turned=head.frame(j,[1,0,0]);
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
