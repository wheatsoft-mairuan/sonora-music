import { firefox } from 'playwright';
const browser = await firefox.launch({ headless:true, env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'}, firefoxUserPrefs:{
  'security.sandbox.content.level':0,'security.sandbox.gpu.level':0,'gfx.webrender.software':true,'media.autoplay.default':0,
}});
const base='http://127.0.0.1:4173';
const page = await browser.newPage({ viewport:{width:1440,height:900}, timezoneId:'Asia/Shanghai', locale:'zh-CN' });
const issues=[]; page.on('pageerror',e=>issues.push(e.message)); page.on('console',m=>{if(m.type()==='error') issues.push(m.text());});
await page.goto(base); await page.waitForTimeout(7000);
await page.screenshot({path:'screenshots/desktop.png'});
await page.locator('[data-action="play-radio"]').first().click(); await page.waitForTimeout(7000);
await page.screenshot({path:'screenshots/player.png'});
await page.locator('.topbar .icon-button[data-action="open-settings"]').click(); await page.waitForTimeout(900);
await page.screenshot({path:'screenshots/settings.png'});
await page.locator('[data-action="set-theme"][data-value="light"]').click(); await page.waitForTimeout(900);
await page.screenshot({path:'screenshots/settings-light.png'});
await page.locator('[data-action="close-settings"]').click(); await page.waitForTimeout(900);
await page.screenshot({path:'screenshots/light.png'});
// back to dark
await page.locator('.topbar .icon-button[data-action="open-settings"]').click(); await page.waitForTimeout(500);
await page.locator('[data-action="set-theme"][data-value="dark"]').click(); await page.locator('[data-action="close-settings"]').click(); await page.waitForTimeout(500);
const input=page.locator('#global-search input'); await input.click(); await input.fill('周杰伦'); await input.press('Enter'); await page.waitForTimeout(5000);
await page.screenshot({path:'screenshots/search.png'});
await page.locator('#player-panel [data-action="open-queue"]').first().click(); await page.waitForTimeout(1200);
await page.screenshot({path:'screenshots/queue.png'});
console.log('desktop issues', issues.slice(0,8));
const mobile = await browser.newPage({ viewport:{width:390,height:844}, timezoneId:'Asia/Shanghai', locale:'zh-CN', isMobile:true, hasTouch:true });
await mobile.goto(base); await mobile.waitForTimeout(7000);
await mobile.screenshot({path:'screenshots/mobile.png'});
await mobile.locator('.track-card-main').first().scrollIntoViewIfNeeded(); await mobile.waitForTimeout(500);
await mobile.locator('.track-card-main').first().click(); await mobile.waitForTimeout(7000);
await mobile.screenshot({path:'screenshots/mobile-playing.png'});
await mobile.locator('#mini-player .mini-meta').click(); await mobile.waitForTimeout(900);
await mobile.screenshot({path:'screenshots/mobile-player.png'});
console.log('done');
await browser.close();
