/* ---------- Простое сохранение и восстановление дневника ---------- */
// Данные не отправляются на внешний сервер. Для Telegram с ограниченным
// WebView предусмотрены копирование и восстановление из текста заметки.
const journalExportModal = document.getElementById('journalExportModal');
const journalExportText = document.getElementById('journalExportText');
const journalExportShare = document.getElementById('journalExportShare');
const journalExportCopy = document.getElementById('journalExportCopy');
const journalExportDownload = document.getElementById('journalExportDownload');
const journalExportStatus = document.getElementById('journalExportStatus');
const journalImportModal = document.getElementById('journalImportModal');
const journalImportFile = document.getElementById('journalImportFile');
const journalImportText = document.getElementById('journalImportText');
const journalImportStatus = document.getElementById('journalImportStatus');
const journalImportPreview = document.getElementById('journalImportPreview');
const journalImportConfirm = document.getElementById('journalImportConfirm');
let journalExportFilename = '';
let pendingJournalImport = null;
const MAX_JOURNAL_BACKUP_BYTES = 8 * 1024 * 1024;
const MAX_JOURNAL_BACKUP_ENTRIES = 20000;

function createJournalBackup() {
  return JSON.stringify({
    format: 'meditation-journal', version: 1,
    exportedAt: new Date().toISOString(),
    sessions: sessionLog, streak, sessionsCount, chakraProgress
  }, null, 2);
}
function journalFileFromText() {
  return new File([journalExportText.value], journalExportFilename,
    { type:'application/json' });
}
function journalExportMessage(message) {
  journalExportStatus.textContent = message;
}
function selectJournalBackup() {
  journalExportText.focus();
  journalExportText.select();
  journalExportText.setSelectionRange(0, journalExportText.value.length);
}
function validJournalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] &&
    date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}
function validateJournalEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('Некорректная запись');
  const id = entry.id;
  if (!(Number.isSafeInteger(id) && id > 0) &&
      !(typeof id === 'string' && /^[A-Za-z0-9:_-]{1,80}$/.test(id))) {
    throw Error('В одной из записей отсутствует идентификатор');
  }
  const ts = Number(entry.ts);
  if (!Number.isSafeInteger(ts) || ts <= 0 || ts > Date.now() + 365 * 86400000) {
    throw Error('Некорректная дата записи');
  }
  if (!validJournalDate(entry.date) ||
      new Date(entry.date + 'T12:00:00Z').getTime() > Date.now() + 365 * 86400000) {
    throw Error('Некорректный день медитации');
  }
  const minutes = Number(entry.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    throw Error('Некорректная длительность медитации');
  }
  if (!CHAKRAS.some(chakra => chakra.key === entry.chakra)) {
    throw Error('Неизвестный тип записи');
  }
  const time = entry.time === undefined ? '00:00' : entry.time;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw Error('Некорректное время записи');
  }
  const note = entry.note === undefined ? '' : entry.note;
  if (typeof note !== 'string' || note.length > 3000) {
    throw Error('Некорректный текст записи');
  }
  const mood = entry.mood || '';
  if (!['','calm','lighter','same','other'].includes(mood)) {
    throw Error('Некорректное настроение');
  }
  const mode = entry.mode === undefined ? 'breath' : entry.mode;
  if (!['breath','scan'].includes(mode)) throw Error('Некорректный тип медитации');
  const updatedAt = entry.updatedAt === undefined ? ts : Number(entry.updatedAt);
  if (!Number.isSafeInteger(updatedAt) || updatedAt <= 0) throw Error('Некорректная дата изменения');
  return { id, ts, date:entry.date, time, chakra:entry.chakra, minutes, note,
    mood, mode, updatedAt };
}
function readJournalBackup(sourceText) {
  if (typeof sourceText !== 'string' || !sourceText.trim() ||
      new Blob([sourceText]).size > MAX_JOURNAL_BACKUP_BYTES) {
    throw Error('Файл пустой или слишком большой (до 8 МБ)');
  }
  let data;
  try { data = JSON.parse(sourceText); } catch (_) {
    throw Error('Файл не распознан. Выбери копию, сохранённую в этом приложении');
  }
  if (!data || data.format !== 'meditation-journal' || data.version !== 1 ||
      !Array.isArray(data.sessions)) {
    throw Error('Это не резервная копия дневника медитаций');
  }
  if (data.sessions.length > MAX_JOURNAL_BACKUP_ENTRIES) {
    throw Error('Слишком много записей в одном файле');
  }
  // Validate everything first; never partially restore corrupt records.
  const sessions = mergeSessionLogs(data.sessions.map(validateJournalEntry));
  let importedStreak = null;
  if (data.streak && typeof data.streak === 'object') {
    const count = Number(data.streak.count);
    const lastDate = data.streak.lastDate;
    if (Number.isInteger(count) && count >= 0 && count <= MAX_JOURNAL_BACKUP_ENTRIES &&
        (lastDate === null || (validJournalDate(lastDate) && lastDate <= todayStr()))) {
      importedStreak = {count, lastDate};
    }
  }
  const totals = {};
  if (data.chakraProgress && typeof data.chakraProgress === 'object' &&
      !Array.isArray(data.chakraProgress)) {
    for (const chakra of CHAKRAS) {
      const n = Number(data.chakraProgress[chakra.key]);
      if (Number.isSafeInteger(n) && n >= 0 && n <= 10000000) totals[chakra.key] = n;
    }
  }
  const count = Number(data.sessionsCount);
  return {sessions, importedStreak, totals,
    importedCount:Number.isSafeInteger(count) && count >= 0 ? count : sessions.length};
}
function journalPreviewStats(backup) {
  const existing = new Map(sessionLog.map(entry => [String(entry.id),entry]));
  const merged = mergeSessionLogs(sessionLog, backup.sessions);
  const additions = backup.sessions.filter(item => !existing.has(String(item.id))).length;
  const previousById = new Map(sessionLog.map(item => [String(item.id),item]));
  const changed = merged.filter(item => {
    const previous = previousById.get(String(item.id));
    return previous && (previous.note || '') !== (item.note || '') ||
      (previous && (previous.mood || '') !== (item.mood || ''));
  }).length;
  return {merged, additions, changed};
}
function saveJournalNativeFile() {
  const file = journalFileFromText();
  // Must be invoked synchronously inside a real user click.
  const promise = navigator.share({files:[file],title:'Мой дневник медитаций'});
  Promise.resolve(promise).then(
    () => journalExportMessage('Меню сохранения закрыто. Проверь выбранное приложение или папку «Файлы».'),
    error => {
      if (error?.name === 'AbortError') {
        journalExportMessage('Сохранение отменено. Твои записи остались в приложении.');
      } else {
        document.getElementById('journalExportAdvanced').open = true;
        journalExportCopy.hidden = false;
        journalExportMessage('Не удалось открыть сохранение. Используй запасной способ ниже.');
      }
    });
}
document.getElementById('exportJournalBtn').addEventListener('click', () => {
  try {
    journalExportFilename = 'meditation-journal-' + todayStr() + '.json';
    journalExportText.value = createJournalBackup();
    journalExportMessage('');
    let nativeSupported = false;
    try {
      nativeSupported = typeof File === 'function' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({files:[journalFileFromText()]});
    } catch(error) { console.warn('Journal native share:',error); }
    journalExportShare.hidden = !nativeSupported;
    journalExportDownload.hidden = !!tg;
    journalExportCopy.hidden = nativeSupported || !tg;
    document.getElementById('journalExportHelp').textContent = nativeSupported
      ? 'Выбери, куда сохранить копию дневника. Позже этот же файл можно восстановить.'
      : tg
        ? 'На этом телефоне Telegram не разрешает сохранять файл напрямую. Воспользуйся запасным способом ниже — затем дневник можно восстановить из заметок.'
        : 'Сохрани файл на устройство. Позже выбери его через «Восстановить дневник».';
    document.getElementById('journalExportAdvanced').open = !nativeSupported && !!tg;
    journalExportModal.classList.add('show');
    (nativeSupported ? journalExportShare :
      tg ? journalExportCopy : journalExportDownload).focus();
  } catch(error) {
    console.warn('Journal export:',error);
    showToast('Не удалось подготовить копию дневника');
  }
});
journalExportShare.addEventListener('click', () => {
  try { saveJournalNativeFile(); }
  catch(error) {
    console.warn('Journal native share:',error);
    journalExportMessage('Не удалось открыть сохранение. Используй запасной способ ниже.');
    document.getElementById('journalExportAdvanced').open = true;
    journalExportCopy.hidden = false;
  }
});
journalExportCopy.addEventListener('click', async () => {
  selectJournalBackup();
  let copied = false;
  try { copied = !!document.execCommand?.('copy'); } catch(error) {
    console.warn('Journal clipboard:',error);
  }
  if (!copied && navigator.clipboard?.writeText) {
    journalExportMessage('Копирование…');
    try {
      await navigator.clipboard.writeText(journalExportText.value);
      copied = true;
    } catch(error) { console.warn('Journal clipboard:',error); }
  }
  if (copied) {
    journalExportMessage('Скопировано. Открой «Заметки», создай заметку и нажми «Вставить». Потом сможешь восстановить её здесь.');
  } else {
    selectJournalBackup();
    journalExportMessage('Текст выделен. Удерживай его и нажми «Копировать», затем вставь в «Заметки».');
  }
});
document.getElementById('journalExportSelect').addEventListener('click', () => {
  selectJournalBackup();
  journalExportMessage('Текст выделен. Выбери «Копировать» в системном меню.');
});
journalExportDownload.addEventListener('click', () => {
  let url = null;
  try {
    const blob = new Blob([journalExportText.value],{type:'application/json;charset=utf-8'});
    url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = journalExportFilename;
    link.href = url;
    document.body.appendChild(link);
    link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    journalExportMessage('Проверь папку загрузок. Если файл не появился, используй запасной способ.');
  } catch(error) {
    if (url) URL.revokeObjectURL(url);
    journalExportMessage('Не получилось скачать файл. Попробуй запасной способ.');
  }
});
function resetJournalImportDialog() {
  pendingJournalImport = null;
  journalImportStatus.textContent = '';
  journalImportPreview.textContent = '';
  journalImportPreview.hidden = true;
  journalImportConfirm.hidden = true;
  journalImportFile.value = '';
  journalImportText.value = '';
  document.getElementById('journalImportAdvanced').open = false;
}
document.getElementById('importJournalBtn').addEventListener('click', () => {
  resetJournalImportDialog();
  journalImportModal.classList.add('show');
  document.getElementById('journalImportChoose').focus();
});
document.getElementById('journalImportChoose').addEventListener('click', () => journalImportFile.click());
function previewJournalImport(sourceText) {
  pendingJournalImport = null;
  journalImportConfirm.hidden = true;
  journalImportPreview.hidden = true;
  try {
    const parsed = readJournalBackup(sourceText);
    const preview = journalPreviewStats(parsed);
    pendingJournalImport = parsed;
    journalImportPreview.textContent = 'Найдено медитаций: ' + parsed.sessions.length +
      '. Новых записей: ' + preview.additions +
      (preview.changed ? '. Обновлённых заметок: ' + preview.changed : '') +
      '. Твои текущие записи сохранятся.';
    journalImportPreview.hidden = false;
    journalImportStatus.textContent = 'Проверь количество записей и подтверди восстановление.';
    journalImportConfirm.textContent = preview.additions || preview.changed
      ? 'Восстановить записи' : 'Объединить данные дневника';
    journalImportConfirm.hidden = false;
  } catch(error) {
    journalImportStatus.textContent = error.message || 'Не удалось прочитать копию дневника';
  }
}
function readJournalFile(file) {
  if (!file || file.size > MAX_JOURNAL_BACKUP_BYTES || !file.size) {
    return Promise.reject(Error('Файл пустой или больше 8 МБ'));
  }
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(Error('Не удалось открыть файл'));
    reader.readAsText(file,'utf-8');
  });
}
journalImportFile.addEventListener('change', async () => {
  const file = journalImportFile.files?.[0];
  if (!file) return;
  journalImportStatus.textContent = 'Проверяем файл…';
  try {
    previewJournalImport(await readJournalFile(file));
  } catch(error) {
    pendingJournalImport = null;
    journalImportConfirm.hidden = true;
    journalImportStatus.textContent = error.message || 'Не удалось открыть файл';
  }
  journalImportFile.value = '';
});
document.getElementById('journalImportCheckText').addEventListener('click', () => {
  previewJournalImport(journalImportText.value);
});
function updateJournalStreak(importedStreak) {
  // Prefer real dated sessions when available, but keep legacy streak data
  // for records that may have been omitted from older backups.
  const completedDates = new Set(sessionLog.map(entry => entry.date));
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (importedStreak?.lastDate) completedDates.add(importedStreak.lastDate);
  if (streak.lastDate) completedDates.add(streak.lastDate);
  const best = [...completedDates].filter(date => date <= today).sort().at(-1) || null;
  if (!best) return;
  if (best !== today && best !== yesterday) {
    // Inactive streaks stay inactive; history is retained.
    if (!streak.lastDate || streak.lastDate < best) streak = {lastDate:best,count:1};
    return;
  }
  let count = 0;
  const cursor = new Date(best + 'T12:00:00');
  while (count <= MAX_JOURNAL_BACKUP_ENTRIES) {
    const date = cursor.getFullYear() + '-' + String(cursor.getMonth()+1).padStart(2,'0') +
      '-' + String(cursor.getDate()).padStart(2,'0');
    if (!completedDates.has(date)) break;
    count++;
    cursor.setDate(cursor.getDate()-1);
  }
  if (streak.lastDate === best) count = Math.max(count,Number(streak.count)||0);
  if (importedStreak?.lastDate === best) count = Math.max(count,importedStreak.count);
  streak = {lastDate:best,count};
}
journalImportConfirm.addEventListener('click', () => {
  if (!pendingJournalImport) return;
  const archive = pendingJournalImport;
  const preview = journalPreviewStats(archive);
  // A failed local write must not change in-memory history or statistics.
  try { localStorage.setItem('sessionLog',JSON.stringify(preview.merged)); }
  catch(error) {
    journalImportStatus.textContent = 'Недостаточно памяти устройства. Записи не изменены.';
    return;
  }
  sessionLog = preview.merged;
  const fromHistory = {};
  for (const entry of sessionLog) {
    fromHistory[entry.chakra] = (fromHistory[entry.chakra] || 0) + entry.minutes;
  }
  for (const chakra of CHAKRAS) {
    const key = chakra.key;
    chakraProgress[key] = Math.max(0,Number(chakraProgress[key])||0,
      Number(archive.totals[key])||0,fromHistory[key]||0);
  }
  sessionsCount = Math.max(sessionsCount,archive.importedCount,sessionLog.length);
  updateJournalStreak(archive.importedStreak);
  saveSessionLog();
  storageSet('chakraProgress',JSON.stringify(chakraProgress));
  storageSet('sessionsCount',String(sessionsCount));
  storageSet('streak',JSON.stringify(streak));
  renderStreak();
  renderProfile();
  pendingJournalImport = null;
  journalImportConfirm.hidden = true;
  journalImportStatus.textContent = 'Восстановлено: новых записей — ' + preview.additions +
    (preview.changed ? ', обновлённых заметок — ' + preview.changed : '') +
    '. Все прежние записи сохранены.';
  showToast('Дневник восстановлен 🌿','success');
});
