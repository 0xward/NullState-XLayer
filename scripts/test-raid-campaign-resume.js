#!/usr/bin/env node
/**
 * test-raid-campaign-resume.js — a raid must never cost the player their campaign.
 *
 * WHAT THIS LOCKS DOWN. Raiding a cleared bunker (GAME-DESIGN.md §7) shares the
 * same saved-session document as the campaign, so three separate things could
 * quietly destroy a player's progress, and all three were found by tracing this
 * flow rather than by playing it:
 *
 *   1. The map read its progress straight off the session's campaignActIndex, so
 *      raiding Bunker 1 would have shown a five-bunker veteran a map with 3-5
 *      locked.
 *   2. DungeonGame's Continue branch CONSUMES the session it loads, which for a
 *      raid would have deleted the campaign mid-flight.
 *   3. The raid's own snapshot would have reset a Bunker 3 run to floor 1.
 *
 * It also caught a fourth, in the fix itself: the campaign-resume stash was
 * taken inside the `if (raw)` guard, so any path where the engine had no
 * snapshot left it on disk for the NEXT raid to restore. The first run of this
 * test reported a FALSE GREEN for exactly that reason — the engine had not
 * mounted, the whole write block was skipped, and the assertions passed against
 * the untouched seeded draft. Hence the stub below: without it this test proves
 * nothing. The "raid KEEPS what it earned" assertion is the tripwire — it can
 * only pass if the raid's snapshot was really written.
 *
 * Playing five floors of real-time combat headlessly is not practical, so this
 * drives the SHELL half by standing in for the engine's snapshot, the same way
 * scripts/test-bunker-floor-reset.js does. It does not prove the engine half.
 *
 *   npm run build && npx next start -p 3170 &
 *   node scripts/test-raid-campaign-resume.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3170'
const W = '0x2222222222222222222222222222222222222222'
let fails = 0
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l); if (!c) fails++ }

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()

  // Fixture the three status APIs — no Firebase admin creds in the sandbox, so
  // they would otherwise all degrade to empty and every chip would hide.
  await page.route('**/api/energy?**', r => r.fulfill({ json: { freeRemaining: 4, bonus: 0, total: 4, resetAt: Date.now() + 3.6e6 } }))
  await page.route('**/api/vault/fragments?**', r => r.fulfill({ json: { weekId: '202631', fragments: 7, paperClaimed: false, goldenKeyClaimed: false, nextGoal: { key: 'paper', threshold: 12, label: 'Old Paper' } } }))
  await page.route('**/api/weapons/craft?**', r => r.fulfill({ json: { craft: { itemId: 'x', targetTier: 2, startedAt: Date.now(), completesAt: Date.now() + 8040000 }, serverNow: Date.now() } }))

  // A player midway through Bunker 3 (act 2) on floor 3, who has beaten 1 and 2.
  await page.addInitScript(([w]) => {
    localStorage.setItem('nullstate-guest-id', w)
    localStorage.setItem('ns-howto-seen', '1')
    localStorage.setItem('nullstate-signin-skipped', '1')
    localStorage.setItem(`nullstate:session-draft:${w.toLowerCase()}`, JSON.stringify({
      charKey: 'knight', campaignActIndex: 2, depth: 3, maxDepthReached: 3,
      xp: 900, level: 9, kills: 40, hp: 100,
      inventory: { keys: 0, relics: 0, shards: 0, items: {} },
      goldenKeysRemaining: 1, paperRemaining: 1, savedAt: Date.now(),
    }))
  }, [W])

  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map', { timeout: 30000 })
  await page.waitForTimeout(2500)

  // ── the daily status bar ──
  // Matched by their icon, not by position: this asserted chips[1] was the
  // fragment chip until the Daily Contracts chip (◇) landed between them and
  // shifted every index by one. A test that breaks when a chip is ADDED is
  // testing the layout of the bar, which scripts/test-daily-contracts.js
  // already owns; what matters here is that the raid flow leaves it intact.
  const chips = await page.$$eval('.ns-hub-chip', els => els.map(e => e.textContent.trim()))
  const chip = (icon) => chips.find(c => c.includes(icon)) || ''
  ok('daily bar renders four chips (' + chips.join(' ') + ')', chips.length === 4)
  ok('craft chip counts down (' + chip('⏳') + ')', /h|m/.test(chip('⏳')))
  ok('contracts chip present (' + chip('◇') + ')', /\d\/\d/.test(chip('◇')))
  ok('fragment chip shows 7/12 (' + chip('◈') + ')', chip('◈').includes('7/12'))
  ok('energy chip shows 4 (' + chip('⚡') + ')', chip('⚡').includes('4'))

  // ── progress: the map must NOT have regressed, and 1-2 must be raidable ──
  const nodes = await page.$$('.ns-hub-node')
  ok('five bunker nodes on the map', nodes.length === 5)
  const doneMarks = await page.$$eval('.ns-hub-done', e => e.length)
  ok('bunkers 1 and 2 carry a ✓', doneMarks === 2)

  // Select Treeline (act 0) — bottom-most node, last in NODES order.
  await nodes[4].click()
  await page.waitForTimeout(400)
  const ctaSel = 'button:has-text("RAID"), button:has-text("ENTER"), button:has-text("START")'
  const cta = (await page.$eval(ctaSel, e => e.textContent) || '').trim()
  const sub = await page.$eval('.ns-hub-daily ~ div span:nth-child(2)', e => e.textContent).catch(() => '')
  ok('a cleared bunker offers RAID (' + cta + ')', cta.includes('RAID'))
  ok('and says it costs energy (' + sub + ')', /1 energy/.test(sub))

  // ── the flow that actually worried me ──
  await page.click(ctaSel)
  await page.waitForFunction((w) => !!localStorage.getItem(`nullstate-campaign-resume-${w.toLowerCase()}`), W, { timeout: 15000 })
  const stash = await page.evaluate((w) => JSON.parse(localStorage.getItem(`nullstate-campaign-resume-${w.toLowerCase()}`)), W)
  ok('tapping RAID stashes the campaign position', stash && stash.campaignActIndex === 2 && stash.depth === 3)

  // Stand the engine in for the raid it would have just finished. Playing five
  // floors of real-time combat headlessly is not practical, so this reports the
  // snapshot a cleared raid on Bunker 1 would produce — act 0, floor 5, with
  // the loot the raid earned. Same technique as scripts/test-bunker-floor-reset.js.
  //
  // Without this the shell's whole write block is skipped and the assertions
  // below pass against the ORIGINAL seeded draft — which is exactly how the
  // first run of this test reported a false green.
  await page.evaluate(() => {
    window.NullStateGame = window.NullStateGame || {}
    window.NullStateGame.getSaveSnapshot = () => ({
      charKey: 'knight', campaignActIndex: 0, depth: 5, maxDepthReached: 5,
      xp: 1400, level: 11, kills: 62, hp: 80,
      inventory: { keys: 1, relics: 0, shards: 0, items: { '12': 3 } },
      goldenKeysRemaining: 0, paperRemaining: 1, raid: true, savedAt: Date.now(),
    })
    window.dispatchEvent(new CustomEvent('nullstate-raid-cleared', { detail: { actIndex: 0 } }))
  })
  await page.waitForTimeout(1200)

  const after = await page.evaluate((w) => JSON.parse(localStorage.getItem(`nullstate:session-draft:${w.toLowerCase()}`) || 'null'), W)
  ok('campaign act is restored, not left at the raided bunker', after && after.campaignActIndex === 2)
  ok('campaign FLOOR is restored (depth ' + (after && after.depth) + ')', after && after.depth === 3)
  ok('maxDepthReached restored', after && after.maxDepthReached === 3)
  ok('the raid KEEPS what it earned (xp ' + (after && after.xp) + ')', after && after.xp === 1400 && after.level === 11)
  ok('and the loot it picked up', after && after.inventory && after.inventory.items['12'] === 3)
  const stashGone = await page.evaluate((w) => localStorage.getItem(`nullstate-campaign-resume-${w.toLowerCase()}`), W)
  ok('the stash is consumed', stashGone === null)
  if (stashGone !== null) console.log('    DEBUG stash still holds: ' + stashGone)

  const highest = await page.evaluate((w) => localStorage.getItem(`nullstate-campaign-progress-${w.toLowerCase()}`), W)
  ok('high-water mark still 2 after raiding bunker 1 (' + highest + ')', highest === '2')

  console.log(fails ? `\n${fails} FAILED` : '\nall passed')
  await b.close(); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
