import { firefox } from 'playwright';
const env = { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1', MOZ_DISABLE_RDD_SANDBOX: '1', MOZ_DISABLE_GMP_SANDBOX: '1' };
const browser = await firefox.launch({ headless: true, env, firefoxUserPrefs: {
  'security.sandbox.content.level': 0, 'security.sandbox.gpu.level': 0, 'gfx.webrender.software': true, 'media.autoplay.default': 0,
}});
const issues = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', locale: 'zh-CN' });
page.on('console', m => { if (m.type() === 'error') issues.push(`[console] ${m.text()}`); });
page.on('pageerror', e => issues.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
console.log('clock', await page.locator('#live-clock').innerText());
await page.locator('[data-action="play-radio"]').first().click();
await page.waitForTimeout(6000);
let audio = await page.evaluate(() => ({
  title: window.sonora.state.current?.name,
  artists: window.sonora.state.current?.artists,
  playing: window.sonora.state.isPlaying,
  loading: window.sonora.state.loadingStream,
  src: window.sonora.audio?.currentSrc,
  paused: window.sonora.audio?.paused,
  error: window.sonora.audio?.error?.code || null,
  duration: window.sonora.audio?.duration,
  panelTitle: document.querySelector('#player-panel .player-meta h2')?.textContent,
}));
console.log('AUDIO', JSON.stringify(audio));
await page.screenshot({ path: '/tmp/ia-playing.png' });
await page.locator('#player-panel [data-action="play-toggle"]').click();
await page.waitForTimeout(500);
console.log('paused', await page.evaluate(() => window.sonora.audio.paused));
await page.locator('.topbar .icon-button[data-action="open-settings"]').click();
await page.waitForTimeout(700);
console.log('dialog', await page.evaluate(() => {
  const d = document.querySelector('#settings-dialog');
  const r = d?.getBoundingClientRect();
  return { exists: !!d, open: d?.open, rect: r && {x:r.x,y:r.y,w:r.width,h:r.height}, theme: document.documentElement.dataset.theme };
}));
await page.screenshot({ path: '/tmp/ia-settings.png' });
await page.locator('[data-action="set-theme"][data-value="light"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/ia-light.png' });
console.log('theme', await page.evaluate(() => ({data: document.documentElement.dataset.theme, cls: document.documentElement.className, bg: getComputedStyle(document.documentElement).getPropertyValue('--bg')})));
await page.locator('[data-action="set-theme"][data-value="dark"]').click();
await page.locator('[data-action="close-settings"]').click();
await page.waitForTimeout(500);
const input = page.locator('#global-search input');
await input.click();
await input.fill('周杰伦');
await input.press('Enter');
await page.waitForTimeout(5000);
console.log('SEARCH', await page.evaluate(() => ({view: window.sonora.state.view, q: window.sonora.state.search.query, n: window.sonora.state.search.results.length, heading: document.querySelector('.search-head h1')?.textContent || document.querySelector('.search-hero h1')?.textContent})));
await page.screenshot({ path: '/tmp/ia-search.png' });
console.log('ISSUES', issues.slice(0,10));
await browser.close();
