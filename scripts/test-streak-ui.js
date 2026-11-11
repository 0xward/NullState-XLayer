#!/usr/bin/env node
/**
 * test-streak-ui.js — the login streak on the map, driven in a real browser.
 *
 * GAME-DESIGN.md §5.3. The day-boundary logic is covered without a browser by
 * `npm run test:streak`; this covers the WIRING that a unit test cannot:
 *
 *   - the map POSTs the streak on mount (opening the app IS the event — there
 *     is no claim button, matching the decision Daily Contracts already made),
 *   - the chip renders FIRST, because it is the one number on the bar the
 *     player can lose and loss aversion needs it in front of them,
 *   - the reward is announced once, on the visit that earned it, and can be
 *     dismissed,
 *   - a streak of 0 (a wallet that has never visited, or Firebase not
 *     configured) renders no chip at all rather than a "0" nobody can read.
 *
 * OWNER, later: "pop up daily nya jelek banget, kaya bukan game banget, streak
 * nya juga ga kaya game2 lain." So this now also covers the two things that
 * answered him, because both are invisible to the logic test:
 *
 *   - the SEVEN-DAY LADDER is on screen, all seven rungs, each naming what it
 *     pays, with the banked ones stamped and today lit. The route had been
 *     sending `ladder` from the day it shipped and nothing rendered it.
 *   - the STREAK SHIELD states its own condition, and a held shield is never
 *     described with "goes back to 1".
 *
 *   npm run build && npx next start -p 3178 &
 *   node scripts/test-streak-ui.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3178'
const W = '0x5555555555555555555555555555555555555555'
let fails = 0
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l); if (!c) fails++ }

// The real ladder, exactly as lib/server/loginStreak.ts defines it. Sent by the
// route on every response; the fixtures below hand it over verbatim so the
// tiles under test are the tiles a player sees.
const LADDER = [
  { kind: 'point', amount: 80 },
  { kind: 'shard', tier: 't1', amount: 2 },
  { kind: 'energy', amount: 1 },
  { kind: 'shard', tier: 't1', amount: 3 },
  { kind: 'point', amount: 150 },
  { kind: 'shard', tier: 't1', amount: 4 },
  { kind: 'shard', tier: 't1', amount: 8 },
]

// The sandbox has no Firebase admin, so every status route degrades to empty.
// Fixture them so the bar has something true to render.
function baseRoutes(page) {
  page.route('**/api/energy?**', r => r.fulfill({ json: { freeRemaining: 4, bonus: 0, total: 4, resetAt: Date.now() + 3.6e6 } }))
  page.route('**/api/vault/fragments?**', r => r.fulfill({ json: { fragments: 5, nextGoal: { key: 'paper', threshold: 8, label: 'Old Paper' } } }))
  page.route('**/api/weapons/craft?**', r => r.fulfill({ json: { craft: null, serverNow: Date.now() } }))
  page.route('**/api/contracts?**', r => r.fulfill({ json: { dayId: '2026-07-31', nextResetAt: Date.now() + 7.2e6, completed: 0, contracts: [] } }))
}

async function openMap(page) {
  await page.addInitScript(w => {
    localStorage.setItem('nullstate-guest-id', w)
    localStorage.setItem('ns-howto-seen', '1')
    localStorage.setItem('nullstate-signin-skipped', '1')
  }, W)
  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map', { timeout: 60000 })
  await page.waitForTimeout(2500)
}

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })

  // ── case 1: day 3, freshly granted ────────────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    let posted = null
    await page.route('**/api/streak', async (r) => {
      posted = r.request().postDataJSON()
      await r.fulfill({ json: {
        dayId: '2026-07-31', nextResetAt: Date.now() + 7.2e6,
        streak: 3, best: 8, day: 3, claimedToday: true,
        today: { kind: 'energy', amount: 1 },
        tomorrow: { kind: 'shard', tier: 't1', amount: 3 },
        granted: { kind: 'energy', amount: 1 },
        grantedLabel: '+1 energy',
        ladder: LADDER, shield: 1, shieldIn: 0, shieldUsed: false, shieldEarnAfter: 3,
      } })
    })
    await openMap(page)

    ok('the map registers the visit with a POST', !!posted)
    ok('and sends the player id', posted && String(posted.wallet || '').toLowerCase() === W)

    // ── the panel opens ITSELF on the visit that paid ──────────────────
    // Every shipped version of this mechanic shows the player the reward
    // instead of parking a note next to it. Once per UTC day by construction:
    // grantedLabel is non-null only on the request that advanced the day.
    ok('the DAILY panel opens by itself on the visit that earned something',
      !!(await page.$('.ns-daily-panel')))
    const claim = await page.textContent('.ns-daily-claim').catch(() => '')
    ok('leading with what was just paid (' + (claim || '').replace(/\s+/g, ' ').trim() + ')',
      /DAY 3 CLAIMED/.test(claim || '') && /\+1 energy/.test(claim || ''))
    ok('and saying there is nothing to press', /nothing to press/i.test(claim || ''))

    // ── THE LADDER ────────────────────────────────────────────────────
    const days = await page.$$eval('.ns-streak-day', els => els.map(e => ({
      txt: e.textContent.replace(/\s+/g, ' ').trim(), cls: e.className,
    })))
    ok('all seven rungs are on screen at once (' + days.length + ')', days.length === 7)
    ok('every rung names what it pays', days.every(d => /\d/.test(d.txt)))
    ok('day 5 shows its 150 Point without being reached yet',
      /150/.test(days[4] ? days[4].txt : ''), days[4] && days[4].txt)
    ok('day 7 shows the 8 shards — the thing the week is FOR',
      /8/.test(days[6] ? days[6].txt : ''))
    ok('and is drawn as the destination, not just another tile',
      (days[6] || {}).cls?.includes('is-jackpot'))
    ok('days 1-3 are banked and stamped',
      days.slice(0, 3).every(d => d.cls.includes('is-done')))
    ok('days 4-7 are not', days.slice(3).every(d => !d.cls.includes('is-done')))
    ok('exactly one tile is lit as today',
      days.filter(d => d.cls.includes('is-today')).length === 1)
    ok('and it is day 3', (days[2] || {}).cls?.includes('is-today'))

    // ── THE SHIELD ────────────────────────────────────────────────────
    const shield = await page.textContent('.ns-streak-shield').catch(() => '')
    ok('a held shield says so (' + (shield || '').replace(/\s+/g, ' ').trim().slice(0, 46) + '…)',
      /shield ready/i.test(shield || ''))
    ok('and states its exact limit — one day, not two',
      /miss one day/i.test(shield || '') && /miss two/i.test(shield || ''))
    ok('the tile is marked as held', !!(await page.$('.ns-streak-shield.is-ready')))

    // Nothing may overflow a 390px phone. The ladder is seven tiles wide and is
    // the obvious thing to get this wrong.
    const over = await page.evaluate(() => {
      const p = document.querySelector('.ns-daily-panel')
      return p ? { over: p.scrollWidth > p.clientWidth + 1, w: p.scrollWidth, c: p.clientWidth } : null
    })
    ok('the panel does not scroll sideways on a 390px screen (' + JSON.stringify(over) + ')',
      over && !over.over)

    await page.click('.ns-daily-close')
    await page.waitForTimeout(250)
    ok('the panel closes', !(await page.$('.ns-daily-panel')))

    const chips = await page.$$eval('.ns-hub-chip', e => e.map(x => x.textContent.trim()))
    ok('the streak chip renders (' + chips.join(' ') + ')', chips.some(c => c.includes('3')))
    ok('and renders FIRST — it is the one thing that can be lost', /3$/.test(chips[0] || ''))

    const note = await page.$('.ns-hub-streak-note')
    ok('the reward is still announced on the bar behind it', !!note)
    const noteText = note ? (await note.textContent()).trim() : ''
    ok('naming the day and what it paid (' + noteText + ')', /Day 3/.test(noteText) && /\+1 energy/.test(noteText))

    // Granted energy is added to the chip in the same breath, or the bar would
    // show yesterday's number until the next mount.
    const energyChip = chips.find(c => c.includes('⚡')) || ''
    ok('the energy chip already includes the granted run (' + energyChip + ')', energyChip.includes('5'))

    await page.click('.ns-hub-streak-note')
    await page.waitForTimeout(250)
    ok('and it can be dismissed', !(await page.$('.ns-hub-streak-note')))
    await page.context().close()
  }

  // ── case 1b: the shield actually saved a streak ───────────────────────
  // The player missed a day and did not lose anything. If the panel does not
  // SAY that, the mechanic may as well not exist: they will assume the streak
  // reset and that the number they are looking at is a new one.
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 4, best: 9, day: 4, claimedToday: true,
      today: { kind: 'shard', tier: 't1', amount: 3 },
      tomorrow: { kind: 'point', amount: 150 },
      granted: { kind: 'shard', tier: 't1', amount: 3 }, grantedLabel: '+3 Glitch Shard T1',
      ladder: LADDER, shield: 0, shieldIn: 3, shieldUsed: true, shieldEarnAfter: 3,
    } }))
    await openMap(page)
    const shield = await page.textContent('.ns-streak-shield').catch(() => '')
    ok('a spent shield says the streak SURVIVED (' + (shield || '').replace(/\s+/g, ' ').trim().slice(0, 48) + '…)',
      /survived/i.test(shield || ''))
    ok('and does not claim to still be protecting anything',
      !/shield ready/i.test(shield || '') && !(await page.$('.ns-streak-shield.is-ready')))
    await page.context().close()
  }

  // ── case 1c: no shield yet — the panel counts it down ─────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 1, best: 1, day: 1, claimedToday: true,
      today: { kind: 'point', amount: 80 }, tomorrow: { kind: 'shard', tier: 't1', amount: 2 },
      granted: { kind: 'point', amount: 80 }, grantedLabel: '+80 NullState Point',
      ladder: LADDER, shield: 0, shieldIn: 2, shieldUsed: false, shieldEarnAfter: 3,
    } }))
    await openMap(page)
    const shield = await page.textContent('.ns-streak-shield').catch(() => '')
    ok('a day-1 player is told how to earn the shield (' + (shield || '').replace(/\s+/g, ' ').trim().slice(0, 44) + '…)',
      /in 2 days/i.test(shield || '') && /three days in a row/i.test(shield || ''))
    const done = await page.$$eval('.ns-streak-day.is-done', e => e.length)
    ok('only day 1 is stamped', done === 1)
    await page.context().close()
  }

  // ── case 2: already counted today — chip yes, announcement no ─────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 6, best: 9, day: 6, claimedToday: true,
      today: { kind: 'shard', tier: 't1', amount: 4 },
      tomorrow: { kind: 'shard', tier: 't1', amount: 8 },
      granted: null, grantedLabel: null,
      ladder: LADDER, shield: 0, shieldIn: 1, shieldUsed: false, shieldEarnAfter: 3,
    } }))
    await openMap(page)
    const chips = await page.$$eval('.ns-hub-chip', e => e.map(x => x.textContent.trim()))
    ok('a second visit the same day still shows the chip', chips.some(c => c.includes('6')))
    ok('but announces nothing', !(await page.$('.ns-hub-streak-note')))
    ok('and does NOT reopen the panel — it opens on the visit that paid, not every visit',
      !(await page.$('.ns-daily-panel')))
    const title = await page.$eval('.ns-hub-chip', e => e.getAttribute('title'))
    ok('the chip says what tomorrow is worth (' + (title || '').slice(0, 60) + '…)', /tomorrow/i.test(title || ''))
    ok('and what is at stake', /back to 1/i.test(title || ''))
    await page.context().close()
  }

  // ── case 2b: an unprotected streak and a protected one must not read the
  // same. "Miss a day and it goes back to 1" is simply false while a shield is
  // held, and it is the one sentence the mechanic is explained in on the map.
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 6, best: 9, day: 6, claimedToday: true,
      today: { kind: 'shard', tier: 't1', amount: 4 },
      tomorrow: { kind: 'shard', tier: 't1', amount: 8 },
      granted: null, grantedLabel: null,
      ladder: LADDER, shield: 1, shieldIn: 0, shieldUsed: false, shieldEarnAfter: 3,
    } }))
    await openMap(page)
    const title = await page.$eval('.ns-hub-chip', e => e.getAttribute('title'))
    ok('a shielded streak is never told it goes back to 1', !/back to 1/i.test(title || ''))
    ok('it is told what the shield actually does (' + (title || '').slice(0, 70) + '…)',
      /covers one missed day/i.test(title || ''))
    await page.context().close()
  }

  // ── case 3: day 7 reads differently ───────────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 7, best: 7, day: 7, claimedToday: true,
      today: { kind: 'shard', tier: 't1', amount: 8 },
      tomorrow: { kind: 'point', amount: 80 },
      granted: { kind: 'shard', tier: 't1', amount: 8 }, grantedLabel: '+8 Glitch Shard T1',
      ladder: LADDER, shield: 1, shieldIn: 0, shieldUsed: false, shieldEarnAfter: 3,
    } }))
    await openMap(page)
    const all7 = await page.$$eval('.ns-streak-day.is-done', e => e.length)
    ok('a completed week stamps all seven rungs', all7 === 7)
    const claim = await page.textContent('.ns-daily-claim').catch(() => '')
    ok('and the panel leads with the 8 shards (' + (claim || '').replace(/\s+/g, ' ').trim() + ')',
      /\+8 Glitch Shard T1/.test(claim || '') && /DAY 7 CLAIMED/.test(claim || ''))
    await page.click('.ns-daily-close')
    await page.waitForTimeout(200)
    const first = await page.$eval('.ns-hub-chip', e => ({ text: e.textContent.trim(), cls: e.className }))
    ok('day 7 is marked as the payoff (' + first.text + ')', first.cls.includes('is-ready'))
    const note = await page.textContent('.ns-hub-streak-note').catch(() => '')
    ok('and announces the 8 shards (' + (note || '').trim() + ')', /\+8 Glitch Shard T1/.test(note || ''))
    await page.context().close()
  }

  // ── case 4: no streak yet — nothing at all ────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await page.route('**/api/streak', r => r.fulfill({ json: {
      streak: 0, best: 0, day: 1, claimedToday: false,
      today: { kind: 'point', amount: 80 }, tomorrow: { kind: 'shard', tier: 't1', amount: 2 },
      granted: null, grantedLabel: null,
      ladder: LADDER, shield: 0, shieldIn: 3, shieldUsed: false, shieldEarnAfter: 3,
    } }))
    await openMap(page)
    const chips = await page.$$eval('.ns-hub-chip', e => e.map(x => x.textContent.trim()))
    ok('a streak of 0 renders no chip — never a "0" nobody can read',
      !chips.some(c => /🔥|★/.test(c)))
    ok('and no ladder either — there is no streak to draw',
      (await page.$$('.ns-streak-day')).length === 0)
    ok('the other chips are unaffected (' + chips.join(' ') + ')', chips.length === 2)
    await page.context().close()
  }

  await b.close()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error('ERROR', e.message); process.exit(2) })
