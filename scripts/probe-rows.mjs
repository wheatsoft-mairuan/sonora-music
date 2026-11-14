import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 20000 });
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const input = page.locator('#global-search input');
await input.click();
await input.fill('周杰伦');
await input.press('Enter');
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.result-list .track-row')].slice(0, 2);
  return rows.map((r) => {
    const like = r.querySelector('.row-like');
    const dur = r.querySelector('.row-duration');
    const alb = r.querySelector('.row-album');
    const cs = like ? getComputedStyle(like) : null;
    return {
      row: r.getBoundingClientRect().toJSON(),
      like: like?.getBoundingClientRect().toJSON(),
      likeOpacity: cs?.opacity, likeColor: cs?.color, likeVisibility: cs?.visibility, likeDisplay: cs?.display,
      duration: dur?.getBoundingClientRect().toJSON(),
      durationText: dur?.textContent,
      album: alb?.textContent,
    };
  });
});
console.log(JSON.stringify(info, null, 2));

await page.locator('.result-list').first().screenshot({ path: 'verify/result-rows.png' });
await page.close();
await browser.close().catch(() => {});
