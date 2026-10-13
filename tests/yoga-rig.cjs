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

test('Dog has a raised hip and an inverted-V back rather than a table top',()=>{
 const j=rig.solve(asanas.poses.dog);
 assert(j.hip[1]>j.shoulder[1]+.28,'Dog torso should slope down from the hip');
 assert(j.hip[1]>j.head[1]+.42,'Dog hips should visibly exceed head height');
 for(const side of ['left','right']){
   assert(j[side+'Wrist'][1]<.27,'Dog hands should meet mat');
   assert(j[side+'Ankle'][1]<.27,'Dog feet should meet mat');
 }
});
test('Low lunges kneel with the rear leg, rather than balancing on one leg',()=>{
 for(const [name,rear] of [['lungeL','right'],['lungeR','left']]){
   const j=rig.solve(asanas.poses[name]);
   assert(j[rear+'Knee'][1]<.36,name+' rear knee should be near mat: '+j[rear+'Knee'][1]);
   assert(j[rear+'Ankle'][1]<.27,name+' rear foot should meet mat');
 }
});
test('Prone cobra, supine bridge and final relaxation show distinct body planes',()=>{
 const cobra=rig.solve(asanas.poses.cobra);
 assert(cobra.hip[1]<.33&&cobra.shoulder[1]>.5,'Cobra chest should rise above prone pelvis');
 const bridge=rig.solve(asanas.poses.bridge);
 assert(bridge.hip[1]>.70&&bridge.shoulder[1]<.55,
   'Bridge hip should rise above shoulders');
 const rest=rig.solve(asanas.poses.savasana);
 assert(rest.hip[1]<.3&&rest.shoulder[1]<.35&&rest.head[1]<.4,
   'Savasana torso and head should stay close to mat');
});

test('Every transition preserves bone lengths and never snaps a joint between frames',()=>{
  const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
  const joints=asanas.joints;
  let maximumJump=0;
  for(let i=0;i<program.movements.length;i++){
    const move=program.movements[i],from=program.movements[i-1]?.pose||'mountain';
    let previous=rig.solve(asanas.sample(move.pose,0,move.duration,from));
    // 30Hz samples include intermediate transitions, not just final asanas.
    for(let frame=1;frame<=Math.min(move.duration,12)*30;frame++){
      const now=rig.solve(asanas.sample(move.pose,frame/30,move.duration,from));
      assert(rig.metrics(now).maxError<.001,move.pose+': invalid bone at frame '+frame);
      for(const joint of joints){
        const delta=distance(now[joint],previous[joint]);
        maximumJump=Math.max(maximumJump,delta);
        assert(delta<.065,
          move.pose+' frame '+frame+' abruptly flipped '+joint+' by '+delta);
      }
      previous=now;
    }
    if(i){
      const old=program.movements[i-1],older=program.movements[i-2]?.pose||'mountain';
      const end=rig.solve(asanas.sample(old.pose,old.duration,old.duration,older));
      const start=rig.solve(asanas.sample(move.pose,0,move.duration,old.pose));
      for(const joint of joints)assert(distance(end[joint],start[joint])<.001,
        old.pose+' -> '+move.pose+': snapped at stage boundary ('+joint+')');
    }
  }
  assert(maximumJump>.005,'Animation must actually move');
});
test('Skipping a half-finished pose interpolates from the displayed mannequin',()=>{
  const old=program.movements[4],next=program.movements[5];
  const displayed=asanas.sample(old.pose,1.7,old.duration,program.movements[3].pose);
  const resumed=rig.solve(asanas.sample(next.pose,0,next.duration,old.pose,displayed));
  const before=rig.solve(displayed);
  for(const joint of asanas.joints)
    assert(dist(before[joint],resumed[joint])<.001,joint+' jumps on manual skip');
});

test('Elbow hinge direction, separation, reach and smooth motion for all 26 asanas',()=>{
  const signs=[['left',-1],['right',1]];
  let maximumDelta=0;
  for(let i=0;i<program.movements.length;i++){
    const movement=program.movements[i],from=program.movements[i-1]?.pose||'mountain';
    let previous=rig.solve(asanas.sample(movement.pose,0,movement.duration,from));
    for(let frame=1;frame<=Math.min(movement.duration,12)*30;frame++){
      const joints=rig.solve(asanas.sample(movement.pose,frame/30,movement.duration,from));
      assert(rig.metrics(joints).maxError<.001,movement.pose+' bone length changed');
      for(const name of asanas.joints){
        const delta=dist(previous[name],joints[name]);
        maximumDelta=Math.max(maximumDelta,delta);
        assert(delta<.07,movement.pose+' '+name+' jerked by '+delta);
      }
      for(const [side,sign] of signs){
        const el=joints[side+'Elbow'],wr=joints[side+'Wrist'],center=joints.shoulder;
        assert(sign*(el[0]-center[0])>.31,
          movement.pose+' '+side+' elbow crossed body');
        assert(sign*(wr[0]-center[0])>.32,
          movement.pose+' '+side+' wrist crossed body');
        const shoulder=[center[0]+sign*.29,center[1],center[2]];
        const a=shoulder.map((v,k)=>v-el[k]),b=wr.map((v,k)=>v-el[k]);
        const cosine=a.reduce((sum,v,k)=>sum+v*b[k],0)/
          (rig.lengths.upperArm*rig.lengths.forearm);
        const angle=Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI;
        assert(angle>=55&&angle<=171,movement.pose+' elbow angle '+angle);
        assert(wr[1]>=.10,movement.pose+' wrist is below mat');
        // Project the elbow on the two-bone perpendicular plane; it must
        // remain on the outward/backward hinge side for the whole sequence.
        const axis=wr.map((v,k)=>v-shoulder[k]);
        const d=Math.hypot(...axis);
        const forward=axis.map(v=>v/d),pole=[sign*.48,0,-.72];
        const scalar=pole.reduce((sum,v,k)=>sum+v*forward[k],0);
        const preferred=pole.map((v,k)=>v-scalar*forward[k]);
        const elbowV=el.map((v,k)=>v-shoulder[k]);
        const signed=preferred.reduce((sum,v,k)=>sum+v*elbowV[k],0);
        assert(signed>=-.00001,movement.pose+' '+side+' elbow inverted');
      }
      previous=joints;
    }
  }
  assert(maximumDelta>.01,'Transition animation did not move');
});
test('Plank and downward dog use nearly straight supporting arms and separate palms',()=>{
  for(const name of ['plank','dog']){
    const joints=rig.solve(asanas.poses[name]);
    for(const side of ['left','right']){
      const sign=side==='left'?-1:1;
      const sh=[joints.shoulder[0]+sign*.29,joints.shoulder[1],joints.shoulder[2]];
      const e=joints[side+'Elbow'],wr=joints[side+'Wrist'];
      const a=sh.map((v,k)=>v-e[k]),b=wr.map((v,k)=>v-e[k]);
      const angle=Math.acos(a.reduce((sum,v,k)=>sum+v*b[k],0)/(.5*.46))*180/Math.PI;
      assert(angle>145,name+' '+side+' arm collapsed: '+angle);
      assert(wr[1]>=.105&&wr[1]<=.23,name+' palm fails mat contact');
    }
    assert(dist(joints.leftWrist,joints.rightWrist)>.65,name+' hands overlap');
  }
});
