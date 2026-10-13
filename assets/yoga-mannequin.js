/* Wooden articulated yoga mannequin – lightweight offline WebGL1.
 * Every limb pivots about an explicit joint. No third-party 3D downloads.
 * Prototype motion is illustrative, not professionally validated yoga instruction.
 */
(function () {
  'use strict';
  const PI=Math.PI;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>t*t*(3-2*t);
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const scaled=(a,s)=>a.map(v=>v*s);
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);

  function sphereMesh(rows=26,columns=36) {
    const vertices=[],normals=[],indices=[];
    for(let row=0;row<=rows;row++){
      const phi=PI*row/rows;
      for(let col=0;col<=columns;col++){
        const theta=2*PI*col/columns;
        const p=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];
        vertices.push(...p);normals.push(...p);
      }
    }
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const a=row*(columns+1)+col,b=a+columns+1;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
    return {vertices:new Float32Array(vertices),normals:new Float32Array(normals),indices:new Uint16Array(indices)};
  }
  function projection(fov,aspect,near,far){
    const f=1/Math.tan(fov/2),d=1/(near-far);
    return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*d,-1,0,0,2*far*near*d,0];
  }
  function lookAt(eye,target){
    const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
    return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
      -dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  }
  function multiply(a,b){
    const output=new Array(16).fill(0);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)
      output[c*4+r]+=a[k*4+r]*b[c*4+k];
    return output;
  }
  function compile(gl,type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function shaderProgram(gl,vertex,fragment){
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    return program;
  }
  function createYogaMannequinRenderer(gl,canvas,state,moves){
    const surface=sphereMesh();
    const vertex=[
      'attribute vec3 aPosition,aNormal;',
      'uniform mat4 uView;',
      'uniform vec3 uCenter,uAxisX,uAxisY,uAxisZ,uScale;',
      'uniform float uTaper;',
      'varying vec3 vWorldNormal,vLocal,vWorld;',
      'void main(){',
      'vec3 p=aPosition*vec3(1.0+uTaper*aPosition.y,1.0,1.0+uTaper*aPosition.y);',
      'vec3 world=uCenter+uAxisX*p.x*uScale.x+uAxisY*p.y*uScale.y+uAxisZ*p.z*uScale.z;',
      'vLocal=p;vWorld=world;',
      'vWorldNormal=normalize(uAxisX*(aNormal.x/uScale.x)+uAxisY*(aNormal.y/uScale.y)+uAxisZ*(aNormal.z/uScale.z));',
      'gl_Position=uView*vec4(world,1.0);',
      '}'
    ].join('\n');
    const fragment=[
      'precision mediump float;',
      'uniform vec3 uColor,uEye;',
      'uniform float uJoint,uGrain;',
      'varying vec3 vWorldNormal,vLocal,vWorld;',
      'void main(){',
      'vec3 n=normalize(vWorldNormal);vec3 eye=normalize(uEye-vWorld);',
      'float key=max(dot(n,normalize(vec3(-0.35,0.68,0.80))),0.0);',
      'float fill=max(dot(n,normalize(vec3(0.73,-0.08,-0.65))),0.0);',
      'float rim=pow(1.0-max(dot(n,eye),0.0),2.4);',
      'float grain1=sin(vLocal.y*21.0+sin(vLocal.x*5.0+vLocal.z*6.0)*1.8);',
      'float grain2=sin(vLocal.y*67.0+vLocal.x*13.0+grain1*1.3);',
      'float wood=1.0+uGrain*(grain1*0.067+grain2*0.023);',
      'float diffuse=0.47+0.40*key+0.15*fill;',
      'vec3 color=uColor*wood*diffuse;',
      'color+=vec3(0.115,0.09,0.16)*rim;',
      'float sheen=pow(max(dot(reflect(-normalize(vec3(-0.35,0.68,0.80)),n),eye),0.0),24.0);',
      'color+=vec3(0.18,0.14,0.10)*sheen*(1.0-uJoint*0.45);',
      'gl_FragColor=vec4(min(color,vec3(1.0)),1.0);',
      '}'
    ].join('\n');
    const program=shaderProgram(gl,vertex,fragment);
    gl.useProgram(program);
    const attribute=(name,buffer)=>{
      const location=gl.getAttribLocation(program,name);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
    };
    function upload(target,data){
      const buffer=gl.createBuffer();gl.bindBuffer(target,buffer);
      gl.bufferData(target,data,gl.STATIC_DRAW);return buffer;
    }
    const positions=upload(gl.ARRAY_BUFFER,surface.vertices);
    const normals=upload(gl.ARRAY_BUFFER,surface.normals);
    const triangles=upload(gl.ELEMENT_ARRAY_BUFFER,surface.indices);
    attribute('aPosition',positions);attribute('aNormal',normals);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangles);
    const loc={};
    for(const key of ['uView','uCenter','uAxisX','uAxisY','uAxisZ','uScale','uTaper','uColor','uEye','uJoint','uGrain'])
      loc[key]=gl.getUniformLocation(program,key);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    const wood={
      torso:[0.84,0.60,0.39],head:[0.93,0.72,0.49],limb:[0.89,0.65,0.41],
      hands:[0.96,0.76,0.52],pelvis:[0.73,0.50,0.32],joint:[0.39,0.24,0.16],
      hinge:[0.65,0.44,0.28]
    };
    const unitX=[1,0,0],unitY=[0,1,0],unitZ=[0,0,1];
    let lastPose=null,frames=0,lastTime=0,meanFrameMs=0;

    function ellipsoid(center,dimensions,color,options={}){
      const x=options.x||unitX,y=options.y||unitY,z=options.z||unitZ;
      gl.uniform3fv(loc.uCenter,center);
      gl.uniform3fv(loc.uAxisX,x);gl.uniform3fv(loc.uAxisY,y);gl.uniform3fv(loc.uAxisZ,z);
      gl.uniform3fv(loc.uScale,dimensions);gl.uniform3fv(loc.uColor,color);
      gl.uniform1f(loc.uTaper,options.taper||0);
      gl.uniform1f(loc.uJoint,options.joint?1:0);
      gl.uniform1f(loc.uGrain,options.joint?0.22:1);
      gl.drawElements(gl.TRIANGLES,surface.indices.length,gl.UNSIGNED_SHORT,0);
    }
    function segment(start,end,width,depth,color,taper=0){
      const v=sub(end,start),y=norm(v),reference=Math.abs(y[2])>.9?unitY:unitZ;
      const x=norm(cross(reference,y)),z=norm(cross(y,x));
      const mid=scaled(add(start,end),.5);
      ellipsoid(mid,[width,Math.hypot(...v)*.52,depth],color,{x,y,z,taper});
    }
    function joint(point,radius){
      ellipsoid(point,[radius,radius,radius],wood.joint,{joint:true});
    }
    function pivot(point,radius){
      ellipsoid(point,[radius*.90,radius,radius*.86],wood.hinge,{joint:true});
    }
    function pose(){
      const {index,elapsed,running}=state;
      const time=moves[index].duration||1;
      const t=clamp(elapsed/time,0,1);
      const wave=Math.sin(3*Math.PI*t);
      const rise=wave*wave;
      const lift=index===2?rise:index===1?rise*.50:0;
      const angle=.23+lift*(index===2?2.56:2.14);
      const bend=.08+.24*lift;
      const breath=(running?1:.25)*.008*Math.sin(elapsed*1.4);
      const top=2.16+breath;
      const shoulderY=2.14+breath;
      return {lift,angle,bend,top,shoulderY,breath};
    }
    function renderFigure(now){
      const bounds=canvas.getBoundingClientRect();
      if(bounds.width<1||bounds.height<1)return;
      const ratio=Math.min(window.devicePixelRatio||1,1.6);
      const width=Math.max(1,Math.round(bounds.width*ratio)),height=Math.max(1,Math.round(bounds.height*ratio));
      if(canvas.width!==width||canvas.height!==height){
        canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);
      }
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      state.azimuth+=(state.targetAzimuth-state.azimuth)*.11;
      lastPose=pose();
      const orbit=5.45+.82*lastPose.lift;
      const target=[0,1.47+.19*lastPose.lift,0];
      const eye=[Math.sin(state.azimuth)*orbit,2.14+.15*lastPose.lift,
        Math.cos(state.azimuth)*orbit];
      gl.useProgram(program);
      gl.uniformMatrix4fv(loc.uView,false,new Float32Array(multiply(projection(.69,width/height,.1,30),lookAt(eye,target))));
      gl.uniform3fv(loc.uEye,eye);

      // Walnut mannequin with clearly exposed ball joints.
      ellipsoid([0,1.13,0],[.263,.225,.183],wood.pelvis);
      ellipsoid([0,1.66+lastPose.breath*.45,0],[.245,.37,.160],wood.torso,{taper:.08});
      ellipsoid([0,2.04+lastPose.breath*.7,0],[.322,.245,.183],wood.torso,{taper:.08});
      joint([0,1.38,0],.126);
      pivot([0,2.37+lastPose.breath,0],.102);
      ellipsoid([0,2.67+lastPose.breath,.01],[.191,.250,.180],wood.head,{taper:-.035});
      for(const sign of [-1,1]){
        const hip=[sign*.17,1.055,0],knee=[sign*.196,.61,.015],ankle=[sign*.198,.174,.035];
        pivot(hip,.136);
        segment(hip,knee,.148,.140,wood.limb,-.06);
        joint(knee,.112);
        segment(knee,ankle,.112,.105,wood.limb,.11);
        pivot(ankle,.085);
        ellipsoid([sign*.199,.105,.166],[.141,.087,.254],wood.hands,{taper:.025});
        const shoulder=[sign*.36,lastPose.shoulderY,0];
        const upperDirection=[sign*Math.sin(lastPose.angle),-Math.cos(lastPose.angle),.015];
        const elbow=add(shoulder,scaled(upperDirection,.505));
        const foreAngle=lastPose.angle+lastPose.bend;
        const foreDirection=[sign*Math.sin(foreAngle),-Math.cos(foreAngle),.03];
        const wrist=add(elbow,scaled(foreDirection,.456));
        const palm=add(wrist,scaled(foreDirection,.131));
        pivot(shoulder,.137);
        segment(shoulder,elbow,.111,.102,wood.limb,.10);
        joint(elbow,.098);
        segment(elbow,wrist,.088,.080,wood.limb,-.08);
        joint(wrist,.068);
        segment(wrist,palm,.081,.056,wood.hands,-.10);
      }
      if(lastTime>0)meanFrameMs=meanFrameMs*.9+(now-lastTime)*.1;
      frames++;lastTime=now;
    }
    return {
      frame:renderFigure,
      diagnostics:()=>({
        material:'wood',segments:23,joints:17,triangles:surface.indices.length/3,
        points:0,shoulderAngle:lastPose?.angle||0,lift:lastPose?.lift||0,
        frames,averageFrameMs:meanFrameMs
      })
    };
  }
  window.createYogaMannequinRenderer=createYogaMannequinRenderer;
})();
