#!/usr/bin/env node
/**
 * test-seeded-floors.js — Save & Exit must bring you back to the SAME dungeon.
 *
 * GAME-DESIGN.md §8. Before this, getSaveSnapshot() persisted 14 fields but not
 * G.floors, and dungeon.js generated from bare Math.random() — so Continue
 * rebuilt every floor from scratch: different layout, monsters alive again,
 * looted containers refilled, smashed props whole.
 *
 * The fix has two halves and this checks BOTH, because either alone fixes
 * nothing:
 *
 *   1. the layout is a pure function of the run seed, so it costs nothing to
 *      persist and comes back identical;
 *   2. what the player DID to it rides along as a delta of indices, which is
 *      only sound because of (1).
 *
 * It also checks the guard: when regeneration produces a different number of
 * enemies or props (a Premium cache appears/disappears with blueprint
 * ownership, which lives outside the save), the delta must be DROPPED rather
 * than applied to the wrong props.
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/test-seeded-floors.js
 */
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3180'
const HARNESS = '__seeded'

const tsx = fs.readFileSync(path.join(__dirname, '..', 'components', 'game', 'DungeonGame.tsx'), 'utf8')
const ids = [...new Set([...tsx.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m => m[1]))].sort()
const special = { game: '<canvas id="game"></canvas>', vaultCodeInput: '<input id="vaultCodeInput" />' }
const scripts = ['audio.js', 'assets.js', 'story.js', 'story_campaign.js', 'dungeon.js', 'items.js',
  'marketplace-items.js', 'props.js', 'monster-config.js', 'effects.js', 'entities.js', 'outdoor.js',
  'run-session.js', 'game.js']
const dir = path.join(__dirname, '..', 'public', HARNESS)
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'index.html'),
  '<!doctype html><meta charset="utf-8"><style>.hidden{display:none}</style><div class="ns-game-root">'
  + ids.map(i => special[i] || `<div id="${i}"></div>`).join('') + '</div>'
  + scripts.map(s => `<script src="/game-engine/${s}"></script>`).join(''))
const clean = () => { try { fs.rmSync(dir, { recursive: true, force: true }) } catch {} }

const results = []
const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail })

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)))
  await p.goto(`${BASE}/${HARNESS}/index.html`, { waitUntil: 'load' })

  const r = await p.evaluate(async () => {
    const sleep = ms => new Promise(x => setTimeout(x, ms))
    const NSG = window.NullStateGame
    const mount = (savedSession) => {
      NSG.mount({
        startMode: 'continue', worldMapHub: true, walletAddress: null,
        energy: { trySpend: async () => ({ ok: true }), onExhausted() {} },
        savedSession,
      })
    }
    const waitG = async () => {
      let g = null
      for (let t = 0; t < 250 && !(g && g.dun); t++) { await sleep(40); g = window.__NS && window.__NS.G }
      return g
    }
    // A fingerprint of the LAYOUT only — nothing the player can change. If the
    // seed works these match exactly; if it does not, room count alone will
    // differ within a couple of runs.
    const layout = (g) => {
      const d = g.dun
      return JSON.stringify({
        w: d.W, h: d.H, rooms: d.rooms.map(r => [r.x, r.y, r.w, r.h]),
        start: [Math.round(d.startPx.x), Math.round(d.startPx.y)],
        stairs: [Math.round(d.stairsPx.x), Math.round(d.stairsPx.y)],
        enemies: g.enemies.map(e => [Math.round(e.x), Math.round(e.y), e.arch && e.arch.key || '']),
        decor: g.decor.map(o => [o.type, Math.round(o.x), Math.round(o.y)]),
      })
    }
    const mkBase = (depth) => ({ charKey: 'knight', campaignActIndex: 0, depth, maxDepthReached: depth, xp: 500, level: 3,
      kills: 10, hp: 90, inventory: { keys: 0, relics: 0, shards: 0, items: {} },
      goldenKeysRemaining: 1, paperRemaining: 1, savedAt: Date.now() })
    const isBox = (o) => o.def && o.def.interactive && !o.def.isVaultDoor && !o.def.isSealedCache && !o.def.isPremiumCache

    // ── run 1: play a little, then save ──────────────────────────────────
    //
    // Mount until the floor has a lockable container to open. A floor averages
    // 1.6 of them, so one in several has none and the container assertions
    // would fail at random — which is what the first version of this test did.
    //
    // The retry KEEPS the mounted instance rather than probing and remounting:
    // every fresh mount draws a new RUN_SEED, so a probe's floor is not the
    // floor the next mount builds. That subtlety is the whole reason the first
    // fix for this flake did not work.
    let g = null, depth = 2
    for (let attempt = 0; attempt < 8; attempt++) {
      NSG.unmount(); await sleep(40)
      depth = (attempt % 5) + 1
      mount(mkBase(depth))
      g = await waitG()
      if (g && g.decor.some(isBox)) break
      g = null
    }
    if (!g) return { err: 'no mount in 8 tries produced a floor with a lockable container' }
    const base = mkBase(depth)
    const layout1 = layout(g)
    const seed1 = window.__NS.RUN_SEED

    // Kill three, smash three, open the first container and take one slot.
    const alive = g.enemies.filter(e => !e.dead).slice(0, 3)
    for (const e of alive) { e.dead = true; e.hp = 0 }
    const breakable = g.decor.filter(o => !o.broken && !o.def.ambient && !o.def.interactive).slice(0, 3)
    for (const o of breakable) { o.broken = true; o.hp = 0 }
    const box = g.decor.find(isBox)
    let boxIdx = -1, slotsBefore = null
    if (box) {
      boxIdx = g.decor.indexOf(box)
      box.open()
      if (box.lootSlots && box.lootSlots.length) box.lootSlots[0].taken = true
      slotsBefore = JSON.stringify(box.lootSlots.map(s => [s.slotId, s.kind, s.taken, (s.item && s.item.id) || 0]))
    }
    // A room the player is NOT standing in — descend() lights the starting
    // room by itself, so asserting on that one proves nothing.
    const litIdx = g.dun.rooms.length - 1
    g.dun.rooms[litIdx].visited = true
    g.player.x = g.dun.startPx.x + 37; g.player.y = g.dun.startPx.y + 11
    const stood = { x: Math.round(g.player.x), y: Math.round(g.player.y) }

    const snap = NSG.getSaveSnapshot()
    const savedFloor = snap.floors && snap.floors[String(depth)]

    // ── run 2: continue from that save ───────────────────────────────────
    NSG.unmount(); await sleep(60)
    mount(Object.assign({}, base, snap))
    g = await waitG(); if (!g) return { err: 'engine never remounted' }
    const layout2 = layout(g)
    const seed2 = window.__NS.RUN_SEED
    const restored = {
      dead: g.enemies.filter(e => e.dead).length,
      broken: g.decor.filter(o => o.broken).length,
      boxOpened: boxIdx >= 0 ? !!(g.decor[boxIdx] && g.decor[boxIdx].opened) : null,
      boxSlots: boxIdx >= 0 && g.decor[boxIdx] && g.decor[boxIdx].lootSlots
        ? JSON.stringify(g.decor[boxIdx].lootSlots.map(s => [s.slotId, s.kind, s.taken, (s.item && s.item.id) || 0])) : null,
      litRoom: !!(g.dun.rooms[litIdx] && g.dun.rooms[litIdx].visited),
      litIdx,
      at: { x: Math.round(g.player.x), y: Math.round(g.player.y) },
    }

    // ── run 3: a FRESH run must NOT reuse the seed ───────────────────────
    NSG.unmount(); await sleep(60)
    mount(Object.assign({}, base, { runSeed: undefined, floors: undefined, at: undefined }))
    g = await waitG(); if (!g) return { err: 'engine never mounted for the fresh run' }
    const layout3 = layout(g)

    // ── run 4: a delta whose shape no longer matches must be DROPPED ─────
    NSG.unmount(); await sleep(60)
    const tampered = JSON.parse(JSON.stringify(snap))
    tampered.floors[String(depth)].dl = tampered.floors[String(depth)].dl + 1   // pretend a cache appeared
    mount(Object.assign({}, base, tampered))
    g = await waitG(); if (!g) return { err: 'engine never mounted for the mismatch run' }
    const afterMismatch = { dead: g.enemies.filter(e => e.dead).length, broken: g.decor.filter(o => o.broken).length }

    // ── run 5: the shell moves the save to the NEXT bunker ───────────────
    // On clear it rewrites campaignActIndex/depth on the same snapshot. The
    // floors it carries belong to the bunker just finished — replaying them
    // would start the new bunker with its monsters already dead and its
    // containers already emptied.
    NSG.unmount(); await sleep(60)
    const moved = JSON.parse(JSON.stringify(snap))
    moved.campaignActIndex = 1; moved.depth = 1; moved.maxDepthReached = 1
    mount(Object.assign({}, base, moved))
    g = await waitG(); if (!g) return { err: 'engine never mounted for the next-bunker run' }
    const nextBunker = { dead: g.enemies.filter(e => e.dead).length, broken: g.decor.filter(o => o.broken).length,
      seed: window.__NS.RUN_SEED }

    // ── size: this payload now rides in EVERY save ───────────────────────
    // It goes to Firestore and, as a draft, to localStorage — so an unbounded
    // blob would be a regression of its own. Worst realistic case: a whole
    // bunker with every prop smashed and every container opened. Each floor's
    // delta is independent, so building them one at a time and summing is a
    // faithful total.
    let worstBytes = 0
    for (let depth = 1; depth <= 5; depth++) {
      NSG.unmount(); await sleep(50)
      mount(Object.assign({}, base, { depth, maxDepthReached: depth }))
      g = await waitG(); if (!g) break
      for (const e of g.enemies) { e.dead = true; e.hp = 0 }
      for (const o of g.decor) {
        if (o.def && o.def.interactive) { o.open() } else { o.broken = true }
      }
      const s = NSG.getSaveSnapshot()
      worstBytes += JSON.stringify(s.floors || {}).length
    }

    NSG.unmount()
    return { layout1, layout2, layout3, seed1, seed2, savedFloor, restored, slotsBefore, stood, afterMismatch,
      boxIdx, nextBunker, savedKey: snap.floorsKey, worstBytes }
  })

  if (r.err) { console.error('  ERROR: ' + r.err); clean(); await b.close(); process.exit(2) }

  ok('run seed survives the save', r.seed1 === r.seed2, r.seed1 + ' -> ' + r.seed2)
  ok('the floor regenerates IDENTICALLY', r.layout1 === r.layout2)
  ok('a fresh run gets a different floor', r.layout1 !== r.layout3)
  ok('the save carries a floor delta', !!r.savedFloor)
  ok('3 dead enemies stay dead', r.restored.dead === 3, 'dead=' + r.restored.dead)
  ok('3 smashed props stay smashed', r.restored.broken === 3, 'broken=' + r.restored.broken)
  ok('the opened container stays open', r.restored.boxOpened === true)
  ok('and holds exactly the loot that was left in it', r.restored.boxSlots === r.slotsBefore)
  ok('a distant lit room stays lit', r.restored.litRoom === true, 'room ' + r.restored.litIdx)
  ok('the player resumes where they stood', r.restored.at.x === r.stood.x && r.restored.at.y === r.stood.y,
    JSON.stringify(r.restored.at) + ' vs ' + JSON.stringify(r.stood))
  ok('a delta that no longer fits is dropped, not misapplied',
    r.afterMismatch.dead === 0 && r.afterMismatch.broken === 0, JSON.stringify(r.afterMismatch))
  ok('the save records which run its floors belong to', typeof r.savedKey === 'string' && r.savedKey.length > 0, r.savedKey)
  ok('the NEXT bunker does not inherit the last one\'s floors',
    r.nextBunker.dead === 0 && r.nextBunker.broken === 0, JSON.stringify({ dead: r.nextBunker.dead, broken: r.nextBunker.broken }))
  ok('and gets its own seed', r.nextBunker.seed !== r.seed1, r.seed1 + ' -> ' + r.nextBunker.seed)
  // Well under Firestore's 1MB document limit and nowhere near a localStorage
  // quota. Stated as a bound rather than a hope — if a future change makes the
  // delta fat, this is where it shows up.
  ok('a fully-cleared bunker stays small enough to save', r.worstBytes < 120000,
    (r.worstBytes / 1024).toFixed(1) + ' KB for 5 floors, semua dipecah & dibuka')

  let failed = 0
  for (const t of results) {
    if (t.ok) console.log('  ✓ ' + t.name + (t.detail ? ' (' + t.detail + ')' : ''))
    else { failed++; console.log('  ✗ ' + t.name + (t.detail ? ' — ' + t.detail : '')) }
  }
  if (errs.length) { failed++; console.log('  ✗ error di halaman: ' + errs.slice(0, 3).join(' | ')) }
  console.log(`  ${results.length - failed}/${results.length} lolos`)
  clean(); await b.close(); process.exit(failed ? 1 : 0)
})().catch(e => { clean(); console.error('ERROR', e.message); process.exit(2) })
