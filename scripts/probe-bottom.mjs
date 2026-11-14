import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 20000 });
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const result = await page.evaluate(async () => {
  const scroller = document.querySelector('#main-scroll') || document.scrollingElement;
  scroller.scrollTop = scroller.scrollHeight;
  await new Promise((r) => setTimeout(r, 1200));
  const pad = getComputedStyle(scroller).paddingBottom;
  const cards = [...document.querySelectorAll('.track-card, .collection-card, .mood-hero, .room-card')];
  const last = cards[cards.length - 1];
  const mini = document.querySelector('#mini-player');
  const nav = document.querySelector('.mobile-nav, .bottom-nav, #mobile-nav');
  return {
    pad,
    scrollTop: scroller.scrollTop,
    scrollHeight: scroller.scrollHeight,
    clientHeight: scroller.clientHeight,
    lastCard: last?.getBoundingClientRect().toJSON(),
    lastClass: last?.className,
    mini: mini?.getBoundingClientRect().toJSON(),
    nav: nav?.getBoundingClientRect().toJSON(),
    viewportH: innerHeight,
  };
});
console.log(JSON.stringify(result, null, 2));
await page.screenshot({ path: 'verify/13-mobile-bottom.png' });
await page.close();
await browser.close().catch(() => {});
