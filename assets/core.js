/* ---------- Telegram ---------- */
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

/* ---------- Хранилище ---------- */
function storageGet(key, cb) {
  if (tg?.CloudStorage) {
    tg.CloudStorage.getItem(key, (err, val) => {
      if (err || val === undefined || val === null || val === '') {
        let local = null; try { local = localStorage.getItem(key); } catch(e) {}
        cb(local);
      }
      else cb(val);
    });
  } else cb(localStorage.getItem(key));
}
function storageSet(key, val) {
  // Always retain a local fallback if Telegram cloud storage is unavailable.
  try { localStorage.setItem(key, val); } catch (e) { console.warn('Local storage:', e); }
  if (tg?.CloudStorage) tg.CloudStorage.setItem(key, val, err => {
    if (err) { console.warn('Cloud storage:', key, err); showToast('Не удалось синхронизировать данные с Telegram'); }
  });
}

// A Telegram CloudStorage value is limited to 4096 bytes. Store the journal in
// small UTF-8-safe batches and write the count last, as a commit marker.
const SESSION_CHUNK_SIZE = 2800;
let sessionSaveQueue = Promise.resolve();
let sessionCloudSlot = 'b';
let journalNeedsCloudSync = false;

function parseJournal(raw) {
  if (!raw) return [];
  try {
    const entries = JSON.parse(raw);
    return Array.isArray(entries) ? entries : [];
  } catch (e) {
    console.warn('Invalid journal backup', e);
    return [];
  }
}

function mergeSessionLogs(...sources) {
  const byId = new Map();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (!item || typeof item !== 'object' || !item.id || !Number.isFinite(Number(item.ts))) continue;
      const key = String(item.id);
      const prior = byId.get(key);
      if (!prior) { byId.set(key, item); continue; }
      const priorUpdated = Number(prior.updatedAt) || Number(prior.ts) || 0;
      const itemUpdated = Number(item.updatedAt) || Number(item.ts) || 0;
      const richness = record => (record.note ? 2 : 0) + (record.mood ? 1 : 0);
      // Newer edits win even if the user intentionally erased a note.
      // Legacy copies without updatedAt use the original session time;
      // on an equal timestamp retain the version with more information.
      if (itemUpdated > priorUpdated || (itemUpdated === priorUpdated && richness(item) > richness(prior))) {
        byId.set(key, item);
      }
    }
  }
  return [...byId.values()].sort((a,b) => Number(a.ts)-Number(b.ts));
}
function cloudSetP(key, val) {
  return new Promise((resolve, reject) => {
    tg.CloudStorage.setItem(key, val, err => err ? reject(err) : resolve());
  });
}
function chunkSessions(entries) {
  const chunks = []; let current = [];
  for (const entry of entries) {
    const candidate = JSON.stringify([...current, entry]);
    if (new TextEncoder().encode(candidate).length > SESSION_CHUNK_SIZE && current.length) {
      chunks.push(JSON.stringify(current)); current = [entry];
    } else current.push(entry);
  }
  if (current.length) chunks.push(JSON.stringify(current));
  return chunks;
}
function saveSessionLog() {
  const snapshot = JSON.stringify(sessionLog);
  try { localStorage.setItem('sessionLog', snapshot); }
  catch(e) { console.warn('Journal local backup:', e); showToast('Не удалось сохранить историю на устройстве'); }
  if (!tg?.CloudStorage) return;
  sessionSaveQueue = sessionSaveQueue.catch(() => {}).then(async () => {
    const chunks = chunkSessions(JSON.parse(snapshot));
    // No silent trimming: cloud limits may be reached, but local data
    // remains intact and the last complete cloud snapshot stays valid.
    if (chunks.length > 400) throw Error('Telegram CloudStorage journal capacity reached');
    const version = sessionCloudSlot === 'a' ? 'b' : 'a';
    for (let i = 0; i < chunks.length; i++) await cloudSetP(`log_${version}_${i}`, chunks[i]);
    await cloudSetP('sessionLogManifest', JSON.stringify({version, count:chunks.length}));
    sessionCloudSlot = version;
  }).catch(e => { console.warn('Journal cloud sync failed', e); showToast('История сохранена локально, но не синхронизирована'); });
}
async function loadSessionLog() {
  const local = parseJournal((() => { try { return localStorage.getItem('sessionLog'); } catch(e) { return null; } })());
  const legacy = parseJournal(await storageGetP('sessionLog'));
  const manifestRaw = await storageGetP('sessionLogManifest');
  let cloud = [];
  if (manifestRaw && tg?.CloudStorage) {
    try {
      const manifest = JSON.parse(manifestRaw);
      if (!Number.isInteger(manifest.count) || manifest.count < 0 || manifest.count > 400 ||
          !/^[ab]$/.test(manifest.version)) throw Error('Invalid journal manifest');
      sessionCloudSlot = manifest.version;
      const batches = await Promise.all(
        Array.from({length: manifest.count}, (_, i) => storageGetP(`log_${manifest.version}_${i}`))
      );
      if (batches.some(x => !x)) throw Error('Missing journal chunk');
      cloud = batches.flatMap(x => {
        const entries = JSON.parse(x);
        if (!Array.isArray(entries)) throw Error('Invalid journal chunk');
        return entries;
      });
    } catch(e) {
      console.warn('Cloud journal recovery failed; preserving available local records', e);
      // Never overwrite an unreadable cloud snapshot automatically.
      return mergeSessionLogs(legacy, local);
    }
  }
  // Sources are ordered from cloud to local; edit timestamps and
  // richer legacy notes determine which duplicate is retained.
  const merged = mergeSessionLogs(cloud, legacy, local);
  journalNeedsCloudSync = !!tg?.CloudStorage && merged.length > 0 &&
    JSON.stringify(merged) !== JSON.stringify(cloud);
  try { localStorage.setItem('sessionLog', JSON.stringify(merged)); }
  catch(e) { console.warn('Local journal restore:', e); }
  return merged;
}
function storageGetP(key) {
  return new Promise(resolve => storageGet(key, resolve));
}

/* ---------- IndexedDB ---------- */
const DB_NAME = 'meditation-app';
const DB_VERSION = 1;
const STORE_TRACKS = 'userTracks';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAddTrack(name, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const req = tx.objectStore(STORE_TRACKS).add({ name, blob, created: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGetAllTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readonly');
    const req = tx.objectStore(STORE_TRACKS).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbDeleteTrack(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const req = tx.objectStore(STORE_TRACKS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Чакры ---------- */
const CHAKRAS = [
  { key:'muladhara', name:'Муладхара', desc:'Заземление · Безопасность · Выживание', color:'#E53935',
    guide:{ location:'Основание позвоночника, область промежности.',
      meaning:'Первая чакра. Отвечает за базовое чувство безопасности, выживание, ощущение опоры.',
      feel:'Сядь удобно, стопы на полу. Представь тёплый красный свет в основании тела. Мягко произнеси: «Я в безопасности».' } },
  { key:'svadhisthana', name:'Свадхистана', desc:'Эмоции · Творчество · Чувственность', color:'#FF8906',
    guide:{ location:'Ниже пупка, в области таза.',
      meaning:'Вторая чакра. Центр эмоций, творчества, удовольствия и потока.',
      feel:'Положи ладонь на низ живота. Представь тёплую воду, которая мягко течёт внутри.' } },
  { key:'manipura', name:'Манипура', desc:'Воля · Уверенность · Внутренняя сила', color:'#F0B429',
    guide:{ location:'Солнечное сплетение, между пупком и грудиной.',
      meaning:'Третья чакра. Центр воли, уверенности, личной силы и действия.',
      feel:'Положи ладонь на солнечное сплетение. Почувствуй тёплый огонь. Скажи себе: «Я могу. Я выбираю».' } },
  { key:'anahata', name:'Анахата', desc:'Любовь · Сострадание · Принятие', color:'#2CB67D',
    guide:{ location:'Центр груди, на уровне сердца.',
      meaning:'Четвёртая чакра — мост между земными и духовными. Центр любви и сострадания.',
      feel:'Положи ладонь на сердце. Почувствуй, как зелёный свет расширяется из груди.' } },
  { key:'vishuddha', name:'Вишудха', desc:'Общение · Истина · Самовыражение', color:'#3DA9FC',
    guide:{ location:'Область горла, у основания шеи.',
      meaning:'Пятая чакра. Центр голоса, самовыражения, честности и истины.',
      feel:'Мягко направь внимание в горло. Почувствуй вибрацию — как будто внутри течёт голубой ручей.' } },
  { key:'ajna', name:'Аджна', desc:'Интуиция · Ясность · Мудрость', color:'#5B5BFF',
    guide:{ location:'Между бровями, чуть выше переносицы.',
      meaning:'Шестая чакра — «третий глаз». Центр интуиции, внутреннего зрения, ясности ума.',
      feel:'Направь внимание в точку между бровями. Представь индиговый свет, который раскрывается изнутри.' } },
  { key:'sahasrara', name:'Сахасрара', desc:'Духовность · Единство · Связь с высшим', color:'#A463F2',
    guide:{ location:'На макушке, чуть выше головы.',
      meaning:'Седьмая чакра. Центр единства, связи с чем-то большим, чистого сознания.',
      feel:'Почувствуй пространство над головой. Представь фиолетовый свет, раскрывающийся как тысячелепестковый лотос.' } }
];
let currentChakra = 'muladhara';

/* ---------- Треки ---------- */
let userTracks = [];
let allTracks = [];
let trackIndex = 0;

const trackUrls = new Map();
function rebuildAllTracks() {
  const ids = new Set(userTracks.map(t => t.id));
  for (const [id, url] of trackUrls) {
    if (!ids.has(id)) { URL.revokeObjectURL(url); trackUrls.delete(id); }
  }
  allTracks = [
        {title:'Спокойствие · фортепиано', src:'assets/peace-of-mind.mp3', _builtin:true},
        ...userTracks.map(t => {
    if (!trackUrls.has(t.id)) trackUrls.set(t.id, URL.createObjectURL(t.blob));
    return {title:t.name, src:trackUrls.get(t.id), _user:true, _id:t.id};
  })];
}

/* ---------- Ритмы ---------- */
const BUILTIN_RHYTHMS = [
  { key:'4-4',   label:'4-4',   phases:[{name:'inhale',dur:4},{name:'exhale',dur:4}] },
  { key:'4-7-8', label:'4-7-8', phases:[{name:'inhale',dur:4},{name:'hold',dur:7},{name:'exhale',dur:8}] },
  { key:'6-6',   label:'6-6',   phases:[{name:'inhale',dur:6},{name:'exhale',dur:6}] },
  { key:'box',   label:'Квадрат', phases:[{name:'inhale',dur:4},{name:'hold',dur:4},{name:'exhale',dur:4},{name:'holdEmpty',dur:4}] }
];
let userRhythms = [];
let allRhythms = [];
let currentRhythm = BUILTIN_RHYTHMS[0];

function rebuildAllRhythms() {
  allRhythms = [...BUILTIN_RHYTHMS, ...userRhythms];
}

/* ---------- Скан тела ---------- */
let scanChimeEnabled = false;
let scanAudibleStep = -1;
let scanChimeContext = null;
function armScanChime() {
  if (!scanChimeEnabled) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try {
    if (!scanChimeContext) scanChimeContext = new Context();
    if (scanChimeContext.state === 'suspended') {
      void scanChimeContext.resume().catch(() => {});
    }
  } catch(e) { console.warn('Chime unavailable:',e); }
}
function playScanChime() {
  if (!scanChimeEnabled || document.hidden || !timerRunning) return;
  try {
    armScanChime();
    if (!scanChimeContext || scanChimeContext.state !== 'running') return;
    const ctx = scanChimeContext;
    const at = ctx.currentTime;
    const tone = ctx.createOscillator();
    const volume = ctx.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(740,at);
    tone.frequency.exponentialRampToValueAtTime(590,at+0.38);
    volume.gain.setValueAtTime(0.0001,at);
    volume.gain.exponentialRampToValueAtTime(0.018,at+0.025);
    volume.gain.exponentialRampToValueAtTime(0.0001,at+0.46);
    tone.connect(volume).connect(ctx.destination);
    tone.start(at);
    tone.stop(at+0.48);
    tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  } catch(e) { console.warn('Chime playback:',e); }
}

const SCAN_PARTS = ['Стопы','Голени','Колени','Бёдра','Живот','Грудь','Кисти рук','Плечи','Шея','Лицо','Макушка','Всё тело'];
let practiceMode = 'breath';

// Divide the selected timer duration evenly between all 12 scan steps.
// Elapsed time (not frame count) keeps the scan in sync after pauses
// or background-tab switches. Clamp at the end; never wrap to step 1.
function scanStepAt(elapsedSeconds, durationSeconds) {
  const total = Math.max(1, durationSeconds);
  const stepSeconds = total / SCAN_PARTS.length;
  const elapsed = Math.max(0, Math.min(elapsedSeconds, total));
  const partIdx = Math.min(SCAN_PARTS.length - 1, Math.floor(elapsed / stepSeconds));
  const local = Math.max(0, Math.min(1, (elapsed - partIdx * stepSeconds) / stepSeconds));
  return { partIdx, local };
}

function rhythmTotal(r) { return r.phases.reduce((s,p)=>s+p.dur,0); }
function easeInOut(x) { return x*x*(3-2*x); }
function breathing(secondsInCycle) {
  if (practiceMode === 'scan') {
    const { partIdx, local } = scanStepAt(secondsInCycle, timerTotalSec);
    // The universe keeps its smooth breathing rhythm independent
    // of the 12-stage progression and selected session length.
    const breathePhase = (secondsInCycle / 8) * Math.PI * 2;
    const level = (1 - Math.cos(breathePhase)) / 2;
    return { level, phaseName: 'scan', scanPart: SCAN_PARTS[partIdx], scanIdx: partIdx, scanLocal: local };
  }
  const total = rhythmTotal(currentRhythm);
  const time = ((secondsInCycle % total) + total) % total;
  let acc = 0;
  for (const p of currentRhythm.phases) {
    if (time < acc + p.dur) {
      const local = (time - acc) / p.dur;
      let level;
      if (p.name === 'inhale') level = easeInOut(local);
      else if (p.name === 'exhale') level = 1 - easeInOut(local);
      else if (p.name === 'hold') level = 1;
      else level = 0;
      return { level, phaseName: p.name };
    }
    acc += p.dur;
  }
  return { level: 0, phaseName: 'inhale' };
}

/* ---------- Намерения ---------- */
const BASE_INTENTIONS = {
  muladhara: ["Я замечаю опору под ногами и возвращаюсь к настоящему.", "Я могу заметить, где моё тело чувствует опору.", "Один медленный вдох — и я снова здесь.", "Сегодня я замедляюсь, чтобы чувствовать опору под ногами.", "Мне не нужно торопиться, чтобы быть в порядке.", "Я позволяю себе занимать своё место в мире.", "Каждый шаг — заземление. Каждое дыхание — покой.", "Сегодня я выбираю простоту и надёжность.", "Моё тело — союзник, а не противник.", "Сейчас мне достаточно сделать один спокойный вдох.", "Сегодня я возвращаю себя в настоящий момент.", "Я стою на своём — спокойно и без усилия.", "Мне хватает того, что есть прямо сейчас.", "Я замечаю поверхность под собой и позволяю плечам опуститься.", "Я могу отнестись к своему телу с заботой.", "Я выбираю покой вместо спешки.", "Я могу находить небольшие островки спокойствия внутри дня.", "Я позволяю себе быть там, где я есть.", "Этот момент может стать маленькой точкой отсчёта.", "Я — часть большого, живого мира.", "Я здесь. Я дома. Я в порядке.", "Сегодня я выбираю устойчивость, а не скорость.", "Моё дыхание — якорь в этом моменте.", "Я прислушиваюсь к сигналам тела без спешки.", "Покой — это не бездействие, а сила.", "Я выбираю ритм, в котором мне хорошо.", "Каждое движение — это возвращение к себе.", "Я стою крепко — и могу расслабиться.", "Сегодня я выбираю мягкую, но твёрдую опору.", "Земля под ногами — моя тихая поддержка.", "Я замечаю вес тела и позволяю опоре поддерживать меня.", "Мне можно расслабить руки и лицо.", "С каждым выдохом я немного отпускаю спешку.", "Мне достаточно быть здесь, а не где-то ещё.", "Я чувствую, как стопы касаются поверхности.", "Мой темп может быть спокойным.", "Я могу сделать паузу, даже если день насыщенный.", "Один вдох, один выдох — этого достаточно для начала."],
  svadhisthana: ["Сегодня я разрешаю себе чувствовать.", "Мои эмоции — это река, а не стена.", "Я выбираю мягкость к себе.", "Я разрешаю себе немного любопытства.", "Сегодня я делаю что-то просто ради удовольствия.", "Я позволяю себе радоваться без причины.", "Мои чувства имеют право быть.", "Я могу дать место тому, что чувствую.", "Сегодня я выбираю чувственность и присутствие.", "Я разрешаю себе быть несовершенным и живым.", "Удовольствие — это тоже практика.", "Я могу с любопытством прислушаться к своим желаниям.", "Сегодня я двигаюсь в такт своему телу.", "Я позволяю творчеству течь через меня.", "Я выбираю живое вместо правильного.", "Моя чувствительность — это сила.", "Мне необязательно бороться с каждым переживанием.", "Я разрешаю себе наслаждаться.", "У каждого чувства есть свой оттенок; я могу его заметить.", "Я — вода: гибкая, живая, настоящая.", "Я разрешаю себе жить в своём темпе.", "Я замечаю, как ощущения меняются со временем.", "Я выбираю быть в контакте с чувствами, а не бежать от них.", "Творчество — это моё дыхание.", "Я могу замечать чувства, не оценивая их.", "Сегодня я делаю что-то новое, просто так.", "Я разрешаю себе не знать — и чувствовать.", "Мягкость — это форма смелости.", "Всё, что я чувствую, имеет право быть.", "Я выбираю живое тепло вместо холодной правильности.", "Мне необязательно давать название каждому чувству.", "Я замечаю настроение таким, какое оно есть.", "Ощущения могут меняться; мне не нужно их удерживать.", "Я могу позволить себе простое удовольствие от тишины.", "Сегодня я с интересом прислушиваюсь к себе.", "Не каждую эмоцию нужно сразу исправлять.", "Я могу быть чувствительным и сохранять равновесие.", "Мне можно побыть с переживанием без спешных выводов."],
  manipura: ["Сегодня я выбираю свою силу — спокойно и без давления.", "Я могу. Я делаю. Я выбираю.", "Мой внутренний огонь согревает, а не сжигает.", "Сегодня я действую из ясности, а не из страха.", "Я доверяю своему решению.", "Мне не нужно разрешение, чтобы жить по-своему.", "Я выбираю смелость вместо удобства.", "Моя воля — это компас, а не кнут.", "Сегодня я делаю одно важное дело до конца.", "Я могу выбрать одно посильное действие.", "Я разрешаю себе быть сильным.", "Я могу обращаться со своей энергией бережно.", "Сомнения могут быть рядом, пока я спокойно выбираю следующий шаг.", "Мне не нужно знать всё заранее, чтобы сделать маленький шаг.", "Моя сила — в моей ясности.", "Я выбираю себя — снова и снова.", "Дисциплина — это моя форма любви к себе.", "Сегодня я зажигаю свой внутренний огонь.", "Я могу начать с малого — прямо сейчас.", "Я замечаю, где могу действовать по собственному выбору.", "Я выбираю свою жизнь, а не чужой сценарий.", "Сегодня я сделаю одно дело, которым буду горд.", "Моя сила растёт, когда я замедляюсь.", "Я выбираю ясность, а не контроль.", "Огонь внутри — это энергия, а не гнев.", "Я доверяю своему решению и иду.", "Сегодня я выбираю быть твёрдым в главном.", "Дисциплина — это форма заботы о себе.", "Я не обязан быть идеальным, чтобы действовать.", "Я могу остановиться и уточнить, что мне сейчас важно.", "Я могу действовать без внутреннего нажима.", "Не всё нужно решать за одну минуту.", "Я замечаю, где трачу силы напрасно.", "Маленькие шаги тоже меняют направление.", "Я могу проявлять решительность спокойно.", "Пауза помогает мне выбирать осознанно.", "Мне не нужно ничего доказывать этой медитацией.", "Я оставляю себе право изменить решение."],
  anahata: ["Сегодня я выбираю мягкость — к себе и к другим.", "Любовь — моё естественное состояние.", "Я позволяю себе немного мягкости, насколько сейчас комфортно.", "Я позволяю себе быть любимым.", "Сегодня я выбираю сострадание вместо осуждения.", "Моё сердце умеет прощать — начну с себя.", "Я выбираю видеть в людях свет.", "Я могу начать с одного доброго отношения — к себе.", "Сегодня я дышу сердцем.", "Я разрешаю себе принимать любовь.", "Доброта — это не слабость, а сила.", "Мне можно самому выбирать комфортную близость.", "Моё сердце — дом для многих.", "Сегодня я скажу кому-то доброе слово.", "Я выбираю любить без условий.", "Я могу постепенно становиться мягче к своим прошлым решениям.", "Всё живое связано со мной.", "Я выбираю быть теплее, чем вчера.", "Я могу быть добрым к себе и сохранять границы.", "Любовь — это практика, и я её выбираю.", "Забота о других не отменяет заботу о себе.", "Моё сердце — не крепость, а сад.", "Сегодня я позволяю себе принять доброту.", "Я выбираю видеть душу в каждом человеке.", "Простить — не значит забыть. Это выбор освободиться.", "Каждое существо хочет быть счастливым.", "Я выбираю соединение, а не отдельность.", "Любовь начинается с честности перед собой.", "Сегодня я дам кому-то почувствовать, что его видят.", "Моё сердце открыто — и я в безопасности.", "Я отношусь к себе как к человеку, которому нужна забота.", "Мне можно быть уязвимым и беречь свои границы.", "Я замечаю теплоту даже в небольших моментах.", "Доброта к себе не требует идеального настроения.", "Я могу отпускать самокритику по чуть-чуть.", "Мои границы и моя мягкость могут сосуществовать.", "Я замечаю, кому и чему благодарен сегодня.", "Я позволяю себе принять поддержку, если она нужна."],
  vishuddha: ["Сегодня я говорю свою правду — мягко и ясно.", "Мой голос имеет значение.", "Я выбираю говорить, а не молчать из страха.", "Слова — это энергия. Я выбираю её с умом.", "Сегодня я слушаю больше, чем говорю.", "Я разрешаю себе выражать себя.", "Мой голос — инструмент, а не оружие.", "Я говорю с собой так же мягко, как с другом.", "Сегодня я честен с собой.", "Я выбираю ясность вместо тумана.", "Молчание — тоже речь.", "Я разрешаю себе быть услышанным.", "Я могу замечать свои мысли без необходимости доказывать их.", "Сегодня я говорю то, что чувствую.", "Я выбираю слова, которые лечат.", "Моё самовыражение — не эго, а дыхание.", "Я говорю с миром уважительно и твёрдо.", "Сегодня я слушаю тишину между словами.", "Я даю себе время сформулировать мысль.", "Я выбираю быть настоящим в каждом слове.", "Я говорю то, что помогает, а не то, что ранит.", "Мой голос — это моя правда.", "Я попробую слушать без подготовки ответа.", "Я разрешаю себе говорить медленно и точно.", "Молчание — тоже форма ясности.", "Я выбираю быть честным — с собой и с другими.", "Я могу подобрать слова, которые не ранят напрасно.", "Я сам решаю, чем и когда готов делиться.", "Я замечаю, как расслабляются горло и челюсть.", "Честность может быть спокойной и уважительной.", "Мне можно сделать паузу перед ответом.", "Я замечаю, какие слова говорю себе мысленно.", "Я могу выражать несогласие без резкости.", "Необязательно заполнять каждую тишину словами.", "Я могу говорить коротко и по существу.", "Я замечаю разницу между чувством и оценкой.", "Сегодня я могу услышать себя без спора.", "Мне можно передумать и объяснить это спокойно."],
  ajna: ["Сегодня я доверяю своему внутреннему знанию.", "Я вижу ясно — умом и сердцем.", "Интуиция может быть подсказкой, а не приказом.", "Сегодня я выбираю наблюдать, а не судить.", "В тишине иногда легче услышать собственные мысли.", "Я разрешаю себе смотреть глубже поверхности.", "Ясность приходит, когда я замедляюсь.", "Сегодня я выбираю понимание вместо мнения.", "Даже при неопределённости я могу оставаться внимательным.", "Моя мудрость растёт в тишине.", "Сегодня я доверяю своим ощущениям.", "Я выбираю видение, а не иллюзию.", "Моё внутреннее зрение открыто — для правды.", "Я разрешаю себе не знать — и не бояться этого.", "Я замечаю детали, которые обычно пропускаю.", "Моя ясность — это мой покой.", "Я наблюдаю свои мысли, не отождествляясь с ними.", "Внутреннее зрение ведёт меня.", "Сегодня я замечаю то, что раньше пропускал.", "Я могу опереться на опыт и при этом оставаться открытым новому.", "Я вижу суть, а не только форму.", "Сегодня я выбираю наблюдать без комментариев.", "Я прислушиваюсь к ощущениям и проверяю их без спешки.", "Я могу взглянуть на знакомое под другим углом.", "Между мыслями есть пространство — и я могу туда зайти.", "Я выбираю смотреть глазами, а не памятью.", "Сегодня я замечаю то, что раньше было невидимо.", "В темноте я вижу звёзды.", "Внутренний свет — мой путеводитель.", "Я допускаю, что не на каждый вопрос нужен ответ прямо сейчас.", "Мысли приходят и уходят; я могу их замечать.", "Мне необязательно верить каждой появившейся мысли.", "Я наблюдаю, куда возвращается моё внимание.", "Я могу заметить мысль и вернуться к дыханию.", "Я оставляю место для неопределённости.", "Сегодня я тренирую любопытство вместо поспешных выводов.", "Я могу смотреть на происходящее без готовой оценки.", "Я замечаю паузу между мыслью и реакцией."],
  sahasrara: ["Я могу на минуту отложить объяснения и просто побыть.", "Я часть чего-то большего, чем я.", "Я могу возвращаться к простому ощущению присутствия.", "Сегодня я дышу единством.", "Я соединяю небо и землю в себе.", "Всё, что я ищу, уже во мне.", "Я выбираю присутствие в каждом мгновении.", "Моё сознание — океан, а мысли — волны.", "Сегодня я отпускаю то, что не моё.", "Я — не только тело и ум.", "Не всё необходимо понимать именно сейчас.", "Я могу ощутить связь с окружающим, не объясняя её.", "Сегодня я возвращаюсь к своей сути.", "Я замечаю перемены в ощущениях, не пытаясь их удержать.", "Прямо сейчас я могу отпустить хотя бы одно лишнее усилие.", "Я выбираю жить из глубины, а не из поверхности.", "Вдох и выдох могут быть достаточной практикой.", "Я связан со всей жизнью.", "Сегодня я позволяю себе просто быть.", "Я возвращаюсь к себе, откуда бы ни ушёл.", "Я дома в каждой клетке своего существа.", "Тишина — мой храм.", "Сегодня я позволю себе раствориться в мгновении.", "Я замечаю своё место в окружающем мире.", "Я прислушиваюсь к звукам, дыханию и пространству вокруг.", "Моя суть — покой за пределами мыслей.", "Каждая форма — приглашение к глубине.", "Я выбираю благодарность за сам факт бытия.", "Всё приходит и уходит. Я остаюсь.", "Я возвращаюсь домой — к себе настоящему.", "Мне необязательно придавать этому моменту особый смысл.", "Тишина может быть простой, без ожиданий.", "Я ощущаю себя частью текущего мгновения.", "Я замечаю пространство вокруг и внутри внимания.", "Мне не нужно достигать особого состояния.", "Я позволяю дыханию идти своим естественным путём.", "Даже обычный момент заслуживает моего присутствия.", "Я могу просто посидеть в тишине и ничего не менять."]
};

let userIntentions = {};

function getCombinedIntentions(chakraKey) {
  const base = BASE_INTENTIONS[chakraKey] || [];
  const mine = userIntentions[chakraKey] || [];
  return [...mine, ...base];
}

const sessionIntentions = {};
function pickRandom(pool) {
  if (!pool || !pool.length) return '—';
  return pool[Math.floor(Math.random() * pool.length)];
}
function getSessionIntention(key) {
  if (!sessionIntentions[key]) sessionIntentions[key] = pickRandom(getCombinedIntentions(key));
  return sessionIntentions[key];
}
function resetSessionIntention(key) { delete sessionIntentions[key]; }
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h >>> 0);
}

/* ---------- Утилиты ---------- */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function lighten([r,g,b], amt) {
  return [Math.round(r+(255-r)*amt), Math.round(g+(255-g)*amt), Math.round(b+(255-b)*amt)];
}
function darkenRgb([r,g,b], amt) {
  return [Math.round(r*(1-amt)), Math.round(g*(1-amt)), Math.round(b*(1-amt))];
}
function rgba([r,g,b], a) { return `rgba(${r},${g},${b},${a})`; }
function applyAccent(hex) {
  const rgb = hexToRgb(hex);
  document.body.style.setProperty('--accent', hex);
  document.body.style.setProperty('--accent-glow', rgba(rgb, 0.45));
}
function currentColor() {
  const c = CHAKRAS.find(x => x.key === currentChakra);
  return c ? c.color : CHAKRAS[6].color;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' КБ';
  return (bytes/(1024*1024)).toFixed(1) + ' МБ';
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(text, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- Состояние ---------- */
let chakraProgress = {};
let streak = { count: 0, lastDate: null };
let sessionsCount = 0;
let currentPresetMin = 10;
let sessionLog = [];
let lastSessionId = null;

function findCurrentUnlocked(savedKey, progress) {
  return CHAKRAS.some(c => c.key === savedKey) ? savedKey : CHAKRAS[0].key;
}

/* ---------- Уровни ---------- */
function getTotalMeditationMinutes() {
  return Object.values(chakraProgress).reduce((s, v) => s + (v || 0), 0);
}


function formatRuDate(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  if (dateStr === todayStr()) return 'сегодня';
  if (dateStr === yesterdayStr()) return 'вчера';
  return `${d} ${months[m-1]}`;
}
