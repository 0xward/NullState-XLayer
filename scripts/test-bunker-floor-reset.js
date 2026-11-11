#!/usr/bin/env node
/**
 * test-bunker-floor-reset.js — a cleared bunker must never save a deep floor.
 *
 * THE BUG THIS LOCKS DOWN: with the world-map hub on, clearing a bunker
 * surfaced the player to the map and persisted whatever getSaveSnapshot()
 * returned. Outside a dungeon that call falls back to the last in-bunker
 * snapshot, which still says the floor the vault was on — 5. Pressing ENTER
 * then resumed with `startDepth = snap.depth`, so the NEXT bunker opened
 * ON FLOOR 5 and four floors of the act were skipped.
 *
 * The classic flow never hit it because _enterBunkerFromDoor() rebuilds its
 * restore snapshot with `depth: 1, maxDepthReached: 1`; the hub path returns
 * before reaching that line.
 *
 * Fixed in two places — game.js resets its cached snapshot on clear, and
 * GameFlowManager clamps again before writing — so this drives the SHELL half,
 * which is the one that can be exercised without playing through five floors:
 * it stubs the engine into reporting a floor-5 snapshot, fires the real
 * bunker-cleared event, and reads what actually landed in the saved draft.
 *
 * Playing an entire bunker in a headless browser is not practical, so this does
 * not prove the engine half end-to-end. It does prove that no floor above 1 can
 * reach the player's save through the shell, which is the path the bug took.
 *
 *   npm run build && npx next start -p 3160 &
 *   node scripts/test-bunker-floor-reset.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core')

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3160'
const WALLET = '0x1111111111111111111111111111111111111111'

let fails = 0
const expect = (label, cond) => {
  if (cond) console.log('   ✓ ' + label)
  else { fails++; console.log('   ✗ FAIL: ' + label) }
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  // A guest id makes the shell treat this as a real player with a wallet-keyed
  // save, without needing a wallet.
  await page.addInitScript((w) => {
    try { window.localStorage.setItem('nullstate-guest-id', w) } catch {}
  }, WALLET)

  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)

  const result = await page.evaluate((wallet) => {
    const key = `nullstate:session-draft:${wallet.toLowerCase()}`
    window.localStorage.removeItem(key)

    // Stand in for an engine that has just cleared the vault on floor 5.
    const before = { charKey: 'knight', campaignActIndex: 1, xp: 900, level: 5, kills: 40,
                     hp: 80, depth: 5, maxDepthReached: 5,
                     inventory: { keys: 0, relics: 0, shards: 0, gshards: { t1: 0, t2: 0, t3: 0 }, paper: 0, items: {} } }
    window.NullStateGame = Object.assign({}, window.NullStateGame, { getSaveSnapshot: () => before })

    window.dispatchEvent(new CustomEvent('nullstate-bunker-cleared', {
      detail: { nextActIndex: 1, clearedActIndex: 0 },
    }))
    return new Promise((resolve) => setTimeout(() => {
      let saved = null
      try { saved = JSON.parse(window.localStorage.getItem(key) || 'null') } catch {}
      resolve({ before, saved })
    }, 600))
  }, WALLET)

  const { before, saved } = result
  console.log(`engine reported: depth ${before.depth}, maxDepthReached ${before.maxDepthReached}`)
  console.log(`saved draft:     ${saved ? `depth ${saved.depth}, maxDepthReached ${saved.maxDepthReached}, act ${saved.campaignActIndex}` : 'NOTHING WRITTEN'}`)

  expect('a draft was written', !!saved)
  if (saved) {
    expect('saved depth is 1, not the vault floor', saved.depth === 1)
    expect('saved maxDepthReached is 1', saved.maxDepthReached === 1)
    expect('the rest of the run carried over (xp)', saved.xp === before.xp)
    expect('the rest of the run carried over (level)', saved.level === before.level)
    expect('the act index was preserved', saved.campaignActIndex === before.campaignActIndex)
  }

  await browser.close()
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
