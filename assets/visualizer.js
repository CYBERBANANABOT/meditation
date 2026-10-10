/* ============================================================
   ВСЕЛЕННАЯ
   ============================================================ */
const orb = document.getElementById('orb');
const octx = orb.getContext('2d', { alpha: true });
const breathHint = document.getElementById('breathHint');
const immersionButton = document.getElementById('immersiveToggle');
immersionButton.addEventListener('click', () => {
  const screen = document.getElementById('screen-practice');
  const active = screen.classList.toggle('immersive');
  immersionButton.textContent = active ? '↙ Выйти из погружения' : '⛶ Режим погружения';
  immersionButton.setAttribute('aria-pressed', String(active));
  // The visualizer stays alive; update its dimensions on the next frame.
  if (typeof startOrbAnimation === 'function') startOrbAnimation();
});
// Canvas renders only when the practice screen is actually visible.
// Cap internal resolution for phone GPUs (previously 600x600 on every phone).
const motionPreference = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : { matches: false };
let orbFrameId = null;
let orbLastDraw = -Infinity;
let orbForceDraw = true;
let orbDisplayed = false;
function resizeOrbCanvas() {
  const cssSize = orb.getBoundingClientRect().width || 300;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const target = Math.max(240, Math.min(600, Math.round(cssSize * pixelRatio)));
  if (orb.width !== target || orb.height !== target) {
    orb.width = target;
    orb.height = target;
    orbForceDraw = true;
  }
}
function canAnimateOrb() {
  return !document.hidden && document.getElementById('screen-practice').classList.contains('active');
}
function stopOrbAnimation() {
  if (orbFrameId !== null) cancelAnimationFrame(orbFrameId);
  orbFrameId = null;
  orbDisplayed = false;
}
function startOrbAnimation() {
  if (!canAnimateOrb()) { stopOrbAnimation(); return; }
  resizeOrbCanvas();
  orbForceDraw = true;
  orbLastDraw = -Infinity;
  if (orbFrameId === null) orbFrameId = requestAnimationFrame(animateOrb);
}
window.addEventListener('resize', () => {
  if (canAnimateOrb()) startOrbAnimation();
});


const STARS = (() => {
  const arr = [];
  for (let i = 0; i < 220; i++) {
    arr.push({
      angle: Math.random()*Math.PI*2,
      radius: 0.05 + Math.random()*0.95,
      size: 0.4 + Math.random()*1.3,
      baseA: 0.15 + Math.random()*0.55,
      spd: (0.008 + Math.random()*0.035) * (Math.random()<0.5?1:-1),
      twinkleSpd: 0.4 + Math.random()*1.8,
      twinklePhase: Math.random()*Math.PI*2
    });
  }
  return arr;
})();
const SPARKS = (() => {
  const arr = [];
  for (let i = 0; i < 42; i++) {
    arr.push({
      angle: Math.random()*Math.PI*2,
      baseR: 0.25 + Math.random()*0.65,
      drift: (0.02 + Math.random()*0.06) * (Math.random()<0.5?1:-1),
      size: 0.6 + Math.random()*1.5,
      twinklePhase: Math.random()*Math.PI*2
    });
  }
  return arr;
})();
const NEBULAS = [
  { speed: 0.05, dist:0.32, size:0.85, alpha:0.30, light:false },
  { speed:-0.08, dist:0.40, size:0.65, alpha:0.22, light:true  },
  { speed: 0.03, dist:0.26, size:0.95, alpha:0.26, light:false },
  { speed:-0.11, dist:0.44, size:0.55, alpha:0.16, light:false },
  { speed: 0.06, dist:0.20, size:1.05, alpha:0.20, light:true  }
];
const nebulaPhases = NEBULAS.map(()=>Math.random()*Math.PI*2);

function drawUniverse(level, progress, t) {
  if (motionPreference.matches) t = 0;
  const w = orb.width, h = orb.height;
  const cx = w/2, cy = h/2;
  const R = w*0.42, R_MAX = R*1.18;
  const mainHex = currentColor();
  const mainRgb = hexToRgb(mainHex);
  const lightRgb = lighten(mainRgb, 0.6);
  const white = [255,255,255];

  octx.clearRect(0,0,w,h);
  octx.save();
  octx.beginPath(); octx.arc(cx,cy,R_MAX,0,Math.PI*2); octx.clip();

  const bg = octx.createRadialGradient(cx,cy,0,cx,cy,R_MAX);
  bg.addColorStop(0,    rgba(mainRgb, 0.12 + level*0.06));
  bg.addColorStop(0.35, rgba(mainRgb, 0.05 + level*0.03));
  bg.addColorStop(0.65, rgba(mainRgb, 0.015));
  bg.addColorStop(1,    rgba(mainRgb, 0));
  octx.fillStyle = bg;
  octx.beginPath(); octx.arc(cx,cy,R_MAX,0,Math.PI*2); octx.fill();

  const starsSqueeze = 0.94 + 0.06*level;
  for (const s of STARS) {
    const angle = s.angle + t*s.spd;
    const rad = R * s.radius * starsSqueeze;
    const x = cx + Math.cos(angle)*rad;
    const y = cy + Math.sin(angle)*rad;
    const edgeFalloff = 1 - Math.max(0, (s.radius - 0.75)/0.25);
    if (edgeFalloff <= 0) continue;
    const twinkle = 0.55 + 0.45*Math.sin(t*s.twinkleSpd + s.twinklePhase);
    const a = s.baseA * twinkle * edgeFalloff;
    if (a <= 0.01) continue;
    if (s.size > 1.2) {
      const glow = octx.createRadialGradient(x,y,0,x,y,s.size*3);
      glow.addColorStop(0, `rgba(255,255,255,${a*0.7})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      octx.fillStyle = glow;
      octx.beginPath(); octx.arc(x,y,s.size*3,0,Math.PI*2); octx.fill();
    }
    octx.fillStyle = `rgba(255,255,255,${a})`;
    octx.beginPath(); octx.arc(x,y,s.size,0,Math.PI*2); octx.fill();
  }

  octx.globalCompositeOperation = 'lighter';
  NEBULAS.forEach((n,i) => {
    const phase = nebulaPhases[i];
    const angle = t*n.speed + phase;
    const nx = cx + Math.cos(angle)*R*n.dist;
    const ny = cy + Math.sin(angle)*R*n.dist;
    const pulsingSize = n.size * (0.9 + 0.15*level);
    const nr = R*pulsingSize;
    const hue = n.light ? lightRgb : mainRgb;
    const alphaBoost = 0.7 + 0.5*level;
    const a0 = n.alpha*alphaBoost;
    const g = octx.createRadialGradient(nx,ny,0,nx,ny,nr);
    g.addColorStop(0,   rgba(hue,a0));
    g.addColorStop(0.4, rgba(hue,a0*0.35));
    g.addColorStop(1,   rgba(hue,0));
    octx.fillStyle = g;
    octx.beginPath(); octx.arc(nx,ny,nr,0,Math.PI*2); octx.fill();
  });
  octx.globalCompositeOperation = 'source-over';

  const coreBase = R*0.035;
  const coreSize = coreBase * (0.7 + level*1.5);
  const halo = octx.createRadialGradient(cx,cy,0,cx,cy,coreSize*6);
  halo.addColorStop(0,    rgba(white,0.9));
  halo.addColorStop(0.08, rgba(lightRgb,0.8));
  halo.addColorStop(0.25, rgba(mainRgb,0.35));
  halo.addColorStop(0.6,  rgba(mainRgb,0.10));
  halo.addColorStop(1,    rgba(mainRgb,0));
  octx.fillStyle = halo;
  octx.beginPath(); octx.arc(cx,cy,coreSize*6,0,Math.PI*2); octx.fill();

  const core = octx.createRadialGradient(cx,cy,0,cx,cy,coreSize);
  core.addColorStop(0,'rgba(255,255,255,1)');
  core.addColorStop(0.5,rgba(lightRgb,0.9));
  core.addColorStop(1,rgba(mainRgb,0.4));
  octx.fillStyle = core;
  octx.beginPath(); octx.arc(cx,cy,coreSize,0,Math.PI*2); octx.fill();

  // Soft breathing ripples; keep Canvas lifecycle and 60 FPS scheduler unchanged.
  octx.save();
  octx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.105 + i / 3) % 1;
    const rippleR = R * (0.10 + phase * 0.82) * (0.85 + level * 0.22);
    octx.beginPath(); octx.arc(cx, cy, rippleR, 0, Math.PI * 2);
    octx.strokeStyle = rgba(lightRgb, (1-phase) * (0.055 + level*0.048));
    octx.lineWidth = Math.max(0.7, w*0.0023); octx.stroke();
  }
  octx.restore();
  const gravity = 0.55 + 0.45*(1-level);
  for (const s of SPARKS) {
    const angle = s.angle + t*s.drift;
    const rad = R * s.baseR * gravity;
    const sx = cx + Math.cos(angle)*rad;
    const sy = cy + Math.sin(angle)*rad;
    const twinkle = 0.4 + 0.6*Math.sin(t*1.3 + s.twinklePhase);
    const a = 0.25 + 0.55*twinkle*(0.6 + 0.4*level);
    const size = s.size*(0.8 + 0.6*level);
    const pg = octx.createRadialGradient(sx,sy,0,sx,sy,size*4);
    pg.addColorStop(0, `rgba(255,255,255,${Math.min(1,a)})`);
    pg.addColorStop(0.4, rgba(lightRgb, a*0.45));
    pg.addColorStop(1, rgba(mainRgb, 0));
    octx.fillStyle = pg;
    octx.beginPath(); octx.arc(sx,sy,size*4,0,Math.PI*2); octx.fill();
    octx.fillStyle = `rgba(255,255,255,${Math.min(1,a+0.25)})`;
    octx.beginPath(); octx.arc(sx,sy,size,0,Math.PI*2); octx.fill();
  }
  octx.restore();

  const ringR = w*0.465, ringWidth = w*0.006;
  octx.beginPath(); octx.arc(cx,cy,ringR,0,Math.PI*2);
  octx.strokeStyle = 'rgba(255,255,255,0.04)';
  octx.lineWidth = ringWidth; octx.stroke();

  if (progress > 0.001) {
    const startAngle = -Math.PI/2;
    const endAngle = startAngle + Math.PI*2*Math.min(progress,1);
    octx.save();
    octx.shadowColor = mainHex; octx.shadowBlur = 20;
    octx.beginPath(); octx.arc(cx,cy,ringR,startAngle,endAngle);
    octx.strokeStyle = rgba(mainRgb, 0.75);
    octx.lineWidth = ringWidth*1.6; octx.lineCap='round'; octx.stroke();
    octx.restore();
    octx.beginPath(); octx.arc(cx,cy,ringR,startAngle,endAngle);
    octx.strokeStyle = rgba(lightRgb, 1);
    octx.lineWidth = ringWidth*0.6; octx.lineCap='round'; octx.stroke();
    if (progress < 1) {
      const tipX = cx + Math.cos(endAngle)*ringR;
      const tipY = cy + Math.sin(endAngle)*ringR;
      const tg = octx.createRadialGradient(tipX,tipY,0,tipX,tipY,22);
      tg.addColorStop(0, rgba(white,0.95));
      tg.addColorStop(0.35, rgba(mainRgb,0.6));
      tg.addColorStop(1, rgba(mainRgb,0));
      octx.fillStyle = tg;
      octx.beginPath(); octx.arc(tipX,tipY,22,0,Math.PI*2); octx.fill();
      octx.fillStyle = '#fff';
      octx.beginPath(); octx.arc(tipX,tipY,3.4,0,Math.PI*2); octx.fill();
    }
  }
}

const PHASE_LABELS = {
  inhale: { text:'Вдох', isAccent:true },
  hold: { text:'Задержка', isAccent:false, color:'#F0B429' },
  exhale: { text:'Выдох', isAccent:false, color:'#a7a9be' },
  holdEmpty: { text:'Пауза', isAccent:false, color:'#a7a9be' }
};
let lastHintState = null;

function animateOrb(now) {
  orbFrameId = null;
  if (!canAnimateOrb()) { orbDisplayed = false; return; }
  // Target 60 FPS on all visible practice states. Small tolerance avoids
  // unintentionally dropping to 30 FPS on 60 Hz screens from timestamp jitter.
  const minFrameMs = 1000 / 60 - 1.5;
  if (!orbForceDraw && now - orbLastDraw < minFrameMs) {
    orbFrameId = requestAnimationFrame(animateOrb);
    return;
  }
  orbForceDraw = false;
  orbLastDraw = now;
  orbDisplayed = true;
  const t = now/1000;
  const secondsInCycle = currentElapsed();
  const isIdle = !timerRunning && !timerDone && timerElapsed === 0;
  // Keep the ambient universe alive before a session; a frozen 0-level sphere
  // makes the visualization look broken. It does not affect the practice timer.
  const ambientSeconds = now / 1000;
  const res = breathing(isIdle ? ambientSeconds : secondsInCycle);
  if (!isIdle && res.phaseName === 'scan') {
    if (scanAudibleStep >= 0 && scanAudibleStep !== res.scanIdx) playScanChime();
    scanAudibleStep = res.scanIdx;
  } else scanAudibleStep = -1;

  if (isIdle) {
    if (lastHintState !== 'idle') { lastHintState = 'idle'; breathHint.textContent = ''; }
  } else if (res.phaseName === 'scan') {
    const key = 'scan_' + res.scanPart + '_' + res.scanIdx;
    if (key !== lastHintState) {
      lastHintState = key;
      const accentRgb = lighten(hexToRgb(currentColor()), 0.55);
      breathHint.textContent = `${res.scanPart}  ·  ${res.scanIdx+1}/${SCAN_PARTS.length}`;
      breathHint.style.color = rgba(accentRgb, 0.85);
    }
  } else if (res.phaseName !== lastHintState) {
    lastHintState = res.phaseName;
    const info = PHASE_LABELS[res.phaseName];
    if (info) {
      breathHint.textContent = info.text;
      breathHint.style.color = info.isAccent
        ? rgba(lighten(hexToRgb(currentColor()),0.55), 1)
        : (info.color || '#a7a9be');
    }
  }

  let finalLevel = isIdle ? 0.12 + res.level * 0.75 : res.level;
  if (!isIdle && (res.phaseName === 'inhale' || res.phaseName === 'exhale')) {
    const micro = Math.sin(t*2*Math.PI/7.3)*0.025 + Math.sin(t*2*Math.PI/4.1)*0.015;
    finalLevel = Math.max(0, Math.min(1, res.level + micro));
  }

  const progress = timerTotalSec > 0 ? Math.min(1, currentElapsed()/timerTotalSec) : 0;
  drawUniverse(finalLevel, progress, t);
  // Keep the universe smooth while this screen remains visible.
  orbFrameId = requestAnimationFrame(animateOrb);
}
if (motionPreference.addEventListener) motionPreference.addEventListener('change', startOrbAnimation);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (timerRunning && currentElapsed() >= timerTotalSec) finishTimer();
    saveActivePractice();
    stopOrbAnimation();
  }
  else {
    if (timerRunning && currentElapsed() >= timerTotalSec) finishTimer();
    else if (typeof renderTimer === 'function') renderTimer();
    startOrbAnimation();
  }
});
