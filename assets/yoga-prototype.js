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
    try{
      renderer=window.createYogaHumanRenderer(gl,canvas,state,moves);
      state.ready=true;
    }catch(err){
      console.warn('Human 3D renderer unavailable:',err.message);
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
    snapshot:()=>({index:state.index,elapsed:state.elapsed,running:state.running,done:state.done,webgl:state.ready,azimuth:state.azimuth,totalDuration,mesh:renderer?.diagnostics?.()||null}),
    jump:index=>selectStage(index),
    setElapsed:seconds=>{state.elapsed=clamp(seconds,0,moves[state.index].duration);setUI();}
  };
  setUI();renderVoice();requestAnimationFrame(tick);
})();
