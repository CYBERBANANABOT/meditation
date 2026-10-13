/* Standalone offline yoga instructor with a wooden jointed 3D mannequin. */
(() => {
  'use strict';
  // Six-minute standing yoga-inspired flow with clearly different articulated poses.
  // Each sequence starts and ends in a neutral position so stages join smoothly.
  const moves = [
    {
      id:'arrival',name:'Поза горы',duration:25,
      instruction:'Встань устойчиво. Мягко расправь плечи, почувствуй опору под стопами.',
      safety:'Можно выполнять сидя. Дыхание свободное, без задержек.',
      voice:'Начинаем. Поза горы. Стопы устойчиво на полу, плечи свободны. Один спокойный вдох и выдох.',
      reminder:'Готовимся двигаться. Сохраняй комфортный ритм.'
    },
    {
      id:'sun',name:'Подъём рук через стороны',duration:35,
      instruction:'Три раза медленно проведи руками через стороны вверх и опусти.',
      safety:'Поднимай руки только до доступной высоты. Не прогибай поясницу.',
      voice:'Подними руки через стороны и плавно опусти. Повтори несколько раз без спешки.',
      reminder:'Сохраняй прямое, удобное положение корпуса.'
    },
    {
      id:'chair',name:'Неглубокая поза стула',duration:40,
      instruction:'Слегка согни колени, отведи таз назад и направь руки вперёд. Затем выпрямись.',
      safety:'Движение неглубокое, без боли. Можно держаться за устойчивую опору или пропустить.',
      voice:'Неглубокая поза стула. Слегка согни колени, отведи таз назад, руки направь вперёд. Выпрямись.',
      reminder:'Не опускайся глубоко и следи за устойчивостью.'
    },
    {
      id:'warriorL',name:'Широкая стойка — левая сторона',duration:45,
      instruction:'Шагни в более широкую стойку, слегка согни левое колено и раскрой руки в стороны.',
      safety:'Держи колено в направлении стопы, не делай глубокого выпада. Используй опору.',
      voice:'Расставь стопы чуть шире. Мягко согни левое колено и раскрой руки по сторонам.',
      reminder:'Положение устойчивое. Если неудобно, сузь стойку.'
    },
    {
      id:'warriorR',name:'Широкая стойка — правая сторона',duration:45,
      instruction:'Перенеси акцент на правую сторону. Немного согни правое колено, руки оставь раскрытыми.',
      safety:'Достаточно совсем небольшой амплитуды. Не допускай неприятных ощущений в колене.',
      voice:'Меняем сторону. Мягко сгибаем правое колено. Руки спокойно раскрыты в стороны.',
      reminder:'Не задерживай дыхание, сохраняй свободное движение.'
    },
    {
      id:'sideL',name:'Вытяжение вверх — левая рука',duration:35,
      instruction:'Подними левую руку вверх. Потянись макушкой, не наклоняясь глубоко.',
      safety:'Можно оставить руку на уровне плеч и совсем не наклонять корпус.',
      voice:'Левая рука поднимается вверх. Мягкое вытяжение, без глубокого наклона.',
      reminder:'Плечо не зажимай. Пусть движение останется лёгким.'
    },
    {
      id:'sideR',name:'Вытяжение вверх — правая рука',duration:35,
      instruction:'Повтори мягкое вытяжение с правой рукой. Плавно вернись в центр.',
      safety:'Не скручивай позвоночник и не двигайся через дискомфорт.',
      voice:'Теперь правая рука. Поднимайся только до комфортной высоты и возвращайся в центр.',
      reminder:'Сохраняй опору под обеими стопами.'
    },
    {
      id:'balance',name:'Подъём колена с опорой',duration:35,
      instruction:'Держась за устойчивую опору, немного приподними одно колено, затем другое.',
      safety:'Это необязательный этап. При неуверенном равновесии не отрывай стопы от пола.',
      voice:'Для равновесия обязательно используй опору. Слегка приподними одно колено, затем другое.',
      reminder:'Нет нужды поднимать колено высоко или стоять без опоры.'
    },
    {
      id:'open',name:'Раскрытие грудной клетки',duration:35,
      instruction:'Трижды плавно раскрой руки в стороны и спокойно верни их вниз.',
      safety:'Не запрокидывай голову и не прогибай спину.',
      voice:'Мягко раскрой руки в стороны, плечи свободны. Вернись в исходное положение.',
      reminder:'Последние движения. Пусть дыхание остаётся естественным.'
    },
    {
      id:'release',name:'Завершение',duration:30,
      instruction:'Опусти руки, выпрямись и заметь ощущения после практики.',
      safety:'Если появилось головокружение или боль, остановись и сядь.',
      voice:'Практика подходит к концу. Расслабь руки и плечи. Заметь, как чувствует себя тело.',
      reminder:'Спасибо за практику.'
    }
  ];
  const totalDuration = moves.reduce((sum,m)=>sum+m.duration,0);
  const $=id=>document.getElementById(id);
  const state={index:0,elapsed:0,running:false,done:false,lastFrame:0,azimuth:0,targetAzimuth:0,voice:false,ready:false,reminded:false};
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
    updateText('stageCount','Этап '+(state.index+1)+' из '+moves.length);
    updateText('nextMovement',state.index<moves.length-1?'Далее: '+moves[state.index+1].name:'Последний этап практики');
    updateText('movementName',move.name);
    updateText('movementInstruction',move.instruction);
    updateText('movementSafety',move.safety);
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
  function selectStage(index){
    const running=state.running;
    stopVoice();state.index=clamp(index,0,moves.length-1);state.elapsed=0;state.reminded=false;
    state.done=false;state.running=running;state.lastFrame=0;
    setUI();if(running)speak();
  }
  function reset(){
    state.index=0;state.elapsed=0;state.running=false;state.done=false;state.lastFrame=0;state.reminded=false;
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
    // The timer uses actual elapsed time: rendering FPS never changes session length.
    state.elapsed+=clamp(dt,0,1.2);
    if(state.elapsed>=moves[state.index].duration){
      if(state.index===moves.length-1){complete();return;}
      state.elapsed-=moves[state.index].duration;
      state.index++;
      state.reminded=false;
      setUI();speak();
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
      renderer=window.createYogaMannequinRenderer(gl,canvas,state,moves);
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
    snapshot:()=>({index:state.index,stage:moves[state.index].id,stages:moves.length,elapsed:state.elapsed,running:state.running,done:state.done,webgl:state.ready,azimuth:state.azimuth,totalDuration,durations:moves.map(m=>m.duration),voice:state.voice,mesh:renderer?.diagnostics?.()||null}),
    jump:index=>selectStage(index),
    setElapsed:seconds=>{state.elapsed=clamp(seconds,0,moves[state.index].duration);state.reminded=state.elapsed>=moves[state.index].duration*.55;setUI();}
  };
  setUI();renderVoice();requestAnimationFrame(tick);
})();
