'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  assert(fs.existsSync('yoga-prototype.html'));
  assert(fs.existsSync('assets/yoga-prototype.js'));
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
      assert.equal(initial.mesh?.joints,17,'Model must use a real skeletal hierarchy');
      assert(initial.mesh?.triangles>1500,'Human surface must be a detailed skin mesh');
      assert(initial.mesh?.points>100,'Human figure must have a visible particle surface');
      assert.equal(initial.totalDuration,170);
      assert.equal(initial.index,0);
      assert.equal(initial.running,false);
      assert.equal(await page.locator('#movementName').textContent(),'Спокойная стойка');
      assert.equal(await page.locator('#totalLabel').textContent(),'2:50 всего');
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
      await page.waitForTimeout(320);
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).running);
      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Раскрытие плеч');
      await page.locator('#cameraButton').click();
      await page.waitForTimeout(500);
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).azimuth>.3,
        '3D camera should rotate');
      await page.screenshot({
        path:'artifacts/yoga/yoga-side-'+viewport.width+'.png',fullPage:true
      });
      await page.locator('#playButton').click();
      const paused=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(paused.running,false);
      await page.waitForTimeout(260);
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).elapsed,
        paused.elapsed,'Pause should freeze practice timer');
      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Плавный подъём рук');
      await page.locator('#cameraButton').click();
      await page.evaluate(()=>{
        window.__yogaPrototype.setElapsed(8.33);
      });
      await page.waitForTimeout(550);
      const raised=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert(raised.mesh?.shoulderAngle>2.0,
        'Arm lift must rotate a skeletal shoulder joint');
      await page.screenshot({
        path:'artifacts/yoga/yoga-arms-up-'+viewport.width+'.png',fullPage:true
      });
      await page.locator('#nextButton').click();
      assert.equal(await page.locator('#movementName').textContent(),'Возвращение к покою');
      await page.locator('#nextButton').click();
      assert(await page.locator('#completeModal').isVisible());
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).done,true);
      await page.locator('#repeatButton').click();
      assert(!(await page.locator('#completeModal').isVisible()));
      assert.equal(await page.locator('#movementName').textContent(),'Спокойная стойка');
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).done,false);
      assert.deepEqual(errors,[],'Unexpected client errors');
      assert(requests.every(url=>url.startsWith('file://')),
        'Prototype must load without any external network requests');
      console.log('PASS yoga '+viewport.width+'x'+viewport.height+
        ' WebGL figure, controls, camera, session and offline assets');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
