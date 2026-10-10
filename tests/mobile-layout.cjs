'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');

(async()=>{
  const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
  assert(fs.existsSync(chrome));
  const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
  fs.mkdirSync('artifacts/layout',{recursive:true});
  try {
    for(const viewport of [{width:320,height:700},{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:768,height:1024}]){
      const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/telegram-web-app.js',route=>route.fulfill({
        status:200,contentType:'text/javascript',
        body:'window.Telegram={WebApp:{ready(){},expand(){}}};'
      }));
      await page.goto('file://'+path.resolve('index.html'),{waitUntil:'load',timeout:30000});
      await page.locator('#welcomeGoalModal.show').waitFor({timeout:12000});
      assert(await page.locator('#welcomeGoalGrid .goal-option').count()===7);
      await page.screenshot({path:'artifacts/layout/entry-'+viewport.width+'.png'});
      await page.locator('#welcomeGoalGrid [data-goal="feel"]').click();
      await page.locator('#welcomeThoughtModal.show').waitFor();
      assert(!(await page.locator('#welcomeGoalModal').isVisible()),'Mood entry dialog failed to close');
      await page.locator('#welcomeThoughtClose').click();
      assert(!(await page.locator('#welcomeThoughtModal').isVisible()));
      assert.deepEqual(errors,[],'Browser errors while starting: '+errors.join(';'));

      // Home screen: chakra label, native-feeling scroll wheel and music player.
      assert(await page.locator('#screen-practice').isVisible());
      assert.equal(await page.locator('#screen-practice button').count(),5);
      assert(await page.locator('#orb').isVisible());
      assert(await page.locator('#breathHint').isVisible());
      assert.equal(await page.locator('#homeChakraName').textContent(),'Свадхистана');
      assert.equal(await page.locator('#durationWheel [role="option"]').count(),180);
      assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'10');
      assert(await page.locator('#playerTrackStatus').isVisible());
      assert(!(await page.locator('#screen-practice #timerDisplay').count()));
      const main = await page.locator('#btnMain').boundingBox();
      const orb = await page.locator('#orb').boundingBox();
      assert(main&&orb);
      assert(orb.x>=0&&orb.x+orb.width<=viewport.width+1,'Universe overflows viewport');
      const ids=['btnPrevTrack','btnMain','btnNextTrack'];
      const controls=await Promise.all(ids.map(id=>page.locator('#'+id).boundingBox()));
      for(let i=0;i<controls.length;i++){
        const box=controls[i];
        assert(box && box.x>=0 && box.x+box.width<=viewport.width+1,'Player control outside viewport '+ids[i]);
        if(i) assert(controls[i-1].x+controls[i-1].width<=box.x+1,'Player controls overlap');
      }
      const homeWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert(homeWidth<=viewport.width+1,'Horizontal overflow on home '+homeWidth);
      await page.screenshot({path:'artifacts/layout/practice-'+viewport.width+'.png'});

      assert.equal(await page.locator('.bottom-tab').count(),3);
      await page.locator('.bottom-tab[data-screen="settings"]').click();
      assert(await page.locator('#screen-settings').isVisible(),'Settings not visible');
      assert(!(await page.locator('#screen-practice').isVisible()),'Practice leaks through Settings');
      assert.equal(await page.locator('#goalGrid .goal-option').count(),7);
      assert.equal(await page.locator('#goalGrid [data-goal="feel"]').getAttribute('aria-pressed'),'true');
      await page.locator('#goalGrid [data-goal="clarity"]').click();
      assert.equal(await page.locator('#goalGrid [data-goal="clarity"]').getAttribute('aria-pressed'),'true');
      assert(!(await page.locator('#timeExactInput').count()),'Exact minutes field still appears');
      assert(await page.locator('#timerDisplay').isVisible(),'Timer display should be in Settings');
      assert.equal(await page.locator('#homeChakraName').textContent(),'Аджна');

      await page.locator('#practiceHeader').click();
      assert(await page.locator('#practicePicker').isVisible());
      await page.locator('#practiceSlider').fill('1');
      await page.locator('#practiceSlider').dispatchEvent('change');
      assert(await page.locator('#scanChimeButton').isVisible());
      await page.locator('#timeHeader').click();
      assert(await page.locator('#timeSlider').isVisible());
      await page.locator('#timeSlider').fill('17');
      await page.locator('#timeSlider').dispatchEvent('change');
      assert.equal(await page.locator('#timeValue').textContent(),'17 мин');
      assert.equal(await page.locator('#timerDisplay').textContent(),'17:00');
      assert(await page.locator('#settingsMusicLibrary').isVisible());
      await page.locator('#settingsMusicLibrary').click();
      assert(await page.locator('#tracksModal').isVisible());
      await page.locator('#tracksModal [data-close]').click();
      assert(!(await page.locator('#tracksModal').isVisible()));
      const settingsRect=await page.locator('#screen-settings').boundingBox();
      assert(settingsRect && settingsRect.x>=-1 && settingsRect.x+settingsRect.width<=viewport.width+1);
      await page.screenshot({path:'artifacts/layout/settings-'+viewport.width+'.png'});

      await page.locator('.bottom-tab[data-screen="practice"]').click();
      assert(await page.locator('#screen-practice').isVisible());
      assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'17');
      assert.equal(await page.locator('#homeChakraName').textContent(),'Аджна');
      await page.locator('#btnTracks').click();
      assert(await page.locator('#tracksModal').isVisible());
      await page.locator('#tracksModal [data-close]').click();
      await page.locator('#durationWheel').evaluate(el=>{el.scrollTop = 24*42});
      await page.waitForFunction(()=>currentPresetMin===25,null,{timeout:4500});
      assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'25');
      assert.equal(await page.locator('#timerDisplay').textContent(),'25:00');
      if(viewport.width===390){
        await page.locator('#durationWheel').evaluate(el=>{el.scrollTop = 179*42});
        await page.waitForFunction(()=>currentPresetMin===180,null,{timeout:4500});
        assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'180');
        await page.locator('#durationWheel').evaluate(el=>{el.scrollTop = 0});
        await page.waitForFunction(()=>currentPresetMin===1,null,{timeout:4500});
        assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'1');
        await page.locator('#durationWheel').press('ArrowDown');
        await page.waitForFunction(()=>currentPresetMin===2,null,{timeout:4500});
        assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'2');
      }
      const initialTimer=await page.locator('#timerDisplay').textContent();
      await page.locator('#btnMain').click();
      assert(await page.evaluate(()=>timerRunning),'Timer did not start');
      assert.equal(await page.locator('#durationWheel').getAttribute('aria-disabled'),'true');
      await page.waitForFunction(initial=>document.getElementById('timerDisplay').textContent !== initial,
        initialTimer,{timeout:3500});
      assert(await page.locator('#homeTimerRemaining').isVisible(),'Remaining time should be visible during practice');
      await page.locator('#btnMain').click();
      assert(!(await page.evaluate(()=>timerRunning)),'Timer did not pause');
      assert.equal(await page.locator('#durationWheel').getAttribute('aria-disabled'),'false');
      // Restoring a paused session after the screen is changed must preserve elapsed time.
      await page.locator('.bottom-tab[data-screen="profile"]').click();
      assert(await page.locator('#screen-profile').isVisible());
      assert(!(await page.locator('#screen-practice').isVisible()));
      assert(await page.locator('#profileBody').isVisible());
      const profileRect=await page.locator('#screen-profile').boundingBox();
      assert(profileRect && profileRect.x>=-1 && profileRect.x+profileRect.width<=viewport.width+1);
      const stats=await page.locator('.stat-card').count();
      assert.equal(stats,4);
      await page.screenshot({path:'artifacts/layout/profile-'+viewport.width+'.png'});

      await page.locator('.profile-tab[data-ptab="history"]').click();
      assert(await page.locator('#historyContent').isVisible());
      if(viewport.width===390){
        await page.evaluate(()=>{
          window.__journalFileName=null;
          Object.defineProperty(navigator,'canShare',{configurable:true,value:o=>o.files?.length===1});
          Object.defineProperty(navigator,'share',{configurable:true,value:async o=>{
            window.__journalFileName=o.files[0].name;
            window.__journalSharedText=await o.files[0].text();
          }});
        });
      }
      await page.locator('#exportJournalBtn').click();
      assert(await page.locator('#journalExportModal').isVisible());
      const backup=JSON.parse(await page.locator('#journalExportText').inputValue());
      assert.equal(backup.format,'meditation-journal');
      assert(Array.isArray(backup.sessions));
      assert(!(await page.locator('#journalExportDownload').isVisible()));
      if(viewport.width===390){
        assert(await page.locator('#journalExportShare').isVisible());
        await page.locator('#journalExportShare').click();
        await page.waitForFunction(()=>typeof window.__journalSharedText==='string');
        assert(JSON.parse(await page.evaluate(()=>window.__journalSharedText)).sessions);
      } else {
        assert(await page.locator('#journalExportCopy').isVisible());
        await page.locator('#journalExportCopy').click();
        await page.waitForFunction(()=>document.getElementById('journalExportStatus').textContent.length>0);
      }
      await page.locator('[data-close="journalExportModal"]').click();
      await page.locator('#importJournalBtn').click();
      assert(await page.locator('#journalImportModal').isVisible());
      if(viewport.width===390){
        const entry={id:1700000000001,ts:1700000000001,
          date:'2025-10-11',time:'12:00',minutes:10,chakra:'muladhara',
          mode:'scan',note:'Тихая практика',mood:'calm'};
        const data={format:'meditation-journal',version:1,sessions:[entry],
          streak:{count:1,lastDate:'2025-10-11'},sessionsCount:1,
          chakraProgress:{muladhara:10}};
        const bytes=Buffer.from(JSON.stringify(data),'utf8');
        await page.locator('#journalImportFile').setInputFiles({name:'my-journal.json',mimeType:'application/json',buffer:bytes});
        await page.locator('#journalImportPreview').waitFor({state:'visible'});
        assert((await page.locator('#journalImportPreview').textContent()).includes('Новых записей: 1'));
        await page.locator('#journalImportConfirm').click();
        await page.waitForFunction(()=>document.getElementById('journalImportStatus').textContent.includes('Восстановлено'));
        await page.locator('[data-close="journalImportModal"]').click();
        assert((await page.locator('#historyContent').textContent()).includes('Тихая практика'));
        await page.locator('#importJournalBtn').click();
        await page.locator('#journalImportFile').setInputFiles({name:'my-journal.json',mimeType:'application/json',buffer:bytes});
        await page.locator('#journalImportPreview').waitFor({state:'visible'});
        assert((await page.locator('#journalImportPreview').textContent()).includes('Новых записей: 0'));
        await page.locator('#journalImportConfirm').click();
        assert.equal(await page.locator('.session-item').count(),1);
      }
      await page.locator('[data-close="journalImportModal"]').click();
      assert.deepEqual(errors,[],'JavaScript errors at '+viewport.width+': '+errors.join('; '));
      console.log('PASS '+viewport.width+'x'+viewport.height+' chakra, wheel, player, settings, countdown, profile, diary');
      await context.close();
    }
  }finally{
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exit(1)});
