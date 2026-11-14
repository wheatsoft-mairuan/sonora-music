import { firefox } from 'playwright';
const browser = await firefox.launch({ headless:true, env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'}, firefoxUserPrefs:{
  'security.sandbox.content.level':0,'security.sandbox.gpu.level':0,'gfx.webrender.software':true,'media.autoplay.default':0,
}});
const page = await browser.newPage({ viewport:{width:1440,height:900}, timezoneId:'Asia/Shanghai', locale:'zh-CN' });
const issues=[]; page.on('pageerror',e=>issues.push(e.message)); page.on('console',m=>{if(m.type()==='error') issues.push(m.text());});
await page.goto('http://127.0.0.1:4173');
await page.waitForTimeout(7000);
await page.locator('[data-action="play-radio"]').first().click();
await page.waitForTimeout(5000);
console.log('loader after settle', await page.locator('.cover-loader').count());
await page.locator('#player-panel .player-like').click();
await page.waitForTimeout(400);
console.log('favorite', await page.evaluate(()=>({count:window.sonora.state.favorites?.length ?? JSON.parse(localStorage.getItem('sonora:favorites')||'[]').length, liked:document.querySelector('#player-panel .player-like')?.classList.contains('is-liked')})));
await page.locator('.topbar .icon-button[data-action="open-settings"]').click();
await page.waitForTimeout(500);
await page.locator('[data-action="set-theme"][data-value="light"]').click();
await page.waitForTimeout(1200);
await page.locator('[data-action="close-settings"]').click();
await page.waitForTimeout(700);
await page.screenshot({path:'/tmp/light-page.png'});
await page.locator('#player-panel [data-action="open-queue"]').first().click();
await page.waitForTimeout(700);
console.log('queue', await page.evaluate(()=>({open:document.body.classList.contains('queue-open'), w:document.querySelector('#queue-drawer')?.getBoundingClientRect().width, items:document.querySelectorAll('.queue-item').length})));
await page.screenshot({path:'/tmp/queue.png'});
console.log('ISSUES', issues.slice(0,10));
await browser.close();
