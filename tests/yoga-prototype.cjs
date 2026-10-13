'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  for(const file of ['yoga-prototype.html','assets/yoga-prototype.js','assets/yoga-program.js',
    'assets/yoga-asanas.js','assets/yoga-mannequin.js','assets/yoga-prototype.css']){
    assert(fs.existsSync(file),'Missing '+file);
  }
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
      '--enable-unsafe-swiftshader','--use-angle=swiftshader']
  });
  fs.mkdirSync('artifacts/yoga',{recursive:true});
  const poses=['mountain','salute','fold','half','plank','cobra','dog','lungeL',
    'warrior1L','warrior2L','triangleL','dog','lungeR','warrior1R',
    'warrior2R','triangleR','dog','plank','child','catcow','butterfly',
    'staff','bridge','twistL','twistR','savasana'];
  try{
    for(const viewport of [{width:320,height:700},{width:390,height:844},{width:768,height:1024}]){
      const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
      const page=await context.newPage(),errors=[],requests=[];
      page.on('pageerror',err=>errors.push(err.message));
      page.on('request',req=>requests.push(req.url()));
      await page.goto('file://'+path.resolve('yoga-prototype.html'),{waitUntil:'load',timeout:30000});
      await page.waitForFunction(()=>window.__yogaPrototype!==undefined);
      await page.waitForTimeout(180);
      const initial=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert(initial.webgl,'3D WebGL context must initialize');
      assert.equal(initial.mesh?.material,'wood');
      assert.equal(initial.mesh?.joints,14);
      assert(initial.mesh?.triangles>1500);
      assert.equal(initial.totalDuration,1100,'Practice must last 18 min 20 seconds');
      assert.equal(initial.stages,26);
      assert.deepEqual(initial.poses,poses);
      assert.equal(initial.durations.reduce((sum,n)=>sum+n,0),1100);
      assert.equal(await page.locator('#stageCount').textContent(),'Асана 1 из 26');
      assert.equal(await page.locator('#movementName').textContent(),'Тадасана · Поза горы');
      assert.equal(await page.locator('#totalLabel').textContent(),'18:20 всего');
      assert.equal(await page.locator('#practiceSection').textContent(),'Старт');
      assert(await page.locator('#figureCanvas').isVisible());
      const canvas=await page.locator('#figureCanvas').evaluate(el=>{
        const gl=el.getContext('webgl');
        return {width:el.width,height:el.height,error:gl.getError()};
      });
      assert(canvas.width>100&&canvas.height>100,'Canvas must render at mobile size');
      assert.equal(canvas.error,0);
      assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=viewport.width+1,
        'No horizontal overflow at '+viewport.width);
      await page.screenshot({path:'artifacts/yoga/yoga-standing-'+viewport.width+'.png',fullPage:true});

      // Voice is enabled by default for guided practice; it can be switched off.
      assert.equal(initial.voice,true);
      await page.locator('#voiceButton').click();
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).voice,false);
      await page.locator('#playButton').click();
      await page.waitForTimeout(200);
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).running);
      await page.locator('#cameraButton').click();
      await page.waitForTimeout(600);
      const cameraDebug=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      console.log('CAMERA DEBUG',JSON.stringify({
        azimuth:cameraDebug.azimuth,frames:cameraDebug.mesh?.frames,
        errors:errors.length
      }));
      assert(cameraDebug.mesh?.frames>2,'3D render loop stopped unexpectedly');
      assert(cameraDebug.azimuth>1.0,'Side camera must rotate');
      await page.locator('#playButton').click();
      const paused=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(paused.running,false);
      await page.waitForTimeout(230);
      assert.equal((await page.evaluate(()=>window.__yogaPrototype.snapshot())).elapsed,
        paused.elapsed,'Pause must freeze the timeline');
      await page.locator('#cameraButton').click();

      // Verify all full-body asanas are reached, have non-trivial pose geometry,
      // and do not emit WebGL errors. Capture standing and floor states.
      for(let index=0;index<poses.length;index++){
        await page.evaluate(n=>{
          window.__yogaPrototype.jump(n);
          window.__yogaPrototype.setElapsed(9);
        },index);
        await page.waitForFunction(expected=>window.__yogaPrototype.snapshot().mesh?.pose===expected,poses[index]);
        const snapshot=await page.evaluate(()=>window.__yogaPrototype.snapshot());
        assert.equal(snapshot.index,index);
        assert.equal(snapshot.mesh.pose,poses[index]);
        assert(Number.isFinite(snapshot.mesh.headY)&&Number.isFinite(snapshot.mesh.hipY),
          'Pose landmarks must be finite');
        if(index===6){
          assert(snapshot.mesh.hipY>1.7,'Downward dog must lift the hips');
          await page.screenshot({path:'artifacts/yoga/yoga-dog-'+viewport.width+'.png',fullPage:true});
        }
        if(index===9){
          assert(snapshot.mesh.leftAnkleZ>.5,'Warrior must move front foot forward');
          await page.screenshot({path:'artifacts/yoga/yoga-warrior-'+viewport.width+'.png',fullPage:true});
        }
        if(index===18){
          assert(snapshot.mesh.headY<.5,'Child pose must lower head near mat');
          await page.screenshot({path:'artifacts/yoga/yoga-child-'+viewport.width+'.png',fullPage:true});
        }
        if(index===20){
          assert(snapshot.mesh.hipY<.4,'Seated pose should reach the mat');
          await page.screenshot({path:'artifacts/yoga/yoga-seated-'+viewport.width+'.png',fullPage:true});
        }
        if(index===22){
          assert(snapshot.mesh.hipY>.75,'Bridge should lift pelvis');
          await page.screenshot({path:'artifacts/yoga/yoga-bridge-'+viewport.width+'.png',fullPage:true});
        }
        if(index===25){
          assert(snapshot.mesh.headY<.4,'Savasana should lie on mat');
          await page.screenshot({path:'artifacts/yoga/yoga-savasana-'+viewport.width+'.png',fullPage:true});
        }
      }
      assert.equal(await page.locator('#nextMovement').textContent(),'Последний этап практики');
      await page.locator('#nextButton').click();
      assert(await page.locator('#completeModal').isVisible());
      assert((await page.evaluate(()=>window.__yogaPrototype.snapshot())).done);
      await page.locator('#repeatButton').click();
      assert(!(await page.locator('#completeModal').isVisible()));
      const restart=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      assert.equal(restart.index,0);
      assert.equal(restart.elapsed,0);
      assert(!restart.running&&!restart.done);
      assert.equal(await page.locator('#figureCanvas').evaluate(el=>el.getContext('webgl').getError()),0);
      assert.deepEqual(errors,[],'Unexpected browser JS errors');
      assert(requests.every(url=>url.startsWith('file://')),'Yoga must work offline without external requests');
      console.log('PASS yoga '+viewport.width+'x'+viewport.height+' 26 asanas, 18:20, ground poses and controls');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
