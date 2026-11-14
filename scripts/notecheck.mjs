import { firefox } from 'playwright';
const browser=await firefox.launch({headless:true,env:{...process.env,MOZ_DISABLE_CONTENT_SANDBOX:'1',MOZ_DISABLE_RDD_SANDBOX:'1'},firefoxUserPrefs:{'security.sandbox.content.level':0,'gfx.webrender.software':true}});
const page=await browser.newPage({viewport:{width:840,height:900}});
await page.goto('http://127.0.0.1:4173'); await page.waitForTimeout(4000);
console.log(await page.evaluate(()=>{const n=document.querySelector('.hero-note-card');const cs=getComputedStyle(n);return {bottom:cs.bottom,left:cs.left,transform:cs.transform,rect:n.getBoundingClientRect().toJSON(),art:document.querySelector('.hero-art').getBoundingClientRect().toJSON(),nav:document.querySelector('.mobile-nav').getBoundingClientRect().toJSON()};}));
await browser.close();
