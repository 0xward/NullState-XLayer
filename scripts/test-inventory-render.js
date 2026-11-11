#!/usr/bin/env node
/**
 * test-inventory-render.js — the inventory must not accumulate rows.
 *
 * OWNER BUG, from MiniPay (screenshots): the stash panel filled up with dozens
 * of identical "FRAGMENTS -> OLD PAPER" bars, so burning an item meant scrolling
 * past all of them first. "kamu menatuh semua di inventory??? sampe2 aku harus
 * scroll hanya untuk burn item di dalam game".
 *
 * CAUSE. renderStashPanel() does not empty its host — it removes children by an
 * explicit LIST of class names and rebuilds those. The fragment bar shipped with
 * a class ('.inv-frag') that was never added to that list, so every one of the
 * sixteen call sites appended one more and nothing ever removed them.
 *
 * This drives the engine's real render repeatedly and asserts the panel holds
 * exactly ONE bar and ONE row per item however many times it runs. It fails on
 * the shipped code and passes on the fix, so it is a regression test rather than
 * a description of the fix.
 *
 *   (cd public && python3 -m http.server 3180) &
 *   node scripts/test-inventory-render.js
 */
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3180'
const HARNESS = '__invrender'

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
const check = (name, got, want) => { results.push({ name, ok: got === want, got, want }) }

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)))
  await p.goto(`${BASE}/${HARNESS}/index.html`, { waitUntil: 'load' })

  const r = await p.evaluate(async () => {
    const sleep = ms => new Promise(x => setTimeout(x, ms))
    window.NullStateGame.mount({
      startMode: 'continue', worldMapHub: true, walletAddress: null,
      energy: { trySpend: async () => ({ ok: true }), onExhausted() {} },
      savedSession: { charKey: 'knight', campaignActIndex: 0, depth: 1, maxDepthReached: 1, xp: 0, level: 1, kills: 0, hp: 100,
        inventory: { keys: 1, relics: 0, shards: 0, items: {} }, goldenKeysRemaining: 1, paperRemaining: 1, savedAt: Date.now() },
    })
    let g = null
    for (let t = 0; t < 200 && !(g && g.dun); t++) { await sleep(50); g = window.__NS && window.__NS.G }
    if (!g) return { err: 'engine never mounted' }

    // Put the panel in the exact state the screenshots show: a fragment bar
    // that has something left to fill, plus real loot to scroll past.
    window.__NS.setVaultFrag({ loaded: true, fragments: 1, nextGoal: { key: 'paper', threshold: 8, label: 'Old Paper' } })
    const mk = (id, name) => ({ item: { id, name, rarity: 'rare', color: '#4af', value: 80 }, count: 1 })
    g.inventory.items = { a: mk('a', 'Alpha'), b: mk('b', 'Beta') }

    const host = document.getElementById('invItems')
    const count = sel => host.querySelectorAll(sel).length
    const render = window.__NS.renderStashPanel
    if (typeof render !== 'function') return { err: 'renderStashPanel not exposed on window.__NS' }

    // '.inv-item' alone also matches the empty grid placeholders
    // (fillGridPlaceholders), so real loot rows are the ones with a data-id.
    render('invItems', 'invEmpty', {})
    const first = { frag: count('.inv-frag'), item: count('.inv-item[data-id]'), all: host.children.length }
    for (let i = 0; i < 16; i++) render('invItems', 'invEmpty', {})   // the 16 real call sites
    const after16 = { frag: count('.inv-frag'), item: count('.inv-item[data-id]'), all: host.children.length }

    // The read-only container panel must still never show the bar.
    render('invItems', 'invEmpty', { readonly: true })
    const readonly = count('.inv-frag')

    // Once both items are held there is nothing left to fill, so no bar at all.
    window.__NS.setVaultFrag({ nextGoal: null })
    render('invItems', 'invEmpty', {})
    const bothHeld = count('.inv-frag')

    return { first, after16, readonly, bothHeld }
  })

  if (r.err) { console.error('  ERROR: ' + r.err); clean(); await b.close(); process.exit(2) }

  check('render pertama: 1 bar fragment', r.first.frag, 1)
  check('render pertama: 3 baris (2 loot + 1 golden key)', r.first.item, 3)
  check('setelah 16x render: TETAP 1 bar fragment', r.after16.frag, 1)
  check('setelah 16x render: TETAP 3 baris', r.after16.item, 3)
  // The property that actually failed in MiniPay: nothing accumulates AT ALL.
  check('setelah 16x render: jumlah total elemen tidak bertambah', r.after16.all, r.first.all)
  check('panel readonly (jendela peti): tanpa bar', r.readonly, 0)
  check('kedua item sudah dipegang: tanpa bar', r.bothHeld, 0)

  let failed = 0
  for (const t of results) {
    if (t.ok) console.log('  ✓ ' + t.name)
    else { failed++; console.log('  ✗ ' + t.name + ' (dapat ' + t.got + ', harus ' + t.want + ')') }
  }
  if (errs.length) { failed++; console.log('  ✗ error di halaman: ' + errs.slice(0, 3).join(' | ')) }
  console.log(`  ${results.length - (failed ? failed : 0)}/${results.length} lolos`)
  clean(); await b.close(); process.exit(failed ? 1 : 0)
})().catch(e => { clean(); console.error('ERROR', e.message); process.exit(2) })
