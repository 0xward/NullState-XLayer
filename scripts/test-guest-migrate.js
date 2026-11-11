#!/usr/bin/env node
/**
 * test-guest-migrate.js — connecting a wallet must not cost the player anything.
 *
 * FOUND BY AUDIT. /api/guest/migrate moved Point, materials, gear, tiers,
 * blueprints and elixir — and none of the time-boxed records. A guest who spent
 * the week opening containers arrived at their new wallet with ZERO Vault
 * Fragments, losing the entire path to that week's USDT at the exact moment
 * they converted. Connecting a wallet is the single thing we most want a player
 * to do, and it was the thing that cost them the most.
 *
 * The merge rules differ per record because the records mean different things,
 * so each is checked separately — a blanket "add everything" would let a player
 * double-count a day by converting, and a blanket "wallet wins" would throw the
 * fragments away all over again.
 *
 *   node scripts/test-guest-migrate.js
 *
 * Runs against a stubbed RTDB: this is merge arithmetic, and the route's own
 * validation is covered where it lives. The logic sits in
 * lib/server/guestMigrate.ts so it can be read and tested without dragging
 * firebase-admin and next/server in behind it.
 */
const { execFileSync } = require('child_process')
const fs = require('fs'), path = require('path'), os = require('os')

const out = path.join(os.tmpdir(), 'ns-migrate-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/server/guestMigrate.ts', '--bundle', '--platform=node',
  '--format=cjs', '--log-level=error', '--alias:@=' + path.resolve('.'), '--outfile=' + out],
  { stdio: ['ignore', 'ignore', 'inherit'] })
const { migrateTimeBoxed } = require(out)

const results = []
const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail })

function makeDb(tree = {}) {
  const read = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree)
  const write = (p, v) => {
    const parts = p.split('/'); let o = tree
    for (const k of parts.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k] }
    o[parts[parts.length - 1]] = v
  }
  return {
    tree,
    ref(p) {
      return {
        async get() { const v = read(p); return { val: () => (v === undefined ? null : v), exists: () => v !== undefined } },
        async transaction(fn) {
          const cur = read(p)
          const next = fn(cur === undefined ? null : cur)
          if (next === undefined) return { committed: false, snapshot: { val: () => (cur === undefined ? null : cur) } }
          write(p, next)
          return { committed: true, snapshot: { val: () => next } }
        },
      }
    },
  }
}

const G = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const W = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const WEEK = '202631', DAY = '2026-07-31'

;(async () => {
  // ── the headline: fragments must ADD ──────────────────────────────────
  {
    const db = makeDb({
      vaultFragments: { [WEEK]: { [G]: 12, [W]: 3 } },
    })
    const r = await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('a guest\'s vault fragments survive the wallet connect',
      db.tree.vaultFragments[WEEK][W] === 15, 'guest 12 + wallet 3 -> ' + db.tree.vaultFragments[WEEK][W])
    ok('and the result is reported back', r.fragments === 15)
  }
  {
    // The case that actually loses money: a full week of guest play, brand-new
    // wallet. Before the fix this arrived as 0.
    const db = makeDb({ vaultFragments: { [WEEK]: { [G]: 12 } } })
    await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('a brand-new wallet inherits the whole bar',
      db.tree.vaultFragments[WEEK][W] === 12, String(db.tree.vaultFragments[WEEK][W]))
  }

  // ── weekly claims: carried, never doubled ─────────────────────────────
  {
    const db = makeDb({ paperClaims: { [WEEK]: { [G]: { claimedAt: 111, via: 'fragments' } } } })
    await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('a Paper earned as a guest counts as the wallet\'s Paper this week',
      !!db.tree.paperClaims[WEEK][W], JSON.stringify(db.tree.paperClaims[WEEK][W]))
  }
  {
    // The wallet already claimed. Its own record must survive untouched, or the
    // week's one-per-wallet cap starts lying about when it was earned.
    const db = makeDb({
      goldenKeyClaims: { [WEEK]: { [G]: { claimedAt: 111 }, [W]: { claimedAt: 999 } } },
    })
    await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('a wallet that already claimed keeps ITS record',
      db.tree.goldenKeyClaims[WEEK][W].claimedAt === 999,
      String(db.tree.goldenKeyClaims[WEEK][W].claimedAt))
  }

  // ── contracts: max, not sum ───────────────────────────────────────────
  {
    const db = makeDb({
      dailyContracts: { [DAY]: { [G]: { kills30: 22, cont5: 1 }, [W]: { kills30: 9, floors3: 2 } } },
    })
    await migrateTimeBoxed(db, G, W, WEEK, DAY)
    const merged = db.tree.dailyContracts[DAY][W]
    ok('today\'s contract progress takes the HIGHER of the two', merged.kills30 === 22, 'kills30=' + merged.kills30)
    ok('and keeps objectives only one side had',
      merged.cont5 === 1 && merged.floors3 === 2, JSON.stringify(merged))
    // Summing would hand a player 31 kills for 22 — a free contract for
    // converting, which is a reward for an account action rather than for play.
    ok('it does NOT sum them', merged.kills30 !== 31)
  }

  // ── streak: the longer run wins, the trophy never shrinks ─────────────
  {
    const db = makeDb({
      loginStreak: { [G]: { streak: 6, best: 9, lastDayId: DAY }, [W]: { streak: 2, best: 4, lastDayId: DAY } },
    })
    await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('the longer streak carries over', db.tree.loginStreak[W].streak === 6, String(db.tree.loginStreak[W].streak))
    ok('and the best-ever is the max of both', db.tree.loginStreak[W].best === 9, String(db.tree.loginStreak[W].best))
  }
  {
    const db = makeDb({
      loginStreak: { [G]: { streak: 2, best: 11, lastDayId: DAY }, [W]: { streak: 7, best: 7, lastDayId: DAY } },
    })
    await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('a wallet with the longer run keeps it', db.tree.loginStreak[W].streak === 7)
    ok('but still inherits the bigger trophy', db.tree.loginStreak[W].best === 11)
  }

  // ── nothing to move must be harmless ──────────────────────────────────
  {
    const db = makeDb({})
    const r = await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('a guest with no weekly progress writes nothing', Object.keys(r).length === 0 && !db.tree.vaultFragments)
  }
  {
    // Only the CURRENT week and day move. Older buckets reset on their own and
    // a three-week-old bar is not worth carrying.
    const db = makeDb({ vaultFragments: { '202628': { [G]: 40 }, [WEEK]: { [G]: 2 } } })
    await migrateTimeBoxed(db, G, W, WEEK, DAY)
    ok('last month\'s fragments are not resurrected',
      db.tree.vaultFragments[WEEK][W] === 2 && !db.tree.vaultFragments['202628'][W],
      String(db.tree.vaultFragments[WEEK][W]))
  }

  let failed = 0
  for (const t of results) {
    if (t.ok) console.log('  ✓ ' + t.name + (t.detail ? ' (' + t.detail + ')' : ''))
    else { failed++; console.log('  ✗ ' + t.name + (t.detail ? ' — ' + t.detail : '')) }
  }
  console.log(`  ${results.length - failed}/${results.length} lolos`)
  try { fs.unlinkSync(out) } catch {}
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('ERROR', e); process.exit(2) })
