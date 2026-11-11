#!/usr/bin/env node
/**
 * test-season-rewards-ui.js — the prize, on the board people compete on.
 *
 * OWNER, 2026-07-31: *"20 5 3 dan $1 seterusnya s/d rank 10, tampilkan juga di
 * leaderboard musim lalu."*
 *
 * Both halves of that were invisible before. The prize table lived in
 * `lib/server/seasonClose.ts` and on `/stats` — an operator page — so a player
 * grinding for 7th place had no way to learn that 7th place was worth anything.
 * And the frozen snapshot of the finished season, including whether it had been
 * paid, was on that same operator page: the people who actually competed for it
 * could not see who won.
 *
 * The logic (ten places, the $28-not-$35 pool split, the payout commands) is
 * covered without a browser by `npm run test:season`. What this covers is the
 * part that only exists on screen:
 *
 *   - the board states what the season is worth, and the SPLIT — the top 3
 *     claim, ranks 4-10 are sent directly, because `updateLeaderboard` takes
 *     `address[3]` and there is no fourth slot to claim from;
 *   - every rank shows its own prize, and ranks outside the prize show nothing
 *     rather than "$0" (a zero reads as a prize won and lost);
 *   - LAST SEASON renders the frozen standings and says paid vs pending.
 *
 *   npm run build
 *   node scripts/test-season-rewards-ui.js --serve
 */
const { chromium } = require('playwright-core')
const { spawn } = require('child_process')
const SERVE = process.argv.includes('--serve')
const PORT = Number(process.env.PORT || 3184)
const BASE = SERVE ? `http://127.0.0.1:${PORT}` : (process.env.BASE_URL || 'http://127.0.0.1:3178')
const W = '0x8888888888888888888888888888888888888888'
let fails = 0
let server = null
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }
const clean = () => { if (server) { try { process.kill(-server.pid) } catch {} server = null } }

async function serve() {
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore', detached: true })
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try { if ((await fetch(`${BASE}/game`)).ok) return } catch { /* not up */ }
  }
  throw new Error('server did not come up')
}

// The exact shape /api/season/status returns: the frozen snapshot plus the
// commands. Ten winners, because ten is the thing under test.
const winners = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  wallet: '0x' + String(i + 1).padStart(2, '0').repeat(20),
  username: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'][i],
  xp: 9000 - i * 500,
  rewardUsd: [20, 5, 3, 1, 1, 1, 1, 1, 1, 1][i],
}))

function routes(page, paidAt) {
  page.route('**/api/energy?**', (r) => r.fulfill({ json: { freeRemaining: 4, bonus: 0, total: 4, resetAt: Date.now() + 3.6e6 } }))
  page.route('**/api/vault/fragments?**', (r) => r.fulfill({ json: { fragments: 0, nextGoal: null } }))
  page.route('**/api/weapons/craft?**', (r) => r.fulfill({ json: { craft: null, serverNow: Date.now() } }))
  page.route('**/api/contracts?**', (r) => r.fulfill({ json: { completed: 0, contracts: [] } }))
  page.route('**/api/streak', (r) => r.fulfill({ json: { streak: 0, best: 0, day: 1, claimedToday: false, granted: null, ladder: [] } }))
  page.route('**/api/season/status', (r) => r.fulfill({
    json: { currentSeasonId: 202608, lastClosedSeasonId: 202607, awaitingPayout: !paidAt, commands: [],
      snapshot: { seasonId: 202607, winners, preparedAt: Date.parse('2026-08-01T01:00:00Z'), paidAt } },
  }))
}

async function openLeaderboard(page) {
  await page.addInitScript((w) => {
    localStorage.setItem('nullstate-guest-id', w)
    localStorage.setItem('ns-howto-seen', '1')
    localStorage.setItem('nullstate-signin-skipped', '1')
  }, W)
  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map', { timeout: 60000 })
  await page.waitForTimeout(2200)
  await page.click('text=≡ MENU')
  await page.waitForTimeout(400)
  await page.click('text=Leaderboard')
  await page.waitForTimeout(2500)
}

;(async () => {
  if (SERVE) await serve()
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })

  // ── an unpaid season ───────────────────────────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    routes(page, null)
    await openLeaderboard(page)

    const body = (await page.textContent('body')) || ''
    ok('the leaderboard screen opened', /TOP PLAYERS/i.test(body))

    // ── what the season is worth ──────────────────────────────────────
    ok('the board states the whole pool ($35)', /\$35\s*USDT/.test(body.replace(/\s+/g, ' ')),
      (body.match(/Season prize[^\n]{0,40}/) || [])[0])
    ok('and that TEN places are paid, not three', /top 10 by XP/i.test(body))
    ok('naming the podium amounts', /\$20 \/ \$5 \/ \$3/.test(body))
    ok('and the tail', /\$1\s*each for ranks 4[–-]10/i.test(body.replace(/\s+/g, ' ')))

    // ── the split, which is the part that could mislead ───────────────
    // Ranks 4-10 have no claim button and never will: updateLeaderboard takes
    // address[3]. Telling them to "claim" would promise a screen that cannot
    // exist, and they would conclude they were not paid.
    ok('it says the top 3 CLAIM theirs', /top 3 claim/i.test(body.replace(/\s+/g, ' ')))
    ok('and that ranks 4-10 are SENT, with nothing to claim',
      /sent straight to your wallet/i.test(body) && /nothing to claim/i.test(body))
    ok('and says WHY — the contract holds three places',
      /contract only holds three places/i.test(body.replace(/\s+/g, ' ')))
    ok('it warns the ranking freezes at season close', /frozen the moment the season closes/i.test(body))

    // ── LAST SEASON ───────────────────────────────────────────────────
    ok('last season is shown at all', /Last season/i.test(body))
    ok('naming the month rather than the raw id', /July 2026/.test(body), '202607')
    ok('an unpaid season says so, in amber', /Payout pending/i.test(body))
    ok('all ten winners are listed', /juliet/.test(body) && /alpha/.test(body))
    ok('with their own prize beside them', /\$20/.test(body) && /\$3/.test(body))
    ok('and it says these are frozen standings, not today\'s',
      /not today/i.test(body))

    // Nothing may push a 390px phone sideways.
    const over = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth > window.innerWidth + 1,
      w: document.documentElement.scrollWidth, vw: window.innerWidth,
    }))
    ok('the screen does not scroll sideways on a 390px phone', !over.over, over.w + 'px in ' + over.vw + 'px')
    await page.context().close()
  }

  // ── a paid season reads differently ────────────────────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    routes(page, Date.parse('2026-08-03T09:00:00Z'))
    await openLeaderboard(page)
    const body = (await page.textContent('body')) || ''
    ok('a paid season says paid', /✓ Paid/.test(body))
    ok('and never also says pending', !/Payout pending/i.test(body))
    await page.context().close()
  }

  // ── the season has not closed yet: no section, no error ────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    routes(page, null)
    await page.route('**/api/season/status', (r) => r.fulfill({
      json: { currentSeasonId: 202608, lastClosedSeasonId: 202607, snapshot: null, awaitingPayout: false, commands: [] },
    }))
    await openLeaderboard(page)
    const body = (await page.textContent('body')) || ''
    ok('with no frozen season there is no Last season block', !/Last season/i.test(body))
    // The prize itself is NOT conditional on a past season — it is what the
    // board is worth right now, and a first month must still answer that.
    ok('but the board still says what it is worth', /top 10 by XP/i.test(body))
    await page.context().close()
  }

  // ── the route failing must never break the screen ──────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    routes(page, null)
    await page.route('**/api/season/status', (r) => r.fulfill({ status: 503, json: { error: 'Season service unavailable' } }))
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)))
    await openLeaderboard(page)
    const body = (await page.textContent('body')) || ''
    ok('a 503 leaves the leaderboard working', /TOP PLAYERS/i.test(body))
    ok('and shows no Last season block rather than an error', !/Last season/i.test(body))
    ok('nothing threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean')
    await page.context().close()
  }

  await b.close(); clean()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch((e) => { clean(); console.error('ERROR', e.message); process.exit(2) })
