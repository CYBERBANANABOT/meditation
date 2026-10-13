'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  assert(fs.existsSync('yoga-prototype.html'));
  assert(fs.existsSync('assets/yoga-prototype.js'));
  assert(fs.existsSync('assets/yoga-mannequin.js'));
  assert(fs.existsSync('assets/yoga-prototype.css'));
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
    headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
      '--enable-unsafe-swiftshader','--use-angle=swiftshader']
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
      await page.goto('file://'+path.resolve('yoga-prototype.html'),{
        waitUntil:'load',timeout:30000
      });
      await page.waitForFunction(()=>window.__yogaPrototype!==undefined);
      await page.waitForTimeout(400);
      const initial=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert(initial.webgl,'3D WebGL should initialize on test device');
      assert.equal(initial.mesh?.material,'wood','New model must use wooden material');
      assert.equal(initial.mesh?.joints,14,'Mannequin must have fourteen visible articulated hinges');
      assert(initial.mesh?.segments>=18,'Mannequin must have distinct body segments');
      assert(initial.mesh?.triangles>1500,'Rounded wooden segments should use real 3D surfaces');
      assert.equal(initial.totalDuration,600,'Full routine must last exactly ten minutes');
      assert.deepEqual(initial.durations,[60,60,90,90,60,90,60,90]);
      assert.equal(initial.stages,8);
      assert.equal(initial.stage,'arrival');
      assert.equal(initial.index,0);
      assert.equal(initial.running,false);
      assert.equal(await page.locator('#movementName').textContent(),'Настрой и дыхание');
      assert.equal(await page.locator('#totalLabel').textContent(),'10:00 всего');
      assert.equal(await page.locator('#stageCount').textContent(),'Этап 1 из 8');
      assert.equal(await page.locator('#nextMovement').textContent(),
        'Далее: Мягкие движения плечами');
      assert(await page.locator('#figureCanvas').isVisible());
      const canvas=await page.locator('#figureCanvas').evaluate(el=>{
        const gl=el.getContext('webgl');
        return {w:el.width,h:el.height,error:gl.getError(),drawingW:gl.drawingBufferWidth};
      });
      assert(canvas.w>100&&canvas.h>100&&canvas.drawingW>0,
        '3D canvas should have positive dimensions');
      assert.equal(canvas.error,0,'WebGL errors in 3D renderer');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert(overflow<=viewport.width+1,'Horizontal overflow at '+viewport.width);
      await page.screenshot({
        path:'artifacts/yoga/yoga-front-'+viewport.width+'.png',fullPage:true
      });
      await page.locator('#playButton').click();
      await page.waitForTimeout(240);
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).running);

      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Мягкие движения плечами');
      await page.evaluate(()=>window.__yogaPrototype.setElapsed(6));
      await page.waitForTimeout(200);
      const shoulders=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(shoulders.mesh.motion,'shoulders');
      assert(shoulders.mesh.shoulderLift>.055,'Shoulder elevation must animate');
      await page.locator('#cameraButton').click();
      await page.waitForTimeout(400);
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).azimuth>.3,
        '3D camera should rotate');
      await page.screenshot({path:'artifacts/yoga/yoga-side-'+viewport.width+'.png',fullPage:true});
      await page.locator('#playButton').click();
      const paused=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(paused.running,false);
      await page.waitForTimeout(250);
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).elapsed,
        paused.elapsed,'Pause should freeze practice timer');

      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Подъём и опускание рук');
      await page.locator('#cameraButton').click();
      await page.evaluate(()=>window.__yogaPrototype.setElapsed(7.5));
      await page.waitForTimeout(380);
      const raised=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(raised.mesh.motion,'arms');
      assert(raised.mesh.shoulderAngle>2.4,'Shoulder hinges should raise arms overhead');
      await page.screenshot({path:'artifacts/yoga/yoga-arms-up-'+viewport.width+'.png',fullPage:true});

      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Вытяжение рук в стороны');
      await page.evaluate(()=>window.__yogaPrototype.setElapsed(7.5));
      await page.waitForTimeout(180);
      const reach=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(reach.mesh.motion,'reach');
      assert(Math.abs(reach.mesh.tilt)>.03,'Small side motion should animate');
      assert(reach.mesh.shoulderAngle>1.3,'Independent arm should reach sideways');
      await page.screenshot({path:'artifacts/yoga/yoga-side-reach-'+viewport.width+'.png',fullPage:true});

      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Кисти и стопы');
      await page.evaluate(()=>window.__yogaPrototype.setElapsed(3.75));
      await page.waitForTimeout(180);
      const extremities=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(extremities.mesh.motion,'extremities');
      assert(extremities.mesh.heelLift>.03,'Heels should lift');
      assert(Math.abs(extremities.mesh.wristFlex)>.08,'Wrists should rotate');

      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Плавный перенос веса');
      await page.evaluate(()=>window.__yogaPrototype.setElapsed(5.625));
      await page.waitForTimeout(180);
      const balance=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(balance.mesh.motion,'balance');
      assert(Math.abs(balance.mesh.shift)>.04,'Gentle body weight shift should animate');
      await page.screenshot({path:'artifacts/yoga/yoga-balance-'+viewport.width+'.png',fullPage:true});

      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Возвращение к дыханию');
      await page.waitForFunction(()=>
        window.__yogaPrototype.snapshot().mesh?.motion==='breath');
      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Завершение и расслабление');
      assert.equal(await page.locator('#nextMovement').textContent(),'Последний этап практики');
      await page.locator('#nextButton').click();
      assert(await page.locator('#completeModal').isVisible());
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).done,true);
      await page.locator('#repeatButton').click();
      assert(!(await page.locator('#completeModal').isVisible()));
      assert.equal(await page.locator('#movementName').textContent(),'Настрой и дыхание');
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).done,false);
      const finalError=await page.locator('#figureCanvas').evaluate(el=>el.getContext('webgl').getError());
      assert.equal(finalError,0,'No WebGL errors across all eight movements');
      assert.deepEqual(errors,[],'Unexpected client errors');
      assert(requests.every(url=>url.startsWith('file://')),
        'Prototype must load without any external network requests');
      console.log('PASS yoga '+viewport.width+'x'+viewport.height+
        ' wooden WebGL mannequin, controls, camera, session and offline assets');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
