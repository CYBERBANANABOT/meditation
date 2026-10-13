/* Standalone offline yoga instructor with a wooden jointed 3D mannequin. */
(() => {
  'use strict';
  const moves=window.YogaProgram?.movements;
  if(!moves||!window.YogaAsanas)throw Error('Yoga practice assets not loaded');
  const totalDuration = moves.reduce((sum,m)=>sum+m.duration,0);
  const $=id=>document.getElementById(id);
  const state={index:0,elapsed:0,running:false,done:false,lastFrame:0,azimuth:.6,targetAzimuth:.6,voice:true,ready:false,reminded:false,transitionFrom:null};
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
    // Avoid repeatedly announcing unchanged instructions through screen readers.
    const updateText=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
    updateText('stageCount','Асана '+(state.index+1)+' из '+moves.length);
    updateText('practiceSection',move.section);
    updateText('nextMovement',state.index<moves.length-1?'Далее: '+moves[state.index+1].name:'Последний этап практики');
    updateText('movementName',move.name);
    updateText('movementInstruction',move.instruction);
    updateText('movementSafety',move.safety);
    $('timeLeft').textContent=format(Math.ceil(Math.max(0,move.duration-state.elapsed)));
    $('timeLeft').setAttribute('aria-label','Осталось в асане '+format(Math.ceil(Math.max(0,move.duration-state.elapsed))));
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
  function speak(text){
    if(!state.voice||!state.running||!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return;
    stopVoice();
    try{
      const msg=new SpeechSynthesisUtterance(text||moves[state.index].voice);
      msg.lang='ru-RU';msg.rate=.87;msg.pitch=.94;msg.volume=.85;
      const russian=window.speechSynthesis.getVoices().find(v=>/^ru(-|_)/i.test(v.lang));
      if(russian)msg.voice=russian;
      window.speechSynthesis.speak(msg);
    }catch{state.voice=false;renderVoice();}
  }
  function pause(){state.running=false;stopVoice();state.lastFrame=0;setUI();}
  // Show long side-on stances in profile; show open seated legs and left/right
  // supine twists from in front so one side is not hidden behind the other.
  const sideViewPoses=new Set(['fold','half','plank','cobra','dog','lungeL','lungeR',
    'warrior1L','warrior1R','warrior2L','warrior2R','child','catcow','staff',
    'bridge','savasana']);
  const frontViewPoses=new Set(['butterfly']);
  const diagonalViewPoses=new Set(['twistL','twistR']);
  function choosePoseCamera(){
    const pose=moves[state.index].pose;
    const side=sideViewPoses.has(pose);
    // Oblique angle preserves torso length while still showing which side
    // the crossed knees travel toward during supine spinal twists.
    state.targetAzimuth=side?1.46:frontViewPoses.has(pose)?.18:
      diagonalViewPoses.has(pose)?.92:.6;
    $('cameraButton').setAttribute('aria-label',side?'Показать вид под углом':'Показать вид сбоку');
    $('cameraButton').querySelector('span').textContent=side?'Вид под углом':'Вид сбоку';
  }
  function selectStage(index){
    const running=state.running;
    // A manual skip can happen mid-motion. Preserve the EXACT displayed
    // skeleton as the start of the next transition, instead of teleporting
    // to the previous asana's canonical ending.
    const move=moves[state.index],previous=moves[state.index-1];
    const displayed=window.YogaAsanas.sample(move.pose,state.elapsed,move.duration,
      previous?.pose||'mountain',state.transitionFrom);
    stopVoice();state.index=clamp(index,0,moves.length-1);state.elapsed=0;state.reminded=false;
    state.transitionFrom=displayed;
    state.done=false;state.running=running;state.lastFrame=0;
    choosePoseCamera();setUI();if(running)speak();
  }
  function reset(){
    state.index=0;state.elapsed=0;state.running=false;state.done=false;state.lastFrame=0;state.reminded=false;state.transitionFrom=null;
    stopVoice();$('completeModal').hidden=true;document.body.style.overflow='';choosePoseCamera();setUI();
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
    // The timer uses actual elapsed time: rendering FPS never changes session length.
    state.elapsed+=clamp(dt,0,1.2);
    if(state.elapsed>=moves[state.index].duration){
      if(state.index===moves.length-1){complete();return;}
      state.elapsed-=moves[state.index].duration;
      state.index++;
      state.transitionFrom=null;
      state.reminded=false;
      choosePoseCamera();setUI();speak();
    }else if(!state.reminded&&state.elapsed>=moves[state.index].duration*.55){
      state.reminded=true;
      if(state.voice)speak(moves[state.index].reminder);
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
    state.targetAzimuth=side?.6:Math.PI/2;
    $('cameraButton').setAttribute('aria-label',side?'Показать вид сбоку':'Показать вид под углом');
    $('cameraButton').querySelector('span').textContent=side?'Вид сбоку':'Вид под углом';
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
    try{
      renderer=window.createYogaMannequinRenderer(gl,canvas,state,moves);
      scene.classList.add('has-webgl');
      state.ready=true;
    }catch(err){
      console.warn('Wooden mannequin renderer unavailable:',err.message);
      $('sceneFallback').hidden=false;$('sceneHint').hidden=true;
    }
  }
  let lastUI=0;
  function tick(timestamp){
    if(!document.hidden){
      if(state.lastFrame&&state.running)advance((timestamp-state.lastFrame)/1000);
      state.lastFrame=timestamp;
      renderer?.frame(timestamp);
      if(timestamp-lastUI>95){lastUI=timestamp;setUI();}
    }else state.lastFrame=0;
    requestAnimationFrame(tick);
  }
  window.__yogaPrototype={
    snapshot:()=>({index:state.index,stage:moves[state.index].id,stages:moves.length,elapsed:state.elapsed,running:state.running,done:state.done,webgl:state.ready,azimuth:state.azimuth,totalDuration,durations:moves.map(m=>m.duration),poses:moves.map(m=>m.pose),voice:state.voice,mesh:renderer?.diagnostics?.()||null}),
    jump:index=>selectStage(index),
    setElapsed:seconds=>{state.elapsed=clamp(seconds,0,moves[state.index].duration);state.reminded=state.elapsed>=moves[state.index].duration*.55;setUI();}
  };
  choosePoseCamera();setUI();renderVoice();requestAnimationFrame(tick);
})();
