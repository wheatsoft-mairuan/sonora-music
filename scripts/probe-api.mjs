import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 20000 });
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();

const out = {};
const url = 'https://music-api.gdstudio.xyz/api.php?types=search&source=netease&name=' + encodeURIComponent('周杰伦') + '&count=2&pages=1';

// 1) plain fetch from a page context (same as app does)
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
out.plainFetch = await page.evaluate(async (u) => {
  try {
    const r = await fetch(u, { headers: { Accept: 'application/json' } });
    const t = await r.text();
    return { ok: r.ok, status: r.status, acao: r.headers.get('access-control-allow-origin'), len: t.length, head: t.slice(0, 200) };
  } catch (e) { return { error: String(e) }; }
}, url);

// 2) raw response headers via CDP network events
const cdp = await page.context().newCDPSession(page);
const resp = [];
cdp.on('Network.responseReceived', (e) => {
  if (e.response.url.includes('gdstudio')) resp.push({ status: e.response.status, headers: e.response.headers });
});
await cdp.send('Network.enable');
await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
out.rawHeaders = resp;
out.bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 400);

console.log(JSON.stringify(out, null, 2));
await page.close();
await browser.close().catch(() => {});
