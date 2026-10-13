/* Anatomical procedural surface and skeletal WebGL motion for the yoga experiment.
 * Offline and dependency-free. Visual demonstration only, not medically reviewed.
 */
(function(){
'use strict';
const B=[
{name:'hips',p:[0,1.09,0],par:-1},{name:'spine',p:[0,1.50,0],par:0},
{name:'chest',p:[0,2.03,0],par:1},{name:'neck',p:[0,2.40,0],par:2},
{name:'head',p:[0,2.64,0],par:3},
{name:'Lshoulder',p:[-.36,2.17,0],par:2},{name:'Lelbow',p:[-.63,1.70,0],par:5},
{name:'Lwrist',p:[-.82,1.27,0],par:6},
{name:'Rshoulder',p:[.36,2.17,0],par:2},{name:'Relbow',p:[.63,1.70,0],par:8},
{name:'Rwrist',p:[.82,1.27,0],par:9},
{name:'Lhip',p:[-.18,1.04,0],par:0},{name:'Lknee',p:[-.19,.59,0],par:11},
{name:'Lankle',p:[-.20,.17,0],par:12},
{name:'Rhip',p:[.18,1.04,0],par:0},{name:'Rknee',p:[.19,.59,0],par:14},
{name:'Rankle',p:[.20,.17,0],par:15}
];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,x)=>{const v=clamp((x-a)/(b-a),0,1);return v*v*(3-2*v);};
const lerp=(a,b,t)=>a+(b-a)*t;
function smin(a,b,k){const h=clamp(.5+.5*(b-a)/k,0,1);return lerp(b,a,h)-k*h*(1-h);}
function ell(p,c,r){
 const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];
 return (Math.hypot(x,y,z)-1)*Math.min(...r);
}
function cap(p,a,b,r1,r2){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
 const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy+(p[2]-a[2])*dz)/(dx*dx+dy*dy+dz*dz),0,1);
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t,p[2]-a[2]-dz*t)-lerp(r1,r2,t);
}
const ellipsoids=[
[[0,1.88,0],[.34,.43,.195]],[[0,2.13,0],[.37,.23,.18]],
[[0,1.55,0],[.244,.36,.167]],[[0,1.23,-.01],[.315,.23,.207]],
[[0,2.41,0],[.115,.17,.114]],[[0,2.72,0],[.204,.251,.178]],
[[0,2.60,.035],[.164,.133,.14]],[[0,2.733,.183],[.044,.067,.065]],
[[.2,2.72,0],[.048,.076,.043]],[[-.2,2.72,0],[.048,.076,.043]],
[[.17,1.07,0],[.19,.21,.18]],[[-.17,1.07,0],[.19,.21,.18]],
[[.32,2.16,0],[.173,.142,.15]],[[-.32,2.16,0],[.173,.142,.15]]
];
const capsules=[];
for(const sign of [-1,1]){
 capsules.push([[sign*.355,2.14,0],[sign*.63,1.70,0],.13,.10,.08]);
 capsules.push([[sign*.63,1.70,0],[sign*.82,1.27,0],.102,.078,.055]);
 capsules.push([[sign*.82,1.27,0],[sign*.88,1.11,.02],.085,.075,.038]);
 for(let i=0;i<4;i++)capsules.push([[sign*.88,1.12,-.07+i*.044],
 [sign*(.94+i*.004),.966+(i===0||i===3?.037:0),-.07+i*.044],.026,.017,.013]);
 capsules.push([[sign*.825,1.235,-.055],[sign*.73,1.13,.02],.041,.026,.015]);
 capsules.push([[sign*.17,1.055,0],[sign*.19,.59,0],.178,.143,.08]);
 capsules.push([[sign*.19,.59,0],[sign*.20,.17,0],.142,.079,.07]);
 capsules.push([[sign*.20,.13,.12],[sign*.20,.105,.29],.132,.11,.075]);
}
function distance(p){
 let d=100;
 for(let i=0;i<ellipsoids.length;i++){
  const e=ellipsoids[i];
  d=smin(d,ell(p,e[0],e[1]),i<4?.115:i<6?.065:.05);
 }
 for(const c of capsules)d=smin(d,cap(p,c[0],c[1],c[2],c[3]),c[4]);
 return d;
}
function positionSkin(p){
 const x=p[0],y=p[1],abs=Math.abs(x),r=x>0;
 if(y>2.58)return [4,3,smooth(2.57,2.69,y)];
 if(y>2.39)return [3,4,1-smooth(2.48,2.59,y)];
 const shoulder=r?8:5,elbow=r?9:6,wrist=r?10:7;
 const armFactor=smooth(.32,.48,abs)*(1-smooth(2.2,2.37,y));
 if(armFactor>.15&&y>1.05){
  if(y<1.46)return [wrist,elbow,smooth(1.55,1.23,y)];
  if(y<1.80)return [elbow,shoulder,smooth(1.85,1.5,y)];
  return [shoulder,2,armFactor];
 }
 if(y<1.18){
  const hip=r?14:11,knee=r?15:12,ankle=r?16:13;
  if(y>.93)return [hip,0,smooth(.92,1.05,y)>.5?.45:.8];
  if(y>.48)return [hip,knee,smooth(.52,.71,y)];
  if(y>.25)return [knee,ankle,smooth(.25,.39,y)];
  return [ankle,knee,.98];
 }
 if(y>2.08)return [2,3,1-smooth(2.32,2.48,y)];
 if(y>1.64)return [2,1,smooth(1.63,1.95,y)];
 return [1,0,smooth(1.19,1.52,y)];
}
function makeMesh(){
 const step=.061,min=[-1.08,-.04,-.47],num=[37,53,17],N=num[0],M=num[1],K=num[2];
 const at=(x,y,z)=>(z*M+y)*N+x;
 const val=new Float32Array(N*M*K);
 for(let z=0;z<K;z++)for(let y=0;y<M;y++)for(let x=0;x<N;x++)
  val[at(x,y,z)]=distance([min[0]+x*step,min[1]+y*step,min[2]+z*step]);
 const offsets=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const v=[],n=[],skin=[],dots=[],dotNormal=[],dotSkin=[],cache=new Map(),seen=new Set();
 function normal(p){
  const key=p.map(x=>Math.round(x*1000)).join(',');
  if(cache.has(key))return cache.get(key);
  const h=.016;
  const g=[distance([p[0]+h,p[1],p[2]])-distance([p[0]-h,p[1],p[2]]),
  distance([p[0],p[1]+h,p[2]])-distance([p[0],p[1]-h,p[2]]),
  distance([p[0],p[1],p[2]+h])-distance([p[0],p[1],p[2]-h])];
  const l=Math.hypot(...g)||1,vec=g.map(x=>x/l);
  cache.set(key,vec);return vec;
 }
 function add(p){
  const nn=normal(p),ss=positionSkin(p);
  v.push(...p);n.push(...nn);skin.push(...ss);
  const key=p.map(x=>Math.round(x*42)).join(',');
  if(!seen.has(key)){
    seen.add(key);
    if(seen.size%2===0){dots.push(...p);dotNormal.push(...nn);dotSkin.push(...ss);}
  }
 }
 const interp=(a,b,fa,fb)=>{const t=clamp(fa/(fa-fb),0,1);return a.map((q,i)=>lerp(q,b[i],t));};
 for(let z=0;z<K-1;z++)for(let y=0;y<M-1;y++)for(let x=0;x<N-1;x++){
  const field=offsets.map(c=>val[at(x+c[0],y+c[1],z+c[2])]);
  if(field.every(t=>t>=0)||field.every(t=>t<0))continue;
  const points=offsets.map(c=>[min[0]+(x+c[0])*step,min[1]+(y+c[1])*step,min[2]+(z+c[2])*step]);
  const edge=(a,b)=>interp(points[a],points[b],field[a],field[b]);
  for(const t of tetra){
   const ins=t.filter(i=>field[i]<0),out=t.filter(i=>field[i]>=0);
   if(!ins.length||!out.length)continue;
   if(ins.length===1){const a=ins[0];add(edge(a,out[0]));add(edge(a,out[1]));add(edge(a,out[2]));}
   else if(ins.length===3){const a=out[0];add(edge(a,ins[0]));add(edge(a,ins[2]));add(edge(a,ins[1]));}
   else{
    const a=edge(ins[0],out[0]),b=edge(ins[0],out[1]),
      c=edge(ins[1],out[0]),d=edge(ins[1],out[1]);
    add(a);add(c);add(b);add(b);add(c);add(d);
   }
  }
 }
 if(v.length<2400)throw Error('Human mesh is empty');
 return {v:new Float32Array(v),n:new Float32Array(n),s:new Float32Array(skin),
 dots:new Float32Array(dots),dn:new Float32Array(dotNormal),ds:new Float32Array(dotSkin),
 triangles:v.length/9,points:dots.length/3};
}
