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
        if(Array.isArray(point))assert(point.every(Number.isFinite),m.pose+': bad '+name);
        else assert(Number.isFinite(point),m.pose+': invalid orientation '+name);
      }
      assert(near(stats.torso,rig.lengths.torso),m.pose+': torso changed length');
      assert(near(stats.neck,rig.lengths.neck),m.pose+': stretched neck');
      assert(stats.maxError<.008,m.pose+': stretched limb error '+stats.maxError);
      assert(near(stats.shoulderSpan,.58),m.pose+': shoulder offset wrong');
      for(const [side,sgn] of [['left',-1],['right',1]]){
        const shoulder=rig.socket(j,side);
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
      assert(near(dist(j[side+'Elbow'],rig.socket(j,side)),.5),
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
        const frame=rig.axisFor(joints);
        const projected=pt=>sign*frame.x.reduce((sum,v,k)=>
          sum+v*(pt[k]-center[k]),0);
        assert(projected(el)>.31,
          movement.pose+' '+side+' elbow crossed body');
        assert(projected(wr)>.32,
          movement.pose+' '+side+' wrist crossed body');
        const shoulder=rig.socket(joints,side);
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
        const forward=axis.map(v=>v/d),
          pole=frame.x.map((v,k)=>v*sign*.48-frame.z[k]*.72);
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

test('Cat-cow remains genuinely on hands and knees through each breathing cycle',()=>{
  for(const name of ['table','cat','cow']){
    const pose=rig.solve(asanas.poses[name]);
    assert(pose.hip[1]>.6&&pose.hip[1]<.8,name+': hips not at kneeling height');
    for(const side of ['left','right']){
      assert(pose[side+'Knee'][1]>.10&&pose[side+'Knee'][1]<.25,
        name+': knee not on mat');
      assert(pose[side+'Wrist'][1]>.10&&pose[side+'Wrist'][1]<.26,
        name+': hands not planted');
    }
  }
});

test('Warrior I and II lower the correct front knee and straighten the rear knee',()=>{
  const kneeAngle=(j,side)=>{
    const sign=side==='left'?-1:1;
    const hip=[j.hip[0]+sign*rig.lengths.hipSpan/2,j.hip[1],j.hip[2]];
    const knee=j[side+'Knee'],ankle=j[side+'Ankle'];
    const a=hip.map((v,i)=>v-knee[i]),b=ankle.map((v,i)=>v-knee[i]);
    const cosine=a.reduce((s,v,i)=>s+v*b[i],0)/
      (rig.lengths.thigh*rig.lengths.shin);
    return Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI;
  };
  for(const family of ['warrior1','warrior2']){
    for(const [suffix,front,rear] of [['L','left','right'],['R','right','left']]){
      const name=family+suffix,j=rig.solve(asanas.poses[name]);
      const bent=kneeAngle(j,front),extended=kneeAngle(j,rear);
      assert(bent>=80&&bent<=120,name+': front knee insufficiently bent '+bent);
      assert(extended>150,name+': rear leg not straight enough '+extended);
      assert(extended-bent>45,name+': front and rear knees look identical');
      assert(Math.abs(j[front+'Knee'][2]-j[front+'Ankle'][2])<.14,
        name+': front knee not above ankle');
      assert(j[front+'Ankle'][1]<.25,name+': front foot is not grounded');
    }
  }
});

test('Human-paced bridge entry reclines, plants feet, then lifts pelvis',()=>{
  const bridge=program.movements.find(m=>m.pose==='bridge');
  assert(bridge&&bridge.duration===55);
  for(const name of ['reclinePrep','constructiveRest','bridgePrep'])
    assert(asanas.poses[name],name+' is missing');
  const at=t=>rig.solve(asanas.sample('bridge',t,55,'staff'));
  const sitting=at(0),reclining=at(7),onBack=at(14),
    ready=at(21),lifted=at(28);
  assert(sitting.head[1]>1.2,'Staff does not start seated');
  assert(reclining.head[2]<sitting.head[2]-.6,'Head did not recline backward');
  assert(reclining.shoulder[1]<.85,'Reclining skipped the intermediate stage');
  for(const j of [onBack,ready]){
    assert(j.shoulder[1]<.33&&j.head[1]<.33,'Shoulders/head must rest on mat');
    assert(j.hip[1]<.29,'Hips rose before feet were prepared');
    for(const side of ['left','right']){
      assert(j[side+'Knee'][1]>.35,'Knee was not bent');
      assert(j[side+'Ankle'][1]>=.09&&j[side+'Ankle'][1]<.26,
        'Foot was not on mat');
    }
  }
  assert(lifted.hip[1]>.75,'Bridge pelvis did not rise');
  assert(lifted.head[1]<.33&&lifted.shoulder[1]<.33,
    'Bridge lifted head or shoulders instead of pelvis');
  for(const side of ['left','right'])assert(
    dist(ready[side+'Ankle'],lifted[side+'Ankle'])<.16,
    'Bridge slid the supporting '+side+' foot');
  assert.equal(program.movements.length,26);
  assert.equal(program.total,1100);
});
test('Plank entry keeps skull above the mat through intermediate frames',()=>{
  const m=program.movements.find(m=>m.pose==='plank');
  for(let i=0;i<=9*30;i++){
    const j=rig.solve(asanas.sample('plank',i/30,m.duration,'half'));
    assert(j.head[1]>.7,'Head dove into mat at '+i/30+'s');
  }
});

test('Spinal twists have a straight lower leg and naturally bent, non-intersecting upper leg',()=>{
  const angle=(j,side)=>{
    const sign=side==='left'?-1:1,
      hip=[j.hip[0]+sign*rig.lengths.hipSpan/2,j.hip[1],j.hip[2]],
      k=j[side+'Knee'],ankle=j[side+'Ankle'];
    const a=hip.map((v,i)=>v-k[i]),b=ankle.map((v,i)=>v-k[i]);
    return Math.acos(Math.max(-1,Math.min(1,
      a.reduce((s,v,i)=>s+v*b[i],0)/(rig.lengths.thigh*rig.lengths.shin))))*180/Math.PI;
  };
  for(const [name,straight,bent,side] of [
    ['twistL','left','right',-1],['twistR','right','left',1]
  ]){
    const j=rig.solve(asanas.poses[name]);
    assert(angle(j,straight)>155,name+' supporting leg is not straight');
    assert(angle(j,bent)>85&&angle(j,bent)<115,name+' crossing knee not correctly bent');
    assert(side*j[bent+'Knee'][0]>.20,name+' knee on wrong side');
    assert(j[bent+'Knee'][1]>.35,name+' knee collapsed through mat');
    assert(j[straight+'Ankle'][1]<.25,name+' support foot is floating');
    assert(dist(j.leftKnee,j.rightKnee)>.50,name+' knees intersect');
    assert(dist(j.leftAnkle,j.rightAnkle)>.70,name+' ankles intersect');
    assert(rig.metrics(j).maxError<.001);
  }
});
test('Twist transitions never pass shins through each other',()=>{
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const segmentClearance=j=>{
    const hipL=[j.hip[0]-.16,j.hip[1],j.hip[2]],
      hipR=[j.hip[0]+.16,j.hip[1],j.hip[2]];
    const lk=j.leftKnee,rk=j.rightKnee,la=j.leftAnkle,ra=j.rightAnkle;
    const pairs=[
      [hipL,lk,hipR,rk,.30,.30],
      [hipL,lk,rk,ra,.25,0],
      [lk,la,hipR,rk,0,.25],
      [lk,la,rk,ra,0,0]
    ];
    let nearest=Infinity;
    for(const [a,b,c,d,startA,startB] of pairs)
      for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){
        const pa=mix(a,b,startA+(1-startA)*i/10);
        const pb=mix(c,d,startB+(1-startB)*j/10);
        nearest=Math.min(nearest,dist(pa,pb));
      }
    return nearest;
  };
  for(const [name,from] of [['twistL','bridge'],['twistR','twistL']]){
    const move=program.movements.find(x=>x.pose===name);
    let previous=null;
    for(let frame=0;frame<=20*30;frame++){
      const joints=rig.solve(asanas.sample(name,frame/30,move.duration,from));
      const separation=segmentClearance(joints);
      assert(separation>.19,name+' crossed leg penetrated the other at '+frame/30);
      if(previous)for(const key of asanas.joints)
        assert(dist(previous[key],joints[key])<.065,name+' joint jump '+key);
      previous=joints;
    }
  }
  assert.equal(program.total,1100);
  assert.equal(program.movements.length,26);
});

test('Warrior II left and right arms are nearly straight at shoulder height',()=>{
  for(const pose of ['warrior2L','warrior2R']){
    const j=rig.solve(asanas.poses[pose]);
    for(const side of ['left','right']){
      const sign=side==='left'?-1:1;
      const shoulder=rig.socket(j,side);
      const elbow=j[side+'Elbow'],wrist=j[side+'Wrist'];
      const a=shoulder.map((v,i)=>v-elbow[i]),b=wrist.map((v,i)=>v-elbow[i]);
      const cosine=a.reduce((s,v,i)=>s+v*b[i],0)/
        (rig.lengths.upperArm*rig.lengths.forearm);
      const angle=Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI;
      assert(angle>162&&angle<175,pose+' '+side+' arm angle '+angle);
      assert(Math.abs(wrist[1]-j.shoulder[1])<.08,
        pose+' '+side+' wrist not horizontal');
      assert(Math.abs(elbow[1]-j.shoulder[1])<.08,
        pose+' '+side+' elbow not horizontal');
    }
    assert(j.leftWrist[2]*j.rightWrist[2]<0,
      pose+' arms do not stretch toward opposite ends of mat');
    assert(rig.metrics(j).maxError<.001);
  }
});

test('Warrior II and Triangle open the chest and maintain attached rotating shoulders',()=>{
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  for(const [family,left] of [['warrior2L',true],['warrior2R',false],
    ['triangleL',true],['triangleR',false]]){
    const j=rig.solve(asanas.poses[family]),frame=rig.axisFor(j);
    assert(Math.abs(Math.abs(j.torsoYaw)-Math.PI/2)<.01,
      family+': chest did not open sideways');
    assert((left?1:-1)*j.torsoYaw>1.5,family+': incorrect turn direction');
    assert(Math.abs(j.pelvisYaw)> .20&&Math.abs(j.pelvisYaw)<.40,
      family+': pelvis should rotate gently, not overtwist');
    assert(Math.abs(dot(frame.x,frame.y))<.001,
      family+': shoulder line no longer perpendicular to spine');
    for(const side of ['left','right']){
      assert(near(dist(rig.socket(j,side),j[side+'Elbow']),.50),
        family+': rotating shoulder disconnected from upper arm');
      assert(near(dist(j[side+'Elbow'],j[side+'Wrist']),.46),
        family+': rotating elbow disconnected from wrist');
    }
  }
  const w=rig.solve(asanas.poses.warrior2L);
  assert(Math.abs(w.leftWrist[1]-w.rightWrist[1])<.07,
    'Warrior II arms must extend on one level');
  for(const pose of ['triangleL','triangleR']){
    const j=rig.solve(asanas.poses[pose]);
    assert(j.shoulder[2]>j.hip[2]+.6,'Triangle did not bend sideways');
    const lower=pose.endsWith('L')?'left':'right';
    const raised=lower==='left'?'right':'left';
    assert(j[lower+'Wrist'][1]<.38,
      'Triangle lower arm not reaching toward the mat');
    assert(j[raised+'Wrist'][1]>2.3,
      'Triangle upper arm not pointing skyward');
  }
});
test('Chest turning occurs smoothly during pose transitions',()=>{
  for(const pose of ['warrior2L','triangleL','warrior2R','triangleR']){
    const index=program.movements.findIndex(m=>m.pose===pose);
    const m=program.movements[index],from=program.movements[index-1]?.pose||'mountain';
    let previous=null;
    for(let frame=0;frame<=Math.min(12,m.duration)*30;frame++){
      const j=rig.solve(asanas.sample(m.pose,frame/30,m.duration,from));
      assert(rig.metrics(j).maxError<.001,pose+': shoulder length changed');
      if(previous)assert(Math.abs(j.torsoYaw-previous.torsoYaw)<.045,
        pose+': chest snapped between frames');
      previous=j;
    }
  }
});
