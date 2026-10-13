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
      'float wood=1.0+uGrain*(grain1*0.028+grain2*0.009);',
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
    // A pose now contains real X/Y/Z positions for every wooden joint,
    // rather than procedural arm swings while the body remains standing.
    function pose(){
      const m=moves[state.index],prev=moves[state.index-1];
      const joints=window.YogaAsanas.sample(
        m.pose,state.elapsed,m.duration,prev?.pose||'mountain');
      return {joints,name:m.pose,section:m.section};
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
      // Three-quarter camera reveals front/back foot placement in lunges and
      // depth of poses on the mat. Manual rotation remains supported.
      const eye=[Math.sin(state.azimuth)*6.5,2.6,
        Math.cos(state.azimuth)*6.5];
      const view=multiply(projection(.70,width/height,.1,32),
        lookAt(eye,[0,1.40,0]));
      gl.useProgram(program);
      gl.uniformMatrix4fv(loc.uView,false,new Float32Array(view));
      gl.uniform3fv(loc.uEye,eye);
      const j=lastPose.joints;
      // Hips, chest and head follow the whole spine in standing, kneeling,
      // prone, inverted and supine poses.
      const h=j.hip,sCenter=j.shoulder,head=j.head;
      const torsoAxis=norm(sub(sCenter,h));
      const shoulderLine=norm(cross([0,0,1],torsoAxis));
      const side=Math.hypot(...shoulderLine)>.5?shoulderLine:unitX;
      const Lshoulder=add(sCenter,scaled(side,-.31));
      const Rshoulder=add(sCenter,scaled(side,.31));
      const chest=add(h,scaled(sub(sCenter,h),.72));
      const chestUp=norm(sub(head,sCenter));
      ellipsoid(h,[.27,.24,.19],wood.pelvis);
      segment(h,sCenter,.25,.17,wood.torso,.02);
      ellipsoid(chest,[.31,.20,.18],wood.torso);
      joint(sCenter,.116);
      segment(sCenter,add(sCenter,scaled(chestUp,.16)),.11,.10,wood.hinge);
      ellipsoid(head,[.192,.248,.176],wood.head);
      for(const sign of [-1,1]){
        const key=sign<0?'left':'right';
        const hip=add(h,[sign*.16,0,0]);
        const knee=j[key+'Knee'],ankle=j[key+'Ankle'];
        pivot(hip,.135);
        segment(hip,knee,.151,.137,wood.limb,-.06);
        joint(knee,.110);
        segment(knee,ankle,.112,.102,wood.limb,.10);
        pivot(ankle,.087);
        // The foot's orientation follows ankle-to-knee direction.
        const foot=add(ankle,[0,0,.16]);
        segment(ankle,foot,.126,.12,wood.hands);
        const shoulder=sign<0?Lshoulder:Rshoulder;
        const elbow=j[key+'Elbow'],wrist=j[key+'Wrist'];
        const handDir=norm(sub(wrist,elbow));
        const palm=add(wrist,scaled(handDir,.135));
        pivot(shoulder,.132);
        segment(shoulder,elbow,.107,.10,wood.limb,.06);
        joint(elbow,.096);
        segment(elbow,wrist,.085,.079,wood.limb,-.04);
        joint(wrist,.068);
        segment(wrist,palm,.081,.062,wood.hands,-.07);
      }
      if(lastTime>0)meanFrameMs=meanFrameMs*.9+(now-lastTime)*.1;
      frames++;lastTime=now;
    }
    return {
      frame:renderFigure,
      diagnostics:()=>({
        material:'wood',joints:14,segments:30,
        triangles:surface.indices.length/3,
        pose:lastPose?.name||'mountain',
        section:lastPose?.section||'',
        hipY:lastPose?.joints.hip[1]||0,
        headY:lastPose?.joints.head[1]||0,
        shoulderY:lastPose?.joints.shoulder[1]||0,
        leftWristY:lastPose?.joints.leftWrist[1]||0,
        rightWristY:lastPose?.joints.rightWrist[1]||0,
        leftAnkleZ:lastPose?.joints.leftAnkle[2]||0,
        frames,averageFrameMs:meanFrameMs
      })
    };
  }
  window.createYogaMannequinRenderer=createYogaMannequinRenderer;
})();
