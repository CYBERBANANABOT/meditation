/* ---------- Заметка ---------- */
const noteModal = document.getElementById('noteModal');
const noteInput = document.getElementById('noteInput');
let chosenMood = '';
document.querySelectorAll('.mood-choice').forEach(btn => btn.addEventListener('click', () => {
  chosenMood = btn.dataset.mood;
  document.querySelectorAll('.mood-choice').forEach(b => b.classList.toggle('selected', b === btn));
}));
function openNoteModal(sessionId) {
  chosenMood = '';
  document.querySelectorAll('.mood-choice').forEach(b => b.classList.remove('selected'));
  noteInput.value = '';
  noteModal.classList.add('show');
  setTimeout(() => noteInput.focus(), 250);
  lastSessionId = sessionId;
}
function closeNoteModal() {
  noteModal.classList.remove('show');
  noteInput.blur();
}
document.getElementById('noteSkip').addEventListener('click', closeNoteModal);
document.getElementById('noteSave').addEventListener('click', () => {
  const text = noteInput.value.trim();
  if (lastSessionId) {
    const s = sessionLog.find(x => x.id === lastSessionId);
    if (s && (text || chosenMood)) {
      s.note = text; s.mood = chosenMood;
      s.updatedAt = Date.now();
      saveSessionLog();
      showToast('Ощущения сохранены 🌿','success');
    }
  }
  closeNoteModal();
});
noteModal.addEventListener('click', e => { if (e.target.id === 'noteModal') closeNoteModal(); });

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.close).classList.remove('show'));
});
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => {
      if (e.target === m && !['practiceRecoveryModal','welcomeGoalModal'].includes(m.id)) m.classList.remove('show');
    });
});

function offerPracticeRecovery(saved) {
      const dialog = document.getElementById('practiceRecoveryModal');
      const minutesLeft = Math.ceil((saved.durationSec - saved.elapsedSec) / 60);
      document.getElementById('practiceRecoveryDescription').textContent =
        `Есть незавершённая практика: осталось примерно ${minutesLeft} мин.`;
      const close = () => dialog.classList.remove('show');
      document.getElementById('practiceRecoveryResume').onclick = () => {
        restoreSavedPractice(saved);
        close();
        showToast('Практика восстановлена на паузе', 'success');
      };
      document.getElementById('practiceRecoveryDiscard').onclick = () => {
        clearSavedPractice();
        close();
        showWelcomeGoal();
      };
      dialog.classList.add('show');
      document.getElementById('practiceRecoveryResume').focus();
    }

/* ---------- Нижняя навигация ---------- */
document.querySelectorAll('.bottom-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bottom-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const screen = btn.dataset.screen;
    document.getElementById('screen-' + screen).classList.add('active');
    if (screen === 'practice') startOrbAnimation();
    else stopOrbAnimation();

    if (screen === 'profile') {
          renderStreak();
      renderProfile();
    }
    if (tg) tg.HapticFeedback?.selectionChanged();
  });
});

/* ---------- Профиль ---------- */
// Дневник и резервные копии управляются в journal-backup.js.
let profileTab = 'stats';

document.querySelectorAll('.profile-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    profileTab = tab.dataset.ptab;
    renderProfile();
    if (tg) tg.HapticFeedback?.selectionChanged();
  });
});

function renderProfile() {
  if (profileTab === 'stats') renderProfileStats();
  else if (profileTab === 'history') renderProfileHistory();
}

function renderProfileStats() {
  const totalMinutes = getTotalMeditationMinutes();
  const avgMin = sessionsCount ? Math.round(totalMinutes / sessionsCount) : 0;
  const body = document.getElementById('profileBody');
  body.innerHTML = `
    <div class="stat-summary">
      <div class="stat-card"><div class="stat-label">Всего практики</div><div class="stat-value">${totalMinutes}<span> мин</span></div></div>
      <div class="stat-card"><div class="stat-label">Медитаций</div><div class="stat-value">${sessionsCount}</div></div>
      <div class="stat-card"><div class="stat-label">В среднем</div><div class="stat-value">${avgMin}<span> мин</span></div></div>
      <div class="stat-card"><div class="stat-label">Дней подряд</div><div class="stat-value">${getVisibleStreakCount()}</div></div>
    </div>
    <p class="personal-note">Каждая минута практики имеет значение. Здесь не нужно ничего достигать.</p>`;
}
function getVisibleStreakCount() {
  if (!streak.lastDate) return 0;
  return (streak.lastDate === todayStr() || streak.lastDate === yesterdayStr()) ? streak.count : 0;
}



let historySubTab = 'sessions';
let calYear, calMonth, calSelectedDate = null;

function renderProfileHistory() {
  const body = document.getElementById('profileBody');
  body.innerHTML = `
    <div class="profile-subtabs">
      <button class="profile-subtab ${historySubTab === 'sessions' ? 'active' : ''}" data-subtab="sessions">Сессии</button>
      <button class="profile-subtab ${historySubTab === 'calendar' ? 'active' : ''}" data-subtab="calendar">Календарь</button>
    </div>
    <div id="historyContent"></div>
  `;
  body.querySelectorAll('.profile-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      historySubTab = btn.dataset.subtab;
      renderProfileHistory();
      if (tg) tg.HapticFeedback?.selectionChanged();
    });
  });
  if (historySubTab === 'sessions') renderSessionsInto(document.getElementById('historyContent'));
  else renderCalendarInto(document.getElementById('historyContent'));
}

function renderSessionsInto(target) {
  if (!target) return;
  if (!sessionLog.length) {
    target.innerHTML = `<div class="sessions-empty">Пока нет записей.<br>Заверши первую медитацию — и она появится здесь.</div>`;
    return;
  }
  const sorted = [...sessionLog].sort((a,b)=>b.ts-a.ts);
  const chakraMap = Object.fromEntries(CHAKRAS.map(c=>[c.key,c]));
  target.innerHTML = sorted.map(s => {
    const c = chakraMap[s.chakra];
    const color = c ? c.color : '#a463f2';
    const chakraName = c ? c.name : '—';
    return `<div class="session-item" style="--c:${color}">
      <div class="session-top">
        <div class="session-date">${formatRuDate(s.date)} · ${s.time}</div>
        <div class="session-mins">${s.minutes} мин</div>
      </div>
      <div class="session-chakra" style="color:${color}">
        <span class="cdot"></span>${chakraName}
      </div>
      ${s.mood ? `<div class="mood-entry">${({calm:'🌿 Спокойно',lighter:'✨ Легче',same:'🌙 Без изменений',other:'💭 По-разному'})[s.mood] || ''}</div>` : ''}
      ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
    </div>`;
  }).join('');
}

function renderCalendarInto(target) {
  if (!target) return;
  if (calYear === undefined || calMonth === undefined) {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const dow = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const firstDay = new Date(calYear, calMonth, 1);
  let firstDow = firstDay.getDay() - 1;
  if (firstDow < 0) firstDow = 6;
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today = todayStr();
  const byDate = {};
  sessionLog.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(`<div class="cal-day empty"></div>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${(calMonth+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
    const hasData = !!byDate[ds];
    const isToday = ds === today;
    const isSelected = ds === calSelectedDate;
    cells.push(`<div class="cal-day ${hasData?'has-data':''} ${isToday?'today':''} ${isSelected?'selected':''}" data-date="${ds}">
      ${d}${hasData?'<span class="cal-dot"></span>':''}
    </div>`);
  }
  let detailHtml = '';
  if (calSelectedDate && byDate[calSelectedDate]) {
    const chakraMap = Object.fromEntries(CHAKRAS.map(c=>[c.key,c]));
    const items = byDate[calSelectedDate].map(s => {
      const c = chakraMap[s.chakra];
      const color = c ? c.color : '#a463f2';
      const chakraName = c ? c.name : '—';
      return `<div class="session-item" style="--c:${color}">
        <div class="session-top">
          <div class="session-date">${s.time}</div>
          <div class="session-mins">${s.minutes} мин</div>
        </div>
        <div class="session-chakra" style="color:${color}">
          <span class="cdot"></span>${chakraName}
        </div>
        ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
      </div>`;
    }).join('');
    detailHtml = `<div class="cal-day-detail"><h3>${formatRuDate(calSelectedDate)} — ${byDate[calSelectedDate].length} сессий</h3>${items}</div>`;
  } else if (calSelectedDate) {
    detailHtml = `<div class="cal-day-detail"><h3>${formatRuDate(calSelectedDate)}</h3><div class="sessions-empty" style="padding:20px;">В этот день практик не было</div></div>`;
  }
  target.innerHTML = `
    <div class="cal-header">
      <div class="cal-title">${months[calMonth]} ${calYear}</div>
      <div class="cal-nav">
        <button data-cal-nav="-1">‹</button>
        <button data-cal-nav="1">›</button>
      </div>
    </div>
    <div class="cal-grid">
      ${dow.map(d=>`<div class="cal-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    ${detailHtml}
  `;
  target.querySelectorAll('[data-cal-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      calMonth += parseInt(btn.dataset.calNav);
      if (calMonth < 0) { calMonth = 11; calYear--; }
      if (calMonth > 11) { calMonth = 0; calYear++; }
      calSelectedDate = null;
      renderProfileHistory();
    });
  });
  target.querySelectorAll('.cal-day[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      calSelectedDate = cell.dataset.date;
      renderProfileHistory();
    });
  });
}

/* ---------- Гайд ---------- */
function openGuide(chakraKey) {
  const c = CHAKRAS.find(x => x.key === chakraKey);
  if (!c) return;
  const g = c.guide;
  const myIntents = userIntentions[chakraKey] || [];
  const body = document.getElementById('guideBody');
  body.innerHTML = `
    <div class="guide-chakra-name" style="color:${c.color}">${c.name}</div><p class="note-subtitle">Чакры здесь используются как символические темы внимания, а не как медицинская система.</p>
    <div class="guide-section">
      <h4>Где находится</h4><p>${g.location}</p>
    </div>
    <div class="guide-section">
      <h4>Традиционное значение</h4><p>${g.meaning}</p>
    </div>
    <div class="guide-section">
      <h4>Простая практика</h4><p>${getGoalForChakra(chakraKey)?.instruction || g.feel}</p>
    </div>
    <div class="guide-section">
      <h4>Мои фразы для практики</h4>
      <div class="my-intents" id="myIntentsList">
        ${myIntents.length ? myIntents.map((t, i) => `
          <div class="my-intent-item">
            <span>${escapeHtml(t)}</span>
            <button data-idx="${i}" title="Удалить">✕</button>
          </div>
        `).join('') : '<div class="intent-empty">Пока нет своих фраз. Можно добавить короткую мысль для практики.</div>'}
      </div>
      <button class="add-intent-btn" id="addIntentBtn">+ Добавить свою фразу</button>
    </div>
  `;
  document.getElementById('guideModal').classList.add('show');

  document.getElementById('addIntentBtn').addEventListener('click', () => {
    const text = prompt('Введи свою фразу для практики:');
    if (!text || !text.trim()) return;
    if (!userIntentions[chakraKey]) userIntentions[chakraKey] = [];
    userIntentions[chakraKey].push(text.trim());
    storageSet('userIntentions', JSON.stringify(userIntentions));
    resetSessionIntention(chakraKey);
    openGuide(chakraKey);
    showToast('✨ Фраза добавлена', 'success');
  });

  body.querySelectorAll('.my-intent-item button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      userIntentions[chakraKey].splice(idx, 1);
      if (!userIntentions[chakraKey].length) delete userIntentions[chakraKey];
      storageSet('userIntentions', JSON.stringify(userIntentions));
      resetSessionIntention(chakraKey);
      openGuide(chakraKey);
    });
  });
}

/* ---------- Длительность практики: барабан минут ---------- */
const MIN_TIME = 1;
const MAX_TIME = 180;
const durationWheel = document.getElementById('durationWheel');
const DURATION_WHEEL_ITEM_HEIGHT = 42;
let wheelPreviewMinutes = null;
let wheelSettleTimer = null;
let wheelSelectedOption = null;
let wheelLastHapticTime = -Infinity;
durationWheel.innerHTML = Array.from({length: 180}, (_, i) =>
  `<div class="duration-wheel-option" role="option" data-min="${i + 1}" aria-selected="false">${i + 1}</div>`
).join('');

function wheelValueFromPosition() {
  const value = Math.round(durationWheel.scrollTop / DURATION_WHEEL_ITEM_HEIGHT) + 1;
  return Math.max(MIN_TIME, Math.min(MAX_TIME, value));
}
function setWheelHighlight(minutes) {
  if (wheelSelectedOption) wheelSelectedOption.setAttribute('aria-selected','false');
  wheelPreviewMinutes = minutes;
  wheelSelectedOption = durationWheel.children[minutes - 1] || null;
  if (wheelSelectedOption) wheelSelectedOption.setAttribute('aria-selected','true');
  durationWheel.setAttribute('aria-valuetext', minutes + ' минут');
}
function syncDurationWheel(minutes) {
  clearTimeout(wheelSettleTimer);
  setWheelHighlight(minutes);
  const top = (minutes - 1) * DURATION_WHEEL_ITEM_HEIGHT;
  if (Math.abs(durationWheel.scrollTop - top) > 0.5) durationWheel.scrollTop = top;
}
function scheduleWheelCommit() {
  clearTimeout(wheelSettleTimer);
  wheelSettleTimer = setTimeout(() => {
    const chosen = wheelValueFromPosition();
    if (timerRunning) {
      syncDurationWheel(currentPresetMin);
      return;
    }
    if (chosen !== currentPresetMin) commitPracticeMinutes(chosen);
    else syncDurationWheel(currentPresetMin);
  }, 260);
}
durationWheel.addEventListener('scroll', () => {
  if (timerRunning) {
    clearTimeout(wheelSettleTimer);
    if (wheelValueFromPosition() !== currentPresetMin) syncDurationWheel(currentPresetMin);
    return;
  }
  const next = wheelValueFromPosition();
  if (next !== wheelPreviewMinutes) {
    setWheelHighlight(next);
    if (tg && performance.now() - wheelLastHapticTime > 75) {
      wheelLastHapticTime = performance.now();
      tg.HapticFeedback?.selectionChanged();
    }
  }
  scheduleWheelCommit();
}, {passive:true});
durationWheel.addEventListener('click', event => {
  const option = event.target.closest('[data-min]');
  if (!option || timerRunning) return;
  const minutes = Number(option.dataset.min);
  durationWheel.scrollTo({top:(minutes-1)*DURATION_WHEEL_ITEM_HEIGHT,behavior:'smooth'});
  scheduleWheelCommit();
});
durationWheel.addEventListener('keydown', event => {
  if (!['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) return;
  event.preventDefault();
  if (timerRunning) return;
  const offsets = {ArrowUp:-1, ArrowDown:1, PageUp:-5, PageDown:5};
  const next = event.key === 'Home' ? MIN_TIME :
    event.key === 'End' ? MAX_TIME :
    Math.max(MIN_TIME, Math.min(MAX_TIME, wheelValueFromPosition() + offsets[event.key]));
  durationWheel.scrollTop = (next - 1) * DURATION_WHEEL_ITEM_HEIGHT;
  setWheelHighlight(next);
  scheduleWheelCommit();
});

function renderPresets() {
  const value = Math.min(MAX_TIME,Math.max(MIN_TIME,currentPresetMin));
  syncDurationWheel(value);
}
function commitPracticeMinutes(min) {
  if (!Number.isInteger(min) || min < MIN_TIME || min > MAX_TIME) {
    showToast('Выбери длительность от 1 до 180 минут');
    renderPresets();
    return;
  }
  if (min === currentPresetMin) { renderPresets(); return; }
  if (!confirmTimerReset()) { renderPresets(); return; }
  currentPresetMin = min;
  storageSet('activePreset',String(min));
  resetTimer(min * 60);
  renderPresets();
}

/* ---------- Треки ---------- */
const tracksModal = document.getElementById('tracksModal');
const fileInput = document.getElementById('fileInput');
const myTracksList = document.getElementById('myTracksList');

function renderTracksModal() {
  myTracksList.innerHTML = allTracks.filter(t => t._builtin).map((t, i) => `
    <button type="button" class="track-item builtin-track ${trackIndex === i ? 'selected' : ''}" data-index="${i}" aria-pressed="${trackIndex === i}">
      <span class="name">✦ ${escapeHtml(t.title)}</span><span class="size">36 мин</span>
    </button>
    `).join('') + userTracks.map(t => `
    <div class="track-item">
      <span class="name">${escapeHtml(t.name)}</span>
      <span class="size">${formatBytes(t.blob.size)}</span>
      <button class="del" data-id="${t.id}" title="Удалить">✕</button>
    </div>
  `).join('');

  myTracksList.querySelectorAll('.builtin-track').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextIndex = Number(btn.dataset.index);
        if (nextIndex !== trackIndex) loadTrack(nextIndex, timerRunning);
        tracksModal.classList.remove('show');
      });
    });

    myTracksList.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      if (!confirm('Удалить этот трек?')) return;
      const selectedId = allTracks[trackIndex]?._id;
          const selectedSrc = allTracks[trackIndex]?.src;
      const wasBuiltin = builtinSelected();
      const deletingSelected = selectedId === id;
      if (deletingSelected) { ++playerRequest; audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load(); }
      try { await dbDeleteTrack(id); } catch(err) {
        if (deletingSelected && allTracks.length) loadTrack(trackIndex, timerRunning);
        showToast('Не удалось удалить трек'); return;
      }
      userTracks = userTracks.filter(t => t.id !== id);
      rebuildAllTracks();
      if (!allTracks.length) clearTrack();
      else if (deletingSelected) loadTrack(Math.min(trackIndex, allTracks.length-1), timerRunning);
      else {
        trackIndex = wasBuiltin ? Math.max(0, allTracks.findIndex(t => t.src === selectedSrc)) : Math.max(0, allTracks.findIndex(t => t._id === selectedId));
        updateTrackStatus();
      }
      renderTracksModal();
      showToast('Трек удалён');
    });
  });
}

document.getElementById('btnTracks').addEventListener('click', () => {
  renderTracksModal();
  tracksModal.classList.add('show');
});
document.getElementById('btnAddTrack').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|ogg|wav|flac)$/i.test(file.name)) { showToast('Можно добавлять только аудиофайлы'); continue; }
    if (file.size > 40 * 1024 * 1024) { showToast('Трек больше 40 МБ. Выбери файл поменьше'); continue; }
    try {
      const id = await dbAddTrack(file.name, file);
      userTracks.push({ id, name: file.name, blob: file, created: Date.now() });
      added++;
    } catch (err) { console.warn('Не удалось сохранить трек', err); showToast('Не удалось сохранить аудио: проверь свободное место'); }
  }
  if (added > 0) {
    rebuildAllTracks();
    if (allTracks.length === 1 + added) loadTrack(0, false);
    updateTrackStatus();
    renderTracksModal();
    showToast(`✨ Добавлено треков: ${added}`, 'success');
  }
  fileInput.value = '';
});

/* ---------- Серия медитаций: автоматически после завершения практики ---------- */
function creditMeditationDay() {
  const today = todayStr();
  if (streak.lastDate === today) return false;
  streak.count = streak.lastDate === yesterdayStr() ? (Number(streak.count) || 0) + 1 : 1;
  streak.lastDate = today;
  storageSet('streak', JSON.stringify(streak));
  return true;
}
function renderStreak() {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const active = streak.lastDate === today || streak.lastDate === yesterday;
  const count = active ? (Number(streak.count) || 0) : 0;
  document.getElementById('streakNum').textContent = count;
  const doneToday = streak.lastDate === today || sessionLog.some(s => s.date === today);
  document.getElementById('streakStatus').textContent = doneToday
    ? '✨ Сегодня уже засчитано! Возвращайся завтра, чтобы продолжить серию.'
    : count ? '🔥 Заверши одну медитацию сегодня, чтобы сохранить серию.'
    : '🌱 Заверши любую медитацию — и твоя серия начнётся!';
  const completedDates = new Set(sessionLog.map(s => s.date));
  if (streak.lastDate) completedDates.add(streak.lastDate);
  const labels = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const now = new Date(); now.setHours(12,0,0,0);
  const parts = [];
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(now); day.setDate(now.getDate() - offset);
    const date = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    const done = completedDates.has(date);
    parts.push(`<div class="streak-day${done?' done':''}${!offset?' today':''}" title="${date}">
      <span class="streak-day-label">${labels[day.getDay()]}</span><span class="streak-day-dot">${done?'✓':'·'}</span></div>`);
  }
  document.getElementById('streakWeek').innerHTML = parts.join('');
}

/* ---------- Личные темы медитации ---------- */
const MEDITATION_GOALS = [
  {key:'calm', chakra:'muladhara', icon:'🌿', title:'Успокоиться', subtitle:'Ощутить опору', instruction:'Устройся удобно. Заметь, где тело соприкасается с сиденьем или полом. Дыши естественно, возвращаясь вниманием к этим ощущениям.'},
  {key:'feel', chakra:'svadhisthana', icon:'💧', title:'Понять чувства', subtitle:'Быть внимательнее к себе', instruction:'Обрати внимание на ощущения в теле и настроение. Не нужно искать причину или исправлять эмоцию — достаточно замечать, что сейчас есть.'},
  {key:'confidence', chakra:'manipura', icon:'☀️', title:'Найти уверенность', subtitle:'Собраться с силами', instruction:'Почувствуй спокойный ритм дыхания. На выдохе мягко расслабляй плечи и живот. Вспомни, что можно двигаться к важному маленькими шагами.'},
  {key:'kind', chakra:'anahata', icon:'💚', title:'Быть добрее к себе', subtitle:'Снизить самокритику', instruction:'Заметь, как ты себя чувствуешь. Попробуй отнестись к этому состоянию так же бережно, как к переживаниям близкого человека.'},
  {key:'voice', chakra:'vishuddha', icon:'🗣️', title:'Услышать себя', subtitle:'Понять свои потребности', instruction:'Несколько дыханий посвяти наблюдению за собой. Спроси себя: «Что мне сейчас нужно?» Не торопись отвечать и ничего не требуй от себя.'},
  {key:'clarity', chakra:'ajna', icon:'🔮', title:'Прояснить мысли', subtitle:'Уменьшить мысленный шум', instruction:'Наблюдай за возникающими мыслями словно со стороны. Замечай их и мягко возвращай внимание к дыханию, не стараясь остановить мышление.'},
  {key:'presence', chakra:'sahasrara', icon:'✨', title:'Просто побыть', subtitle:'Без цели и ожиданий', instruction:'Позволь вниманию свободно замечать дыхание, звуки и ощущения. Не нужно достигать особого состояния — просто побудь здесь несколько минут.'}
];
let selectedGoal = 'calm';
const practiceTip = document.getElementById('practiceTip');
const welcomeGoalGrid = document.getElementById('welcomeGoalGrid');
const welcomeGoalModal = document.getElementById('welcomeGoalModal');
const welcomeGoalKeep = document.getElementById('welcomeGoalKeep');

function renderGoals() {
  const markup = MEDITATION_GOALS.map(g =>
    `<button type="button" class="goal-option" data-goal="${g.key}" aria-pressed="${g.key === selectedGoal}"><strong>${g.icon} ${g.title}</strong><small>${g.subtitle}</small></button>`
  ).join('');
  welcomeGoalGrid.innerHTML = markup;
}
function getGoalForChakra(key) { return MEDITATION_GOALS.find(g => g.chakra === key); }
function selectMeditationGoal(key) {
  const goal = MEDITATION_GOALS.find(g => g.key === key);
  if (!goal) return false;
  if (selectedGoal === goal.key && currentChakra === goal.chakra) return true;
  if (!confirmTimerReset()) return false;
  selectedGoal = goal.key;
  currentChakra = goal.chakra;
  storageSet('activeChakra',currentChakra);
  resetTimer(currentPresetMin * 60);
  updateChakraUI();
  if (tg) tg.HapticFeedback?.selectionChanged();
  return true;
}
let goalSelectionFromStartup = false;
function closeGoalWelcome() {
  welcomeGoalModal.classList.remove('show');
  document.body.style.overflow = '';
  if (goalSelectionFromStartup) {
    goalSelectionFromStartup = false;
    showWelcomeThought();
  } else {
    document.getElementById('changeChakraBtn').focus({preventScroll:true});
  }
}
welcomeGoalGrid.addEventListener('click', event => {
  const option = event.target.closest('[data-goal]');
  if (!option || !selectMeditationGoal(option.dataset.goal)) return;
  closeGoalWelcome();
});
welcomeGoalKeep.addEventListener('click', closeGoalWelcome);
function openGoalSelection(fromStartup = false) {
  goalSelectionFromStartup = fromStartup;
  renderGoals();
  welcomeGoalKeep.textContent = fromStartup
    ? 'Продолжить с прежним настроем'
    : 'Оставить текущую чакру';
  welcomeGoalModal.classList.add('show');
  document.body.style.overflow = 'hidden';
  welcomeGoalGrid.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
}
function showWelcomeGoal() {
  openGoalSelection(true);
}
document.getElementById('changeChakraBtn').addEventListener('click', () =>
  openGoalSelection(false));
welcomeGoalModal.addEventListener('click', event => {
  if (event.target === welcomeGoalModal) closeGoalWelcome();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && welcomeGoalModal.classList.contains('show')) {
    event.preventDefault();
    closeGoalWelcome();
  }
});

/* ---------- Информация о выбранной теме ---------- */
const chakraName = document.getElementById('chakraName');
const chakraDesc = document.getElementById('chakraDesc');
function updateChakraUI() {
  const c = CHAKRAS.find(x=>x.key===currentChakra) || CHAKRAS[0];
  chakraName.textContent = c.name;
  chakraName.style.color = c.color;
  const goal = getGoalForChakra(currentChakra);
  chakraDesc.textContent = goal ? `Тема: ${goal.title.toLowerCase()} · ${c.name}` : c.desc;
  practiceTip.innerHTML = goal ? `<b>Как практиковать</b>${goal.instruction}` : '';
  renderGoals();
  applyAccent(c.color);
  lastHintState = null;
  if (profileTab === 'stats') renderProfileStats();
}

/* ---------- Мысль при каждом запуске приложения ---------- */
const welcomeThoughtModal = document.getElementById('welcomeThoughtModal');
const welcomeThoughtText = document.getElementById('welcomeThoughtText');
const welcomeThoughtClose = document.getElementById('welcomeThoughtClose');
function showWelcomeThought() {
  const pool = [...new Set(CHAKRAS.flatMap(c => getCombinedIntentions(c.key)).filter(Boolean))];
  let last = null;
  try { last = localStorage.getItem('meditation_last_welcome_thought'); } catch(e) {}
  const candidates = pool.filter(text => text !== last);
  const chosen = pickRandom(candidates.length ? candidates : pool);
  welcomeThoughtText.textContent = chosen;
  try { localStorage.setItem('meditation_last_welcome_thought', chosen); } catch(e) {}
  welcomeThoughtModal.classList.add('show');
  document.body.style.overflow = 'hidden';
  welcomeThoughtClose.focus({preventScroll:true});
}
welcomeThoughtClose.addEventListener('click', () => {
  welcomeThoughtModal.classList.remove('show');
  document.body.style.overflow = '';
});
document.getElementById('chakraNameWrap').addEventListener('click', () => openGuide(currentChakra));

/* ---------- Инициализация ---------- */
(async () => {

  const [streakVal, cpVal, acVal, arVal, apVal, sessVal, logVal, pmVal, uiVal, urVal, chimeVal] = await Promise.all([
    storageGetP('streak'),
    storageGetP('chakraProgress'),
    storageGetP('activeChakra'),
    storageGetP('activeRhythm'),
    storageGetP('activePreset'),
    storageGetP('sessionsCount'),
    loadSessionLog(),
    storageGetP('practiceMode'),
    storageGetP('userIntentions'),
    storageGetP('userRhythms'),
    storageGetP('scanChime')
  ]);

  if (streakVal) { try { streak = JSON.parse(streakVal); } catch(e){} }
  if (cpVal) { try { chakraProgress = JSON.parse(cpVal); } catch(e){} }
  if (sessVal) sessionsCount = parseInt(sessVal) || 0;
  if (Array.isArray(logVal)) sessionLog = logVal;
  if (uiVal) { try { userIntentions = JSON.parse(uiVal) || {}; } catch(e){} }
  if (urVal) { try { userRhythms = JSON.parse(urVal) || []; } catch(e){} }
  if (pmVal === 'scan' || pmVal === 'breath') practiceMode = pmVal;
  scanChimeEnabled = chimeVal === '1';
  if (apVal) {
    const n = parseInt(apVal);
    if (n >= MIN_TIME && n <= MAX_TIME) currentPresetMin = n;
  }

  rebuildAllRhythms();
  if (arVal) {
    const r = allRhythms.find(x => x.key === arVal);
    if (r) currentRhythm = r;
  }

  try {
    const stored = await dbGetAllTracks();
    userTracks = stored || [];
  } catch (e) {
    console.warn('IndexedDB недоступен', e);
    userTracks = [];
  }
  rebuildAllTracks();

  currentChakra = findCurrentUnlocked(acVal, chakraProgress);
  selectedGoal = getGoalForChakra(currentChakra)?.key || 'calm';


  renderPresets();
  resetTimer(currentPresetMin * 60, true);
  renderStreak();
  updateChakraUI();
  renderProfile();

  if (allTracks.length) loadTrack(0, false);
    else updateTrackStatus();
    if (journalNeedsCloudSync) saveSessionLog();
    const recovery = readSavedPractice();
    if (recovery) offerPracticeRecovery(recovery);
    else showWelcomeGoal();
})();


// Start the visualizer after every state variable and handler is initialized.
startOrbAnimation();
