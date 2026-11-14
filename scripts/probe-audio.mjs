import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 20000 });
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

await page.addInitScript(() => {
  const Orig = window.Audio;
  window.__audios = [];
  window.__audioEvents = [];
  window.Audio = function (...args) {
    const a = new Orig(...args);
    ['loadstart', 'loadedmetadata', 'canplay', 'playing', 'pause', 'error', 'stalled', 'waiting', 'ended'].forEach((ev) =>
      a.addEventListener(ev, () => window.__audioEvents.push(`${ev} @${Number((a.currentTime || 0).toFixed(1))} src=${(a.currentSrc || a.src || '').slice(0, 50)}`)));
    window.__audios.push(a);
    return a;
  };
  window.Audio.prototype = Orig.prototype;
  window.__toasts = [];
  new MutationObserver(() => {
    document.querySelectorAll('[class*="toast"]').forEach((n) => {
      const t = n.textContent?.trim();
      if (t && !window.__toasts.includes(t)) window.__toasts.push(t);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
});

await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
await page.locator('[data-action="play-radio"]').first().click();
await page.waitForTimeout(9000);

const state = await page.evaluate(() => {
  const a = window.__audios?.[0];
  return {
    audioCount: window.__audios?.length ?? 0,
    src: a?.currentSrc || a?.src || null,
    paused: a?.paused, time: a?.currentTime, duration: a?.duration,
    readyState: a?.readyState, networkState: a?.networkState,
    error: a ? { code: a.error?.code ?? null, msg: a.error?.message ?? null } : null,
    events: window.__audioEvents?.slice(-12),
    toasts: window.__toasts,
    progressLabel: document.querySelector('[class*="player"] [class*="time"]')?.innerText,
  };
});
console.log(JSON.stringify(state, null, 2));
await page.close();
await browser.close().catch(() => {});
