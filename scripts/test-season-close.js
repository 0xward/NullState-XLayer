#!/usr/bin/env node
/**
 * test-season-close.js — freezing a season, against stubbed Firebase.
 *
 * GAME-DESIGN.md §9. The season bonus was entirely manual: the owner had to
 * remember to run deposit-reward.js twice, every month, from memory. Miss it
 * and the claim button is dead for every player with no error anywhere.
 *
 * Owner decision: prepare automatically, the owner still signs. So what this
 * covers is everything up to the signature — and the properties that make an
 * automated preparation safe rather than merely convenient:
 *
 *   - the snapshot is FROZEN once and never re-ranked, because XP keeps moving
 *     after a season ends (it is cumulative and does not reset);
 *   - a cron that fires twice, or a manual re-run, changes nothing;
 *   - marking a season paid is one-way;
 *   - the commands handed to the owner MATCH the CLI's real flags. A pasted
 *     command that errors at 1am is worse than no command, so the flags are
 *     checked against deposit-reward.js's own argument validation rather than
 *     against my memory of it.
 *
 *   node scripts/test-season-close.js
 */
const { execFileSync } = require('child_process')
const fs = require('fs'), path = require('path'), os = require('os')

const out = path.join(os.tmpdir(), 'ns-season-' + process.pid + '.cjs')
execFileSync('npx', ['esbuild', 'lib/server/seasonClose.ts', '--bundle', '--platform=node',
  '--format=cjs', '--log-level=error', '--alias:@=' + path.resolve('.'), '--outfile=' + out],
  { stdio: ['ignore', 'ignore', 'inherit'] })
const S = require(out)

const results = []
const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail })

// ── stubs: the RTDB tree and the Firestore query the module actually uses ───
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
        async update(patch) { write(p, Object.assign({}, read(p) || {}, patch)) },
        async remove() {
          const parts = p.split('/')
          const parent = parts.slice(0, -1).reduce((o, k) => (o == null ? undefined : o[k]), tree)
          if (parent) delete parent[parts[parts.length - 1]]
        },
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
// Two collections now, because the payout moved off the career board.
//   `leaderboard`                              -> career XP (the fallback)
//   `seasonLeaderboard/{seasonId}/players`     -> XP earned in that season
// `seasonRowsBySeason` is keyed by season id so a test can hand one season rows
// and another none, which is the case the fallback exists for.
function makeFs(careerRows, seasonRowsBySeason = {}) {
  const queryOver = (rows) => {
    const state = { rows: (rows || []).slice() }
    const api = {
      orderBy(field, dir) {
        state.rows.sort((a, b) => (dir === 'desc' ? b[field] - a[field] : a[field] - b[field]))
        return api
      },
      limit(n) { state.rows = state.rows.slice(0, n); return api },
      async get() { return { docs: state.rows.map((r) => ({ id: r.walletAddress, data: () => r })) } },
    }
    return api
  }
  return {
    collection(name) {
      if (name === 'seasonLeaderboard') {
        return {
          doc(seasonId) {
            return { collection() { return queryOver(seasonRowsBySeason[String(seasonId)]) } }
          },
        }
      }
      return queryOver(careerRows)
    },
  }
}

// Two digits, repeated. The old one-digit version ('0x' + String(n).repeat(40))
// collided the moment the fixture grew past nine players: W(1) and W(11) are
// both forty 1s, so ranks 1 and 11 shared a wallet and every ordering assertion
// below would have been reading the wrong row.
const W = (n) => '0x' + String(n).padStart(2, '0').repeat(20)

;(async () => {
  // ── the season arithmetic ─────────────────────────────────────────────
  ok('previous season inside a year', S.previousSeasonId(202607) === 202606)
  ok('previous season across the year boundary', S.previousSeasonId(202601) === 202512,
    String(S.previousSeasonId(202601)))

  // ── freezing ──────────────────────────────────────────────────────────
  // Twelve, so the fixture is deeper than the ten places that are paid — the
  // eleventh and twelfth exist to prove the cut is real.
  const NAMES = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot',
    'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima']
  const rows = NAMES.map((username, i) => ({
    walletAddress: W(i + 1), username, xp: 9000 - i * 500,
  }))
  const db = makeDb()
  const first = await S.prepareSeason(db, makeFs(rows), 202607)
  ok('the first run freezes the season', first.created === true)
  ok('winners are in XP order',
    first.snapshot.winners.slice(0, 4).map((w) => w.username).join(',') === 'alpha,bravo,charlie,delta',
    first.snapshot.winners.map((w) => w.username).join(','))
  ok('ranks start at 1,2,3', first.snapshot.winners.slice(0, 3).map((w) => w.rank).join(',') === '1,2,3')
  // Owner, 2026-07-31: 20/5/3 then $1 down to rank 10. Asserted LITERALLY, not
  // read back off RANK_REWARDS_USD — a test that derives its expectation from
  // the same constant it is checking passes no matter what that constant
  // becomes, which for a money figure is worse than having no test.
  ok('ten places are paid, not three', first.snapshot.winners.length === 10,
    String(first.snapshot.winners.length))
  ok('rewards are 20/5/3 then $1 to rank 10',
    first.snapshot.winners.map((w) => w.rewardUsd).join(',') === '20,5,3,1,1,1,1,1,1,1',
    first.snapshot.winners.map((w) => w.rewardUsd).join(','))
  ok('ranks run 1..10 with no gaps',
    first.snapshot.winners.map((w) => w.rank).join(',') === '1,2,3,4,5,6,7,8,9,10')
  ok('the month costs $35 in total',
    first.snapshot.winners.reduce((t, w) => t + w.rewardUsd, 0) === 35)
  ok('it is not marked paid', first.snapshot.paidAt === null)

  // ── the property that matters most ────────────────────────────────────
  // XP does not reset between seasons, so re-reading later gives a different
  // answer. The frozen snapshot must win.
  const movedOn = [
    { walletAddress: W(12), username: 'lima', xp: 99000 },   // played on after the season
    ...rows.slice(0, 11),
  ]
  const second = await S.prepareSeason(db, makeFs(movedOn), 202607)
  ok('a second run changes nothing', second.created === false)
  ok('and the winners are still the ones frozen at closing time',
    second.snapshot.winners.slice(0, 4).map((w) => w.username).join(',') === 'alpha,bravo,charlie,delta',
    second.snapshot.winners.map((w) => w.username).join(','))

  // ── status ────────────────────────────────────────────────────────────
  const julyNoon = Date.parse('2026-08-15T12:00:00Z')   // season 202608, so 202607 has closed
  const status = await S.readSeasonStatus(db, julyNoon)
  ok('status names the season being played', status.currentSeasonId === 202608, String(status.currentSeasonId))
  ok('and the one that can be paid', status.lastClosedSeasonId === 202607, String(status.lastClosedSeasonId))
  ok('a frozen, unpaid season reads as awaiting payout', status.awaitingPayout === true)

  // ── marking paid ──────────────────────────────────────────────────────
  const paid = await S.markSeasonPaid(db, 202607, '0xdeadbeef')
  ok('marking paid records the time', typeof paid.paidAt === 'number' && paid.paidAt > 0)
  ok('and the note', paid.paidNote === '0xdeadbeef')
  const paidAgain = await S.markSeasonPaid(db, 202607, 'second attempt')
  ok('marking it twice keeps the FIRST record', paidAgain.paidNote === '0xdeadbeef')
  const after = await S.readSeasonStatus(db, julyNoon)
  ok('and it no longer awaits payout', after.awaitingPayout === false)
  ok('marking a season that never closed reports nothing to mark',
    (await S.markSeasonPaid(db, 209912)) === null)

  // ── the handover: the commands must actually run ──────────────────────
  const all = S.payoutCommands(first.snapshot)
  // Comment lines are guidance for the owner, not things to paste. They are
  // asserted on their own further down; the runnable half is what these check.
  const notes = all.filter((c) => c.startsWith('#'))
  const cmds = all.filter((c) => !c.startsWith('#'))
  // 3 on-chain + one direct transfer per rank 4-10 = 10.
  ok('ten commands: three on-chain, seven direct transfers', cmds.length === 10,
    String(cmds.length))
  // These winners have no players/ record at all, which is what every player
  // ranked before payout addresses existed looks like. Unknown is NOT treated
  // as safe — the commands still run, but the owner is told to check first.
  ok('winners with no record are flagged UNVERIFIED, not silently paid',
    notes.some((n) => /UNVERIFIED/.test(n)), notes[0] || 'none')
  const cli = fs.readFileSync(path.join(__dirname, 'deposit-reward.js'), 'utf8')
  // deposit-reward.js validates args.p1..p3 and args.s1..s3 for
  // update-leaderboard, and args.season/args.amount for season-deposit. If it
  // ever renames those, the pasted command breaks silently — so assert against
  // the script's own source rather than against memory.
  // FIRST COMMAND: the one that makes the chain agree with RANK_REWARDS_USD.
  //
  // It exists because the two had already drifted and nothing could catch it:
  // TREASURY-OPS.md records the rank rewards actually set on-chain as
  // $1/$0.60/$0.40, while this file said $20/$5/$3 — so /stats and the frozen
  // snapshot promised a first-place finisher twenty dollars the contract would
  // never have paid. A mirror of on-chain state that is never compared to the
  // chain is just a second, quieter source of truth.
  const setAmounts = cmds[0]
  ok('the first command sets the on-chain rank rewards', /season-rewards/.test(setAmounts))
  ok('with the SAME figures this module promises (' + setAmounts.match(/--r1.*/)?.[0] + ')',
    /--r1 20 --r2 5 --r3 3/.test(setAmounts))
  ok('and names the token, which that subcommand also requires',
    /--token \w+/.test(setAmounts))
  for (const flag of ['r1', 'r2', 'r3']) {
    ok(`deposit-reward.js still reads --${flag}`, cli.includes('args.' + flag))
  }
  ok('season-rewards is a real subcommand of the script', /case 'season-rewards'/.test(cli))

  const publish = cmds[1]
  const onchainWallets = first.snapshot.winners.slice(0, 3).map((x) => x.wallet)
  ok('publish command names the right subcommand', /update-leaderboard/.test(publish))
  for (const flag of ['p1', 'p2', 'p3', 's1', 's2', 's3']) {
    ok(`deposit-reward.js still reads --${flag}`, cli.includes('args.' + flag))
    ok(`and the generated command passes --${flag}`, publish.includes('--' + flag + ' '))
  }
  ok('publish carries the winners in order',
    publish.indexOf(W(1)) < publish.indexOf(W(2)) && publish.indexOf(W(2)) < publish.indexOf(W(3)))
  ok('publish carries their scores', /--s1 9000/.test(publish) && /--s3 8000/.test(publish))
  // The fund command got the same treatment as the publish one only after an
  // audit found it BROKEN: it omitted --token, and resolveToken() in that
  // script dies with "missing --token" rather than defaulting — so the second
  // line handed to the owner failed the moment it was pasted. Checking one
  // command's flags and not the other is how that survived being "tested".
  const fund = cmds[2]
  ok('fund command names the right subcommand', /season-deposit/.test(fund))
  // The pool must cover exactly what the three commands above promise. If the
  // amounts change and this does not, the third-place finisher is the one who
  // finds out.
  // The pool funds ONLY what the pool can pay. Depositing the full $35 would
  // strand $7 in a contract with no way to release it — updateLeaderboard has
  // three slots and ranks 4-10 are not in them.
  ok('fund command totals the three ON-CHAIN prizes ($28), not all ten ($35)',
    /--amount 28\b/.test(fund), fund.match(/--amount \S+/)?.[0])
  ok('deposit-reward.js REQUIRES --token (it dies without one)',
    /function resolveToken/.test(cli) && /missing --token/.test(cli))
  ok('so the fund command passes --token', /--token \w+/.test(fund), fund.match(/--token \w+/)?.[0])
  ok('and --season', /--season \d{6}/.test(fund))
  // Every flag season-deposit validates must be present. Same source-of-truth
  // check as the publish command: read the script, do not trust memory.
  for (const flag of ['season', 'token', 'amount']) {
    ok(`season-deposit still reads args.${flag}`, cli.includes('args.' + flag))
  }

  // ── RANKS 4-10: the contract cannot pay them, so something must ───────
  //
  // updateLeaderboard takes address[3]. Emitting the podium commands alone
  // would have been the dangerous version — they look complete, they succeed,
  // and seven people are silently paid nothing.
  const direct = cmds.slice(3)
  ok('one direct transfer per unpaid rank', direct.length === 7, String(direct.length))
  ok('each is the pay subcommand', direct.every((c) => /deposit-reward\.js pay /.test(c)))
  ok('`pay` is a real subcommand of the script', /case 'pay'/.test(cli))
  for (const flag of ['to', 'amount', 'token']) {
    ok(`pay still reads args.${flag}`, cli.includes('args.' + flag))
    ok(`and every generated line passes --${flag}`, direct.every((c) => c.includes('--' + flag + ' ')))
  }
  ok('they carry ranks 4 through 10, in order',
    direct.map((c) => (c.match(/# rank (\d+)/) || [])[1]).join(',') === '4,5,6,7,8,9,10',
    direct.map((c) => (c.match(/# rank (\d+)/) || [])[1]).join(','))
  ok('each sends exactly $1', direct.every((c) => /--amount 1\b/.test(c)))
  ok('to the right wallets, in rank order',
    direct.every((c, i) => c.includes(first.snapshot.winners[i + 3].wallet)))
  ok('and no podium wallet is paid twice',
    direct.every((c) => !onchainWallets.some((wal) => c.includes(wal))))
  // What the three on-chain commands promise plus what the seven direct ones
  // send must equal the month's stated cost. This is the assertion that fails
  // if any of the three numbers above drifts on its own.
  const directTotal = direct.reduce((t, c) => t + Number((c.match(/--amount (\S+)/) || [])[1] || 0), 0)
  ok('on-chain pool + direct sends = the $35 the snapshot promises',
    28 + directTotal === 35, '28 + ' + directTotal)

  // ── THE PAYOUT MUST READ THE SEASON BOARD, NOT THE CAREER ONE ─────────
  //
  // Owner: "pertimbangan rank skrg sudah bagus belum? mengingat hanya dari xp?"
  // It was not: XP is cumulative, so the season prize was being paid off an
  // all-time board. July's winner would have opened August 5,926 XP ahead on
  // work that was finished, and a September joiner could never have won.
  {
    // Career order and season order are deliberately OPPOSITE, so a test that
    // silently kept reading `leaderboard` cannot pass.
    const career = [
      { walletAddress: W(1), username: 'veteran', xp: 90000 },   // months of accumulation
      { walletAddress: W(2), username: 'rookie', xp: 300 },
    ]
    const seasonRows = [
      { walletAddress: W(2), username: 'rookie', xp: 4000 },     // actually played THIS month
      { walletAddress: W(1), username: 'veteran', xp: 10 },      // opened the app, did nothing
    ]
    const sdb = makeDb()
    const snap = await S.prepareSeason(sdb, makeFs(career, { 202608: seasonRows }), 202608)
    ok('the winner is who played THIS season, not who has the biggest career',
      snap.snapshot.winners[0].username === 'rookie', snap.snapshot.winners[0].username)
    ok('and the career leader ranks below them on 10 season XP',
      snap.snapshot.winners[1].username === 'veteran' && snap.snapshot.winners[1].xp === 10,
      JSON.stringify(snap.snapshot.winners.map((w) => [w.username, w.xp])))
    ok('the frozen XP is the SEASON figure, not the career one',
      snap.snapshot.winners[0].xp === 4000, String(snap.snapshot.winners[0].xp))
  }
  {
    // A player who opened the app and never played has a season row of 0. They
    // are not a winner — a $1 prize for logging in would be paid to everyone.
    const zdb = makeDb()
    const snap = await S.prepareSeason(zdb, makeFs(
      [{ walletAddress: W(3), username: 'idle', xp: 500 }],
      { 202608: [{ walletAddress: W(3), username: 'idle', xp: 0 }] },
    ), 202608)
    ok('a zero-XP season row is not treated as a season result',
      snap.snapshot.winners.length === 1 && snap.snapshot.winners[0].xp === 500,
      JSON.stringify(snap.snapshot.winners.map((w) => [w.username, w.xp])))
  }
  {
    // Seasons that closed BEFORE this existed have no season rows at all. They
    // must keep producing the answer they produced at the time — an empty top
    // 10 for July would read as "nobody won" rather than "this predates it".
    const fdb = makeDb()
    const snap = await S.prepareSeason(fdb, makeFs(rows, {}), 202605)
    ok('a season with no season rows falls back to the career board',
      snap.snapshot.winners.length === 10 && snap.snapshot.winners[0].username === 'alpha',
      String(snap.snapshot.winners.length))
  }
  {
    // And the fallback must be per-season: August having rows cannot make July
    // read August's.
    const mdb = makeDb()
    const snap = await S.prepareSeason(mdb, makeFs(rows, {
      202608: [{ walletAddress: W(9), username: 'august-only', xp: 999 }],
    }), 202607)
    ok('one season\'s rows never leak into another\'s snapshot',
      !snap.snapshot.winners.some((w) => w.username === 'august-only'),
      snap.snapshot.winners.map((w) => w.username).join(','))
  }

  // ── a thin leaderboard must not produce a half payout ─────────────────
  const thin = makeDb()
  const small = await S.prepareSeason(thin, makeFs(rows.slice(0, 2)), 202605)
  ok('two players yield two winners, not three padded ones', small.snapshot.winners.length === 2)
  ok('and no commands are offered for an incomplete top 3', S.payoutCommands(small.snapshot).length === 0)
  ok('two players are still paid their own ranks',
    small.snapshot.winners.map((w) => w.rewardUsd).join(',') === '20,5')

  // ── malformed rows are dropped, not paid ──────────────────────────────
  const dirty = makeDb()
  const withJunk = await S.prepareSeason(dirty, makeFs([
    { walletAddress: 'not-a-wallet', username: 'junk', xp: 99999 },
    ...rows,
  ]), 202604)
  ok('a malformed wallet never becomes a winner',
    withJunk.snapshot.winners.every((w) => /^0x[a-f0-9]{40}$/.test(w.wallet)),
    JSON.stringify(withJunk.snapshot.winners.map((w) => w.wallet)))
  // The overshoot in readTopByXp exists for exactly this: a junk row at the top
  // must not cost rank 10 their dollar.
  ok('and all ten places are still filled', withJunk.snapshot.winners.length === 10,
    String(withJunk.snapshot.winners.length))

  // ── THE PRIZE THAT WOULD HAVE BEEN DESTROYED ──────────────────────────
  //
  // A signed-in player is ranked under SHA-256 of their account id. That
  // address can receive USDT and can never release it: no private key for it
  // exists anywhere in the world. Paying it does not delay the prize, it
  // destroys it — and nothing distinguished that address from a real wallet,
  // because /api/player/seen recorded isGuest, which is FALSE for an account.
  //
  // players/{id}.kind is what tells them apart, and .payout is the way out for
  // a Privy player who has an embedded wallet they actually control.
  {
    const W = (n) => '0x' + String(n).padStart(2, '0').repeat(20)
    const tenRows = Array.from({ length: 10 }, (_, i) => ({
      walletAddress: W(i + 1), username: 'P' + (i + 1), xp: 1000 - i * 10,
    }))
    const db = makeDb({
      players: {
        // rank 1: a real wallet. Pays itself.
        [W(1)]: { kind: 'wallet' },
        // rank 2: signed in, WITH an embedded wallet. Pays the wallet, never
        // the key they are ranked under.
        [W(2)]: { kind: 'account', payout: '0x' + 'ab'.repeat(20) },
        // rank 3: signed in with nowhere to be paid. This is the one that
        // used to burn money.
        [W(3)]: { kind: 'account' },
        // rank 4: a guest. Same problem, smaller prize.
        [W(4)]: { kind: 'guest' },
        // rank 5: has an embedded wallet too, out in the direct-transfer tail.
        [W(5)]: { kind: 'account', payout: '0x' + 'cd'.repeat(20) },
      },
    })
    const { snapshot } = await S.prepareSeason(db, makeFs(tenRows), 202610)
    const by = (r) => snapshot.winners.find((w) => w.rank === r)

    ok('a real wallet resolves to itself', by(1).payable === 'wallet' && by(1).payout === W(1))
    ok('an account with an embedded wallet resolves to the WALLET, not the key',
      by(2).payable === 'embedded' && by(2).payout === '0x' + 'ab'.repeat(20))
    ok('an account with no wallet resolves to nowhere', by(3).payable === 'none' && by(3).payout === null)
    ok('so does a guest', by(4).payable === 'none')
    ok('and a player with no record at all is UNKNOWN, not assumed payable',
      by(6).payable === 'unknown')
    // Frozen INTO the snapshot: the list reviewed on Monday must be the list
    // paid on Tuesday, even if somebody signs in over the weekend.
    ok('the answer is stored with the ranking, not recomputed later',
      typeof by(1).payout === 'string' && typeof by(3).payable === 'string')

    const out = S.payoutCommands(snapshot)
    const notes = out.filter((c) => c.startsWith('#'))
    const runs = out.filter((c) => !c.startsWith('#'))

    // THE HEADLINE: no transfer may be generated to an address that cannot
    // release it.
    ok('no command pays the account key of rank 3',
      !runs.some((c) => c.includes(W(3))), runs.filter((c) => c.includes(W(3))).join(' | '))
    ok('nor the guest at rank 4', !runs.some((c) => c.includes(W(4))))
    ok('and both are named so the owner can go and ask them',
      notes.some((n) => /NO ADDRESS/.test(n)) &&
      notes.some((n) => /rank 3/.test(n)) && notes.some((n) => /rank 4/.test(n)))

    // The contract pays by CLAIM. A winner who cannot sign can never claim, so
    // funding the pool for them locks the deposit away — worse than a failed
    // transfer, because the treasury has already paid.
    ok('the on-chain half is withheld when a podium winner cannot claim',
      !runs.some((c) => /season-deposit/.test(c)) && !runs.some((c) => /update-leaderboard/.test(c)))
    ok('and it says why, in words the owner can act on',
      notes.some((n) => /WITHHELD/.test(n)) && notes.some((n) => /claim/i.test(n)))

    // The tail still pays everyone who CAN be paid — a blocked winner must not
    // take the others down with them.
    ok('rank 5 is still paid, at their embedded wallet',
      runs.some((c) => c.includes('0x' + 'cd'.repeat(20)) && /--amount 1/.test(c)))
    ok('and the line says it went to the embedded wallet, not the ranked key',
      runs.some((c) => c.includes('0x' + 'cd'.repeat(20)) && /embedded wallet/.test(c)))
    ok('ranks 6-10 are unaffected',
      [6, 7, 8, 9, 10].every((r) => runs.some((c) => c.includes(W(r)))))
  }

  // ── pruning finished buckets ──────────────────────────────────────────
  // Added after the audit noted nothing ever deleted the daily/weekly rows.
  // The dangerous mistake here is not leaving data behind, it is deleting the
  // wrong data — /api/stats counts LIFETIME totals out of paperClaims,
  // goldenKeyClaims and vaultCompleted, and pruning those would make the public
  // page show players leaving when really rows were removed.
  const NOW = Date.parse('2026-07-31T12:00:00Z')
  ok('a bucket from today is never stale', S.isStaleDayKey('2026-07-31', NOW) === false)
  ok('nor one from yesterday', S.isStaleDayKey('2026-07-30', NOW) === false)
  ok('nor one just inside the keep window', S.isStaleDayKey('2026-07-02', NOW) === false)
  ok('but one well past it is', S.isStaleDayKey('2026-05-01', NOW) === true)
  ok('a key of an unrecognised shape is NEVER stale', S.isStaleDayKey('garbage', NOW) === false)
  ok('and neither is an empty one', S.isStaleDayKey('', NOW) === false)
  ok('this week is never stale', S.isStaleWeekKey('202631', '202631') === false)
  ok('nor eight weeks back', S.isStaleWeekKey('202623', '202631') === false)
  ok('but twenty weeks back is', S.isStaleWeekKey('202611', '202631') === true)
  ok('a malformed week key is never stale', S.isStaleWeekKey('20263', '202631') === false)

  {
    const db = makeDb({
      dailyContracts: { '2026-05-01': { [W]: { k: 1 } }, '2026-07-31': { [W]: { k: 2 } } },
      dailyContractClaims: { '2026-05-01': { [W]: true } },
      passPerkClaims: { '2026-05-01': { [W]: true } },
      vaultFragments: { '202611': { [W]: 9 }, '202631': { [W]: 4 } },
      // Everything below is read by /api/stats for lifetime totals.
      paperClaims: { '202611': { [W]: { claimedAt: 1 } } },
      goldenKeyClaims: { '202611': { [W]: { claimedAt: 1 } } },
      vaultCompleted: { '202611': { [W]: { at: 1 } } },
      playerProfiles: { [W]: { nullstateTokenBalance: 500 } },
    })
    const { removed } = await S.prune(db, NOW, '202631')
    ok('finished daily buckets are removed', !db.tree.dailyContracts['2026-05-01'])
    ok('today\'s bucket is untouched', !!db.tree.dailyContracts['2026-07-31'])
    ok('finished weekly fragments are removed', !db.tree.vaultFragments['202611'])
    ok('this week\'s fragments are untouched', db.tree.vaultFragments['202631'][W] === 4)
    ok('claim gates and perk claims are pruned too',
      !db.tree.dailyContractClaims['2026-05-01'] && !db.tree.passPerkClaims['2026-05-01'])
    // The assertions that matter most.
    ok('paperClaims are NEVER pruned — /api/stats counts them forever',
      !!db.tree.paperClaims['202611'])
    ok('nor goldenKeyClaims', !!db.tree.goldenKeyClaims['202611'])
    ok('nor vaultCompleted', !!db.tree.vaultCompleted['202611'])
    ok('nor anything that is not a dated bucket at all', !!db.tree.playerProfiles[W])
    ok('and it reports what it removed', removed.length === 4, removed.join(', '))
  }
  {
    const db = makeDb({})
    const { removed } = await S.prune(db, NOW, '202631')
    ok('pruning an empty database is harmless', removed.length === 0)
  }

  // ── BURN HISTORY: seven days shown, the rest folded into a rollup ────────
  // OWNER: "history burn yang menumpuk, lebih baik tunjukan burn 7 hari
  // terakhir, lalu hilangkan sisanya." The trap is the pair of season totals
  // the Rewards screen shows above the list, both of which used to be summed
  // out of the very rows being deleted — the exact failure the paperClaims note
  // above exists to prevent, one path over.
  {
    const DAY = 86400000
    ok('the burn window is seven days', S.BURN_HISTORY_DAYS === 7)
    ok('a burn from today is not stale', S.isStaleBurn({ recordedAt: NOW }, NOW) === false)
    ok('nor one from six days ago', S.isStaleBurn({ recordedAt: NOW - 6 * DAY }, NOW) === false)
    ok('but one from thirty days ago is', S.isStaleBurn({ recordedAt: NOW - 30 * DAY }, NOW) === true)
    ok('a row with no usable date is KEPT, never guessed at',
      S.isStaleBurn({}, NOW) === false && S.isStaleBurn(null, NOW) === false)
    ok('and a client `timestamp` is accepted when the server stamp is missing',
      S.isStaleBurn({ timestamp: NOW - 30 * DAY }, NOW) === true)

    const db = makeDb({
      burnRecords: {
        202607: {
          [W]: {
            old1: { recordedAt: NOW - 40 * DAY, totalValue: 120, itemCount: 4 },
            old2: { recordedAt: NOW - 9 * DAY, totalValue: 30, itemCount: 1 },
            fresh: { recordedAt: NOW - 2 * DAY, totalValue: 55, itemCount: 2 },
            undated: { totalValue: 7, itemCount: 1 },
          },
        },
      },
    })
    await S.prune(db, NOW, '202631')
    const left = db.tree.burnRecords['202607'][W]
    ok('burns inside the window survive', !!left.fresh)
    ok('burns outside it are gone', !left.old1 && !left.old2)
    ok('an undated row is never deleted', !!left.undated)

    const roll = db.tree.burnRollup['202607'][W]
    ok('the deleted rows are folded into a rollup, not simply lost',
      roll && roll.events === 2, JSON.stringify(roll))
    ok('carrying their exact value, so the season total cannot shrink',
      roll.value === 150, 'value=' + roll.value)
    ok('and their item count', roll.items === 5, 'items=' + roll.items)

    // Running twice must not double-count. This is the whole reason
    // prunedThrough is stored.
    await S.prune(db, NOW, '202631')
    ok('a second prune adds nothing — the rollup is not double-counted',
      db.tree.burnRollup['202607'][W].value === 150)

    // A new old row appearing later still folds correctly.
    db.tree.burnRecords['202607'][W].late = { recordedAt: NOW - 8 * DAY, totalValue: 10, itemCount: 1 }
    await S.prune(db, NOW, '202631')
    ok('a row that ages out later is folded on the next run',
      db.tree.burnRollup['202607'][W].value === 160 && db.tree.burnRollup['202607'][W].events === 3,
      JSON.stringify(db.tree.burnRollup['202607'][W]))

    // Every season and wallet, not just the current one.
    const multi = makeDb({
      burnRecords: {
        202606: { [W]: { a: { recordedAt: NOW - 60 * DAY, totalValue: 5, itemCount: 1 } } },
        202607: { '0x9999999999999999999999999999999999999999': { b: { recordedAt: NOW - 60 * DAY, totalValue: 9, itemCount: 3 } } },
      },
    })
    await S.prune(multi, NOW, '202631')
    ok('past seasons are pruned too', multi.tree.burnRollup['202606'][W].value === 5)
    ok('and every wallet, not only the caller',
      multi.tree.burnRollup['202607']['0x9999999999999999999999999999999999999999'].value === 9)
  }

  let failed = 0
  for (const t of results) {
    if (t.ok) console.log('  ✓ ' + t.name)
    else { failed++; console.log('  ✗ ' + t.name + (t.detail ? ' — ' + t.detail : '')) }
  }
  console.log(`  ${results.length - failed}/${results.length} lolos`)
  try { fs.unlinkSync(out) } catch {}
  process.exit(failed ? 1 : 0)
})().catch((e) => { try { fs.unlinkSync(out) } catch {}; console.error('ERROR', e); process.exit(2) })
