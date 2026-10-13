'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  for(const name of ['yoga-prototype.html','assets/yoga-prototype.js',
    'assets/yoga-mannequin.js','assets/yoga-prototype.css']){
    assert(fs.existsSync(name),'Missing app resource '+name);
  }
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
    headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader']
  });
  fs.mkdirSync('artifacts/yoga',{recursive:true});
  try{
    for(const viewport of [{width:320,height:700},{width:390,height:844},{width:768,height:1024}]){
      const context=await browser.newContext({
        viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true
      });
      const page=await context.newPage(),errors=[],requests=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>requests.push(request.url()));
      await page.goto('file://'+path.resolve('yoga-prototype.html'),{waitUntil:'load',timeout:30000});
      await page.waitForFunction(()=>window.__yogaPrototype!==undefined);
      await page.waitForTimeout(180);
      const initial=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert(initial.webgl,'WebGL must initialize');
      assert.equal(initial.mesh?.material,'wood');
      assert.equal(initial.mesh?.joints,14);
      assert(initial.mesh?.segments>=18);
      assert(initial.mesh?.triangles>1500);
      assert.equal(initial.totalDuration,360,'Routine must be exactly 6 minutes');
      assert.deepEqual(initial.durations,[25,35,40,45,45,35,35,35,35,30]);
      assert.equal(initial.stages,10);
      assert.equal(initial.stage,'arrival');
      assert.equal(initial.index,0);
      assert.equal(initial.running,false);
      assert.equal(await page.locator('#movementName').textContent(),'Поза горы');
      assert.equal(await page.locator('#stageCount').textContent(),'Этап 1 из 10');
      assert.equal(await page.locator('#totalLabel').textContent(),'6:00 всего');
      assert.equal(await page.locator('#nextMovement').textContent(),'Далее: Подъём рук через стороны');
      assert(await page.locator('#figureCanvas').isVisible());
      const canvas=await page.locator('#figureCanvas').evaluate(el=>{
        const gl=el.getContext('webgl');
        return {w:el.width,h:el.height,error:gl.getError(),drawingW:gl.drawingBufferWidth};
      });
      assert(canvas.w>100&&canvas.h>100&&canvas.drawingW>0,'Canvas has positive dimensions');
      assert.equal(canvas.error,0);
      assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=viewport.width+1,
        'No horizontal overflow at '+viewport.width);
      await page.screenshot({path:'artifacts/yoga/yoga-front-'+viewport.width+'.png',fullPage:true});
      await page.locator('#playButton').click();
      await page.waitForTimeout(220);
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).running);

      const nextPose=async(id,seconds,expectedName)=>{
        await page.locator('#nextButton').click();
        await page.evaluate(t=>window.__yogaPrototype.setElapsed(t),seconds);
        await page.waitForFunction(m=>window.__yogaPrototype.snapshot().mesh?.motion===m,id);
        if(expectedName)assert.equal(await page.locator('#movementName').textContent(),expectedName);
        return page.evaluate(()=>window.__yogaPrototype.snapshot());
      };
      const sun=await nextPose('sun',35/6,'Подъём рук через стороны');
      assert(sun.mesh.shoulderAngle>2.5,'Arm raise should reach above shoulder');
      await page.locator('#cameraButton').click();
      await page.waitForTimeout(360);
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).azimuth>.3,'Camera must rotate');
      await page.screenshot({path:'artifacts/yoga/yoga-arms-'+viewport.width+'.png',fullPage:true});

      await page.locator('#playButton').click();
      const paused=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(paused.running,false);
      await page.waitForTimeout(250);
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).elapsed,
        paused.elapsed,'Pause freezes timer');

      const chair=await nextPose('chair',40/6,'Неглубокая поза стула');
      assert(chair.mesh.kneeBend>.8,'Shallow chair must bend knees');
      await page.screenshot({path:'artifacts/yoga/yoga-chair-'+viewport.width+'.png',fullPage:true});

      const warriorL=await nextPose('warriorL',22.5,'Широкая стойка — левая сторона');
      assert(warriorL.mesh.stance>.20&&warriorL.mesh.warriorL>.70,
        'Left wide stance must spread feet and bend the left knee');
      const warriorR=await nextPose('warriorR',22.5,'Широкая стойка — правая сторона');
      assert(warriorR.mesh.warriorR>.70&&warriorR.mesh.warriorL===0,
        'Right wide stance must bend the opposite knee');
      await page.locator('#cameraButton').click();
      await page.waitForTimeout(360);
      await page.screenshot({path:'artifacts/yoga/yoga-stance-'+viewport.width+'.png',fullPage:true});

      const sideL=await nextPose('sideL',17.5,'Вытяжение вверх — левая рука');
      assert(sideL.mesh.tilt>.07,'Left stretch should have slight movement');
      const sideR=await nextPose('sideR',17.5,'Вытяжение вверх — правая рука');
      assert(sideR.mesh.tilt<-.07,'Right stretch should be mirrored');
      await page.screenshot({path:'artifacts/yoga/yoga-side-'+viewport.width+'.png',fullPage:true});

      const balance=await nextPose('balance',8.75,'Подъём колена с опорой');
      assert(balance.mesh.kneeLift>.65,'Supported knee lift must be visible');
      await page.screenshot({path:'artifacts/yoga/yoga-balance-'+viewport.width+'.png',fullPage:true});
      const open=await nextPose('open',35/6,'Раскрытие грудной клетки');
      assert(open.mesh.shoulderAngle>1.5,'Both arms open outward');
      const release=await nextPose('release',15,'Завершение');
      assert.equal(release.index,9);
      assert.equal(await page.locator('#nextMovement').textContent(),'Последний этап практики');
      await page.locator('#nextButton').click();
      assert(await page.locator('#completeModal').isVisible());
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).done);
      await page.locator('#repeatButton').click();
      assert(!(await page.locator('#completeModal').isVisible()));
      const restarted=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(restarted.index,0);
      assert.equal(restarted.elapsed,0);
      assert.equal(restarted.done,false);
      assert.equal(await page.locator('#movementName').textContent(),'Поза горы');
      assert.equal(await page.locator('#figureCanvas').evaluate(el=>el.getContext('webgl').getError()),0);
      assert.deepEqual(errors,[],'Unexpected page JavaScript errors');
      assert(requests.every(url=>url.startsWith('file://')),'No external network dependencies');
      console.log('PASS '+viewport.width+'x'+viewport.height+' six-minute yoga, 10 poses, joints, controls, offline assets');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
