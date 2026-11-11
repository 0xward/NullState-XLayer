#!/usr/bin/env node
/**
 * test-audio-sync.js — prove every sound control agrees with every other one.
 *
 * WHY THIS EXISTS: the "Sound" switch used to silence the music and leave every
 * effect playing. The engine's `muted` flag deliberately controls ONLY the
 * ambient bed (see audio.js), and each UI switch had been wired straight to it,
 * so a control labelled as a master switch was a music switch. Nothing caught
 * it because nothing checked what the ENGINE was actually doing after a tap —
 * the buttons all looked right.
 *
 * So this drives the real built page in a real browser and, after each tap,
 * reads window.Audio2's own state plus what was written to storage. A control
 * that changes the label but not the audio fails here.
 *
 * It is NOT in CI: it needs a running server and a Chromium download, which
 * would add minutes to every pull request for a surface that changes rarely.
 * Run it by hand when touching anything audio.
 *
 *   npm run build && npx next start -p 3140 &
 *   node scripts/test-audio-sync.js
 *
 * Exits non-zero on the first disagreement.
 *
 * Requires playwright-core and a Chromium at CHROME_PATH (defaults to the
 * container's pre-installed one).
 */
const { chromium } = require('playwright-core');
const P = process.env.BASE_URL || 'http://127.0.0.1:3140';

const read = (page) => page.evaluate(() => {
  const A = window.Audio2;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('ns-settings-v1') || 'null'); } catch {}
  return A ? { muted: A.muted, sfxEnabled: A.sfxEnabled, vol: Number(A.musicVolume.toFixed(2)), stored } : null;
});

const line = (label, s) =>
  `${label.padEnd(34)} engine{ muted:${String(s.muted).padEnd(5)} sfx:${String(s.sfxEnabled).padEnd(5)} vol:${s.vol} }  stored{ muted:${s.stored?.soundMuted} sfx:${s.stored?.sfxEnabled} }`;

let fails = 0;
function expect(label, cond) {
  if (!cond) { fails++; console.log('   ✗ FAIL: ' + label); } else { console.log('   ✓ ' + label); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(P + '/game', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6500);
  await page.mouse.click(195, 400); // a gesture, to unlock the AudioContext
  await page.waitForTimeout(800);

  console.log(line('1. fresh load', await read(page)));
  let s = await read(page);
  expect('starts unmuted with effects on', s.muted === false && s.sfxEnabled === true);

  // ── the reported bug: master mute must kill EFFECTS too
  await page.getByRole('button', { name: /Turn sound off/i }).click();
  await page.waitForTimeout(600);
  s = await read(page);
  console.log(line('2. map speaker -> OFF', s));
  expect('music muted', s.muted === true);
  expect('EFFECTS SILENCED (the reported bug)', s.sfxEnabled === false);
  expect('stored', s.stored?.soundMuted === true);

  // ── unmute must restore effects (they were on before)
  await page.getByRole('button', { name: /Turn sound on/i }).click();
  await page.waitForTimeout(600);
  s = await read(page);
  console.log(line('3. map speaker -> ON', s));
  expect('music back', s.muted === false);
  expect('effects restored', s.sfxEnabled === true);

  // ── Settings screen: effects off on their own, music untouched
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('switch', { name: 'Sound effects' }).click();
  await page.waitForTimeout(500);
  s = await read(page);
  console.log(line('4. settings: effects OFF', s));
  expect('effects off', s.sfxEnabled === false);
  expect('music still playing', s.muted === false);

  // ── volume applies live from the map settings screen
  await page.evaluate(() => {
    const el = document.querySelector('input[type=range]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '0.3');
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  s = await read(page);
  console.log(line('5. settings: volume -> 0.30', s));
  expect('volume applied to the LIVE engine', Math.abs(s.vol - 0.3) < 0.01);

  // ── master mute while effects already off, then unmute: must NOT switch them back on
  await page.getByRole('switch', { name: 'Sound', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('switch', { name: 'Sound', exact: true }).click();
  await page.waitForTimeout(400);
  s = await read(page);
  console.log(line('6. mute+unmute w/ effects off', s));
  expect('effects STAY off (preference respected)', s.sfxEnabled === false);

  // ── survives a reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6500);
  await page.mouse.click(195, 400);
  await page.waitForTimeout(800);
  s = await read(page);
  console.log(line('7. after reload', s));
  expect('effects still off', s.sfxEnabled === false);
  expect('volume still 0.30', Math.abs(s.vol - 0.3) < 0.01);

  await browser.close();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
