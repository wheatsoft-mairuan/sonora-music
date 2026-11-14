import { firefox } from 'playwright';
const browser = await firefox.launch({ headless:true, env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'}, firefoxUserPrefs:{
  'security.sandbox.content.level':0,'security.sandbox.gpu.level':0,'gfx.webrender.software':true,'media.autoplay.default':0,
}});
const page = await browser.newPage({ viewport:{width:1440,height:900}, timezoneId:'Asia/Shanghai', locale:'zh-CN' });
const issues=[]; page.on('pageerror',e=>issues.push(e.message)); page.on('console',m=>{if(m.type()==='error') issues.push(m.text());});
await page.goto('http://127.0.0.1:4173'); await page.waitForTimeout(7000);
await page.locator('[data-action="play-radio"]').first().click(); await page.waitForTimeout(5000);
await page.screenshot({path:'screenshots/player.png'});
const input=page.locator('#global-search input');
await input.click(); await input.fill('周杰伦'); await input.press('Enter');
let n=0;
for (let i=0;i<3;i++) {
  try { await page.waitForFunction(()=>window.sonora.state.search.loading===false && window.sonora.state.search.results.length>0, null, {timeout:12000}); n=await page.evaluate(()=>window.sonora.state.search.results.length); if(n) break; }
  catch { const retry=page.locator('[data-action="retry-search"]'); if(await retry.count()) await retry.click(); await page.waitForTimeout(2500); }
}
console.log('results', n, 'issues', issues.slice(0,3));
await page.waitForTimeout(2500);
await page.screenshot({path:'screenshots/search.png'});
await page.locator('#player-panel [data-action="open-queue"]').first().click(); await page.waitForTimeout(1200);
await page.screenshot({path:'screenshots/queue.png'});
await browser.close();
