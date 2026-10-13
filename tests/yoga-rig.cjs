'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({window:{},console});
for(const file of ['assets/yoga-asanas.js','assets/yoga-rig.js','assets/yoga-program.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const {YogaAsanas:asanas,YogaRig:rig,YogaProgram:program}=context.window;
const near=(a,b,tol=.008)=>Math.abs(a-b)<tol;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
test('All 26 authentic yoga stages exist, retain 18:20 duration',()=>{
  assert.equal(program.movements.length,26);
  assert.equal(program.total,1100);
  for(const m of program.movements)assert(asanas.poses[m.pose],m.pose+' pose missing');
});
test('No stretching of mannequin spine, neck, arms, or legs across 26 poses and transitions',()=>{
  for(let i=0;i<program.movements.length;i++){
    const m=program.movements[i],previous=program.movements[i-1]?.pose||'mountain';
    for(const secs of [0,.5,2,4,6,m.duration*.22,m.duration*.50,m.duration*.75,m.duration]){
      const candidate=asanas.sample(m.pose,secs,m.duration,previous);
      const j=rig.solve(candidate),stats=rig.metrics(j);
      for(const [name,point] of Object.entries(j)){
        assert(point.every(Number.isFinite),m.pose+': bad '+name);
      }
      assert(near(stats.torso,rig.lengths.torso),m.pose+': torso changed length');
      assert(near(stats.neck,rig.lengths.neck),m.pose+': stretched neck');
      assert(stats.maxError<.008,m.pose+': stretched limb error '+stats.maxError);
      assert(near(stats.shoulderSpan,.58),m.pose+': shoulder offset wrong');
      for(const [side,sgn] of [['left',-1],['right',1]]){
        const shoulder=[j.shoulder[0]+sgn*.29,j.shoulder[1],j.shoulder[2]];
        assert(near(dist(shoulder,j[side+'Elbow']),.50),
          m.pose+': disconnected '+side+' shoulder');
        assert(near(dist(j[side+'Elbow'],j[side+'Wrist']),.46),
          m.pose+': disconnected '+side+' hand');
      }
    }
  }
});
test('Asanas demanding mat support maintain hands and feet at mat height',()=>{
  for(const name of ['plank','dog']){
    const j=rig.solve(asanas.sample(name,12,30,'mountain'));
    for(const side of ['left','right']){
      assert(j[side+'Wrist'][1]>=.09&&j[side+'Wrist'][1]<=.26,
        name+' hand leaves mat: '+j[side+'Wrist'][1]);
      assert(j[side+'Ankle'][1]>=.09&&j[side+'Ankle'][1]<=.26,
        name+' foot leaves mat: '+j[side+'Ankle'][1]);
    }
  }
});
test('Standing arms overhead are attached to shoulders and neck is human-scale',()=>{
  for(const name of ['mountain','salute','warrior1L','warrior1R','warrior2L','warrior2R']){
    const j=rig.solve(asanas.poses[name]);
    assert(near(dist(j.head,j.shoulder),.39),name+': giraffe neck');
    for(const side of ['left','right']){
      assert(near(dist(j[side+'Elbow'],[j.shoulder[0]+(side==='left'?-.29:.29),j.shoulder[1],j.shoulder[2]]),.5),
        name+': arm disconnected');
    }
  }
});
test('Left/right pose families remain distinct, and floor poses are on the mat',()=>{
  for(const [a,b] of [['warrior1L','warrior1R'],['warrior2L','warrior2R'],
    ['triangleL','triangleR'],['lungeL','lungeR'],['twistL','twistR']]){
    const left=rig.solve(asanas.poses[a]),right=rig.solve(asanas.poses[b]);
    assert.notDeepEqual(left.leftKnee,right.leftKnee,a+' and '+b+' identical');
  }
  for(const name of ['child','butterfly','staff','savasana','supine']){
    const j=rig.solve(asanas.poses[name]);
    assert(j.hip[1]<.55,name+' not near mat');
  }
});
