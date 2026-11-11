#!/usr/bin/env node
/**
 * test-season-routes.js — the season endpoints, against a running server.
 *
 * GAME-DESIGN.md §9. `npm run test:season` covers the logic; this covers the
 * things only a real request can show, and every one of them is a way the
 * feature could hurt someone rather than merely not work:
 *
 *   - the cron route FAILS CLOSED without CRON_SECRET, and rejects a wrong or
 *     missing bearer token. An unauthenticated caller must never be able to
 *     freeze a ranking early — that is the one action here that cannot be undone.
 *   - marking a season paid FAILS CLOSED without ADMIN_SECRET and rejects a
 *     wrong header, because it writes a record players can read.
 *   - the status GET is public and degrades rather than erroring.
 *   - /api/leaderboard is GONE. It served a ranking that disagreed with the one
 *     players see, through a component rendered nowhere.
 *
 * The sandbox has no Firebase admin credentials, so the routes correctly report
 * "service unavailable" past the auth gate. That is the point: the AUTH gate is
 * what is being tested, and it must hold before anything else is reached.
 *
 *   npm run build && npx next start -p 3181 &
 *   node scripts/test-season-routes.js
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3181'
let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d ? ' (' + d + ')' : '')); if (!c) fails++ }

const get = async (path, headers) => {
  const r = await fetch(BASE + path, { headers })
  let body = null
  try { body = await r.json() } catch { /* non-JSON */ }
  return { status: r.status, body }
}
const post = async (path, body, headers) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: JSON.stringify(body),
  })
  let j = null
  try { j = await r.json() } catch { /* non-JSON */ }
  return { status: r.status, body: j }
}

;(async () => {
  // ── the deleted leaderboard ───────────────────────────────────────────
  const dead = await get('/api/leaderboard?seasonId=202607')
  ok('the second, disagreeing leaderboard route is gone', dead.status === 404, 'HTTP ' + dead.status)

  // ── cron auth ─────────────────────────────────────────────────────────
  const noAuth = await get('/api/cron/season')
  ok('the cron route refuses an unauthenticated caller',
    noAuth.status === 401 || noAuth.status === 503, 'HTTP ' + noAuth.status)
  ok('and says which, without leaking anything else',
    /CRON_SECRET|Unauthorized/.test(noAuth.body?.error || ''), noAuth.body?.error)

  const wrongAuth = await get('/api/cron/season', { authorization: 'Bearer definitely-not-the-secret' })
  ok('a wrong bearer token is refused too',
    wrongAuth.status === 401 || wrongAuth.status === 503, 'HTTP ' + wrongAuth.status)
  ok('it never freezes a ranking for an unauthorised caller',
    !wrongAuth.body?.snapshot && !wrongAuth.body?.created)

  // ── mark-paid auth ────────────────────────────────────────────────────
  const markNoAuth = await post('/api/season/status', { seasonId: 202607 })
  ok('marking paid refuses an unauthenticated caller',
    markNoAuth.status === 401 || markNoAuth.status === 503, 'HTTP ' + markNoAuth.status)
  const markWrong = await post('/api/season/status', { seasonId: 202607 }, { 'x-admin-secret': 'nope' })
  ok('and a wrong admin secret', markWrong.status === 401 || markWrong.status === 503, 'HTTP ' + markWrong.status)
  ok('nothing was marked', !markWrong.body?.success)

  // ── status is public and safe ─────────────────────────────────────────
  const status = await get('/api/season/status')
  ok('status answers without a secret', status.status === 200 || status.status === 503, 'HTTP ' + status.status)
  if (status.status === 200) {
    ok('and names both seasons',
      Number.isInteger(status.body?.currentSeasonId) && Number.isInteger(status.body?.lastClosedSeasonId),
      JSON.stringify({ cur: status.body?.currentSeasonId, closed: status.body?.lastClosedSeasonId }))
    ok('the closed season is the month before the current one',
      status.body.lastClosedSeasonId < status.body.currentSeasonId)
  } else {
    ok('and degrades with a clear reason rather than a stack trace',
      /unavailable/i.test(status.body?.error || ''), status.body?.error)
  }

  // ── the POSITIVE auth path ────────────────────────────────────────────
  // Rejecting everything is easy; a gate that also rejects the RIGHT caller is
  // a broken cron nobody notices until a season is missed. Run the server with
  // CRON_SECRET/ADMIN_SECRET set and pass the same values here. Without
  // Firebase the route then answers 503 — which is the proof that auth passed,
  // because an unauthorised caller never gets that far.
  if (process.env.CRON_SECRET) {
    const good = await get('/api/cron/season', { authorization: `Bearer ${process.env.CRON_SECRET}` })
    ok('the RIGHT bearer token gets past the gate', good.status !== 401, 'HTTP ' + good.status)
    ok('and is not turned away as unconfigured',
      !/CRON_SECRET is not configured/.test(good.body?.error || ''), good.body?.error)
  } else {
    console.log('  – positive cron auth skipped (set CRON_SECRET on server and test to cover it)')
  }
  if (process.env.ADMIN_SECRET) {
    const good = await post('/api/season/status', { seasonId: 202607 }, { 'x-admin-secret': process.env.ADMIN_SECRET })
    ok('the RIGHT admin secret gets past the gate', good.status !== 401, 'HTTP ' + good.status)
  } else {
    console.log('  – positive admin auth skipped (set ADMIN_SECRET on server and test to cover it)')
  }

  // ── no route anywhere pays out ────────────────────────────────────────
  // The owner's decision was "prepare automatically, I still sign". If a route
  // that moves money ever appears, this is where it should be noticed.
  const fs = require('fs'), path = require('path')
  const routes = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'route.ts') routes.push(p)
    }
  }
  walk(path.join(__dirname, '..', 'app', 'api'))
  const signing = routes.filter((p) => {
    const src = fs.readFileSync(p, 'utf8')
    return /privateKeyToAccount|PRIVATE_KEY|walletClient|writeContract/.test(src)
  })
  ok('no season route signs a transaction',
    signing.filter((p) => /season|cron/.test(p)).length === 0, signing.join(', ') || 'none')

  console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error('ERROR', e.message); process.exit(2) })
