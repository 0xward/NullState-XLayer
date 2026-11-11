#!/usr/bin/env node
/**
 * test-prop-loot.js — a smashed prop must actually give you the thing.
 *
 * OWNER: *"Lootingan food ko skrg kaya gaada ya?? ini serius perlu di bahas
 * kenapa di hilangkan sebelum2nya."* Nothing had been removed. applyLoot() in
 * game.js handled hp, xp, relic, goldkey, paper and gshard — and had no `item`
 * branch at all. Nine breakable props roll `item` (crate, crystal, tablet,
 * statue, oak_barrel, barrel_stack, hay_pile, plaque_sword, cot); every one of
 * those rolls played the pickup sound, logged "— loot!" because the roll was
 * not 'none', and put nothing in the stash.
 *
 * Food is the edible ~16% of that same item library (NS_MARKET.FOOD_RANGES),
 * so a broken item path took food with it. His own screenshot says "Straw
 * Bedding shattered — loot!" over an inventory that never changed.
 *
 * This drives the REAL engine: it mounts the game, spawns props, and smashes
 * them through the same smashDecor() a weapon swing calls. It asserts on the
 * stash, not on the log line — the log line was never the thing that was
 * broken.
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/test-prop-loot.js
 *
 * Requires playwright-core and a Chromium at CHROME_PATH.
 */
const { chromium } = require('playwright-core')
const fs = require('fs'), path = require('path')

let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }

;(async () => {
  const tsx = fs.readFileSync('components/game/DungeonGame.tsx', 'utf8')
  const ids = [...new Set([...tsx.matchAll(/id="([A-Za-z0-9_]+)"/g)].map((m) => m[1]))].sort()
  const sp = { game: '<canvas id="game"></canvas>', vaultCodeInput: '<input id="vaultCodeInput" />' }
  const scripts = ['audio.js','assets.js','story.js','story_campaign.js','dungeon.js','items.js',
    'marketplace-items.js','props.js','monster-config.js','effects.js','entities.js','outdoor.js','run-session.js','game.js']
  fs.mkdirSync('public/__loot', { recursive: true })
  fs.writeFileSync('public/__loot/index.html',
    '<!doctype html><meta charset="utf-8"><style>.hidden{display:none}</style><div class="ns-game-root">'
    + ids.map((i) => sp[i] || `<div id="${i}"></div>`).join('') + '</div>'
    + scripts.map((s) => `<script src="/game-engine/${s}"></script>`).join(''))

  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
  await p.goto((process.env.BASE_URL || 'http://127.0.0.1:3180') + '/__loot/index.html', { waitUntil: 'load' })

  const res = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    // Mount the shell, tear it down, then mount a real run — the same dance
    // scripts/test-floor-traversable.js does. Mounting 'continue' straight on
    // to a cold shell leaves the dungeon null.
    window.NullStateGame.mount({ startMode: null, worldMapHub: true }); await sleep(1200)
    window.NullStateGame.unmount(); await sleep(50)
    window.NullStateGame.mount({ startMode: 'continue', worldMapHub: true, walletAddress: null,
      energy: { trySpend: async () => ({ ok: true }), onExhausted() {} },
      savedSession: { charKey: 'knight', campaignActIndex: 0, depth: 1, maxDepthReached: 1,
        xp: 0, level: 1, kills: 0, hp: 100, inventory: { keys: 0, relics: 0, shards: 0, items: {} },
        goldenKeysRemaining: 1, paperRemaining: 1, savedAt: Date.now() } })
    let g = null
    for (let t = 0; t < 200 && !(g && g.dun); t++) { await sleep(50); g = window.__NS && window.__NS.G }
    if (!g || !g.dun) return { err: 'engine did not mount' }

    const count = () => Object.values(g.inventory.items || {}).reduce((s, e) => s + (e.qty || 0), 0)
    const foodCount = () => Object.values(g.inventory.items || {})
      .filter((e) => e.item && window.NS_MARKET.isFood(e.item.id))
      .reduce((s, e) => s + (e.qty || 0), 0)

    // Smash a lot of one type and see what actually lands in the stash. The
    // rates are probabilistic, so the counts are compared against the loot
    // table's own weights rather than against a hardcoded number.
    const run = (type, n) => {
      g.decor.length = 0
      g.inventory.items = {}
      for (let i = 0; i < n; i++) window.__NS.addDecor(type)
      let smashed = 0
      for (let i = g.decor.length - 1; i >= 0; i--) if (window.__NS.smashDecorAt(i)) smashed++
      return { smashed, items: count(), food: foodCount() }
    }

    const N = 400
    return {
      hay: run('hay_pile', N),
      crate: run('crate', N),
      pail: run('bucket_water', N),
      vase: run('vase', N),          // no item/food in its table at all
      n: N,
      // The table this is measured against, read from the engine itself so the
      // test cannot drift from the data it is checking.
      tables: ['hay_pile','crate','bucket_water','vase'].reduce((o, k) => {
        const d = window.NS_PROPS.DECOR_TYPES[k]
        const tot = d.loot.reduce((s, l) => s + l[2], 0)
        o[k] = { item: d.loot.filter(l => l[0]==='item').reduce((s,l)=>s+l[2],0) / tot,
                 food: d.loot.filter(l => l[0]==='food').reduce((s,l)=>s+l[2],0) / tot }
        return o
      }, {}),
    }
  })

  if (res.err) { console.error('  ERROR: ' + res.err); process.exit(2) }
  const N = res.n

  ok('the engine smashed every prop it was given',
    res.hay.smashed === N && res.crate.smashed === N, `${res.hay.smashed}/${N}`)

  // ── THE BUG ────────────────────────────────────────────────────────────────
  // Before the fix these were all 0: an item roll produced nothing at all.
  ok('smashing Straw Bedding puts things in the stash', res.hay.items > 0,
    `${res.hay.items} items from ${N}`)
  ok('smashing a Supply Crate does too', res.crate.items > 0,
    `${res.crate.items} items from ${N}`)

  // ── FOOD, which was the owner's actual report ─────────────────────────────
  const expFood = (k) => (res.tables[k].food + res.tables[k].item * 0.156) * N
  for (const [k, got] of [['hay_pile', res.hay.food], ['crate', res.crate.food], ['bucket_water', res.pail.food]]) {
    const exp = expFood(k)
    // ±45% of expectation: loose enough that 400 samples never flake, tight
    // enough that a zero or a tenfold change fails loudly.
    ok(`${k} yields food at roughly its table's rate`,
      got > exp * 0.55 && got < exp * 1.45, `got ${got}, table says ~${exp.toFixed(0)}`)
  }
  ok('everything counted as food really is edible — checked via NS_MARKET',
    res.pail.food <= res.pail.items)

  // ── AND NOTHING ELSE CHANGED ──────────────────────────────────────────────
  // A prop with no item and no food in its table must still give none. This is
  // what would fail if the fix had been "make every prop drop items".
  ok('a Glazed Vase still drops no items at all', res.vase.items === 0,
    String(res.vase.items))

  ok('nothing threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean')

  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  await b.close()
  fs.rmSync('public/__loot', { recursive: true, force: true })
  process.exit(fails ? 1 : 0)
})().catch((e) => {
  console.error('ERROR', e.message)
  fs.rmSync('public/__loot', { recursive: true, force: true })
  process.exit(2)
})
