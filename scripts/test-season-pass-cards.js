#!/usr/bin/env node
/**
 * test-season-pass-cards.js — a finished season must not read as a coming one.
 *
 * OWNER, on 2 August, looking at the July card: *"ini mint pass ko gini
 * tulisaannya not started, padahal sudah lewat."*
 *
 * `SeasonPassCard` knew exactly two states — "the current month" and
 * "everything else" — so a season that had already run fell into the same
 * branch as one that had not started. July was blurred behind a padlock and
 * captioned **"Not started yet · Coming — Season 1"** the day after it paid
 * three players real USDT.
 *
 * It compounds. The program is six months long, so by December five of the six
 * cards would have been advertising months that were already over.
 *
 * The second half is the same bug seen from the player's side: the rail renders
 * all six in order and started at the left, so from August onward the first
 * card on screen was a dead month and the only one with a working MINT button
 * was off-screen.
 *
 * The month is faked with Playwright's clock so this asserts real transitions
 * rather than whatever month CI happens to run in — the whole defect only
 * appears once time has moved.
 *
 *   npm run build
 *   node scripts/test-season-pass-cards.js --serve
 */
const { chromium } = require('playwright-core')
const { spawn } = require('child_process')
const SERVE = process.argv.includes('--serve')
const PORT = Number(process.env.PORT || 3185)
const BASE = SERVE ? `http://127.0.0.1:${PORT}` : (process.env.BASE_URL || 'http://127.0.0.1:3178')
const W = '0x9999999999999999999999999999999999999999'
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

// Seasons run July–December 2026 (SEASON_IDS in lib/season.ts).
async function openPass(browser, whenIso) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  // Freeze the browser's clock BEFORE any script runs — currentSeasonId() reads
  // `new Date()` at module scope in a useMemo, so it must already be lying.
  await page.clock.install({ time: new Date(whenIso) })
  page.route('**/api/energy?**', (r) => r.fulfill({ json: { freeRemaining: 4, bonus: 0, total: 4, resetAt: Date.now() + 3.6e6 } }))
  page.route('**/api/vault/fragments?**', (r) => r.fulfill({ json: { fragments: 0, nextGoal: null } }))
  page.route('**/api/weapons/craft?**', (r) => r.fulfill({ json: { craft: null, serverNow: Date.now() } }))
  page.route('**/api/contracts?**', (r) => r.fulfill({ json: { completed: 0, contracts: [] } }))
  page.route('**/api/streak', (r) => r.fulfill({ json: { streak: 0, best: 0, day: 1, claimedToday: false, granted: null, ladder: [] } }))
  page.route('**/api/season/status', (r) => r.fulfill({ json: { currentSeasonId: 202608, lastClosedSeasonId: 202607, snapshot: null, awaitingPayout: false, commands: [] } }))
  await page.addInitScript((w) => {
    localStorage.setItem('nullstate-guest-id', w)
    localStorage.setItem('ns-howto-seen', '1')
    localStorage.setItem('nullstate-signin-skipped', '1')
  }, W)
  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map', { timeout: 60000 })
  await page.waitForTimeout(2200)
  await page.click('img[alt="Pass"]')
  await page.waitForTimeout(2500)
  return { ctx, page }
}

/** Read every card as {number, caption, button}, in rail order. */
async function readCards(page) {
  return page.evaluate(() => {
    const rail = [...document.querySelectorAll('div')].find(
      (d) => d.style.scrollSnapType === 'x mandatory')
    if (!rail) return null
    return [...rail.children].map((c) => {
      const t = (c.textContent || '').replace(/\s+/g, ' ').trim()
      const btn = c.querySelector('button')
      return { text: t, button: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : '' }
    })
  })
}

;(async () => {
  if (SERVE) await serve()
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })

  // ── AUGUST: July is over, August is live, Sep-Dec are ahead ────────────
  {
    const { ctx, page } = await openPass(b, '2026-08-02T10:00:00Z')
    const cards = await readCards(page)
    ok('all six season cards render', cards && cards.length === 6, cards ? String(cards.length) : 'no rail')

    const july = cards[0]
    // THE BUG, exactly as the owner saw it.
    ok('July does NOT say it has not started (' + july.text.slice(0, 40) + '…)',
      !/not started/i.test(july.text))
    ok('and its button does not advertise it as COMING', !/coming/i.test(july.button), july.button)
    ok('it says it ENDED', /ended/i.test(july.text))
    ok('naming the month, which is what anyone actually remembers it by',
      /July 2026/.test(july.text), july.text.slice(0, 60))
    ok('and the button says the season is over', /is over/i.test(july.button), july.button)

    // A future season keeps the old, correct treatment.
    const sept = cards[2]
    ok('September still reads as not started', /not started|not announced/i.test(sept.text), sept.text.slice(0, 40))
    ok('and still says COMING', /coming/i.test(sept.button), sept.button)

    // Past and future must not be indistinguishable — that WAS the bug.
    ok('a finished season and an unstarted one no longer read the same',
      july.text !== sept.text && july.button !== sept.button)

    // ── the rail must open on the mintable card ────────────────────────
    // Asserted as "which card is centred", not as a pixel offset: the cards
    // carry snap-center, so the browser adjusts whatever scroll position is
    // requested. What matters to the player is which card they are looking at.
    const centred = await page.evaluate(() => {
      const rail = [...document.querySelectorAll('div')].find((d) => d.style.scrollSnapType === 'x mandatory')
      const mid = rail.scrollLeft + rail.clientWidth / 2
      let best = -1, bestD = Infinity
      ;[...rail.children].forEach((c, i) => {
        const d = Math.abs((c.offsetLeft - rail.offsetLeft + c.clientWidth / 2) - mid)
        if (d < bestD) { bestD = d; best = i }
      })
      return best
    })
    ok('the rail opens on August, not on the dead July card', centred === 1, 'card index ' + centred)
    await ctx.close()
  }

  // ── JULY: nothing is past yet, so nothing may claim to be ──────────────
  {
    const { ctx, page } = await openPass(b, '2026-07-15T10:00:00Z')
    const cards = await readCards(page)
    ok('in July, no card claims to have ended', !cards.some((c) => /ended —/i.test(c.text)),
      (cards.find((c) => /ended —/i.test(c.text)) || {}).text)
    ok('and the rail stays at the start — season 1 IS the mintable one',
      (await page.evaluate(() => {
        const rail = [...document.querySelectorAll('div')].find((d) => d.style.scrollSnapType === 'x mandatory')
        return rail.scrollLeft
      })) < 12)
    await ctx.close()
  }

  // ── DECEMBER: the last month, five behind it ───────────────────────────
  // The compounding case. Without the fix this screen would have said "Coming"
  // about five months that were already finished.
  {
    const { ctx, page } = await openPass(b, '2026-12-10T10:00:00Z')
    const cards = await readCards(page)
    const ended = cards.filter((c) => /ended/i.test(c.text)).length
    ok('five finished seasons all read as ended', ended === 5, String(ended))
    ok('and none of them says COMING',
      !cards.slice(0, 5).some((c) => /coming/i.test(c.button)),
      cards.slice(0, 5).map((c) => c.button).join(' | '))
    const centredDec = await page.evaluate(() => {
      const rail = [...document.querySelectorAll('div')].find((d) => d.style.scrollSnapType === 'x mandatory')
      const mid = rail.scrollLeft + rail.clientWidth / 2
      let best = -1, bestD = Infinity
      ;[...rail.children].forEach((c, i) => {
        const d = Math.abs((c.offsetLeft - rail.offsetLeft + c.clientWidth / 2) - mid)
        if (d < bestD) { bestD = d; best = i }
      })
      return best
    })
    ok('the rail opens on December, past five finished months', centredDec === 5,
      'card index ' + centredDec)
    await ctx.close()
  }

  await b.close(); clean()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch((e) => { clean(); console.error('ERROR', e.message); process.exit(2) })
