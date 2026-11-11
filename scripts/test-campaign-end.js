#!/usr/bin/env node
/**
 * test-campaign-end.js — where the player stands after they win.
 *
 * OWNER, having just cracked the vault for real: "setelah buka vault itu aku
 * masuk menu abbys, menurut km itu hilangkan atau jangan?"
 *
 * The Abyss is not the problem. It is the campaign-completion reward, and with
 * the world map as the home screen it is one of only two modes that unlock at
 * the end. The problem is that the finale called returnToTitleScreen()
 * unconditionally, dropping the player onto the engine's PRE-MAP home screen —
 * which hides the HUD (so no Save & Exit) and has no route back to the map.
 * Winning the game put him somewhere he could not leave, seconds after being
 * paid.
 *
 * Two halves, and this covers both:
 *
 *   ENGINE (harness) — with the hub on, the finale dispatches
 *   `nullstate-campaign-complete` and never shows #title; with the hub off it
 *   still shows #title, because there the title IS the home screen.
 *
 *   MAP (real /game) — a finished campaign makes Bunker 5 read as RAID (which
 *   is how the weekly vault is reached forever after), puts THE NULL ABYSS and
 *   NEW GAME+ under ≡ MENU, and shows the "what you just unlocked" panel
 *   exactly once.
 *
 *   npm run build
 *   node scripts/test-campaign-end.js --serve      # starts its own server
 *
 * `--serve` exists because `next start` indexes public/ once at boot, and the
 * engine harness below is written into public/ by this script — so a server
 * that was already running 404s on it. Starting the server after the harness is
 * on disk is the only ordering that works, and getting it wrong looks like the
 * engine failing to load rather than like a missing file.
 */
const { chromium } = require('playwright-core')
const { spawn } = require('child_process')
const fs = require('fs'), path = require('path')
const SERVE = process.argv.includes('--serve')
const PORT = Number(process.env.PORT || 3179)
const BASE = SERVE ? `http://127.0.0.1:${PORT}` : (process.env.BASE_URL || 'http://127.0.0.1:3178')
const HARNESS = '__cend'
const W = '0x7777777777777777777777777777777777777777'
let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }

// Same harness shape every engine test here uses: every DOM id DungeonGame.tsx
// renders, read out of that file so the markup cannot drift from what the
// engine queries.
const tsx = fs.readFileSync(path.join(__dirname, '..', 'components', 'game', 'DungeonGame.tsx'), 'utf8')
const ids = [...new Set([...tsx.matchAll(/id="([A-Za-z0-9_]+)"/g)].map((m) => m[1]))].sort()
const special = { game: '<canvas id="game"></canvas>', vaultCodeInput: '<input id="vaultCodeInput" />' }
const scripts = ['audio.js', 'assets.js', 'story.js', 'story_campaign.js', 'dungeon.js', 'items.js',
  'marketplace-items.js', 'props.js', 'monster-config.js', 'effects.js', 'entities.js', 'outdoor.js',
  'run-session.js', 'game.js']
const dir = path.join(__dirname, '..', 'public', HARNESS)
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<style>.hidden{display:none}.overlay{position:fixed;inset:0;display:flex}</style>'
  + '<div class="ns-game-root">'
  + ids.map((i) => special[i] || `<div id="${i}"></div>`).join('') + '</div>'
  + scripts.map((x) => `<script src="/game-engine/${x}"></script>`).join(''))
let server = null
const clean = () => {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  if (server) { try { process.kill(-server.pid) } catch {} server = null }
}

/** Start `next start` AFTER the harness exists, and wait for it to answer. */
async function serve() {
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore', detached: true })
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const res = await fetch(`${BASE}/${HARNESS}/index.html`)
      if (res.ok) return
    } catch { /* not up yet */ }
  }
  throw new Error(`server did not come up on ${BASE}`)
}

async function openMap(page, complete) {
  await page.addInitScript(([w, done]) => {
    localStorage.setItem('nullstate-guest-id', w)
    localStorage.setItem('ns-howto-seen', '1')
    localStorage.setItem('nullstate-signin-skipped', '1')
    if (done) localStorage.setItem('nullstate-protocolzero-' + w.toLowerCase(), '1')
  }, [W, !!complete])
  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map', { timeout: 60000 })
  await page.waitForTimeout(2200)
}
// The status routes have no Firebase in the sandbox; fixture them so the map
// paints the same furniture a real player sees.
function baseRoutes(page) {
  page.route('**/api/energy?**', r => r.fulfill({ json: { freeRemaining: 4, bonus: 0, total: 4, resetAt: Date.now() + 3.6e6 } }))
  page.route('**/api/vault/fragments?**', r => r.fulfill({ json: { fragments: 0, nextGoal: null } }))
  page.route('**/api/weapons/craft?**', r => r.fulfill({ json: { craft: null, serverNow: Date.now() } }))
  page.route('**/api/contracts?**', r => r.fulfill({ json: { completed: 0, contracts: [] } }))
  page.route('**/api/streak', r => r.fulfill({ json: { streak: 0, best: 0, day: 1, claimedToday: false, granted: null, ladder: [] } }))
}

;(async () => {
  if (SERVE) await serve()
  else {
    // Fail with the real reason rather than "window.__NS is undefined".
    const res = await fetch(`${BASE}/${HARNESS}/index.html`).catch(() => null)
    if (!res || !res.ok) {
      throw new Error(`${BASE}/${HARNESS}/ is 404 — restart the server now that the harness exists, or run with --serve`)
    }
  }
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })

  // ── ENGINE: where does the finale hand control back to? ────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
    await page.goto(`${BASE}/${HARNESS}/index.html`, { waitUntil: 'load' })

    const hub = await page.evaluate(() => {
      const seen = []
      window.addEventListener('nullstate-campaign-complete', (e) => seen.push(e.detail))
      window.__NS.setWorldMapHub(true)
      document.getElementById('title').classList.add('hidden')
      document.getElementById('hud').classList.remove('hidden')
      window.__NS.finishCampaign()
      return {
        fired: seen.length,
        titleShown: !document.getElementById('title').classList.contains('hidden'),
        hudShown: !document.getElementById('hud').classList.contains('hidden'),
      }
    })
    ok('with the map on, the finale tells the shell the campaign is over', hub.fired === 1)
    ok('and does NOT strand the player on the pre-map title screen', !hub.titleShown)
    ok('the run is torn down either way', !hub.hudShown)

    const classic = await page.evaluate(() => {
      const seen = []
      window.addEventListener('nullstate-campaign-complete', () => seen.push(1))
      window.__NS.setWorldMapHub(false)
      document.getElementById('title').classList.add('hidden')
      window.__NS.finishCampaign()
      return {
        fired: seen.length,
        titleShown: !document.getElementById('title').classList.contains('hidden'),
      }
    })
    // With the hub off the title IS the home screen and DESCEND is on it, so
    // ending there is correct — this is the kill-switch path, not a bug.
    ok('with the map OFF the classic title screen is still the ending', classic.titleShown)
    ok('and no map event is fired into a shell that is not listening', classic.fired === 0)
    ok('nothing threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean')
    await page.context().close()
  }

  // ── MAP: an unfinished campaign shows none of it ───────────────────────
  {
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    baseRoutes(page)
    await openMap(page, false)
    ok('a player mid-campaign gets no unlock panel', !(await page.$('.ns-hub-reveal')))
    await page.click('text=≡ MENU')
    await page.waitForTimeout(300)
    ok('and no endgame entries in the menu', !(await page.$('.ns-hub-endgame')))
    await page.context().close()
  }

  // ── MAP: a finished campaign ───────────────────────────────────────────
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    baseRoutes(page)
    await openMap(page, true)

    const reveal = await page.$('.ns-hub-reveal')
    ok('finishing the campaign is announced ON THE MAP', !!reveal)
    const txt = reveal ? (await reveal.textContent()).replace(/\s+/g, ' ') : ''
    ok('naming both modes that just unlocked',
      /THE NULL ABYSS/.test(txt) && /NEW GAME\+/.test(txt))
    ok('and saying where the weekly money is from now on (' + txt.slice(60, 130) + '…)',
      /Bunker 5/.test(txt) && /vault/i.test(txt))
    ok('with a way back to the map — the thing the old ending had none of',
      !!(await page.$('.ns-hub-reveal-close')))

    await page.click('.ns-hub-reveal-close')
    await page.waitForTimeout(300)
    ok('which closes it', !(await page.$('.ns-hub-reveal')))

    // Bunker 5 must be raidable: that is how the vault is reached every week
    // once the campaign is done.
    await page.click('button[aria-label^="THE LAST LIGHT"]')
    await page.waitForTimeout(300)
    const enter = await page.$eval('.ns-hub-map ~ div button, button', () => null).catch(() => null)
    const label = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim())
      return btns.find((t) => /^(ENTER|START|RAID|LOCKED)/.test(t)) || ''
    })
    ok('Bunker 5 reads as beaten, so it can be raided for the vault (' + label + ')',
      /RAID/.test(label))
    void enter

    await page.click('text=≡ MENU')
    await page.waitForTimeout(300)
    const menu = await page.textContent('.ns-hub-endgame').catch(() => '')
    ok('and both modes live under ≡ MENU permanently',
      /THE NULL ABYSS/.test(menu || '') && /NEW GAME\+/.test(menu || ''))

    // Second visit, same browser: the reveal is a one-time thing.
    const page2 = await ctx.newPage()
    baseRoutes(page2)
    await page2.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
    await page2.waitForSelector('.ns-hub-map', { timeout: 60000 })
    await page2.waitForTimeout(2200)
    ok('the unlock panel does not reappear on every visit', !(await page2.$('.ns-hub-reveal')))
    await page2.click('text=≡ MENU')
    await page2.waitForTimeout(300)
    ok('but the endgame entries are still there', !!(await page2.$('.ns-hub-endgame')))
    await ctx.close()
  }

  await b.close(); clean()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch((e) => { clean(); console.error('ERROR', e.message); process.exit(2) })
