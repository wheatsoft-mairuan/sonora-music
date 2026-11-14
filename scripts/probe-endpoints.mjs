import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 20000 });
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });

const base = 'https://music-api.gdstudio.xyz/api.php';
const cases = {
  search: { types: 'search', source: 'netease', name: '周杰伦', count: '3', pages: '1' },
  playlist: { types: 'playlist', source: 'netease', id: '19723756' },
  pic: { types: 'pic', source: 'netease', id: '109951163038292176', size: '500' },
  url: { types: 'url', source: 'netease', id: '509781655', br: '320' },
  lyric: { types: 'lyric', source: 'netease', id: '509781655' },
};

const out = {};
for (const [name, params] of Object.entries(cases)) {
  const u = `${base}?${new URLSearchParams(params)}`;
  out[name] = await page.evaluate(async (u) => {
    try {
      const r = await fetch(u, { headers: { Accept: 'application/json' } });
      const t = await r.text();
      return { ok: r.ok, status: r.status, acao: r.headers.get('access-control-allow-origin'), type: r.type, len: t.length, head: t.slice(0, 160) };
    } catch (e) { return { error: String(e) }; }
  }, u);
  await page.waitForTimeout(400);
}
console.log(JSON.stringify(out, null, 2));
await page.close();
await browser.close().catch(() => {});
