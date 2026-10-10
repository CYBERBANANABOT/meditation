'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync('index.html','utf8');
const modules=['core','visualizer','session','ui','journal-backup'].map(name=>'assets/'+name+'.js');
const modular=modules.every(file=>fs.existsSync(file));
const script=modular?modules.map(file=>fs.readFileSync(file,'utf8')).join('\n'):
  (fs.existsSync('assets/app.js')?fs.readFileSync('assets/app.js','utf8'):
  (html.match(/<script>\s*([\s\S]*?)<\/script>/)||[])[1]);
const css=fs.existsSync('assets/style.css')?fs.readFileSync('assets/style.css','utf8'):
  (html.match(/<style>([\s\S]*?)<\/style>/)||[])[1];
assert(script&&css,'App CSS and JS must exist');
new vm.Script(script,{filename:'app.js'});
function extract(name){
  const m=script.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));
  assert(m,'Missing '+name);
  return m[0];
}
function functions(names,globals={}){
  const ctx={console,...globals};
  vm.runInNewContext(names.map(extract).join('\n')+'\n'+names.map(n=>'this.'+n+'='+n).join(';'),ctx);
  return ctx;
}
test('Core music and user features',()=>{
  assert(fs.statSync('assets/peace-of-mind.mp3').size>20000000);
  assert(fs.existsSync('assets/MUSIC-LICENSE.md'));
  assert.equal((script.match(/_builtin:true/g)||[]).length,1);
  for(const key of ['dbAddTrack(','dbGetAllTracks(','function playSelectedTrack()',
    'function drawUniverse(','function creditMeditationDay(','function saveSessionLog(',
    'function offerPracticeRecovery(','function renderProfileHistory(',
    'function saveActivePractice(','scanStepAt(secondsInCycle, timerTotalSec)']){
    assert(script.includes(key),'Missing feature: '+key);
  }
  assert(!script.includes('assets/rain-meditation.mp3'));
});
test('Unique IDs, correct controls, no blocked zoom',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'Duplicate ID');
  // Some containers are created dynamically from trusted UI templates.
  const dynamicIds=[...script.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const known=new Set([...ids,...dynamicIds]);
  for(const m of script.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)){
    assert(known.has(m[1]),'Missing DOM element '+m[1]);
  }
  for(const id of ['practiceHeader','rhythmHeader','timeHeader']){
    assert(html.includes('id="'+id+'" aria-expanded="false"'));
  }
  for(const id of ['welcomeGoalModal','welcomeGoalGrid','scanChimeButton','exportJournalBtn',
    'importJournalBtn','journalImportFile','journalImportConfirm','journalExportModal',
    'journalImportModal','practiceRecoveryModal','finishOverlay','myTracksList','audioEl']){
    assert(known.has(id),'Missing '+id);
  }
  assert(!html.includes('user-scalable=no'));
});

test('Every HTML container closes correctly; practice and profile cannot overlap',()=>{
  const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const stack=[];
  const ids=new Map();
  const re=/<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gi;
  for (const m of html.matchAll(re)){
    const source=m[0],name=m[1].toLowerCase();
    if(source.startsWith('</')){
      const last=stack.pop();
      assert(last,'Unmatched closing tag '+source);
      assert.equal(last.tag,name,'Bad nesting at '+source+'; current parent #'+(last.id||'?'));
      continue;
    }
    const id=(source.match(/\bid="([^"]+)"/)||[])[1]||null;
    if(id) ids.set(id,[...stack.map(x=>x.id).filter(Boolean)]);
    if(!voidTags.has(name) && !source.endsWith('/>'))stack.push({tag:name,id});
  }
  assert.equal(stack.length,0,'Unclosed tags: '+JSON.stringify(stack.slice(-8)));
  function inside(id,ancestor){
    assert(ids.get(id),'Missing '+id);
    assert(ids.get(id).includes(ancestor),
      '#'+id+' escaped its expected parent #'+ancestor+'; actual ancestors: '+ids.get(id).join(','));
  }
  inside('btnMain','screen-practice');
  for(const id of ['goalGrid','chakraNameWrap','practiceBlock','rhythmBlock','timeBlock',
    'timerDisplay','btnTracks','btnPrevTrack','btnNextTrack','btnAddTrack']){
    inside(id,'screen-settings');
  }
  inside('welcomeGoalGrid','welcomeGoalModal');
  inside('profileBody','screen-profile');
  inside('streakNum','screen-profile');
  inside('exportJournalBtn','screen-profile');
  for(const id of ['screen-practice','screen-settings','screen-profile']) {
    assert.equal(ids.get(id).length,0,'Screen must be a direct child of body');
  }
  assert(!ids.get('screen-profile').includes('screen-practice'),
    'Profile must not be nested inside meditation screen');
});
test('All twelve body-scan stages fit the requested duration',()=>{
  const c=functions(['scanStepAt'],{SCAN_PARTS:Array.from({length:12})});
  for(const minutes of [1,2,5,10,30,60,90,180]){
    const duration=minutes*60;
    for(let i=0;i<12;i++)assert.equal(c.scanStepAt((i+.5)*duration/12,duration).partIdx,i);
    assert.equal(c.scanStepAt(duration,duration).partIdx,11);
    assert.equal(c.scanStepAt(duration+100,duration).partIdx,11);
  }
});
test('Journal merges offline edits and never truncates history',()=>{
  const c=functions(['mergeSessionLogs']);
  const cloud=[{id:1,ts:1000,note:'old'},{id:3,ts:3000,note:'cloud'}];
  const local=[{id:1,ts:1000,note:'new',updatedAt:5000},{id:2,ts:2000,note:'local'}];
  const all=c.mergeSessionLogs(cloud,local);
  assert.deepEqual(Array.from(all.map(s=>s.id)),[1,2,3]);
  assert.equal(all[0].note,'new');
  assert(!script.includes('sessionLog.slice(-200)'));
  assert(script.includes('s.updatedAt = Date.now()'));
});
test('Saved progress restores paused, not as elapsed closed time',()=>{
  const storage={values:new Map(),
    getItem(k){return this.values.get(k)||null},
    setItem(k,v){this.values.set(k,v)},
    removeItem(k){this.values.delete(k)}
  };
  const ctx={console,Date,localStorage:storage,CHAKRAS:[{key:'muladhara'}],
    currentRhythm:{key:'4-4'},currentChakra:'muladhara',practiceMode:'scan',
    timerTotalSec:60,timerElapsed:25,timerRunning:false,timerDone:false,
    performance:{now:()=>10000}};
  vm.runInNewContext('const ACTIVE_PRACTICE_KEY="meditation_active_practice_v1";'+
    'let lastPracticeCheckpointMs=-Infinity;\n'+
    ['currentElapsed','readSavedPractice','clearSavedPractice','saveActivePractice'].map(extract).join('\n')+
    '\nthis.get=readSavedPractice;this.save=saveActivePractice;this.clear=clearSavedPractice;',ctx);
  ctx.save();
  const entry=ctx.get();assert.equal(entry.elapsedSec,25);
  assert.equal(ctx.get().elapsedSec,25);
  ctx.clear();assert.equal(ctx.get(),null);
  storage.setItem('meditation_active_practice_v1',JSON.stringify({...entry,elapsedSec:60}));
  assert.equal(ctx.get(),null);
});
test('Timer deadlines, audio fallback and repeat session',()=>{
  for(const key of ['function armTimerDeadline()',"audioEl.addEventListener('timeupdate'",
    'clearTimerDeadline();','if (timerDone) resetTimer(currentPresetMin * 60)',
    'audioEl.pause(); audioEl.volume = MUSIC_VOLUME;']){
    assert(script.includes(key),'Missing '+key);
  }
});
test('Controls and defaults remain consistent',()=>{
  for(const id of ['rIn','rOut','rHold','rEmpty']){
    const m=html.match(new RegExp('<input[^>]+id="'+id+'"[^>]+>'));
    assert(m&&m[0].includes('max="20"'),'Mismatch '+id);
  }
  for(const key of ['commitPracticeMinutes(',
    "storageGetP('scanChime')",'function playScanChime()',
    'motionPreference.matches','function showWelcomeGoal()',
    'function selectMeditationGoal('])assert(script.includes(key));
  assert(!html.includes('timeExactInput') && !script.includes('timeExactInput'),
    'The exact minutes field should be removed');
  assert(!html.includes('immersiveToggle'), 'The old immersive mode button should not exist');
  assert(css.includes('prefers-reduced-motion'));
});
console.log('Smoke suite running against '+(modular?'modular':'inline')+' version');

test('Journal backups support safe non-destructive recovery',()=>{
  for(const fn of ['createJournalBackup','readJournalBackup','validateJournalEntry',
    'journalPreviewStats','updateJournalStreak'])assert(script.includes('function '+fn+'('));
  assert(script.includes("journalImportConfirm.addEventListener('click'"));
  assert(script.includes("journalImportFile.addEventListener('change'"));
  assert(script.includes('localStorage.setItem(\'sessionLog\''));
  assert(script.includes('mergeSessionLogs(sessionLog, backup.sessions)'));
});
