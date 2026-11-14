import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5173';
const OUT = 'verify';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 20000 });
const ctx = browser.contexts()[0] ?? (await browser.newContext());

const log = { console: [], pageerror: [], netfail: [], http4xx5xx: [], facts: {}, overflow: [], images: [] };

function watch(page, tag) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log.console.push(`[${tag}][${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => log.pageerror.push(`[${tag}] ${e.message}`));
  page.on('requestfailed', (r) => log.netfail.push(`[${tag}] ${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) log.http4xx5xx.push(`[${tag}] ${r.status()} ${r.url()}`); });
}

const watchAudio = async (p) => p.addInitScript(() => {
  const Orig = window.Audio;
  window.__audios = [];
  window.Audio = function (...args) { const a = new Orig(...args); window.__audios.push(a); return a; };
  window.Audio.prototype = Orig.prototype;
});

const overflow = async (page, tag) => log.overflow.push(await page.evaluate((tag) => {
  const d = document.documentElement;
  return { tag, over: d.scrollWidth - d.clientWidth };
}, tag));

const brokenImages = async (page, tag) => log.images.push(await page.evaluate((tag) => {
  const imgs = [...document.images];
  const dead = imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src);
  return { tag, total: imgs.length, deadCount: dead.length, dead: dead.slice(0, 6) };
}, tag));

const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await watchAudio(page);
watch(page, 'desktop');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/01-home-1440.png` });
await overflow(page, '1440 home');
await brokenImages(page, '1440 home');
log.facts.home = await page.evaluate(() => ({
  cards: document.querySelectorAll('.track-card, .album-card, .curation-card').length,
  heading: document.querySelector('h1')?.innerText,
}));

await page.locator('[data-action="play-radio"]').first().click();
await page.waitForTimeout(9000);
await page.screenshot({ path: `${OUT}/02-player-1440.png` });
log.facts.player = await page.evaluate(() => {
  const a = window.__audios?.[0];
  return {
    src: a?.currentSrc ? a.currentSrc.slice(0, 48) : null,
    paused: a?.paused, time: Number(a?.currentTime?.toFixed(1)), duration: Math.round(a?.duration || 0),
    readyState: a?.readyState, err: a?.error?.code ?? null,
  };
});
log.facts.lyrics = await page.evaluate(() => ({
  lines: document.querySelectorAll('.lyric-line').length,
  active: document.querySelectorAll('.lyric-line.is-active').length,
}));
await brokenImages(page, '1440 playing');

await page.locator('.topbar .icon-button[data-action="open-settings"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/03-settings-dark.png` });
await page.locator('[data-action="set-theme"][data-value="light"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/04-settings-light.png` });
await page.locator('[data-action="close-settings"]').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/05-light-player.png` });
await page.locator('.topbar .icon-button[data-action="open-settings"]').click();
await page.waitForTimeout(400);
await page.locator('[data-action="set-theme"][data-value="dark"]').click();
await page.locator('[data-action="close-settings"]').click();
await page.waitForTimeout(700);

const input = page.locator('#global-search input');
await input.click();
await input.fill('周杰伦');
await input.press('Enter');
await page.waitForTimeout(7000);
await page.screenshot({ path: `${OUT}/06-search.png` });
log.facts.search = await page.evaluate(() => ({
  rows: document.querySelectorAll('.result-list > *').length,
  head: document.querySelector('.search-result-head')?.innerText?.replace(/\s+/g, ' ').trim(),
}));
await brokenImages(page, 'search');

await page.locator('#player-panel [data-action="open-queue"]').first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/07-queue.png` });
log.facts.queue = await page.evaluate(() => ({ items: document.querySelectorAll('.queue-item').length }));
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

for (const w of [1280, 1024, 840, 560]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/bp-${w}.png` });
  await overflow(page, `${w}`);
}
await page.close();

const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mobile = await mobileCtx.newPage();
await watchAudio(mobile);
watch(mobile, 'mobile');
await mobile.goto(BASE, { waitUntil: 'domcontentloaded' });
await mobile.waitForTimeout(8000);
await mobile.screenshot({ path: `${OUT}/10-mobile.png` });
await overflow(mobile, '390 home');
await mobile.screenshot({ path: `${OUT}/10b-mobile-full.png`, fullPage: true });
await mobile.locator('.track-card-main').first().scrollIntoViewIfNeeded();
await mobile.waitForTimeout(400);
await mobile.locator('.track-card-main').first().click();
await mobile.waitForTimeout(8000);
await mobile.screenshot({ path: `${OUT}/11-mobile-playing.png` });
await mobile.locator('#mini-player .mini-meta').click();
await mobile.waitForTimeout(900);
await mobile.screenshot({ path: `${OUT}/12-mobile-player.png` });
log.facts.mobileSheet = await mobile.evaluate(() => {
  const a = window.__audios?.[0];
  return { paused: a?.paused, time: Number(a?.currentTime?.toFixed(1)) };
});
await overflow(mobile, '390 sheet');
await brokenImages(mobile, '390 sheet');
await mobile.close();

await browser.close().catch(() => {});
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
