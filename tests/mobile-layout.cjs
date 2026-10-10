'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');

(async()=>{
  const chrome=process.env.CHROME_BIN || '/usr/bin/google-chrome';
  assert(fs.existsSync(chrome),'Chromium/Google Chrome not installed at '+chrome);
  const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox','--disable-dev-shm-usage']});
  const dir='artifacts/layout';
  fs.mkdirSync(dir,{recursive:true});
  try {
    for(const viewport of [{width:320,height:700},{width:360,height:740},{width:390,height:844},{width:430,height:932},{width:768,height:1024}]){
      const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/telegram-web-app.js',route=>route.fulfill({status:200,contentType:'text/javascript',
        body:'window.Telegram={WebApp:{ready(){},expand(){}}};'}));
      await page.goto('file://'+path.resolve('index.html'),{waitUntil:'load',timeout:30000});
      await page.waitForTimeout(400);
      if (await page.locator('#welcomeThoughtModal.show').count())await page.locator('#welcomeThoughtClose').click();
      assert.deepEqual(errors,[],'JS errors on '+viewport.width+'px: '+errors.join('; '));
      const structure=await page.evaluate(()=>{
        const parentId=id=>document.getElementById(id)?.closest('.screen')?.id||null;
        const sizes=()=>{
          const ids=['screen-practice','screen-profile','practiceBlock','rhythmBlock','timeBlock','timerDisplay','btnMain','practiceStreakNote','profileBody','streakNum'];
          return Object.fromEntries(ids.map(id=>[id,parentId(id)]));
        };
        return sizes();
      });
      for(const id of ['practiceBlock','rhythmBlock','timeBlock','timerDisplay','btnMain','practiceStreakNote'])
        assert.equal(structure[id],'screen-practice',id+' is outside practice on '+viewport.width);
      for(const id of ['profileBody','streakNum'])
        assert.equal(structure[id],'screen-profile',id+' is outside profile on '+viewport.width);
      await page.locator('#practiceHeader').click();
      assert(await page.locator('#practicePicker').isVisible(),'Practice settings do not expand');
      await page.locator('#practiceSlider').fill('1');
      await page.locator('#practiceSlider').dispatchEvent('change');
      assert(await page.locator('#scanChimeButton').isVisible(),'Scan chime toggle outside practice settings');
      await page.locator('#timeHeader').click();
      assert(await page.locator('#timeExactInput').isVisible(),'Exact time input not visible');
      await page.locator('#timeExactInput').fill('17');
      await page.locator('#timeExactInput').dispatchEvent('change');
      assert.equal(await page.locator('#timeValue').textContent(),'17 мин');
      await page.locator('#btnMain').scrollIntoViewIfNeeded();
      const practice=await page.evaluate(()=>{
        const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
        const bar=document.querySelector('.control-bar').getBoundingClientRect();
        const player=document.querySelector('.player').getBoundingClientRect();
        const buttons=['btnTracks','btnPrevTrack','btnMain','btnNextTrack','btnAddTrack'].map(id=>({id,...rect(id)}));
        return {buttons,bar:{left:bar.left,right:bar.right},player:{left:player.left,right:player.right},viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};
      });
      for(let j=0;j<practice.buttons.length;j++){
        const btn=practice.buttons[j];
        assert(btn.w>=25,'Button too small '+btn.id+' '+viewport.width);
        assert(btn.x>=practice.player.left-1 && btn.right<=practice.player.right+1,
          'Player icon clipped: '+JSON.stringify({viewport,button:btn,player:practice.player}));
        if(j>0)assert(practice.buttons[j-1].right<=btn.x+1,'Overlapping playback icons '+viewport.width);
      }
      await page.screenshot({path:dir+'/practice-'+viewport.width+'.png'});
      await page.locator('.bottom-tab[data-screen="profile"]').click();
      assert(await page.locator('#screen-profile').isVisible(),'Profile screen not displayed');
      assert(!(await page.locator('#screen-practice').isVisible()),'Practice appears under profile tab');
      assert(await page.locator('#profileBody').isVisible(),'Profile content hidden');
      const profile=await page.evaluate(()=>{
        const target=document.querySelector('#screen-profile').getBoundingClientRect();
        const tabs=document.querySelector('.tabs-bottom').getBoundingClientRect();
        const stat=document.querySelector('.stat-summary').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.stat-card')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}});
        return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
          profile:{left:target.left,right:target.right,width:target.width},
          tabs:{left:tabs.left,right:tabs.right},stat:{left:stat.left,right:stat.right},cards};
      });
      assert(profile.profile.left>=-1 && profile.profile.right<=viewport.width+1,
        'Profile outside viewport '+JSON.stringify(profile));
      for(const card of profile.cards)assert(card.left>=profile.profile.left-1&&card.right<=profile.profile.right+1,
        'Stat card clipped '+JSON.stringify({viewport,card,profile:profile.profile}));
      await page.screenshot({path:dir+'/profile-'+viewport.width+'.png'});
      await page.locator('.profile-tab[data-ptab="history"]').click();
      assert(await page.locator('#historyContent').isVisible(),'History tab not usable');
      if(viewport.width===390){
        await page.evaluate(()=>{
          window.__journalFileName = null;
          Object.defineProperty(navigator,'canShare',{configurable:true,value:opts=>opts.files?.length===1});
          Object.defineProperty(navigator,'share',{configurable:true,value:async opts=>{
            window.__journalFileName = opts.files[0].name;
            window.__journalSharedText = await opts.files[0].text();
          }});
        });
      }
      await page.locator('#exportJournalBtn').click();
      assert(await page.locator('#journalExportModal').isVisible(),'Export dialog did not open');
      const archive=JSON.parse(await page.locator('#journalExportText').inputValue());
      assert.equal(archive.format,'meditation-journal');
      assert(Array.isArray(archive.sessions),'Export omits sessions');
      assert(archive.streak,'Export omits streak');
      assert(await page.locator('#journalExportText').inputValue()!=='','Backup text must be available');
      assert(!(await page.locator('#journalExportDownload').isVisible()),
        'Telegram should not show unreliable blob downloads');
      if(viewport.width===390){
        assert(await page.locator('#journalExportShare').isVisible(),'Native share button not shown when supported');
        await page.locator('#journalExportShare').click();
        await page.waitForFunction(()=>typeof window.__journalSharedText === 'string');
        assert((await page.evaluate(()=>window.__journalFileName)).endsWith('.json'));
        assert.equal(JSON.parse(await page.evaluate(()=>window.__journalSharedText)).format,'meditation-journal');
      } else {
        assert(!(await page.locator('#journalExportShare').isVisible()),'Unsupported native share should be hidden');
      }
      await page.locator('#journalExportCopy').click();
      assert(await page.locator('#journalExportStatus').textContent(),'Copy must show clear feedback');
      await page.locator('#journalExportSelect').click();
      const selected=await page.locator('#journalExportText').evaluate(el=>
        el.selectionStart===0 && el.selectionEnd===el.value.length);
      assert(selected,'Manual copy fallback should select full journal text');
      await page.locator('[data-close="journalExportModal"]').click();
      assert(!(await page.locator('#journalExportModal').isVisible()),'Export dialog should close');
      console.log('PASS viewport '+viewport.width+'x'+viewport.height,
        'player controls',practice.buttons.map(b=>Math.round(b.x)+'+'+Math.round(b.w)).join(' '),
        'profile width',Math.round(profile.profile.width),'stats',profile.cards.length,'page errors',errors.length);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exit(1)});
