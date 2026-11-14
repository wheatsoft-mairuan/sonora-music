import { firefox } from 'playwright';
const browser = await firefox.launch({ headless:true, env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'}, firefoxUserPrefs:{
  'security.sandbox.content.level':0,'security.sandbox.gpu.level':0,'gfx.webrender.software':true,'media.autoplay.default':0,
}});
const page = await browser.newPage({ viewport:{ width:390, height:844 }, timezoneId:'Asia/Shanghai', locale:'zh-CN', isMobile:true, hasTouch:true });
const issues=[]; page.on('pageerror',e=>issues.push(e.message)); page.on('console',m=>{if(m.type()==='error') issues.push(m.text());});
await page.goto('http://127.0.0.1:4173');
await page.waitForTimeout(7000);
const before = await page.evaluate(()=>{const m=document.querySelector('#mini-player');const cs=getComputedStyle(m);return {sw:document.body.scrollWidth,cw:document.documentElement.clientWidth,mini:{display:cs.display,visibility:cs.visibility,opacity:cs.opacity,transform:cs.transform,rect:m.getBoundingClientRect().toJSON()},nav:getComputedStyle(document.querySelector('.mobile-nav')).display,scrollPadding:getComputedStyle(document.querySelector('#main-scroll')).paddingBottom,clock:document.querySelector('#live-clock')?.textContent};});
console.log('BEFORE', JSON.stringify(before));
await page.screenshot({path:'/tmp/m-home.png'});
await page.locator('.track-card-main').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.locator('.track-card-main').first().click();
await page.waitForTimeout(3000);
const after = await page.evaluate(()=>{const m=document.querySelector('#mini-player');const cs=getComputedStyle(m);return {title:window.sonora.state.current?.name,mini:{display:cs.display,visibility:cs.visibility,opacity:cs.opacity,rect:m.getBoundingClientRect().toJSON()},has: m.classList.contains('has-current'),err:window.sonora.audio?.error?.code||null};});
console.log('AFTER', JSON.stringify(after));
await page.screenshot({path:'/tmp/m-playing.png'});
await page.locator('#mini-player .mini-meta').click();
await page.waitForTimeout(800);
console.log('sheet', await page.evaluate(()=>({open:document.body.classList.contains('sheet-open'),body:document.body.className,sheet:document.querySelector('#player-sheet').getBoundingClientRect().toJSON()})));
await page.screenshot({path:'/tmp/m-sheet.png'});
console.log('ISSUES', issues.slice(0,8));
await browser.close();
