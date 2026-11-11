#!/usr/bin/env node
/**
 * test-bunker-profile-ui.js — the map must actually SAY what each bunker is for.
 *
 * GAME-DESIGN.md §7. With all five bunkers open after the campaign, "which one
 * should I raid today?" needs an answer. The mechanical answer now exists (risk
 * curve in monster-config.js, length curve in dungeon.js, shard tier per act) —
 * this checks the player can SEE it, which is the half that actually decides
 * anything. A difference nobody is shown is not a choice.
 *
 * `npm run test:bunkers` checks the numbers against the engine. This checks
 * they reach the screen, change when you select a different bunker, and appear
 * for locked bunkers too — knowing Bunker 5 is the only T3 source is a reason
 * to keep going.
 *
 *   npm run build && npx next start -p 3179 &
 *   node scripts/test-bunker-profile-ui.js
 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3179'
const W = '0x7777777777777777777777777777777777777777'
let fails = 0
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l); if (!c) fails++ }

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()

  for (const p of ['**/api/energy?**', '**/api/vault/fragments?**', '**/api/weapons/craft?**', '**/api/contracts?**', '**/api/streak']) {
    await page.route(p, r => r.fulfill({ json: {} }))
  }
  // A player who has cleared bunkers 1-3 and is working on 4: cleared ones are
  // raidable, 5 is still locked.
  await page.addInitScript((w) => {
    localStorage.setItem('nullstate-guest-id', w)
    localStorage.setItem('ns-howto-seen', '1')
    localStorage.setItem('nullstate-signin-skipped', '1')
    localStorage.setItem('nullstate-campaign-progress-' + w, '3')
    localStorage.setItem('nullstate-session-draft-' + w, JSON.stringify({
      charKey: 'knight', campaignActIndex: 3, depth: 2, maxDepthReached: 2, xp: 900, level: 4,
      kills: 20, hp: 90, inventory: { keys: 0, relics: 0, shards: 0, items: {} },
      goldenKeysRemaining: 1, savedAt: Date.now(),
    }))
  }, W)
  await page.goto(BASE + '/game', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ns-hub-map', { timeout: 60000 })
  await page.waitForTimeout(2500)

  const profileText = async () => (await page.textContent('.ns-hub-profile').catch(() => null) || '').replace(/\s+/g, ' ').trim()
  const pitchText = async () => (await page.textContent('.ns-hub-pitch').catch(() => null) || '').trim()

  ok('the selected bunker shows a profile', !!(await profileText()))

  const nodes = await page.$$('.ns-hub-node')
  ok('five bunker nodes', nodes.length === 5)

  // Nodes are laid out bottom (bunker 1) to top (bunker 5) in NODES order:
  // act 4, 3, 2, 1, 0. Select by clicking and read what changes.
  //
  // Waits for the panel to show the bunker's NAME rather than sleeping: a fixed
  // delay caught the panel mid-render and read one bunker's pips beside
  // another's length, which failed at random and looked like an app bug.
  const readAfterClick = async (idx, name) => {
    await nodes[idx].click()
    await page.waitForFunction(
      (n) => !!document.body.textContent && document.body.textContent.includes(n),
      name, { timeout: 10000 },
    )
    await page.waitForTimeout(150)
    return { profile: await profileText(), pitch: await pitchText() }
  }

  const b1 = await readAfterClick(4, 'TREELINE BUNKER')   // act 0
  ok('bunker 1 shows 1 risk pip (' + b1.profile + ')', /▰▱▱▱▱/.test(b1.profile))
  ok('bunker 1 shows its shard tier', /SHARD T1/.test(b1.profile))
  ok('bunker 1 has NO length note — it is the yardstick', !/LONGER/.test(b1.profile))
  ok('and says what it is for (' + b1.pitch + ')', b1.pitch.length > 10)

  const b3 = await readAfterClick(2, 'FROSTLINE BUNKER')   // act 2
  ok('bunker 3 shows 3 risk pips (' + b3.profile + ')', /▰▰▰▱▱/.test(b3.profile))
  ok('bunker 3 is where T2 starts', /SHARD T2/.test(b3.profile))
  ok('and says how much longer', /\+30% LONGER/.test(b3.profile))
  ok('its pitch differs from bunker 1', b3.pitch !== b1.pitch)

  // Bunker 5 is locked for this player. Waiting for the ENTER button to read
  // LOCKED is the definitive signal that the selection has committed — the
  // bunker's NAME is not, because it also appears elsewhere on the screen.
  await nodes[0].click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((el) => el.textContent.trim() === 'LOCKED'),
    undefined, { timeout: 10000 },
  )
  const b5 = { profile: await profileText(), pitch: await pitchText() }
  ok('bunker 5 shows 5 risk pips (' + b5.profile + ')', /▰▰▰▰▰/.test(b5.profile))
  ok('bunker 5 is the only T3 source', /SHARD T3/.test(b5.profile))
  ok('and bunker 5 reads longer than bunker 4 — the rungs must differ',
    /\+65% LONGER/.test(b5.profile))
  ok('a LOCKED bunker still shows its profile — that is the reason to keep going',
    !!b5.profile && /SHARD T3/.test(b5.profile))
  // The pitch is for bunkers you can actually enter; a locked one already says
  // "Locked · clear X first" on the line above and does not need a sales line.
  ok('but a locked bunker shows no pitch', !(await page.$('.ns-hub-pitch')))

  // A late progress load must not undo a deliberate tap. `apply()` runs twice —
  // once from the instant localStorage draft and again when the Firestore copy
  // lands — and its clamp used to snap the selection back to the player's own
  // bunker a beat after they tapped a locked one, with no explanation.
  await page.waitForTimeout(2500)
  ok('and the selection SURVIVES the late progress load',
    /▰▰▰▰▰/.test(await profileText()))

  await b.close()
  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error('ERROR', e.message); process.exit(2) })
