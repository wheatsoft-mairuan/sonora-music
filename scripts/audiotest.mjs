import { firefox } from 'playwright';
const browser = await firefox.launch({ headless:true, env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'}, firefoxUserPrefs:{'security.sandbox.content.level':0,'media.autoplay.default':0}});
const page = await browser.newPage();
page.on('requestfailed', r=>console.log('FAIL',r.url(),r.failure()?.errorText));
page.on('response', r=>{ if(r.url().includes('.mp3')) console.log('RESP',r.status(),r.headers()['content-type'],r.headers()['content-length']); });
await page.setContent(`<audio id=a controls autoplay src="https://m801.music.126.net/20261114022625/253d982453e51b0414100fc9a976eaba/jdymusic/obj/wo3DlMOGwrbDjj7DisKw/17555556350/f890/1bc8/142f/2bfd1b21ce6609ef585fa2b455ae1ec7.mp3"></audio>`);
await page.waitForTimeout(8000);
console.log(await page.evaluate(()=>{const a=document.querySelector('#a'); return {rs:a.readyState, ns:a.networkState, err:a.error&&{code:a.error.code,msg:a.error.message}, paused:a.paused, ct:a.currentTime, dur:a.duration, can:a.canPlayType('audio/mpeg')};}));
await browser.close();
