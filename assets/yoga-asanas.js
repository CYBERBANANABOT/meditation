/* Static yoga asana reference poses, expressed as articulated joint positions.
   X = left/right, Y = height above mat, Z = toward camera/mat front.
   These are stylised instructional silhouettes, not motion capture or
   individualised alignment assessment. No remote dependencies. */
(()=>{
'use strict';
const J=['hip','shoulder','head','leftKnee','rightKnee','leftAnkle','rightAnkle','leftElbow','rightElbow','leftWrist','rightWrist'];
const standing={
 hip:[0,1.14,0],shoulder:[0,2.1,0],head:[0,2.70,.02],
 leftKnee:[-.18,.62,0],rightKnee:[.18,.62,0],
 leftAnkle:[-.19,.15,0],rightAnkle:[.19,.15,0],
 leftElbow:[-.56,1.68,0],rightElbow:[.56,1.68,0],
 leftWrist:[-.77,1.28,0],rightWrist:[.77,1.28,0]
};
const own=o=>Object.fromEntries(J.map(j=>[j,(o[j]||standing[j]).slice()]));
const p={mountain:own({})};
p.salute=own({
 leftElbow:[-.41,2.65,0],rightElbow:[.41,2.65,0],
 leftWrist:[-.27,3.18,0],rightWrist:[.27,3.18,0]
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
 hip:[0,.71,-.35],shoulder:[0,.79,.87],head:[0,.82,1.36],
 leftKnee:[-.17,.39,-.94],rightKnee:[.17,.39,-.94],
 leftAnkle:[-.19,.15,-1.60],rightAnkle:[.19,.15,-1.60],
 leftElbow:[-.30,.52,.91],rightElbow:[.30,.52,.91],
 leftWrist:[-.35,.13,1.09],rightWrist:[.35,.13,1.09]
});
p.cobra=own({
 hip:[0,.28,-.59],shoulder:[0,1.05,.28],head:[0,1.49,.51],
 leftKnee:[-.18,.17,-1.20],rightKnee:[.18,.17,-1.20],
 leftAnkle:[-.19,.14,-1.77],rightAnkle:[.19,.14,-1.77],
 leftElbow:[-.29,.62,.37],rightElbow:[.29,.62,.37],
 leftWrist:[-.32,.14,.55],rightWrist:[.32,.14,.55]
});
p.dog=own({
 hip:[0,1.99,-.29],shoulder:[0,1.26,.69],head:[0,1.02,1.07],
 leftKnee:[-.18,.88,-.89],rightKnee:[.18,.88,-.89],
 leftAnkle:[-.19,.14,-1.68],rightAnkle:[.19,.14,-1.68],
 leftElbow:[-.32,.69,1.06],rightElbow:[.32,.69,1.06],
 leftWrist:[-.37,.13,1.41],rightWrist:[.37,.13,1.41]
});
function lunge(left){
 const front=left?'left':'right',back=left?'right':'left';
 const q=own({
   hip:[0,1.00,-.01],shoulder:[0,1.86,.04],head:[0,2.42,.05],
   leftElbow:[-.37,1.41,.40],rightElbow:[.37,1.41,.40],
   leftWrist:[-.32,1.12,.62],rightWrist:[.32,1.12,.62]
 });
 q[front+'Knee']=[left?-.26:.26,.69,.69];
 q[front+'Ankle']=[left?-.27:.27,.14,1.01];
 q[back+'Knee']=[left?.23:-.23,.18,-.71];
 q[back+'Ankle']=[left?.24:-.24,.13,-1.45];
 return q;
}
p.lungeL=lunge(true);p.lungeR=lunge(false);
function warrior1(left){
 const q=lunge(left);
 q.hip=[0,1.18,-.02];q.shoulder=[0,2.08,0];q.head=[0,2.67,0];
 const rear=left?'right':'left',front=left?'left':'right';
 q[rear+'Knee']=[left?.23:-.23,.73,-.88];
 q[front+'Knee']=[left?-.27:.27,.70,.68];
 q.leftElbow=[-.36,2.67,0];q.rightElbow=[.36,2.67,0];
 q.leftWrist=[-.24,3.18,0];q.rightWrist=[.24,3.18,0];
 return q;
}
p.warrior1L=warrior1(true);p.warrior1R=warrior1(false);
function warrior2(left){
 const q=warrior1(left);
 q.leftElbow=[-.35,2.13,left?.61:-.61];
 q.rightElbow=[.35,2.13,left?-.61:.61];
 q.leftWrist=[-.38,2.12,left?1.17:-1.17];
 q.rightWrist=[.38,2.12,left?-1.17:1.17];
 return q;
}
p.warrior2L=warrior2(true);p.warrior2R=warrior2(false);
function triangle(left){
 const q=warrior2(left),sign=left?-1:1;
 q.hip=[0,1.20,-.08];q.shoulder=[sign*.13,1.48,.68];q.head=[sign*.21,1.75,1.02];
 q.leftKnee=[-.26,.61,.74];q.rightKnee=[.26,.61,-.78];
 if(left){
  q.leftElbow=[-.34,1.01,.85];q.leftWrist=[-.33,.54,.99];
  q.rightElbow=[.34,2.06,.65];q.rightWrist=[.40,2.62,.62];
 }else{
  q.rightElbow=[.34,1.01,.85];q.rightWrist=[.33,.54,.99];
  q.leftElbow=[-.34,2.06,.65];q.leftWrist=[-.40,2.62,.62];
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
const sample=(name,seconds,duration,from)=>{
 if(!p[name])throw Error('Unknown yoga pose '+name);
 const u=Math.max(0,Math.min(1,seconds/Math.max(duration,1)));
 const base=name==='catcow'?interpolate(p.cat,p.cow,(1+Math.sin(2*Math.PI*4*u))/2):p[name];
 // Give 3.5 seconds to change position, then demonstrate a genuine static asana.
 const previous=p[from]||p.mountain;
 return interpolate(previous,base,Math.min(1,seconds/3.5));
};
window.YogaAsanas=Object.freeze({sample,poses:p,names:available,joints:J});
})();
