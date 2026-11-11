#!/usr/bin/env node
/**
 * measure-bunkers-by-act.js — are the five bunkers actually different?
 *
 * GAME-DESIGN.md §7 says the intended axis is TIME vs RISK: bunker 1 short and
 * easy, bunker 5 long and deadly. This measures whether that is true, by
 * mounting the real engine at every act and counting what it produces.
 *
 * Run it before and after any change to the generator. The numbers it prints
 * are the ones §7 quotes, so they can never quietly drift from the code the way
 * game-config.ts did.
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/measure-bunkers-by-act.js
 *
 * Env: REPS (runs per act/depth pair, default 12).
 */
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3180'
const HARNESS = '__byact'
const REPS = Number(process.env.REPS || 12)

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

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await p.goto(`${BASE}/${HARNESS}/index.html`, { waitUntil: 'load' })

  const rows = await p.evaluate(async (reps) => {
    const sleep = ms => new Promise(x => setTimeout(x, ms))
    const NSG = window.NullStateGame
    const out = []
    const isBox = o => o.def && o.def.interactive && !o.def.isVaultDoor && !o.def.isSealedCache && !o.def.isPremiumCache
    for (let act = 0; act < 5; act++) {
      const acc = { act, tiles: 0, rooms: 0, enemies: 0, boxes: 0, props: 0, n: 0, shardTier: 0 }
      for (let i = 0; i < reps; i++) {
        for (let depth = 1; depth <= 5; depth++) {
          NSG.unmount(); await sleep(20)
          NSG.mount({
            startMode: 'continue', worldMapHub: true, walletAddress: null,
            energy: { trySpend: async () => ({ ok: true }), onExhausted() {} },
            savedSession: { charKey: 'knight', campaignActIndex: act, depth, maxDepthReached: depth,
              xp: 0, level: 1, kills: 0, hp: 100, inventory: { keys: 0, relics: 0, shards: 0, items: {} },
              goldenKeysRemaining: 1, paperRemaining: 1, savedAt: Date.now() },
          })
          let g = null
          for (let t = 0; t < 200 && !(g && g.dun); t++) { await sleep(30); g = window.__NS && window.__NS.G }
          if (!g || !g.dun) continue
          // Walkable tiles, not the grid box — that is what "how long is this
          // floor" actually means to someone walking it.
          let walk = 0
          for (let y = 0; y < g.dun.H; y++) for (let x = 0; x < g.dun.W; x++) if (g.dun.grid[y][x]) walk++
          acc.tiles += walk
          acc.rooms += g.dun.rooms.length
          acc.enemies += g.enemies.length
          acc.boxes += g.decor.filter(isBox).length
          acc.props += g.decor.length
          acc.n++
        }
      }
      // The shard tier this act pays, straight from the engine's own rule.
      acc.shardTier = act >= 4 ? 3 : act >= 2 ? 2 : 1
      out.push(acc)
    }
    NSG.unmount()
    return out
  }, REPS)

  const f = (v, n) => (v / n).toFixed(1)
  console.log('')
  console.log('  per LANTAI (rata-rata dari 5 kedalaman × ' + REPS + ' run)')
  console.log('  ┌───────┬────────┬───────┬───────┬──────┬────────┬───────┐')
  console.log('  │ bunker│ petak  │ ruang │ musuh │ peti │ prop   │ shard │')
  console.log('  ├───────┼────────┼───────┼───────┼──────┼────────┼───────┤')
  for (const r of rows) {
    console.log('  │   ' + (r.act + 1) + '   │ ' + String(f(r.tiles, r.n)).padStart(6)
      + ' │ ' + String(f(r.rooms, r.n)).padStart(5) + ' │ ' + String(f(r.enemies, r.n)).padStart(5)
      + ' │ ' + String(f(r.boxes, r.n)).padStart(4) + ' │ ' + String(f(r.props, r.n)).padStart(6)
      + ' │  T' + r.shardTier + '   │')
  }
  console.log('  └───────┴────────┴───────┴───────┴──────┴────────┴───────┘')

  const first = rows[0], last = rows[rows.length - 1]
  const ratio = (a, b) => (b / a).toFixed(2)
  console.log('')
  console.log('  BUNKER 5 vs BUNKER 1 — apakah benar "lebih panjang, lebih berat"?')
  console.log('    luas lantai : ' + ratio(first.tiles / first.n, last.tiles / last.n) + '×')
  console.log('    ruangan     : ' + ratio(first.rooms / first.n, last.rooms / last.n) + '×')
  console.log('    musuh       : ' + ratio(first.enemies / first.n, last.enemies / last.n) + '×')
  console.log('    peti ber-OPEN: ' + ratio(first.boxes / first.n, last.boxes / last.n) + '×')
  console.log('')
  console.log('  SATU BUNKER PENUH (5 lantai):')
  for (const r of rows) {
    console.log('    bunker ' + (r.act + 1) + ': ' + (r.enemies / r.n * 5).toFixed(0) + ' musuh · '
      + (r.boxes / r.n * 5).toFixed(1) + ' peti · ' + (r.tiles / r.n * 5).toFixed(0) + ' petak · shard T' + r.shardTier)
  }
  console.log('')

  clean(); await b.close()
})().catch(e => { clean(); console.error('ERROR', e.message); process.exit(2) })
