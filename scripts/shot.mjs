import { firefox } from 'playwright';
import fs from 'node:fs';

const browser = await firefox.launch({
  headless: true,
  env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1', MOZ_DISABLE_RDD_SANDBOX: '1', MOZ_DISABLE_GMP_SANDBOX: '1' },
  firefoxUserPrefs: { 'security.sandbox.content.level': 0, 'security.sandbox.gpu.level': 0, 'gfx.webrender.software': true, 'media.autoplay.default': 0 },
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const issues = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`[console.${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => issues.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => { if (!r.url().includes('music.126.net')) issues.push(`[failed] ${r.url().slice(0,120)} :: ${r.failure()?.errorText}`); });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await page.screenshot({ path: '/tmp/sonora-1440.png', fullPage: false });

const metrics = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: cs.display, overflowY: cs.overflowY, color: cs.color, bg: cs.backgroundColor };
  };
  return {
    body: { sw: document.body.scrollWidth, cw: document.body.clientWidth, sh: document.body.scrollHeight, ch: document.body.clientHeight },
    app: pick('#app'), grid: pick('.app-grid'), sidebar: pick('.sidebar'), main: pick('.main-area'), topbar: pick('.topbar'), scroll: pick('.main-scroll'), panel: pick('.player-panel'), hero: pick('.hero'), trackGrid: pick('.track-grid'), card: pick('.track-card'), chart: pick('.chart-shell'), mini: pick('.mini-player'), mobileNav: pick('.mobile-nav'),
    boot: !!document.querySelector('#boot-screen'),
    views: document.querySelectorAll('.track-card').length,
    texts: [...document.querySelectorAll('.track-card strong')].slice(0,3).map(e=>e.textContent),
    searchField: !!document.querySelector('#global-search')?.shadowRoot,
    searchValue: document.querySelector('#global-search')?.value,
    mduiPrimary: getComputedStyle(document.documentElement).getPropertyValue('--mdui-color-primary').trim(),
    mduiSurface: getComputedStyle(document.documentElement).getPropertyValue('--mdui-color-surface').trim(),
    font: getComputedStyle(document.body).fontFamily,
  };
});
console.log(JSON.stringify({ metrics, issues: issues.slice(0, 40) }, null, 2));

await page.setViewportSize({ width: 1024, height: 800 });
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/sonora-1024.png', fullPage: false });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/sonora-390.png', fullPage: false });
const mobile = await page.evaluate(() => ({
  sw: document.body.scrollWidth, cw: document.body.clientWidth,
  hero: getComputedStyle(document.querySelector('.hero')).gridTemplateColumns,
  mini: getComputedStyle(document.querySelector('.mini-player')).display,
  nav: getComputedStyle(document.querySelector('.mobile-nav')).display,
  sidebar: getComputedStyle(document.querySelector('.sidebar')).transform,
  scroll: document.querySelector('.main-scroll').getBoundingClientRect().height,
}));
console.log('MOBILE', JSON.stringify(mobile));
await browser.close();
