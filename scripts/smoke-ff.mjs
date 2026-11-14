import { firefox } from 'playwright';
const browser = await firefox.launch({
  headless: true,
  env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1', MOZ_DISABLE_RDD_SANDBOX: '1', MOZ_DISABLE_GMP_SANDBOX: '1' },
  firefoxUserPrefs: { 'security.sandbox.content.level': 0, 'security.sandbox.gpu.level': 0, 'gfx.webrender.software': true }
});
console.log('launched', browser.version());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }});
console.log('page created');
const issues = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => issues.push(`[pageerror] ${e.message}`));
await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log('title', await page.title());
await page.waitForTimeout(9000);
console.log('body', (await page.locator('body').innerText()).slice(0,300));
console.log('issues', issues.slice(0,20));
await page.screenshot({ path: '/tmp/ff-1440.png' });
console.log('shot');
await browser.close();
