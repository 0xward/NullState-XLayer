#!/usr/bin/env node
/**
 * test-season-xp.js — the number that decides who gets paid.
 *
 * A season score has to be what the player earned THIS season. The first
 * version took it as a difference against a baseline — career XP now, minus
 * career XP when the season started — and it was wrong for precisely the
 * players who had been here longest.
 *
 * OWNER, Season 2, from the live board: *"pake wallet lainnya kills terhitung
 * tp xp tidak."* His row read 30 kills and 0 XP.
 *
 * Career XP is stored as a high-water mark, so a New Game (which legitimately
 * restarts at 0) cannot erase it. Combine the two:
 *
 *     stored career xp .... 8581      baseline .... 8581
 *     this run's xp ....... 585       score ....... max(8581,585) - 8581 = 0
 *
 * The player earns nothing until ONE RUN beats their all-time best. A new
 * wallet is baselined at 0 and works perfectly, which is why some accounts
 * looked right and others sat at zero — and why it survived a whole month.
 *
 * seasonXpGain is the same shape recordRunKills has used correctly all along:
 * remember what was last reported, add the increase.
 *
 *   node scripts/test-season-xp.js
 */
const { execFileSync } = require('child_process')
const path = require('path'), os = require('os')

const out = path.join(os.tmpdir(), 'ns-sxp-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/seasonXp.ts', '--bundle', '--platform=node',
  '--format=cjs', '--log-level=error', '--alias:@=' + path.resolve('.'), '--outfile=' + out],
  { stdio: ['ignore', 'ignore', 'inherit'] })
const { seasonXpGain } = require(out)

let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }
const eq = (l, got, want) => ok(l, got === want, `got ${got}, want ${want}`)

// ── THE BUG, AS THE OWNER SAW IT ────────────────────────────────────────────
// A veteran with 8581 career XP plays a run and reaches 585. Under the old
// baseline this was 0. It must be 585 — everything that run earned.
eq('a returning player earns the whole run, not zero',
  seasonXpGain({ xp: 8581, lastRecordedXp: 0 }, 585), 585)

// ── first sight anchors, it does not award ──────────────────────────────────
// Every existing doc lands here exactly once at rollout. Awarding the figure
// would hand a veteran their entire career total as a season score.
eq('a doc that has never reported is anchored, not paid', seasonXpGain({ xp: 8581 }, 8581), 0)
eq('and so is a brand-new wallet', seasonXpGain(null, 0), 0)
eq('even one that arrives mid-run', seasonXpGain(undefined, 1200), 0)

// ── ordinary progress ───────────────────────────────────────────────────────
eq('the increase between reports is the score', seasonXpGain({ lastRecordedXp: 100 }, 175), 75)
eq('an unchanged report is worth nothing', seasonXpGain({ lastRecordedXp: 175 }, 175), 0)
// Two writers (updateLeaderboardEntry and recordRunProgress) call this with the
// same figure. The second must not pay twice.
eq('so two writers with the same figure cannot double-count',
  seasonXpGain({ lastRecordedXp: 175 }, 175), 0)

// ── New Game, which the baseline could never handle ─────────────────────────
// p.xp only goes DOWN when a run restarts, so the lower figure is a fresh run
// and every point of it is new.
eq('a restart counts in full rather than reading as no progress',
  seasonXpGain({ lastRecordedXp: 8581 }, 40), 40)
eq('and keeps accumulating from there', seasonXpGain({ lastRecordedXp: 40 }, 260), 220)

// ── never negative, never nonsense ──────────────────────────────────────────
ok('a gain is never negative', [
  seasonXpGain({ lastRecordedXp: 500 }, 0),
  seasonXpGain({ lastRecordedXp: 500 }, 499),
  seasonXpGain({ lastRecordedXp: 0 }, 0),
].every((n) => n >= 0))
eq('a garbage report is worth nothing', seasonXpGain({ lastRecordedXp: 10 }, NaN), 0)
eq('so is a negative one', seasonXpGain({ lastRecordedXp: 10 }, -5), 0)
eq('and Infinity is not a score', seasonXpGain({ lastRecordedXp: 10 }, Infinity), 0)

// ── a season is a sum, and it adds up ───────────────────────────────────────
// Walk a veteran through a month: anchored, two runs, a New Game, two more.
{
  const reports = [8581, 8700, 8950, 120, 400, 900]
  let doc = { xp: 8581 }
  let season = 0
  for (const xp of reports) {
    season += seasonXpGain(doc, xp)
    doc = { xp: Math.max(doc.xp, xp), lastRecordedXp: xp }
  }
  // 0 + 119 + 250 + 120 + 280 + 500
  eq('a full month of play sums to what was actually earned', season, 1269)
  ok('and the career high-water mark is untouched by any of it', doc.xp === 8950, String(doc.xp))
}

// ── the baseline is gone, not merely unused ─────────────────────────────────
const read = (p) => require('fs').readFileSync(path.join(__dirname, '..', p), 'utf8')
ok('seasonBaseline no longer exists to be called by mistake',
  !/export function seasonBaseline/.test(read('lib/seasonXp.ts')))
const svc = read('lib/leaderboardService.ts')
ok('and nothing writes seasonBaseXp any more', !/seasonBaseXp: /.test(svc))
ok('both writers accumulate instead', (svc.match(/seasonXpGain\(data, xp\)/g) || []).length === 2)
// The rule that already cost this file every kill for a month.
ok('and neither of them reads after it writes', (() => {
  const bodies = svc.split('runTransaction(db, async (tx) => {').slice(1)
  return bodies.every((b) => {
    const body = b.slice(0, b.indexOf('\n    })'))
    const firstSet = body.indexOf('tx.set'), lastGet = body.lastIndexOf('tx.get')
    return firstSet < 0 || lastGet < firstSet
  })
})())

console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
process.exit(fails ? 1 : 0)
