/* Static yoga asana reference poses, expressed as articulated joint positions.
   X = left/right, Y = height above mat, Z = toward camera/mat front.
   These are stylised instructional silhouettes, not motion capture or
   individualised alignment assessment. No remote dependencies. */
(()=>{
'use strict';
const J=['hip','shoulder','head','leftKnee','rightKnee','leftAnkle','rightAnkle','leftElbow','rightElbow','leftWrist','rightWrist'];
const smooth=t=>t*t*(3-2*t);
const standing={
 hip:[0,1.14,0],shoulder:[0,2.1,0],head:[0,2.49,.02],
 leftKnee:[-.18,.62,0],rightKnee:[.18,.62,0],
 leftAnkle:[-.19,.15,0],rightAnkle:[.19,.15,0],
 leftElbow:[-.56,1.68,0],rightElbow:[.56,1.68,0],
 leftWrist:[-.77,1.28,0],rightWrist:[.77,1.28,0]
};
const own=o=>Object.fromEntries(J.map(j=>[j,(o[j]||standing[j]).slice()]));
const p={mountain:own({})};
p.salute=own({
 leftElbow:[-.34,2.54,0],rightElbow:[.34,2.54,0],
 leftWrist:[-.26,2.93,0],rightWrist:[.26,2.93,0]
});
p.fold=own({
 hip:[0,1.18,-.04],shoulder:[0,.65,.56],head:[0,.30,.79],
 leftKnee:[-.19,.63,.12],rightKnee:[.19,.63,.12],
 leftElbow:[-.22,.40,.71],rightElbow:[.22,.40,.71],
 leftWrist:[-.21,.17,.84],rightWrist:[.21,.17,.84]
});
p.half=own({
 shoulder:[0,1.49,.62],head:[0,1.72,.89],
 leftElbow:[-.26,1.00,.55],rightElbow:[.26,1.00,.55],
 leftWrist:[-.24,.71,.43],rightWrist:[.24,.71,.43]
});
p.plank=own({
 hip:[0,.63,-.36],shoulder:[0,.71,.50],head:[0,.70,.89],
 leftKnee:[-.18,.37,-.72],rightKnee:[.18,.37,-.72],
 leftAnkle:[-.19,.15,-1.17],rightAnkle:[.19,.15,-1.17],
 leftElbow:[-.29,.42,.66],rightElbow:[.29,.42,.66],
 leftWrist:[-.32,.14,.77],rightWrist:[.32,.14,.77]
});
p.cobra=own({
 hip:[0,.23,-.49],shoulder:[0,.88,.14],head:[0,1.19,.36],
 leftKnee:[-.30,.18,-.98],rightKnee:[.30,.18,-.98],
 leftAnkle:[-.19,.14,-1.46],rightAnkle:[.19,.14,-1.46],
 leftElbow:[-.29,.51,.30],rightElbow:[.29,.51,.30],
 leftWrist:[-.31,.14,.39],rightWrist:[.31,.14,.39]
});
p.dog=own({
 hip:[0,1.12,-.42],shoulder:[0,.64,.35],head:[0,.40,.65],
 leftKnee:[-.18,.66,-.60],rightKnee:[.18,.66,-.60],
 leftAnkle:[-.19,.14,-.83],rightAnkle:[.19,.14,-.83],
 leftElbow:[-.29,.38,.57],rightElbow:[.29,.38,.57],
 leftWrist:[-.32,.14,.81],rightWrist:[.32,.14,.81]
});
function lunge(left){
 const front=left?'left':'right',back=left?'right':'left';
 const q=own({
   hip:[0,.67,-.04],shoulder:[0,1.57,.02],head:[0,1.95,.04],
   leftElbow:[-.37,1.41,.40],rightElbow:[.37,1.41,.40],
   leftWrist:[-.32,1.12,.62],rightWrist:[.32,1.12,.62]
 });
 q[front+'Knee']=[left?-.25:.25,.51,.38];
 q[front+'Ankle']=[left?-.26:.26,.14,.60];
 q[back+'Knee']=[left?.22:-.22,.16,-.27];
 q[back+'Ankle']=[left?.23:-.23,.13,-.72];
 return q;
}
p.lungeL=lunge(true);p.lungeR=lunge(false);
function warrior1(left){
 const q=lunge(left);
 q.hip=[0,1.03,-.03];q.shoulder=[0,1.93,0];q.head=[0,2.33,0];
 const rear=left?'right':'left',front=left?'left':'right';
 q[rear+'Knee']=[left?.23:-.23,.62,-.40];
 q[front+'Knee']=[left?-.27:.27,.60,.41];
 q.leftElbow=[-.33,2.39,0];q.rightElbow=[.33,2.39,0];
 q.leftWrist=[-.25,2.83,0];q.rightWrist=[.25,2.83,0];
 return q;
}
p.warrior1L=warrior1(true);p.warrior1R=warrior1(false);
function warrior2(left){
 const q=warrior1(left);
 q.leftElbow=[-.32,1.94,left?.47:-.47];
 q.rightElbow=[.32,1.94,left?-.47:.47];
 q.leftWrist=[-.35,1.93,left?.93:-.93];
 q.rightWrist=[.35,1.93,left?-.93:.93];
 return q;
}
p.warrior2L=warrior2(true);p.warrior2R=warrior2(false);
function triangle(left){
 const q=warrior2(left),sign=left?-1:1;
 q.hip=[0,1.02,-.07];q.shoulder=[sign*.13,1.39,.74];q.head=[sign*.18,1.59,1.07];
 q.leftKnee=[-.25,.57,.40];q.rightKnee=[.25,.57,-.39];
 if(left){
  q.leftElbow=[-.31,1.04,.78];q.leftWrist=[-.30,.64,.87];
  q.rightElbow=[.32,1.86,.70];q.rightWrist=[.33,2.26,.72];
 }else{
  q.rightElbow=[.31,1.04,.78];q.rightWrist=[.30,.64,.87];
  q.leftElbow=[-.32,1.86,.70];q.leftWrist=[-.33,2.26,.72];
 }
 return q;
}
p.triangleL=triangle(true);p.triangleR=triangle(false);
p.child=own({
 hip:[0,.49,-.72],shoulder:[0,.46,.35],head:[0,.28,.73],
 leftKnee:[-.24,.14,-.31],rightKnee:[.24,.14,-.31],
 leftAnkle:[-.22,.12,-1.17],rightAnkle:[.22,.12,-1.17],
 leftElbow:[-.31,.28,.85],rightElbow:[.31,.28,.85],
 leftWrist:[-.34,.13,1.33],rightWrist:[.34,.13,1.33]
});
p.table=own({
 hip:[0,.82,-.59],shoulder:[0,.80,.65],head:[0,1.04,1.03],
 leftKnee:[-.24,.15,-.56],rightKnee:[.24,.15,-.56],
 leftAnkle:[-.24,.12,-1.15],rightAnkle:[.24,.12,-1.15],
 leftElbow:[-.33,.52,.80],rightElbow:[.33,.52,.80],
 leftWrist:[-.34,.13,1.00],rightWrist:[.34,.13,1.00]
});
p.cat=own({...p.table,shoulder:[0,1.02,.65],head:[0,.77,1.12],hip:[0,.96,-.59]});
p.cow=own({...p.table,shoulder:[0,.70,.65],head:[0,1.19,1.15],hip:[0,.79,-.59]});
p.catcow=own(p.table); // Animated sequence interpolates cat and cow at runtime.
p.butterfly=own({
 hip:[0,.26,-.10],shoulder:[0,1.18,-.10],head:[0,1.78,-.08],
 leftKnee:[-.60,.18,.48],rightKnee:[.60,.18,.48],
 leftAnkle:[-.16,.12,.83],rightAnkle:[.16,.12,.83],
 leftElbow:[-.38,.61,.40],rightElbow:[.38,.61,.40],
 leftWrist:[-.27,.22,.70],rightWrist:[.27,.22,.70]
});
p.staff=own({
 hip:[0,.23,-.36],shoulder:[0,1.15,-.35],head:[0,1.75,-.35],
 leftKnee:[-.22,.17,.70],rightKnee:[.22,.17,.70],
 leftAnkle:[-.23,.14,1.46],rightAnkle:[.23,.14,1.46],
 leftElbow:[-.33,.67,-.21],rightElbow:[.33,.67,-.21],
 leftWrist:[-.38,.19,.05],rightWrist:[.38,.19,.05]
});
p.bridge=own({
 hip:[0,.87,-.31],shoulder:[0,.27,.68],head:[0,.19,1.10],
 leftKnee:[-.20,.68,-.78],rightKnee:[.20,.68,-.78],
 leftAnkle:[-.22,.14,-1.18],rightAnkle:[.22,.14,-1.18],
 leftElbow:[-.35,.19,.28],rightElbow:[.35,.19,.28],
 leftWrist:[-.38,.12,-.20],rightWrist:[.38,.12,-.20]
});
p.supine=own({
 hip:[0,.18,-.28],shoulder:[0,.17,.68],head:[0,.20,1.21],
 leftKnee:[-.22,.16,-.91],rightKnee:[.22,.16,-.91],
 leftAnkle:[-.28,.12,-1.60],rightAnkle:[.28,.12,-1.60],
 leftElbow:[-.61,.18,.49],rightElbow:[.61,.18,.49],
 leftWrist:[-.96,.14,.26],rightWrist:[.96,.14,.26]
});
function twist(left){
 const q=own(p.supine),sign=left?-1:1;
 q.leftKnee=[sign*.62,.26,-.03];q.rightKnee=[sign*.63,.27,.12];
 q.leftAnkle=[sign*.73,.16,-.45];q.rightAnkle=[sign*.75,.16,-.30];
 return q;
}
p.twistL=twist(true);p.twistR=twist(false);
p.savasana=own(p.supine);
function interpolate(a,b,t){
 const x=smooth(Math.max(0,Math.min(1,t))),out={};
 for(const k of J)out[k]=a[k].map((n,i)=>n+(b[k][i]-n)*x);
 return out;
}
const available=Object.keys(p);
// Difficult posture changes use intermediate supported positions rather than
// linearly teleporting from standing to the floor in three seconds.
const routes={
 'half>plank':['fold','table'],
 'plank>cobra':['table'],
 'cobra>dog':['table'],
 'dog>lungeL':['table'],
 'dog>lungeR':['table'],
 'triangleL>dog':['table'],
 'triangleR>dog':['table'],
 'plank>child':['table'],
 'catcow>butterfly':['child'],
 'staff>bridge':['butterfly'],
 'bridge>twistL':['supine'],
 'twistL>twistR':['supine']
};
const sample=(name,seconds,duration,from,fromCurrentFrame=null)=>{
 if(!p[name])throw Error('Unknown yoga pose '+name);
 const u=Math.max(0,Math.min(1,seconds/Math.max(duration,1)));
 // Cat/cow must return to the neutral table at the start and finish;
 // otherwise changing to the next asana introduces a visible jump.
 const breath=interpolate(p.cat,p.cow,(1+Math.sin(2*Math.PI*4*u))/2);
 const envelope=Math.max(0,Math.min(1,u*8,(1-u)*8));
 const target=name==='catcow'?interpolate(p.table,breath,envelope):p[name];
 const start=fromCurrentFrame||p[from]||p.mountain;
 const via=routes[from+'>'+name]||[];
 const path=[start,...via.map(k=>p[k]),target];
 const transition=Math.min(duration*.35,via.length?Math.min(10,5+via.length*2):4.5);
 const phase=Math.min(1,seconds/transition)* (path.length-1);
 const step=Math.min(path.length-2,Math.floor(phase));
 return window.YogaRig?.blend
   ? window.YogaRig.blend(path[step],path[step+1],phase-step)
   : interpolate(path[step],path[step+1],phase-step);
};
window.YogaAsanas=Object.freeze({sample,poses:p,names:available,joints:J});
})();
