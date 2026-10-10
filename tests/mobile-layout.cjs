'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');

(async()=>{
  const chrome=process.env.CHROME_BIN || '/usr/bin/google-chrome';
  assert(fs.existsSync(chrome),'Chromium is required');
  const browser=await chromium.launch({headless:true,executablePath:chrome,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  fs.mkdirSync('artifacts/layout',{recursive:true});
  try{
    for(const viewport of [{width:320,height:700},{width:360,height:740},
      {width:390,height:844},{width:430,height:932},{width:768,height:1024}]){
      const context=await browser.newContext({viewport,deviceScaleFactor:1,
        isMobile:true,hasTouch:true});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/telegram-web-app.js',route=>route.fulfill({
        status:200,contentType:'text/javascript',
        body:'window.Telegram={WebApp:{ready(){},expand(){}}};'
      }));
      await page.goto('file://'+path.resolve('index.html'),{waitUntil:'load',timeout:30000});
      await page.locator('#welcomeGoalModal.show').waitFor({timeout:12000});
      assert.equal(await page.locator('#welcomeGoalGrid .goal-option').count(),7);
      await page.locator('#welcomeGoalGrid [data-goal="clarity"]').click();
      await page.locator('#welcomeThoughtModal.show').waitFor();
      await page.locator('#welcomeThoughtClose').click();
      assert(!(await page.locator('#welcomeThoughtModal').isVisible()));
      assert(await page.locator('#screen-practice').isVisible());
      assert.equal(await page.locator('.bottom-tab').count(),2);
      assert.equal(await page.locator('#screen-settings').count(),0);
      assert.equal(await page.locator('#chakraName').textContent(),'Аджна');
      assert((await page.locator('#chakraDesc').textContent()).includes('прояснить мысли'));
      assert((await page.locator('#practiceTip').textContent()).includes('Как практиковать'));
      assert((await page.locator('#practiceTip').textContent()).includes('Наблюдай за возникающими'));
      assert(await page.locator('#changeChakraBtn').isVisible());
      const info=await page.locator('.home-chakra-info').boundingBox(),
        orb=await page.locator('#orb').boundingBox();
      assert(info&&orb&&info.y+info.height<=orb.y+2,'Chakra instruction must be above universe');
      assert(info.x>=-1&&info.x+info.width<=viewport.width+1,'Chakra instruction overflow');
      await page.screenshot({path:'artifacts/layout/practice-'+viewport.width+'.png',fullPage:true});

      // The small icon to the left of the title changes the practice goal.
      await page.locator('#changeChakraBtn').click();
      assert(await page.locator('#welcomeGoalModal').isVisible());
      assert.equal(await page.locator('#welcomeGoalGrid .goal-option').count(),7);
      await page.locator('#welcomeGoalGrid [data-goal="feel"]').click();
      assert(!(await page.locator('#welcomeGoalModal').isVisible()));
      assert(!(await page.locator('#welcomeThoughtModal').isVisible()),
        'Changing chakra later must not replay welcome thought');
      assert.equal(await page.locator('#chakraName').textContent(),'Свадхистана');
      assert((await page.locator('#practiceTip').textContent()).includes('Обрати внимание'));

      // The info icon continues to open details about the active chakra.
      await page.locator('#chakraNameWrap').click();
      assert(await page.locator('#guideModal').isVisible());
      await page.locator('#guideModal [data-close]').first().click();

      // Cancel a second chakra selection without changing it.
      await page.locator('#changeChakraBtn').click();
      await page.locator('#welcomeGoalKeep').click();
      assert.equal(await page.locator('#chakraName').textContent(),'Свадхистана');
      assert(!(await page.locator('#welcomeThoughtModal').isVisible()));

      // Settings removed, but music and time controls remain on practice.
      assert.equal(await page.locator('#durationWheel [role="option"]').count(),180);
      assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'10');
      assert(await page.locator('#playerTrackStatus').isVisible());
      assert.equal(await page.locator('#screen-practice button').count(),7);
      for(const id of ['btnTracks','btnAddTrack','btnPrevTrack','btnMain','btnNextTrack']){
        const box=await page.locator('#'+id).boundingBox();
        assert(box && box.x>=-1 && box.x+box.width<=viewport.width+1,
          'Player control outside viewport '+id+' at '+viewport.width);
      }
      await page.locator('#btnTracks').click();
      assert(await page.locator('#tracksModal').isVisible());
      await page.locator('#tracksModal [data-close]').click();

      await page.locator('#durationWheel').evaluate(el=>{el.scrollTop=24*42});
      await page.waitForFunction(()=>currentPresetMin===25,null,{timeout:4500});
      assert.equal(await page.locator('#durationWheel [aria-selected="true"]').textContent(),'25');
      if(viewport.width===390){
        await page.locator('#durationWheel').evaluate(el=>{el.scrollTop=179*42});
        await page.waitForFunction(()=>currentPresetMin===180,null,{timeout:4500});
        await page.locator('#durationWheel').evaluate(el=>{el.scrollTop=0});
        await page.waitForFunction(()=>currentPresetMin===1,null,{timeout:4500});
      }
      const initial=await page.evaluate(()=>currentPresetMin);
      await page.locator('#btnMain').click();
      assert(await page.evaluate(()=>timerRunning),'Timer did not start');
      assert.equal(await page.locator('#durationWheel').getAttribute('aria-disabled'),'true');
      assert(await page.locator('#homeTimerRemaining').isVisible());
      await page.waitForFunction(()=>timerElapsed>0 ||
        (performance.now()-timerStartMs)>1000,null,{timeout:3500});
      await page.locator('#btnMain').click();
      assert(!(await page.evaluate(()=>timerRunning)),'Timer did not pause');
      assert.equal(await page.evaluate(()=>currentPresetMin),initial);
      assert.equal(await page.locator('#durationWheel').getAttribute('aria-disabled'),'false');

      // Settings removed, profile and journal remain untouched.
      await page.locator('.bottom-tab[data-screen="profile"]').click();
      assert(await page.locator('#screen-profile').isVisible());
      assert(!(await page.locator('#screen-practice').isVisible()));
      const profile=await page.locator('#screen-profile').boundingBox();
      assert(profile && profile.x>=-1 && profile.x+profile.width<=viewport.width+1);
      assert.equal(await page.locator('.stat-card').count(),4);
      await page.screenshot({path:'artifacts/layout/profile-'+viewport.width+'.png'});
      await page.locator('.profile-tab[data-ptab="history"]').click();
      assert(await page.locator('#historyContent').isVisible());

      if(viewport.width===390){
        await page.evaluate(()=>{
          Object.defineProperty(navigator,'canShare',{configurable:true,
            value:o=>o.files?.length===1});
          Object.defineProperty(navigator,'share',{configurable:true,
            value:async o=>{window.__journalShared=await o.files[0].text()}});
        });
      }
      await page.locator('#exportJournalBtn').click();
      assert(await page.locator('#journalExportModal').isVisible());
      const archive=JSON.parse(await page.locator('#journalExportText').inputValue());
      assert.equal(archive.format,'meditation-journal');
      assert(Array.isArray(archive.sessions));
      if(viewport.width===390){
        await page.locator('#journalExportShare').click();
        await page.waitForFunction(()=>!!window.__journalShared);
        assert.equal(JSON.parse(await page.evaluate(()=>window.__journalShared)).format,'meditation-journal');
      }else{
        assert(await page.locator('#journalExportCopy').isVisible());
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
        await page.locator('#journalImportFile').setInputFiles({
          name:'my-journal.json',mimeType:'application/json',buffer:bytes});
        await page.locator('#journalImportPreview').waitFor({state:'visible'});
        assert((await page.locator('#journalImportPreview').textContent()).includes('Новых записей: 1'));
        await page.locator('#journalImportConfirm').click();
        await page.waitForFunction(()=>document.getElementById('journalImportStatus').textContent.includes('Восстановлено'));
        await page.locator('[data-close="journalImportModal"]').click();
        assert((await page.locator('#historyContent').textContent()).includes('Тихая практика'));
        await page.locator('#importJournalBtn').click();
        await page.locator('#journalImportFile').setInputFiles({
          name:'my-journal.json',mimeType:'application/json',buffer:bytes});
        await page.locator('#journalImportPreview').waitFor({state:'visible'});
        assert((await page.locator('#journalImportPreview').textContent()).includes('Новых записей: 0'));
      }
      await page.locator('[data-close="journalImportModal"]').click();
      assert.deepEqual(errors,[],'Page errors '+viewport.width+': '+errors.join('; '));
      console.log('PASS '+viewport.width+'x'+viewport.height+
        ' chakra card, change modal, duration wheel, music, profile and journal');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
