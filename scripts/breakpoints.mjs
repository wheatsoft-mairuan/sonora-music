import { firefox } from 'playwright';
const browser = await firefox.launch({ headless:true, env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'}, firefoxUserPrefs:{'security.sandbox.content.level':0,'gfx.webrender.software':true,'media.autoplay.default':0}});
for (const [w,h] of [[1280,800],[840,900],[560,900]]) {
 const page=await browser.newPage({viewport:{width:w,height:h}, timezoneId:'Asia/Shanghai', locale:'zh-CN'});
 await page.goto('http://127.0.0.1:4173'); await page.waitForTimeout(5500);
 const m=await page.evaluate(()=>({sw:document.body.scrollWidth,cw:innerWidth,panel:getComputedStyle(document.querySelector('.player-panel')).display,sidebar:getComputedStyle(document.querySelector('.sidebar')).transform,nav:getComputedStyle(document.querySelector('.mobile-nav')).display,hero:document.querySelector('.hero').getBoundingClientRect().toJSON(),h1:document.querySelector('.hero h1').getBoundingClientRect().toJSON(),art:document.querySelector('.hero-art').getBoundingClientRect().toJSON()}));
 console.log(w, JSON.stringify(m));
 await page.screenshot({path:`/tmp/bp-${w}.png`});
 await page.close();
}
await browser.close();
