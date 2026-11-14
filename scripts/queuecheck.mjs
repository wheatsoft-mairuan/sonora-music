import { firefox } from 'playwright';
const browser = await firefox.launch({ headless:true, env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'}, firefoxUserPrefs:{'security.sandbox.content.level':0,'gfx.webrender.software':true,'media.autoplay.default':0}});
const page = await browser.newPage({ viewport:{width:1440,height:900}, timezoneId:'Asia/Shanghai', locale:'zh-CN' });
await page.goto('http://127.0.0.1:4173'); await page.waitForTimeout(6000);
await page.locator('[data-action="play-radio"]').first().click(); await page.waitForTimeout(3000);
await page.locator('#player-panel [data-action="open-queue"]').first().click(); await page.waitForTimeout(900);
console.log(await page.evaluate(()=>{
 const d=document.querySelector('#queue-drawer'), p=document.querySelector('#player-panel'), cs=getComputedStyle(d);
 const e=document.elementFromPoint(1120,70);
 return {bg:cs.background, bgc:cs.backgroundColor, op:cs.opacity, vis:cs.visibility, z:cs.zIndex, rect:d.getBoundingClientRect().toJSON(), pz:getComputedStyle(p).zIndex, atPoint:e?.className+'|'+e?.tagName, stack:document.elementsFromPoint(1120,70).slice(0,5).map(x=>x.id||x.className||x.tagName)};
}));
await page.screenshot({path:'/tmp/q2.png'});
await browser.close();
