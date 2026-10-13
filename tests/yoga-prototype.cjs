'use strict';
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  for(const file of ['yoga-prototype.html','assets/yoga-prototype.js','assets/yoga-program.js',
    'assets/yoga-asanas.js','assets/yoga-head.js',
    'assets/yoga-mannequin.js','assets/yoga-prototype.css']){
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
      assert.equal(initial.mesh?.eyes,2,'Wooden instructor must have two eyes');
      assert.equal(initial.mesh?.face?.eyes?.length,2,'Eyes not drawn with the head');
      assert.equal(initial.mesh?.mat,'world-space','Mat and figure need one projection');
      assert.equal(await page.locator('.scene-mat').evaluate(el=>getComputedStyle(el).display),
        'none','Misaligned CSS mat must not be visible over the 3D mat');
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
      const eyesBeforeCamera=await page.evaluate(()=>
        window.__yogaPrototype.snapshot().mesh?.face?.eyes);
      await page.locator('#cameraButton').click();
      await page.waitForTimeout(600);
      const eyesAfterCamera=await page.evaluate(()=>
        window.__yogaPrototype.snapshot().mesh?.face?.eyes);
      assert.deepEqual(eyesAfterCamera,eyesBeforeCamera,
        'Orbiting the camera must not drag eyes around the head');
      const cameraDebug=await page.evaluate(()=>window.__yogaPrototype.snapshot());
      console.log('CAMERA DEBUG',JSON.stringify({
        azimuth:cameraDebug.azimuth,frames:cameraDebug.mesh?.frames,
        errors
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
        const headCenter=snapshot.mesh.headCenter;
        const faceAxes=snapshot.mesh.face;
        assert(headCenter&&faceAxes,'Face diagnostics missing');
        for(const eye of faceAxes.eyes){
          const offset=eye.map((v,k)=>v-headCenter[k]);
          const alongUp=offset.reduce((s,v,k)=>s+v*faceAxes.up[k],0);
          const inFront=offset.reduce((s,v,k)=>s+v*faceAxes.forward[k],0);
          assert(alongUp>.005&&alongUp<.05,
            poses[index]+': eye moved onto crown/chin');
          assert(inFront>.15,poses[index]+': eye moved behind face');
        }
        const face=snapshot.mesh.face;
        assert(face?.eyes?.length===2,'Eyes missing in '+poses[index]);
        const magnitude=Math.hypot(...face.forward);
        assert(Math.abs(magnitude-1)<.001,'Head orientation invalid');
        if(['bridge','twistL','twistR','savasana'].includes(poses[index]))
          assert(face.forward[1]>.1,poses[index]+': eyes should face upward');
        assert(snapshot.mesh.rig?.maxError<.008,poses[index]+': stretched limb or neck detected');
        assert(Number.isFinite(snapshot.mesh.headY)&&Number.isFinite(snapshot.mesh.hipY),
          'Pose landmarks must be finite');
        if([8,9,13,14].includes(index)){
          const facing=snapshot.mesh.face;
          assert(facing&&facing.eyes.length===2,'Eyes missing in '+poses[index]);
          if(index===9)assert(facing.forward[0]>.15,
            'Left Warrior II head did not turn with eyes');
          if(index===14)assert(facing.forward[0]<-.15,
            'Right Warrior II head did not turn with eyes');
        }
        if(viewport.width===390){
          // Let the automatic camera reach its final angle before archiving.
          // Otherwise consecutive poses were photographed mid-turn.
          await page.waitForTimeout(420);
          if(index===20||index===23||index===24){
            const camera=await page.evaluate(()=>window.__yogaPrototype.snapshot());
            if(index===20)assert(camera.azimuth<.5,
              'Butterfly needs front view for symmetric knees');
            else assert(camera.azimuth>.65&&camera.azimuth<1.15,
              poses[index]+': twists need oblique view to show torso and crossed knees');
          }
          await page.screenshot({
            path:'artifacts/yoga/pose-'+String(index+1).padStart(2,'0')+'-'+poses[index]+'.png',
            fullPage:true
          });
        }
        if(viewport.width===390&&index===22){
          // Record the physical bridge sequence instead of only its finish.
          for(const seconds of [0,7,14,21,24,28]){
            await page.evaluate(t=>window.__yogaPrototype.setElapsed(t),seconds);
            await page.waitForTimeout(100);
            const stage=await page.evaluate(()=>window.__yogaPrototype.snapshot());
            if(seconds===21)assert(stage.mesh.hipY<.30,
              'Bridge pelvis lifted before lying down with bent knees');
            if(seconds===28)assert(stage.mesh.hipY>.75,
              'Bridge pelvis never lifted');
            await page.screenshot({
              path:'artifacts/yoga/bridge-transition-'+seconds+'.png'
            });
          }
          await page.evaluate(()=>window.__yogaPrototype.setElapsed(9));
        }
        if(viewport.width===390&&[4,5,6,17].includes(index)){
          // Archive half-way motion, not only the final resting silhouette.
          await page.evaluate(()=>window.__yogaPrototype.setElapsed(2.5));
          await page.waitForTimeout(180);
          await page.screenshot({path:'artifacts/yoga/transition-'+index+'.png'});
          await page.evaluate(()=>window.__yogaPrototype.setElapsed(9));
        }
        if(index===6){
          assert(snapshot.mesh.hipY>1.0&&snapshot.mesh.hipY>snapshot.mesh.headY,'Dog must lift hips above head');
          await page.screenshot({path:'artifacts/yoga/yoga-dog-'+viewport.width+'.png',fullPage:true});
        }
        if(index===9){
          assert(snapshot.mesh.leftAnkleZ>.40,'Warrior must move front foot forward');
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
