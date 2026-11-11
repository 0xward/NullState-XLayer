#!/usr/bin/env node
/**
 * test-leaderboard-writes.js — the transaction rule that ate every kill.
 *
 * OWNER, looking at the live Season 2 board: *"aku test login pakai email, tapi
 * di leaderboard tidak tercatat jumlah kills nya??"* — his row read 1,095 XP
 * and 0 kills, and so did every other row on the board.
 *
 * The cause was one line in the wrong place. Firestore rejects a transaction
 * that reads after it writes:
 *
 *     "Firestore transactions require all reads to be executed before all
 *      writes."
 *
 * recordRunKills gained a season mirror, and the mirror's `tx.get` was written
 * below the career `tx.set`. So the transaction threw on every call, the catch
 * turned it into a console line nobody was watching, and NOTHING was recorded —
 * not the season kills the change was for, and not the career kills that had
 * been working for months. XP was untouched on the same rows, which is exactly
 * why it went unnoticed: recordRunProgress does one read and two writes.
 *
 * This runs the real functions against a stub that ENFORCES the rule, so the
 * next person who adds a read to one of these transactions gets a failing test
 * instead of a silently empty column.
 *
 *   node scripts/test-leaderboard-writes.js
 */
const { execFileSync } = require('child_process')
const path = require('path'), os = require('os')

let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }

// ── the stub: Firestore's actual constraint, enforced ────────────────────────
const store = new Map()
let wroteInThisTx = false

const key = (r) => r.__path
const mkRef = (p) => ({ __path: p })

// Writes are BUFFERED and only committed when the whole transaction resolves,
// which is what Firestore actually does — and it is the reason this bug lost
// the career kills too, not just the season mirror it was introduced for. A
// stub that applied writes as they were made would have shown the career
// column surviving and quietly understated the damage.
function makeTx(pending) {
  return {
    async get(ref) {
      if (wroteInThisTx) {
        // The real SDK's message, so a failure here reads like production.
        throw new Error('Firestore transactions require all reads to be executed before all writes.')
      }
      const v = store.get(key(ref))
      return { exists: () => v !== undefined, data: () => v }
    },
    set(ref, value) {
      wroteInThisTx = true
      pending.push([key(ref), value])
    },
  }
}

const errors = []
const stubFirestore = `
  const store = ${'globalThis.__store'};
`

// The module imports firebase/firestore. Rather than stand up the SDK, bundle
// it with that import aliased to this stub — same code path, no network.
const stubPath = path.join(os.tmpdir(), 'ns-fs-stub-' + process.pid + '.js')
require('fs').writeFileSync(stubPath, `
  export const doc = (db, col, id) => ({ __path: col + '/' + id })
  export const collection = (db, ...p) => ({ __path: p.join('/') })
  export const getDoc = async () => ({ exists: () => false, data: () => ({}) })
  export const getDocs = async () => ({ docs: [] })
  export const setDoc = async () => {}
  export const updateDoc = async () => {}
  export const query = (...a) => a
  export const orderBy = (...a) => a
  export const limit = (...a) => a
  export const where = (...a) => a
  export const serverTimestamp = () => Date.now()
  export const increment = (n) => n
  export const runTransaction = async (db, fn) => globalThis.__runTx(fn)
  export const writeBatch = () => ({ set(){}, update(){}, async commit(){} })
  export const deleteDoc = async () => {}
  export const startAfter = (...a) => a
  export const documentId = () => '__name__'
  export const Timestamp = { now: () => ({ toMillis: () => Date.now() }) }
  export const getFirestore = () => ({})
`)
// firebase/app is only reached through lib/firebase.ts, which runs at import
// time. Stub it so importing the module under test does not try to stand up a
// real Firebase app from environment variables that are not here.
const appStub = path.join(os.tmpdir(), 'ns-app-stub-' + process.pid + '.js')
require('fs').writeFileSync(appStub, `
  export const initializeApp = () => ({})
  export const getApps = () => []
`)

const out = path.join(os.tmpdir(), 'ns-lb-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/leaderboardService.ts', '--bundle', '--platform=node',
  '--format=cjs', '--log-level=error',
  '--alias:firebase/firestore=' + stubPath,
  '--alias:firebase/app=' + appStub,
  '--alias:@=' + path.resolve('.'),
  '--outfile=' + out],
  { stdio: ['ignore', 'ignore', 'inherit'] })

globalThis.__runTx = async (fn) => {
  wroteInThisTx = false
  const pending = []
  const result = await fn(makeTx(pending))   // a throw here commits nothing
  for (const [k, v] of pending) store.set(k, Object.assign({}, store.get(k) || {}, v))
  return result
}

const L = require(out)

const W = '0x' + '77'.repeat(20)
const orig = console.error
console.error = (...a) => errors.push(a.join(' '))

;(async () => {
  // ── the bug, in the shape the owner saw it ────────────────────────────────
  await L.recordRunKills(W, 23)
  console.error = orig

  ok('the transaction does not throw on the read-after-write rule',
    !errors.some((e) => /reads to be executed before all writes/.test(e)),
    errors[0] || 'no errors')

  const career = store.get('leaderboard/' + W)
  ok('career kills are recorded', career && career.totalKills === 23,
    JSON.stringify(career))
  ok('and the raw counter is remembered, so a Revive cannot double-count',
    career && career.lastRecordedKills === 23)

  const seasonPath = [...store.keys()].find((k) => /^seasonLeaderboard\//.test(k))
  const season = seasonPath ? store.get(seasonPath) : null
  ok('season kills are recorded too — the column that read 0 on the live board',
    season && season.kills === 23, JSON.stringify(season))

  // ── the delta logic, which the throw was hiding ───────────────────────────
  // p.kills keeps climbing across a Revive within one session, so the same
  // life reporting 23 then 30 must add 7, not 30.
  await L.recordRunKills(W, 30)
  ok('a second report from the same life adds only the difference',
    store.get('leaderboard/' + W).totalKills === 30,
    String(store.get('leaderboard/' + W).totalKills))
  ok('and the season total tracks it exactly', store.get(seasonPath).kills === 30,
    String(store.get(seasonPath).kills))

  // A fresh run starts p.kills at 0 again; 5 must count in full, not as -25.
  await L.recordRunKills(W, 5)
  ok('a fresh life counts in full rather than going backwards',
    store.get('leaderboard/' + W).totalKills === 35,
    String(store.get('leaderboard/' + W).totalKills))

  // ── the guard, stated as a rule rather than an instance ───────────────────
  // Every transaction in the module, not just the one that broke.
  const src = require('fs').readFileSync('lib/leaderboardService.ts', 'utf8')
  const bodies = src.split('runTransaction(db, async (tx) => {').slice(1)
  let offenders = 0
  for (const b of bodies) {
    const body = b.slice(0, b.indexOf('\n    })'))
    const firstSet = body.indexOf('tx.set')
    const lastGet = body.lastIndexOf('tx.get')
    if (firstSet >= 0 && lastGet > firstSet) offenders++
  }
  ok('no transaction in the module reads after it writes', offenders === 0,
    offenders + ' of ' + bodies.length)

  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch((e) => { console.error = orig; console.error('ERROR', e.message); process.exit(2) })
