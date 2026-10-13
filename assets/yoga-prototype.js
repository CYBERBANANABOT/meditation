/* Standalone offline WebGL yoga instructor prototype. No external services. */
(() => {
  'use strict';
  const moves = [
    {name:'Спокойная стойка',duration:35,
      instruction:'Встань устойчиво или сядь. Отпусти напряжение в плечах, дыши естественно.',
      safety:'Если стоять неудобно, выполняй движение сидя.',
      voice:'Начнём спокойно. Найди устойчивое положение. Расслабь плечи. Дыши естественно.'},
    {name:'Раскрытие плеч',duration:45,
      instruction:'Медленно разводи руки в стороны и возвращай обратно. Не поднимай их выше комфортного уровня.',
      safety:'Если возникает боль, уменьши амплитуду или пропусти движение.',
      voice:'Плавно разводи руки в стороны. Движение мягкое, без усилия. На выдохе возвращай руки вниз.'},
    {name:'Плавный подъём рук',duration:50,
      instruction:'Поднимай руки вверх настолько, насколько удобно, затем медленно опускай. Не прогибай поясницу.',
      safety:'Можно поднимать руки только до уровня плеч. Не делай движение через боль.',
      voice:'На комфортном вдохе медленно поднимай руки. Сохраняй корпус неподвижным. На выдохе плавно опускай.'},
    {name:'Возвращение к покою',duration:40,
      instruction:'Опусти руки, позволь плечам расслабиться. Заметь дыхание и ощущения в теле.',
      safety:'Сохраняй естественное дыхание. В любой момент можно завершить.',
      voice:'Мягко опусти руки. Расслабь плечи и кисти. Почувствуй, как тело возвращается к покою.'}
  ];
  const totalDuration = moves.reduce((sum,m)=>sum+m.duration,0);
  const $=id=>document.getElementById(id);
  const state={index:0,elapsed:0,running:false,done:false,lastFrame:0,azimuth:0,targetAzimuth:0,voice:false,ready:false};
  const scene=$('figureScene'),canvas=$('figureCanvas');
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const format=time=>{
    const t=Math.max(0,Math.floor(time));
    return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
  };
  const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function cumulativeTime(){
    return moves.slice(0,state.index).reduce((sum,m)=>sum+m.duration,0)+state.elapsed;
  }
  function setUI(){
    const move=moves[state.index],percentage=clamp(cumulativeTime()/totalDuration*100,0,100);
    $('stageCount').textContent='Этап '+(state.index+1)+' из '+moves.length;
    $('movementName').textContent=move.name;
    $('movementInstruction').textContent=move.instruction;
    $('movementSafety').textContent=move.safety;
    $('timeLeft').textContent=format(Math.ceil(Math.max(0,move.duration-state.elapsed)));
    $('progressFill').style.width=percentage+'%';
    $('sessionProgress').setAttribute('aria-valuenow',String(Math.round(percentage)));
    $('elapsedLabel').textContent=format(cumulativeTime())+' прошло';
    $('totalLabel').textContent=format(totalDuration)+' всего';
    $('playText').textContent=state.running?'Пауза':state.elapsed||state.index?'Продолжить':'Начать';
    $('playButton').setAttribute('aria-label',state.running?'Приостановить практику':'Начать или продолжить практику');
    $('playIcon').querySelector('path').setAttribute('d',state.running?'M7 5h3v14H7zm7 0h3v14h-3z':'m9 5 11 7-11 7z');
    $('previousButton').disabled=state.index===0&&state.elapsed===0;
    $('previousButton').style.opacity=$('previousButton').disabled?'.35':'1';
    $('nextButton').disabled=state.done;
  }
  function stopVoice(){try{window.speechSynthesis?.cancel();}catch{}}
  function renderVoice(){
    $('voiceButton').setAttribute('aria-pressed',String(state.voice));
    $('voiceLabel').textContent=state.voice?'Голос включён':'Озвучить подсказки';
  }
  function speak(){
    if(!state.voice||!state.running||!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return;
    stopVoice();
    try{
      const msg=new SpeechSynthesisUtterance(moves[state.index].voice);
      msg.lang='ru-RU';msg.rate=.87;msg.pitch=.94;msg.volume=.85;
      const russian=window.speechSynthesis.getVoices().find(v=>/^ru(-|_)/i.test(v.lang));
      if(russian)msg.voice=russian;
      window.speechSynthesis.speak(msg);
    }catch{state.voice=false;renderVoice();}
  }
  function pause(){state.running=false;stopVoice();state.lastFrame=0;setUI();}
  function selectStage(index){
    const running=state.running;
    stopVoice();state.index=clamp(index,0,moves.length-1);state.elapsed=0;
    state.done=false;state.running=running;state.lastFrame=0;
    setUI();if(running)speak();
  }
  function reset(){
    state.index=0;state.elapsed=0;state.running=false;state.done=false;state.lastFrame=0;
    stopVoice();$('completeModal').hidden=true;document.body.style.overflow='';setUI();
    window.scrollTo({top:0,behavior:reduced?'instant':'smooth'});
  }
  function complete(){
    state.index=moves.length-1;state.elapsed=moves.at(-1).duration;
    state.running=false;state.done=true;stopVoice();setUI();
    $('completeModal').hidden=false;document.body.style.overflow='hidden';
    $('repeatButton').focus({preventScroll:true});
  }
  function advance(dt){
    if(!state.running||state.done)return;
    state.elapsed+=clamp(dt,0,.06);
    if(state.elapsed>=moves[state.index].duration){
      if(state.index===moves.length-1){complete();return;}
      state.index++;state.elapsed=0;setUI();speak();
    }
  }
  $('playButton').addEventListener('click',()=>{
    if(state.done)reset();
    state.running=!state.running;state.lastFrame=0;
    if(state.running)speak();else stopVoice();
    setUI();
  });
  $('previousButton').addEventListener('click',()=>selectStage(state.elapsed>3?state.index:state.index-1));
  $('nextButton').addEventListener('click',()=>{
    if(state.index===moves.length-1)complete();else selectStage(state.index+1);
  });
  $('restartButton').addEventListener('click',reset);
  $('repeatButton').addEventListener('click',reset);
  $('voiceButton').addEventListener('click',()=>{
    if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){
      $('voiceLabel').textContent='Голос недоступен';return;
    }
    state.voice=!state.voice;renderVoice();
    if(state.voice)speak();else stopVoice();
  });
  $('cameraButton').addEventListener('click',()=>{
    const side=Math.abs(state.targetAzimuth)>1.1;
    state.targetAzimuth=side?0:Math.PI/2;
    $('cameraButton').setAttribute('aria-label',side?'Показать вид сбоку':'Показать вид спереди');
    $('cameraButton').querySelector('span').textContent=side?'Вид сбоку':'Вид спереди';
  });
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{
    drag={x:e.clientX,pointerId:e.pointerId,moved:false};
    if(e.pointerType!=='touch')canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;
    const delta=e.clientX-drag.x;
    if(e.pointerType==='touch'&&!drag.moved&&Math.abs(delta)<9)return;
    if(e.pointerType==='touch'&&!drag.moved){
      drag.moved=true;scene.classList.add('dragging');
      try{canvas.setPointerCapture(e.pointerId);}catch{}
    }
    state.targetAzimuth=clamp(state.targetAzimuth-delta*.011,-Math.PI,Math.PI);
    drag.x=e.clientX;
  });
  function release(){drag=null;scene.classList.remove('dragging');}
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();state.lastFrame=0;});
  window.addEventListener('pagehide',()=>{if(state.running)pause();});
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false})||
    canvas.getContext('experimental-webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
  let renderer=null;
  if(!gl){$('sceneFallback').hidden=false;$('sceneHint').hidden=true;}
  else{
    try{renderer=createRenderer(gl);state.ready=true;}
    catch(err){console.warn('3D unavailable:',err.message);$('sceneFallback').hidden=false;$('sceneHint').hidden=true;}
  }
  function createRenderer(gl){
    const vertex=[
      'attribute vec3 aP,aN;',
      'uniform mat4 uVP;uniform vec3 uC,uX,uY,uZ,uS;',
      'varying vec3 vN,vP;',
      'void main(){vec3 p=aP*uS;vP=uC+uX*p.x+uY*p.y+uZ*p.z;',
      'vN=normalize(uX*(aN.x/uS.x)+uY*(aN.y/uS.y)+uZ*(aN.z/uS.z));',
      'gl_Position=uVP*vec4(vP,1.);}'
    ].join('\n');
    const fragment=[
      'precision mediump float;varying vec3 vN,vP;',
      'uniform vec3 uCam,uColor;',
      'void main(){vec3 n=normalize(vN);vec3 eye=normalize(uCam-vP);',
      'float light=.58+.30*max(dot(n,normalize(vec3(-.45,.82,1.))),0.);',
      'float rim=pow(1.-abs(dot(n,eye)),2.35);',
      'vec3 c=uColor*light+vec3(.41,.32,.56)*rim;',
      'gl_FragColor=vec4(min(c,vec3(1.)),.95);}'
    ].join('\n');
    function compile(type,source){
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const positions=[],normals=[],indices=[],lat=18,lon=26;
    for(let y=0;y<=lat;y++){
      const phi=y/lat*Math.PI;
      for(let x=0;x<=lon;x++){
        const a=x/lon*Math.PI*2;
        const v=[Math.sin(phi)*Math.cos(a),Math.cos(phi),Math.sin(phi)*Math.sin(a)];
        positions.push(...v);normals.push(...v);
      }
    }
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){
      const i=y*(lon+1)+x;
      indices.push(i,i+lon+1,i+1,i+1,i+lon+1,i+lon+2);
    }
    function makeBuffer(target,array){
      const buffer=gl.createBuffer();gl.bindBuffer(target,buffer);
      gl.bufferData(target,array,gl.STATIC_DRAW);return buffer;
    }
    const posBuf=makeBuffer(gl.ARRAY_BUFFER,new Float32Array(positions));
    const norBuf=makeBuffer(gl.ARRAY_BUFFER,new Float32Array(normals));
    makeBuffer(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices));
    for(const [attr,buf] of [['aP',posBuf],['aN',norBuf]]){
      const index=gl.getAttribLocation(program,attr);
      gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,3,gl.FLOAT,false,0,0);
    }
    const uni={};
    for(const name of ['uVP','uC','uX','uY','uZ','uS','uColor','uCam'])uni[name]=gl.getUniformLocation(program,name);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
    const norm=a=>{const len=Math.hypot(...a)||1;return a.map(n=>n/len);};
    function projection(fov,aspect,near,far){
      const f=1/Math.tan(fov/2),n=1/(near-far);
      return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*n,-1,0,0,2*far*near*n,0];
    }
    function lookAt(eye,target){
      const z=norm(subtract(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);
      return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
        -dot(x,eye),-dot(y,eye),-dot(z,eye),1];
    }
    function multiply(a,b){
      const out=new Array(16).fill(0);
      for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)
        out[c*4+r]+=a[k*4+r]*b[c*4+k];
      return out;
    }
    const colors={body:[.70,.51,.88],limbs:[.77,.59,.94],joints:[.82,.65,.96],face:[.80,.66,.97]};
    const AX=[1,0,0],AY=[0,1,0],AZ=[0,0,1];
    function shape(center,scale,x,y,z,color){
      gl.uniform3fv(uni.uC,center);gl.uniform3fv(uni.uS,scale);
      gl.uniform3fv(uni.uX,x);gl.uniform3fv(uni.uY,y);gl.uniform3fv(uni.uZ,z);
      gl.uniform3fv(uni.uColor,color);
      gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    }
    const ball=(position,scale,color)=>shape(position,scale,AX,AY,AZ,color);
    function limb(start,end,radius,depth,color){
      const y=norm(subtract(end,start)),ref=Math.abs(y[2])>.95?[0,1,0]:[0,0,1];
      const x=norm(cross(ref,y)),z=norm(cross(y,x));
      const length=Math.hypot(...subtract(end,start));
      shape(start.map((v,i)=>(v+end[i])/2),[radius,length/2+radius*.25,depth||radius],x,y,z,color);
    }
    function frame(){
      if(document.hidden)return;
      const rect=canvas.getBoundingClientRect();
      if(rect.width<1||rect.height<1)return;
      const density=Math.min(devicePixelRatio||1,1.65);
      const w=Math.max(1,Math.round(rect.width*density)),h=Math.max(1,Math.round(rect.height*density));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      state.azimuth+=(state.targetAzimuth-state.azimuth)*.11;
      const eye=[Math.sin(state.azimuth)*5.4,2.14,Math.cos(state.azimuth)*5.4];
      const vp=multiply(projection(39*Math.PI/180,w/h,.1,35),lookAt(eye,[0,1.4,0]));
      gl.uniformMatrix4fv(uni.uVP,false,new Float32Array(vp));
      gl.uniform3fv(uni.uCam,eye);
      const ratio=clamp(state.elapsed/moves[state.index].duration,0,1);
      const breathing=state.running?Math.sin(state.elapsed*1.25)*.012:0;
      const lift=(state.index===0||state.index===3)?.06:
        state.index===1?1.32*Math.sin(Math.PI*2*ratio)**2:2.67*Math.sin(Math.PI*1.5*ratio)**2;
      const sway=state.index===0?.035*Math.sin(ratio*Math.PI*2):0;
      ball([0,1.08,0],[.28,.25,.205],colors.body);
      ball([0,1.75+breathing,0],[.295,.54,.190],colors.body);
      ball([0,2.42+breathing,0],[.115,.17,.112],colors.joints);
      ball([0,2.72+breathing,0],[.205,.259,.189],colors.face);
      for(const sign of [-1,1]){
        const hip=[sign*.16,1.03,0],knee=[sign*.175,.59,.01],ankle=[sign*.175,.17,.04];
        limb(hip,knee,.162,.151,colors.body);
        ball(knee,[.143,.13,.145],colors.joints);
        limb(knee,ankle,.120,.113,colors.limbs);
        ball([sign*.175,.115,.205],[.15,.105,.285],colors.limbs);
        const shoulder=[sign*.34,2.165+breathing,0];
        ball(shoulder,[.156,.145,.147],colors.joints);
        const angle=clamp(.085+sway+lift,0,2.8);
        const upper=[sign*Math.sin(angle),-Math.cos(angle),-.03];
        const elbow=shoulder.map((v,i)=>v+upper[i]*.48);
        const fore=[sign*Math.sin(angle+.09),-Math.cos(angle+.09),-.06];
        const wrist=elbow.map((v,i)=>v+fore[i]*.435);
        limb(shoulder,elbow,.105,.098,colors.limbs);
        ball(elbow,[.105,.105,.108],colors.joints);
        limb(elbow,wrist,.083,.079,colors.limbs);
        ball(wrist,[.084,.087,.080],colors.joints);
        const fingertip=wrist.map((v,i)=>v+fore[i]*.15);
        limb(wrist,fingertip,.088,.06,colors.face);
      }
    }
    return {frame};
  }
  let lastUI=0;
  function tick(timestamp){
    if(!document.hidden){
      if(state.lastFrame&&state.running)advance((timestamp-state.lastFrame)/1000);
      state.lastFrame=timestamp;
      renderer?.frame();
      if(timestamp-lastUI>95){lastUI=timestamp;setUI();}
    }else state.lastFrame=0;
    requestAnimationFrame(tick);
  }
  window.__yogaPrototype={
    snapshot:()=>({index:state.index,elapsed:state.elapsed,running:state.running,done:state.done,webgl:state.ready,azimuth:state.azimuth,totalDuration}),
    jump:index=>selectStage(index),
    setElapsed:seconds=>{state.elapsed=clamp(seconds,0,moves[state.index].duration);setUI();}
  };
  setUI();renderVoice();requestAnimationFrame(tick);
})();
