import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/opt/chrome-cft/chrome-linux-arm64/chrome',
  headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--single-process','--no-zygote','--disable-features=VizDisplayCompositor','--autoplay-policy=no-user-gesture-required']
});
console.log('launched', browser.version());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }});
console.log('page');
await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log('title', await page.title());
await page.waitForTimeout(5000);
console.log('body', (await page.locator('body').innerText()).slice(0,500));
await page.screenshot({ path: '/tmp/smoke.png' });
console.log('shot');
await browser.close();
