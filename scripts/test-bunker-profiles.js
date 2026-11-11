#!/usr/bin/env node
/**
 * test-bunker-profiles.js — the map may not claim anything the engine does not do.
 *
 * GAME-DESIGN.md §7 and §10 rule 2. `lib/constants/game-config.ts` once carried
 * a `bunkers` block claiming six bunkers of three floors and a Golden Key on
 * "bunker 1, floor 3". All of it was false, none of it was read by any source,
 * and it reached the player-facing docs anyway. Nine such blocks were deleted.
 *
 * `lib/constants/bunkers.ts` describes bunkers again — risk, shard tier, floor
 * length — and the map renders every field of it. So it can drift the same way,
 * and this is what stops it: it mounts the REAL engine, reads the engine's own
 * actHardMode and shard-tier rule, MEASURES floor size per act, and fails if
 * any number in the constants disagrees.
 *
 * The engine stays the source of truth. The constants are a view of it that the
 * React shell can import, because the engine is a static <script> and cannot be
 * imported from (rule 1).
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/test-bunker-profiles.js
 *
 * Env: REPS (samples per act/depth pair, default 8).
 */
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path'), os = require('os')
const { execFileSync } = require('child_process')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3180'
const HARNESS = '__profiles'
const REPS = Number(process.env.REPS || 8)

// Load the constants through esbuild so the test reads exactly what ships.
const bundled = path.join(os.tmpdir(), 'ns-bunkers-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/constants/bunkers.ts', '--bundle', '--platform=node',
  '--format=cjs', '--log-level=error', '--alias:@=' + path.resolve('.'), '--outfile=' + bundled],
  { stdio: ['ignore', 'ignore', 'inherit'] })
const { BUNKERS, riskPips, lengthNote } = require(bundled)

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
const clean = () => {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  try { fs.unlinkSync(bundled) } catch {}
}

const results = []
const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail })

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await p.goto(`${BASE}/${HARNESS}/index.html`, { waitUntil: 'load' })

  const engine = await p.evaluate(async (reps) => {
    const sleep = ms => new Promise(x => setTimeout(x, ms))
    const NSG = window.NullStateGame
    const hard = (window.NS_MONSTER_CONFIG && window.NS_MONSTER_CONFIG.actHardMode) || {}
    const area = []
    for (let act = 0; act < 5; act++) {
      let tiles = 0, n = 0
      for (let i = 0; i < reps; i++) {
        for (let depth = 1; depth <= 5; depth++) {
          NSG.unmount(); await sleep(15)
          NSG.mount({ startMode: 'continue', worldMapHub: true, walletAddress: null,
            energy: { trySpend: async () => ({ ok: true }), onExhausted() {} },
            savedSession: { charKey: 'knight', campaignActIndex: act, depth, maxDepthReached: depth,
              xp: 0, level: 1, kills: 0, hp: 100, inventory: { keys: 0, relics: 0, shards: 0, items: {} },
              goldenKeysRemaining: 1, paperRemaining: 1, savedAt: Date.now() } })
          let g = null
          for (let t = 0; t < 200 && !(g && g.dun); t++) { await sleep(25); g = window.__NS && window.__NS.G }
          if (!g || !g.dun) continue
          let walk = 0
          for (let y = 0; y < g.dun.H; y++) for (let x = 0; x < g.dun.W; x++) if (g.dun.grid[y][x]) walk++
          tiles += walk; n++
        }
      }
      area.push(n ? tiles / n : 0)
    }
    NSG.unmount()
    return { hard, area }
  }, REPS)

  ok('the constants cover every act the engine has', BUNKERS.length === 5)

  for (const prof of BUNKERS) {
    const h = engine.hard[prof.act]
    ok(`bunker ${prof.act + 1}: the engine actually has a difficulty entry`, !!h)
    if (h) {
      ok(`bunker ${prof.act + 1}: hpMul matches the engine (${h.hpMul})`, Math.abs(h.hpMul - prof.hpMul) < 1e-6,
        'constants say ' + prof.hpMul)
      ok(`bunker ${prof.act + 1}: dmgMul matches the engine (${h.dmgMul})`, Math.abs(h.dmgMul - prof.dmgMul) < 1e-6,
        'constants say ' + prof.dmgMul)
    }
    // game.js `_shardTierForAct()`: acts 0-1 -> t1, 2-3 -> t2, 4 -> t3.
    const expectTier = prof.act >= 4 ? 3 : prof.act >= 2 ? 2 : 1
    ok(`bunker ${prof.act + 1}: shard tier matches _shardTierForAct (T${expectTier})`, prof.shardTier === expectTier)
  }

  // Difficulty and length must both RISE with the act, or the axis §7 promises
  // does not exist however nice the table looks.
  ok('risk rises with every bunker', BUNKERS.every((b2, i) => i === 0 || b2.hpMul > BUNKERS[i - 1].hpMul))
  ok('length rises with every bunker', BUNKERS.every((b2, i) => i === 0 || b2.lengthMul > BUNKERS[i - 1].lengthMul))
  ok('risk pips are ordered 1..5', BUNKERS.every((b2, i) => b2.risk === i + 1))

  // The measured half. A 10% band: floor generation is random, and the point is
  // that the claim is HONEST, not that it is exact to three decimals.
  const base = engine.area[0]
  for (const prof of BUNKERS) {
    const measured = engine.area[prof.act] / base
    const off = Math.abs(measured - prof.lengthMul) / prof.lengthMul
    ok(`bunker ${prof.act + 1}: claimed ${prof.lengthMul.toFixed(2)}× length, measured ${measured.toFixed(2)}×`,
      off <= 0.10, off > 0.10 ? 'off by ' + (off * 100).toFixed(0) + '%' : undefined)
  }

  // The two helpers the map renders through.
  ok('riskPips draws five slots', riskPips(3) === '▰▰▰▱▱')
  ok('bunker 1 shows no length note — it is the yardstick', lengthNote(BUNKERS[0]) === null)
  ok('bunker 5 does', /LONGER/.test(lengthNote(BUNKERS[4]) || ''))
  // Two adjacent bunkers rendering the SAME note would defeat the line's whole
  // purpose — it exists to tell them apart.
  ok('every length note is distinct',
    new Set(BUNKERS.slice(1).map(lengthNote)).size === BUNKERS.length - 1,
    BUNKERS.map(lengthNote).join(' | '))
  ok('every bunker says what it is for', BUNKERS.every((b2) => b2.pitch && b2.pitch.length > 10))

  let failed = 0
  for (const t of results) {
    if (t.ok) console.log('  ✓ ' + t.name)
    else { failed++; console.log('  ✗ ' + t.name + (t.detail ? ' — ' + t.detail : '')) }
  }
  console.log(`  ${results.length - failed}/${results.length} lolos`)
  clean(); await b.close(); process.exit(failed ? 1 : 0)
})().catch(e => { clean(); console.error('ERROR', e.message); process.exit(2) })
