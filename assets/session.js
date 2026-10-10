/* ---------- Таймер ---------- */
// Recovery is device-local. Background / closed time is not credited.
const ACTIVE_PRACTICE_KEY = 'meditation_active_practice_v1';
let lastPracticeCheckpointMs = -Infinity;

function readSavedPractice() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_PRACTICE_KEY) || 'null');
    if (!saved || saved.version !== 1 ||
        !Number.isInteger(saved.durationSec) || saved.durationSec < 60 || saved.durationSec > 10800 ||
        !Number.isFinite(saved.elapsedSec) || saved.elapsedSec <= 0 ||
        saved.elapsedSec >= saved.durationSec ||
        !Number.isFinite(saved.savedAt) || Date.now() - saved.savedAt > 7 * 86400000 ||
        saved.savedAt > Date.now() + 60000 ||
        !['scan','breath'].includes(saved.mode) ||
        !CHAKRAS.some(c => c.key === saved.chakra)) return null;
    return saved;
  } catch (e) { console.warn('Practice recovery:', e); return null; }
}
function clearSavedPractice() {
  try { localStorage.removeItem(ACTIVE_PRACTICE_KEY); } catch(e) { console.warn('Clear practice:', e); }
}
function saveActivePractice() {
  if (timerDone || (!timerRunning && timerElapsed <= 0)) return;
  const elapsed = Math.max(0, Math.min(currentElapsed(), timerTotalSec - 0.001));
  if (elapsed <= 0) return;
  const saved = {
    version: 1, durationSec: timerTotalSec, elapsedSec: elapsed,
    mode: practiceMode, rhythmKey: currentRhythm.key,
    chakra: currentChakra, savedAt: Date.now()
  };
  try { localStorage.setItem(ACTIVE_PRACTICE_KEY, JSON.stringify(saved)); }
  catch(e) { console.warn('Save interrupted practice:', e); }
  lastPracticeCheckpointMs = performance.now();
}
function restoreSavedPractice(saved) {
  currentPresetMin = saved.durationSec / 60;
  timerTotalSec = saved.durationSec;
  timerElapsed = saved.elapsedSec;
  timerStartMs = null;
  timerRunning = false;
  timerDone = false;
  practiceMode = saved.mode;
  currentRhythm = allRhythms.find(r => r.key === saved.rhythmKey) || currentRhythm;
  currentChakra = saved.chakra;
  selectedGoal = getGoalForChakra(currentChakra)?.key || 'calm';
  renderPresets();
  renderPracticeUI();
  renderRhythmPicker();
  updateChakraUI();
  renderTimer();
  updateMainIcon();
  saveActivePractice();
  if (canAnimateOrb()) startOrbAnimation();
}

let timerTotalSec = 600;
let timerElapsed = 0;
let timerStartMs = null;
let timerRunning = false;
let timerDone = false;
let timerInterval = null;
let timerDeadlineTimeout = null;
function clearTimerDeadline() {
  if (timerDeadlineTimeout !== null) clearTimeout(timerDeadlineTimeout);
  timerDeadlineTimeout = null;
}
function armTimerDeadline() {
  clearTimerDeadline();
  if (!timerRunning) return;
  timerDeadlineTimeout = setTimeout(() => {
    if (!timerRunning) return;
    if (currentElapsed() >= timerTotalSec) finishTimer();
    else armTimerDeadline();
  }, Math.max(30,Math.ceil((timerTotalSec-currentElapsed())*1000)));
}
const timerDisplay = document.getElementById('timerDisplay');
const mainIcon = document.getElementById('mainIcon');
const ICON_PLAY = 'M8 5v14l11-7z';
const ICON_PAUSE = 'M6 5h4v14H6zm8 0h4v14h-4z';

function currentElapsed() {
  return timerElapsed + (timerRunning ? (performance.now() - timerStartMs)/1000 : 0);
}
function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s/60), ss = s%60;
  return `${m}:${ss.toString().padStart(2,'0')}`;
}
function renderTimer() {
  const left = Math.max(0, timerTotalSec - currentElapsed());
  timerDisplay.textContent = fmt(left);
  timerDisplay.classList.toggle('warn', left <= 30 && left > 0);
}
function updateMainIcon() {
  mainIcon.querySelector('path').setAttribute('d', timerRunning ? ICON_PAUSE : ICON_PLAY);
}
function startTimer() {
  if (timerRunning || timerDone) return;
  timerRunning = true;
  timerStartMs = performance.now();
  armScanChime();
  armTimerDeadline();
  timerInterval = setInterval(() => {
    if (currentElapsed() >= timerTotalSec) finishTimer();
    else {
      renderTimer();
      if (performance.now() - lastPracticeCheckpointMs >= 4000) saveActivePractice();
    }
  }, 200);
  saveActivePractice();
  updateMainIcon();
  if (canAnimateOrb()) startOrbAnimation();
}
window.addEventListener('pagehide', saveActivePractice);
function pauseTimer() {
  if (!timerRunning) return;
  clearTimerDeadline();
  timerElapsed += (performance.now() - timerStartMs)/1000;
  timerRunning = false;
  saveActivePractice();
  clearInterval(timerInterval);
  renderTimer();
  updateMainIcon();
  if (canAnimateOrb()) startOrbAnimation();
}
// Audio fade is separate from the breathing animation and cancels on user actions.
let fadeToken = 0;
const MUSIC_VOLUME = 0.82;
function stopAudioFade() { fadeToken++; }
function fadeAudioTo(target, ms = 3500, pauseAtEnd = false) {
  const token = ++fadeToken;
  if (document.hidden) {
    audioEl.volume = target;
    if (pauseAtEnd) { audioEl.pause(); audioEl.volume = MUSIC_VOLUME; }
    return;
  }
  const beginning = audioEl.volume;
  const started = performance.now();
  function tick(now) {
    if (token !== fadeToken) return;
    const fraction = Math.min(1, (now-started)/ms);
    const smooth = fraction*fraction*(3-2*fraction);
    audioEl.volume = beginning + (target-beginning)*smooth;
    if (fraction < 1) requestAnimationFrame(tick);
    else if (pauseAtEnd) { audioEl.pause(); audioEl.volume = MUSIC_VOLUME; }
  }
  requestAnimationFrame(tick);
}
function showFinishMoment(mins, newDay) {
  const overlay = document.getElementById('finishOverlay');
  document.getElementById('finishDescription').textContent = `${mins} мин для себя · ${newDay ? '🔥 День засчитан' : 'Сегодняшний день уже засчитан'}.`;
  overlay.classList.add('show');
}
document.getElementById('finishContinue').addEventListener('click', () => {
  document.getElementById('finishOverlay').classList.remove('show');
  if (lastSessionId) openNoteModal(lastSessionId);
});
function finishTimer() {
  if (timerDone) return;
  clearTimerDeadline();
  clearSavedPractice();
  clearInterval(timerInterval);
  timerRunning = false;
  timerDone = true;
  timerElapsed = timerTotalSec;
  if (!audioEl.paused) {
    if (document.hidden) {
      stopAudioFade(); audioEl.pause(); audioEl.volume = MUSIC_VOLUME;
    } else fadeAudioTo(0, 4500, true);
  }
  if (tg) tg.HapticFeedback?.notificationOccurred('success');
  renderStreak();
  renderTimer();
  updateMainIcon();
  if (canAnimateOrb()) startOrbAnimation();

  const mins = Math.round(timerTotalSec/60);
  chakraProgress[currentChakra] = (chakraProgress[currentChakra] || 0) + mins;
  storageSet('chakraProgress', JSON.stringify(chakraProgress));

  sessionsCount++;
  storageSet('sessionsCount', String(sessionsCount));

  const entry = {
    id: Date.now(), ts: Date.now(),
    date: todayStr(), time: new Date().toTimeString().slice(0,5),
    chakra: currentChakra, minutes: mins,
    note: '', mode: practiceMode, updatedAt: Date.now()
  };
  sessionLog.push(entry);
  saveSessionLog();
  lastSessionId = entry.id;
  const isNewStreakDay = creditMeditationDay();
  renderStreak();
  if (isNewStreakDay) showToast(`🔥 День засчитан! Серия: ${streak.count}`, 'success');

  if (profileTab === 'stats') renderProfileStats();
  showFinishMoment(mins, isNewStreakDay);
}
function confirmTimerReset() {
  return !(timerRunning || (timerElapsed > 0 && !timerDone)) ||
    confirm('Текущая медитация будет сброшена. Продолжить?');
}
function resetTimer(newTotalSec, preserveRecovery = false) {
    clearTimerDeadline();
    if (!preserveRecovery) clearSavedPractice();
    clearInterval(timerInterval);
  timerRunning = false;
  timerDone = false;
  timerElapsed = 0;
  timerStartMs = null;
  timerTotalSec = newTotalSec;
  renderTimer();
  updateMainIcon();
  lastHintState = null;
  scanAudibleStep = -1;
  if (canAnimateOrb()) startOrbAnimation();
  if (audioEl && !audioEl.paused) { stopAudioFade(); audioEl.pause(); audioEl.volume = MUSIC_VOLUME; }
  return true;
}


function builtinSelected() { return !!allTracks[trackIndex]?._builtin; }
const audioEl = document.getElementById('audioEl');
const playerTrackStatus = document.getElementById('playerTrackStatus');
const prevTrackButton = document.getElementById('btnPrevTrack');
const nextTrackButton = document.getElementById('btnNextTrack');
let playerRequest = 0;
audioEl.volume = MUSIC_VOLUME;
function updateTrackStatus(message) {
  const selected = allTracks[trackIndex];
  playerTrackStatus.textContent = message || (selected ? `♫ ${selected.title}${audioEl.paused ? '' : ' · играет'}` : 'Музыка не выбрана');
  prevTrackButton.disabled = nextTrackButton.disabled = allTracks.length === 0;
}
function clearTrack() {
  ++playerRequest;
  stopAudioFade(); audioEl.pause(); audioEl.volume = MUSIC_VOLUME;
  audioEl.removeAttribute('src');
  audioEl.load();
  trackIndex = 0;
  updateTrackStatus();
}
async function playSelectedTrack() {
  if (!allTracks.length) { updateTrackStatus(); return; }
  if (!audioEl.getAttribute('src') || audioEl.getAttribute('src') !== allTracks[trackIndex].src) {
    audioEl.src = allTracks[trackIndex].src;
  }
  audioEl.loop = builtinSelected();
  const request = ++playerRequest;
  stopAudioFade();
  audioEl.volume = 0;
  try {
    await audioEl.play();
    if (request === playerRequest) fadeAudioTo(MUSIC_VOLUME, 3500);
    if (request === playerRequest) updateTrackStatus();
  } catch (err) {
    if (request === playerRequest) {
      console.warn('Ошибка воспроизведения аудио:', err);
      updateTrackStatus('Не удалось воспроизвести: проверь формат или разрешение звука');
      showToast('Не удалось включить аудио. Проверь формат файла.');
    }
  }
}
function loadTrack(i, autoplay = false) {
  if (!allTracks.length) { clearTrack(); return; }
  ++playerRequest;
  trackIndex = ((i % allTracks.length) + allTracks.length) % allTracks.length;
  stopAudioFade(); audioEl.pause(); audioEl.volume = MUSIC_VOLUME;
  audioEl.loop = builtinSelected();
  audioEl.src = allTracks[trackIndex].src;
  audioEl.load();
  updateTrackStatus();
  if (autoplay) void playSelectedTrack();
}
document.getElementById('btnMain').addEventListener('click', () => {
  if (timerDone) resetTimer(currentPresetMin * 60);
  if (timerRunning) {
    pauseTimer();
    ++playerRequest;
    if (!audioEl.paused) fadeAudioTo(0, 700, true);
    updateTrackStatus();
  } else {
    startTimer();
    if (allTracks.length) void playSelectedTrack();
  }
});
nextTrackButton.addEventListener('click', () => {
  if (!allTracks.length) return;
  loadTrack(trackIndex + 1, timerRunning);
});
prevTrackButton.addEventListener('click', () => {
  if (!allTracks.length) return;
  if (!builtinSelected() && audioEl.currentTime > 3) {
    audioEl.currentTime = 0;
    if (timerRunning && audioEl.paused) void playSelectedTrack();
  } else loadTrack(trackIndex - 1, timerRunning);
});
audioEl.addEventListener('play', () => updateTrackStatus());
audioEl.addEventListener('waiting', () => {
  if (!audioEl.paused) updateTrackStatus('♫ Загрузка музыки…');
});
audioEl.addEventListener('stalled', () => {
  if (!audioEl.paused) updateTrackStatus('♫ Ожидание сети…');
});
audioEl.addEventListener('playing', () => updateTrackStatus());
audioEl.addEventListener('timeupdate', () => {
  if (timerRunning && currentElapsed() >= timerTotalSec) finishTimer();
});
audioEl.addEventListener('pause', () => updateTrackStatus());
audioEl.addEventListener('error', () => {
    if (allTracks.length) {
      updateTrackStatus('Не удаётся прочитать аудиофайл');
      showToast('Проблема с музыкой. Практика продолжится без звука');
    }
});
updateTrackStatus();
renderTimer();
updateMainIcon();
