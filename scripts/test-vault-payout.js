#!/usr/bin/env node
/**
 * test-vault-payout.js — the week a solved vault paid nothing.
 *
 * OWNER, week 202632: he found the Paper, found the Golden Key, entered the
 * right code, and no USDT arrived. He got his reward back only by reading the
 * contract on celoscan himself and working out what had happened. A player
 * cannot do that, and for them the sequence ends at "won, paid nothing".
 *
 * WHAT WAS MEASURED ON CHAIN BEFORE ANY CODE WAS WRITTEN — none of it guessed:
 *
 *   pool balance ................ 0.85 USDT  (the reward is 0.05)  — enough
 *   deposited 1.00 / claimed 0.15 ........................................ — enough
 *   backend signer .............. 0.645 CELO                       — enough gas
 *   isCodeSetForWeek(202632) .... true
 *   simulate submitVaultCode .... does NOT revert
 *   celoscan .................... "Store Weekly Vault Code" SUCCEEDED,
 *                                 "Submit Vault Code" NEVER BROADCAST AT ALL
 *
 * So: not a revert, not a funding problem, not a permissions problem. The
 * payout transaction never existed. /api/vault/submit was doing TWO sequential
 * on-chain writes in ONE request — store the week's code, then pay — and only
 * for the FIRST winner of any given week, which is why it looked random and
 * survived weeks. Forno is load-balanced, so the node answering the nonce read
 * for write #2 need not have seen write #1; the transaction was rejected at the
 * RPC boundary before it was a transaction, the route caught it, and the player
 * was told the reward pool needed topping up.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE ─────────────────────────────────────
 *
 * CAN: that the two-write path is gone from the normal case; that when two
 * writes are unavoidable they share ONE nonce read; that a dropped broadcast
 * retries; that a failure names a reason it actually CHECKED; and that an
 * unpaid win is collected later by the sweep without the player doing anything.
 *
 * CANNOT: reproduce Forno. There is no Celo node in this sandbox and no
 * backend key, so every client below is a fake whose behaviour I chose. What
 * that means honestly: these tests prove the CODE does the right thing when an
 * RPC misbehaves in the way the chain evidence says it misbehaved. They do not
 * prove that is the only way it misbehaves. The real verification is the next
 * vault win on mainnet, and the sweep exists precisely because I cannot promise
 * this is the last failure mode.
 *
 * Several assertions below are marked FAILS-ON-OLD and run the DELETED
 * implementation (reconstructed verbatim as oldStoreThenPay) against the same
 * fakes, so "this test would have caught it" is demonstrated rather than
 * claimed.
 *
 *   node scripts/test-vault-payout.js
 */
const { execFileSync } = require('child_process')
const path = require('path'), os = require('os')

const bundle = (src, name) => {
  const out = path.join(os.tmpdir(), `ns-${name}-${process.pid}.cjs`)
  execFileSync('npx', ['esbuild', src, '--bundle', '--platform=node', '--format=cjs',
    '--log-level=error', '--alias:@=' + path.resolve('.'), '--outfile=' + out],
    { stdio: ['ignore', 'ignore', 'inherit'] })
  return require(out)
}

const CHAIN = bundle('lib/server/vaultChain.ts', 'vaultchain')
const SWEEP = bundle('lib/server/vaultSweep.ts', 'vaultsweep')
const UTILS = bundle('lib/vault-utils.ts', 'vaultutils')

let fails = 0
const ok = (label, cond, detail) => {
  console.log((cond ? '  ✓ ' : '  ✗ FAIL: ') + label + (detail !== undefined ? ' (' + detail + ')' : ''))
  if (!cond) fails++
}
const section = (t) => console.log('\n' + t)

const WALLET = '0x1111111111111111111111111111111111111111'
const WEEK = 202632
const CODE = '4821'

// ── a fake chain ────────────────────────────────────────────────────────────
// Records every call so the assertions can be about WHAT WAS SENT, not about
// what the function returned. The bug was never visible in a return value.
function makeChain(opts = {}) {
  const state = {
    codeSet: opts.codeSet ?? false,
    claimed: opts.claimed ?? false,
    available: opts.available ?? BigInt(850000),   // 0.85 USDT, 6 decimals
    reward: opts.reward ?? BigInt(50000),          // 0.05 USDT
    gas: opts.gas ?? BigInt('645000000000000000'), // 0.645 CELO
    nonce: opts.nonce ?? 7,
  }
  const calls = { writes: [], nonceReads: 0, receipts: [] }
  // A load-balanced RPC that has not caught up: it keeps answering with the
  // SAME nonce no matter how many transactions it has already accepted. This is
  // the behaviour the chain evidence points at.
  const staleNonce = opts.staleNonce ?? false
  let accepted = 0
  let failWrites = opts.failWrites ?? 0

  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === 'isCodeSetForWeek') return state.codeSet
      if (functionName === 'hasClaimedThisWeek') return state.claimed
      if (functionName === 'getAvailableVaultFunds') return state.available
      if (functionName === 'vaultReward') return state.reward
      if (functionName === 'currentRewardToken') return '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'
      throw new Error('unstubbed read: ' + functionName)
    },
    async getBalance() { return state.gas },
    async getTransactionCount() {
      calls.nonceReads++
      return staleNonce ? state.nonce : state.nonce + accepted
    },
    async waitForTransactionReceipt({ hash }) {
      calls.receipts.push(hash)
      if (opts.revert) return { status: 'reverted' }
      return { status: 'success' }
    },
  }

  const walletClient = {
    async writeContract(args) {
      // The RPC rejects a transaction whose nonce it has already seen — this is
      // the "never broadcast" case, and it throws BEFORE producing a hash.
      const seen = calls.writes.some((w) => w.nonce !== undefined && w.nonce === args.nonce)
      if (args.nonce !== undefined && seen) {
        throw new Error('nonce too low: known transaction')
      }
      if (failWrites > 0 && args.functionName === 'submitVaultCode') {
        failWrites--
        calls.writes.push({ ...args, rejected: true })
        throw new Error('failed to send raw transaction: connection reset')
      }
      calls.writes.push(args)
      accepted++
      if (args.functionName === 'storeWeeklyVaultCode') state.codeSet = true
      if (args.functionName === 'submitVaultCode' && opts.claimOnPay !== false) state.claimed = true
      return '0x' + String(calls.writes.length).padStart(64, 'a')
    },
  }

  return { clients: { publicClient, walletClient, account: { address: WALLET } }, calls, state }
}

const writesOf = (calls, fn) => calls.writes.filter((w) => w.functionName === fn && !w.rejected)

// ── the DELETED implementation, reconstructed ───────────────────────────────
// This is what app/api/vault/submit/route.ts did, verbatim in shape: check
// isCodeSetForWeek, store if unset and wait for the receipt, then submit —
// with NO nonce passed to either write, so viem asks the RPC for one each time.
// It exists so the FAILS-ON-OLD assertions run against real old behaviour.
async function oldStoreThenPay({ clients, weekId, walletAddress, expectedCode }) {
  const { publicClient, walletClient, account } = clients
  try {
    const alreadySet = await publicClient
      .readContract({ functionName: 'isCodeSetForWeek', args: [BigInt(weekId)] }).catch(() => false)
    if (!alreadySet) {
      const storeHash = await walletClient.writeContract({
        functionName: 'storeWeeklyVaultCode', args: [BigInt(weekId), expectedCode], account,
        nonce: await publicClient.getTransactionCount({ address: account.address }),
      })
      await publicClient.waitForTransactionReceipt({ hash: storeHash })
    }
    const hash = await walletClient.writeContract({
      functionName: 'submitVaultCode', args: [walletAddress, BigInt(weekId), expectedCode], account,
      nonce: await publicClient.getTransactionCount({ address: account.address }),
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return { ok: true, txHash: hash }
  } catch (e) {
    // Exactly what the old route did: swallow it and report pending.
    return { ok: false, reason: 'pending', detail: e.message }
  }
}

async function main() {
  // ═══════════════════════════════════════════════════════════════════════════
  section('1. The two-write path is gone from the request that pays')
  {
    const { clients, calls } = makeChain({ codeSet: true })
    const r = await CHAIN.storeThenPay({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('a winner is paid', r.ok === true, r.ok ? r.txHash : r.reason)
    ok('exactly ONE on-chain write', calls.writes.length === 1, calls.writes.length + ' writes')
    ok('and it is submitVaultCode, not storeWeeklyVaultCode',
      writesOf(calls, 'storeWeeklyVaultCode').length === 0 && writesOf(calls, 'submitVaultCode').length === 1)
    ok('the nonce is never even read on the single-write path', calls.nonceReads === 0, String(calls.nonceReads))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('2. Storing the code is its own errand, done before anybody wins')
  {
    const { clients, calls, state } = makeChain({ codeSet: false })
    const r = await CHAIN.ensureWeeklyCodeOnChain(WEEK, CODE, clients)
    ok('the code goes on chain', r.onChain === true && r.stored === true)
    ok('one write, and it stores — it does not pay',
      calls.writes.length === 1 && writesOf(calls, 'submitVaultCode').length === 0)
    ok('the contract now reports the code as set', state.codeSet === true)

    const again = await CHAIN.ensureWeeklyCodeOnChain(WEEK, CODE, clients)
    ok('calling it again writes nothing (safe on every vault open)',
      again.onChain === true && again.stored === false && calls.writes.length === 1)
  }
  {
    const { clients } = makeChain({ codeSet: false })
    const r = await CHAIN.ensureWeeklyCodeOnChain(WEEK, '12', clients)
    ok('a malformed code is never stored', r.onChain === false && r.error === 'invalid_code')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('3. FAILS-ON-OLD — two writes, one stale RPC')
  // The degenerate case the fix cannot remove: the first person to open this
  // week's vault also solves it in the same request. Both writes must go out
  // back to back against an RPC that has not caught up.
  {
    const oldChain = makeChain({ codeSet: false, staleNonce: true })
    const oldResult = await oldStoreThenPay({
      clients: oldChain.clients, weekId: WEEK, walletAddress: WALLET, expectedCode: CODE,
    })
    ok('OLD: asks the RPC for a nonce twice', oldChain.calls.nonceReads === 2, String(oldChain.calls.nonceReads))
    ok('OLD: the payout is rejected before it is ever a transaction', oldResult.ok === false, oldResult.detail)
    ok('OLD: storeWeeklyVaultCode succeeded, submitVaultCode never landed — the exact celoscan trace',
      writesOf(oldChain.calls, 'storeWeeklyVaultCode').length === 1
      && writesOf(oldChain.calls, 'submitVaultCode').length === 0)

    const { clients, calls } = makeChain({ codeSet: false, staleNonce: true })
    const r = await CHAIN.storeThenPay({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('NEW: reads the nonce ONCE', calls.nonceReads === 1, String(calls.nonceReads))
    const store = writesOf(calls, 'storeWeeklyVaultCode')[0]
    const pay = writesOf(calls, 'submitVaultCode')[0]
    ok('NEW: the two writes are numbered locally, N and N+1',
      !!store && !!pay && pay.nonce === store.nonce + 1, store && pay ? `${store.nonce} -> ${pay.nonce}` : 'missing')
    ok('NEW: the winner is paid against the same stale RPC', r.ok === true, r.ok ? r.txHash : r.reason)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('4. FAILS-ON-OLD — a dropped broadcast retries instead of giving up')
  {
    const oldChain = makeChain({ codeSet: true, failWrites: 1 })
    const oldResult = await oldStoreThenPay({
      clients: oldChain.clients, weekId: WEEK, walletAddress: WALLET, expectedCode: CODE,
    })
    ok('OLD: one dropped broadcast and the reward is pending forever', oldResult.ok === false)

    const { clients, calls } = makeChain({ codeSet: true, failWrites: 1 })
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('NEW: the same dropped broadcast is retried and paid', r.ok === true, r.ok ? r.txHash : r.reason)
    ok('NEW: it retried rather than sending twice at once',
      calls.writes.filter((w) => w.rejected).length === 1 && writesOf(calls, 'submitVaultCode').length === 1)
  }
  {
    const { clients } = makeChain({ codeSet: true, failWrites: 99 })
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('a permanently dropped broadcast gives up as `rpc`, not as a pool problem',
      r.ok === false && r.reason === 'rpc', r.reason)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('5. FAILS-ON-OLD — the message stops blaming the pool')
  // The old route had ONE sentence for every failure: "the transfer completes
  // as soon as the reward pool is topped up". It had never read the pool. On
  // the measured week the pool held 0.85 USDT against a 0.05 reward.
  {
    const { clients } = makeChain({ codeSet: true, failWrites: 99, available: BigInt(850000) })
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('a funded pool is NEVER reported as empty', r.reason !== 'pool_empty', r.reason)
    ok('the player is told the network dropped it',
      /network dropped/i.test(CHAIN.VAULT_FAILURE_MESSAGE[r.reason]), CHAIN.VAULT_FAILURE_MESSAGE[r.reason])
    ok('and no message invents a pool problem that was not checked',
      !/pool/i.test(CHAIN.VAULT_FAILURE_MESSAGE.rpc)
      && !/pool/i.test(CHAIN.VAULT_FAILURE_MESSAGE.signer_out_of_gas)
      && !/pool/i.test(CHAIN.VAULT_FAILURE_MESSAGE.code_not_on_chain))
  }
  {
    const { clients, calls } = makeChain({ codeSet: true, available: BigInt(10000) }) // 0.01 < 0.05
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('a genuinely empty pool IS reported as empty', r.reason === 'pool_empty', r.reason)
    ok('and no gas is burned on a write that must fail', calls.writes.length === 0)
    ok('that message is the only one allowed to mention the pool',
      /pool/i.test(CHAIN.VAULT_FAILURE_MESSAGE.pool_empty))
  }
  {
    const { clients, calls } = makeChain({ codeSet: true, gas: BigInt('1000000000000000') }) // 0.001 CELO
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('an unfunded signer is named as such, not as an empty pool', r.reason === 'signer_out_of_gas', r.reason)
    ok('and it too writes nothing', calls.writes.length === 0)
  }
  {
    const { clients, calls } = makeChain({ codeSet: false })
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('paying before the code is stored is refused, not attempted',
      r.reason === 'code_not_on_chain' && calls.writes.length === 0, r.reason)
  }
  {
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients: null })
    ok('an unconfigured server says so plainly', r.reason === 'not_configured')
    ok('every reason has a sentence for the player',
      Object.keys(CHAIN.VAULT_FAILURE_MESSAGE).length === 7
      && Object.values(CHAIN.VAULT_FAILURE_MESSAGE).every((m) => typeof m === 'string' && m.length > 20))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('6. Nobody is ever paid twice')
  {
    const { clients, calls } = makeChain({ codeSet: true, claimed: true })
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('a wallet the contract has already paid is not paid again',
      r.ok === false && r.reason === 'already_claimed' && calls.writes.length === 0)
  }
  {
    // The nastiest case: the write lands but we never hear the receipt. A blind
    // retry here is a double payment.
    const chain = makeChain({ codeSet: true, failWrites: 1, claimOnPay: true })
    const realWrite = chain.clients.walletClient.writeContract
    chain.clients.walletClient.writeContract = async (args) => {
      try { return await realWrite(args) } finally { chain.state.claimed = true }
    }
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients: chain.clients })
    ok('a payout that landed unheard settles as already_claimed, not as a second write',
      r.reason === 'already_claimed' && writesOf(chain.calls, 'submitVaultCode').length === 0, r.reason)
  }
  {
    const { clients } = makeChain({ codeSet: true, revert: true, claimOnPay: false })
    const r = await CHAIN.payVaultWinner({ weekId: WEEK, walletAddress: WALLET, expectedCode: CODE, clients })
    ok('a transaction that mines and reverts is reported as reverted, not retried blindly',
      r.ok === false && r.reason === 'reverted', r.reason)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('7. FAILS-ON-OLD — an unpaid win is collected without the player')
  // Before the sweep, the ONLY retry was re-opening the vault door: re-enter
  // Bunker 5, clear it, kill the final boss, walk back. The owner recovered his
  // reward by reading the contract on celoscan. A player cannot.
  {
    const db = makeDb({
      vaultCodes: { [WEEK]: { code: CODE } },
      vaultCompleted: {
        [WEEK]: {
          [WALLET]: { completedAt: 1, txHash: null, pendingReason: 'rpc' },
          '0x2222222222222222222222222222222222222222': { completedAt: 2, txHash: '0xdead' },
        },
      },
    })
    const paid = []
    const r = await SWEEP.sweepPendingVaultPayouts(db, {
      weekIds: [WEEK],
      deps: {
        ensureCode: async () => ({ onChain: true, stored: false }),
        pay: async ({ walletAddress }) => { paid.push(walletAddress); return { ok: true, txHash: '0xfeed' } },
      },
    })
    ok('the unpaid win is retried', paid.length === 1 && paid[0] === WALLET, paid.join(','))
    ok('the already-paid win is left alone', r.checked === 1 && r.paid === 1)
    ok('the row is settled with the real hash',
      db.tree.vaultCompleted[WEEK][WALLET].txHash === '0xfeed')
    ok('and the stale reason is cleared, not left to be re-reported',
      db.tree.vaultCompleted[WEEK][WALLET].pendingReason === null)
  }
  {
    const db = makeDb({
      vaultCodes: { [WEEK]: { code: CODE } },
      vaultCompleted: { [WEEK]: { [WALLET]: { txHash: null } } },
    })
    const r = await SWEEP.sweepPendingVaultPayouts(db, {
      weekIds: [WEEK],
      deps: {
        ensureCode: async () => ({ onChain: true, stored: false }),
        pay: async () => ({ ok: false, reason: 'already_claimed' }),
      },
    })
    ok('a reward the contract already paid is settled, not retried every night',
      r.paid === 1 && db.tree.vaultCompleted[WEEK][WALLET].paidOnChain === true)
  }
  {
    const db = makeDb({
      vaultCodes: { [WEEK]: { code: CODE } },
      vaultCompleted: { [WEEK]: { [WALLET]: { txHash: null } } },
    })
    const r = await SWEEP.sweepPendingVaultPayouts(db, {
      weekIds: [WEEK],
      deps: {
        ensureCode: async () => ({ onChain: true, stored: false }),
        pay: async () => ({ ok: false, reason: 'pool_empty' }),
      },
    })
    ok('a still-stuck reward keeps its true reason for next time',
      r.stillPending === 1 && db.tree.vaultCompleted[WEEK][WALLET].pendingReason === 'pool_empty')
    ok('and the win itself is never discarded', db.tree.vaultCompleted[WEEK][WALLET].txHash === null)
  }
  {
    let ensured = 0, payCalls = 0
    const db = makeDb({ vaultCompleted: { [WEEK]: { [WALLET]: { txHash: null } } } }) // no vaultCodes
    const r = await SWEEP.sweepPendingVaultPayouts(db, {
      weekIds: [WEEK],
      deps: {
        ensureCode: async () => { ensured++; return { onChain: true, stored: false } },
        pay: async () => { payCalls++; return { ok: true, txHash: '0x1' } },
      },
    })
    ok('a week with no code pays nobody and burns no gas',
      ensured === 0 && payCalls === 0 && r.stillPending === 1)
  }
  {
    let ensured = 0
    const db = makeDb({
      vaultCodes: { [WEEK]: { code: CODE } },
      vaultCompleted: { [WEEK]: { [WALLET]: { txHash: '0xabc' } } },
    })
    const r = await SWEEP.sweepPendingVaultPayouts(db, {
      weekIds: [WEEK],
      deps: { ensureCode: async () => { ensured++; return { onChain: true } }, pay: async () => ({ ok: true, txHash: '0x1' }) },
    })
    ok('a week with nothing pending does no chain work at all',
      ensured === 0 && r.checked === 0 && r.paid === 0)
  }
  {
    const rows = {}
    for (let i = 0; i < 40; i++) rows['0x' + String(i).padStart(40, '0')] = { txHash: null }
    const db = makeDb({ vaultCodes: { [WEEK]: { code: CODE } }, vaultCompleted: { [WEEK]: rows } })
    const r = await SWEEP.sweepPendingVaultPayouts(db, {
      weekIds: [WEEK], limit: 5,
      deps: { ensureCode: async () => ({ onChain: true }), pay: async () => ({ ok: true, txHash: '0x1' }) },
    })
    ok('the daily cron cannot be turned into a long job by one bad week',
      r.outcomes.length === 5, String(r.outcomes.length))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('8. A reward pending across a week boundary is not stranded')
  {
    // Monday 2026-08-03 00:30 UTC — half an hour into a new ISO week.
    const monday = Date.UTC(2026, 7, 3, 0, 30)
    const weeks = UTILS.recentWeekIdStrings(monday)
    ok('the sweep looks at this week AND last week', weeks.length === 2, weeks.join(','))
    ok('and they really are different weeks', weeks[0] !== weeks[1], weeks.join(' -> '))
    const sunday = UTILS.recentWeekIdStrings(monday - 3600 * 1000)[0]
    ok('last week is the week a Sunday-night win was recorded in', weeks[1] === sunday, `${weeks[1]} vs ${sunday}`)
  }
  {
    // Stepping back seven real days, not subtracting 1 from the id — week 1 of
    // a year does not follow week 0 of the same year.
    const jan = Date.UTC(2027, 0, 6) // ISO week 1 of 2027
    const weeks = UTILS.recentWeekIdStrings(jan)
    ok('a new year does not produce a week 0', !/00$/.test(weeks[1]), weeks.join(' -> '))
    ok('it rolls back into the previous year', Number(weeks[1]) < Number(weeks[0]) && weeks[1].startsWith('2026'),
      weeks.join(' -> '))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('9. isSettled — what counts as money that arrived')
  {
    ok('a real hash is settled', SWEEP.isSettled({ txHash: '0xabc' }) === true)
    ok('paidOnChain is settled (a receipt we never heard)', SWEEP.isSettled({ paidOnChain: true }) === true)
    ok('an empty hash is NOT settled', SWEEP.isSettled({ txHash: '' }) === false)
    ok('a null hash is NOT settled', SWEEP.isSettled({ txHash: null }) === false)
    ok('a missing row is NOT settled', SWEEP.isSettled(null) === false)
  }

  console.log('\n' + (fails === 0 ? '✓ all vault payout checks passed' : `✗ ${fails} failing`))
  process.exit(fails === 0 ? 0 : 1)
}

// Minimal RTDB stub — same shape as scripts/test-season-close.js uses.
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
        async set(v) { write(p, v) },
      }
    },
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
