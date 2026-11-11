import { createPublicClient, createWalletClient, formatUnits, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { celoTransport } from '@/lib/celoRpc'
import { TREASURE_VAULT_ABI, TREASURE_VAULT_ADDRESS } from '@/lib/contract-abi'
import { MARKETPLACE_TOKENS } from '@/lib/constants/tokens'
import { getServerAttributionSuffix } from '@/lib/attribution-tag'

// ─── Every on-chain thing the Treasure Vault does, in one place ──────────────
//
// THE BUG THIS FILE EXISTS FOR. app/api/vault/submit/route.ts used to do TWO
// sequential on-chain writes inside a single player request: store the week's
// code if it was not stored yet, then pay the winner. Only the FIRST winner of
// any given week took that path — everyone after them found the code already
// stored and did a single write — which is exactly why it survived so long and
// why it looked random.
//
// Measured on Celo, week 202632, with the owner's own wallet:
//
//   pool balance ................ 0.85 USDT   (reward is 0.05)  — enough
//   deposited 1.00 / claimed 0.15 ............................. — enough
//   backend signer .............. 0.645 CELO                    — enough gas
//   isCodeSetForWeek(202632) .... true
//   simulate submitVaultCode .... does NOT revert
//   celoscan .................... "Store Weekly Vault Code" SUCCEEDED,
//                                 "Submit Vault Code" WAS NEVER BROADCAST
//
// Not a revert. Not a funding problem. The second write never reached the
// mempool at all. Forno is load-balanced, so the node that answered the nonce
// read for write #2 was not necessarily the node that had already seen write
// #1 — a stale nonce or stale state gets the transaction rejected at the RPC
// boundary, before it is ever a transaction. The route caught that, logged it,
// and reported "pending".
//
// THREE THINGS CHANGE HERE, and the first one is the one that matters:
//
//   1. STORING THE CODE IS NOT PART OF PAYING ANYMORE. ensureWeeklyCodeOnChain()
//      is called when the vault is first opened by anybody that week (and again
//      by the daily cron as a net), so by the time someone actually wins, the
//      code has been on chain for hours and the payout is ONE write. The
//      two-write path stops existing for real players rather than being made
//      more reliable.
//
//   2. WHEN TWO WRITES STILL HAVE TO BE SEQUENTIAL — the degenerate case where
//      the very first person to open the vault this week also solves it in the
//      same request — the nonce is read ONCE and incremented locally. The RPC is
//      never asked twice, so it can never answer twice differently.
//
//   3. A FAILURE NOW HAS A REASON. Every exit below names what actually went
//      wrong, checked rather than guessed: the pool balance is READ before it
//      is blamed. See VaultPayoutFailure.
//
// WHAT IS DELIBERATELY NOT DONE: no retry loop around storeWeeklyVaultCode.
// Storing is idempotent and cheap to re-attempt on the next open, and a retry
// there would put the two-write path back on the request that (1) exists to
// eliminate. Only the payout retries, because only the payout is the money.

export type VaultPayoutFailure =
  | 'not_configured'    // no BACKEND_PRIVATE_KEY or no vault address
  | 'code_not_on_chain' // this week's code has never been stored — submit would revert
  | 'pool_empty'        // READ from the contract, not assumed
  | 'signer_out_of_gas' // the backend signer cannot pay for the transaction
  | 'already_claimed'   // the contract says this wallet was already paid this week
  | 'reverted'          // broadcast, mined, and rejected by the contract
  | 'rpc'               // never made it into a block — the failure that started all this

// What the player is told, per reason. These are the STRINGS THAT REPLACE the
// single line the popup used to show for every failure alike:
//
//   "The transfer completes as soon as the reward pool is topped up"
//
// The pool was never checked before that sentence was printed. On the week it
// was measured the pool held 0.85 USDT against a 0.05 reward — seventeen
// payouts' worth — and the sentence sent the owner, and then an agent, looking
// at treasury balances for an hour while the real fault was an RPC that had
// dropped a transaction. A diagnosis nobody verified is worse than no
// diagnosis, because it is where everybody looks first.
export const VAULT_FAILURE_MESSAGE: Record<VaultPayoutFailure, string> = {
  not_configured:
    'Your win is recorded. Payouts are not switched on for this server yet — the reward is safe and will be sent once they are.',
  code_not_on_chain:
    "Your win is recorded. This week's vault is still being opened on-chain — the reward sends itself within a few minutes.",
  pool_empty:
    'Your win is recorded. The reward pool needs topping up — the transfer completes by itself as soon as it is funded.',
  signer_out_of_gas:
    'Your win is recorded. The payout account needs a top-up before it can send — this finishes on its own, nothing is lost.',
  already_claimed:
    'This wallet has already been paid for this week.',
  reverted:
    'Your win is recorded, but the payout was rejected on-chain. It is being looked at — the win does not expire.',
  rpc:
    'Your win is recorded. The network dropped the payout transaction — it retries automatically and completes within a day.',
}

// The DEPLOYED contract exposes a lowercase `vaultReward` getter; the shared
// TREASURE_VAULT_ABI still carries the old `VAULT_REWARD` constant name that
// the live contract no longer has. Reading the wrong one throws, which is how
// the amount silently went missing from the win popup.
const VAULT_READ_ABI = [
  { name: 'vaultReward', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'currentRewardToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

// Enough CELO to pay for one write with room to spare. The signer had 0.645
// CELO when this was measured and a vault write costs a small fraction of a
// cent, so this threshold is a smoke alarm, not a budget.
const MIN_SIGNER_CELO_WEI = BigInt(2) * BigInt(10) ** BigInt(16) // 0.02 CELO

const PAYOUT_ATTEMPTS = 3
const PAYOUT_BACKOFF_MS = [700, 1800]

export type VaultClients = {
  publicClient: PublicClient
  walletClient: WalletClient
  account: PrivateKeyAccount
}

/** null when the server has no signer or no vault address — never throws. */
export function getVaultClients(): VaultClients | null {
  const key = process.env.BACKEND_PRIVATE_KEY as `0x${string}` | undefined
  if (!key || !TREASURE_VAULT_ADDRESS || TREASURE_VAULT_ADDRESS === '0x') return null
  try {
    const account = privateKeyToAccount(key)
    const transport = celoTransport()
    return {
      publicClient: createPublicClient({ chain: celo, transport }) as PublicClient,
      walletClient: createWalletClient({ chain: celo, transport, account }),
      account,
    }
  } catch {
    return null
  }
}

export async function isCodeOnChain(publicClient: PublicClient, weekId: number): Promise<boolean> {
  return publicClient
    .readContract({
      address: TREASURE_VAULT_ADDRESS,
      abi: TREASURE_VAULT_ABI,
      functionName: 'isCodeSetForWeek',
      args: [BigInt(weekId)],
    })
    .then((v) => !!v)
    .catch(() => false)
}

export type EnsureCodeResult = {
  onChain: boolean
  /** true only when THIS call was the one that stored it */
  stored: boolean
  txHash?: string
  error?: string
}

/**
 * Put this week's code on chain, on its own, well before anybody wins.
 *
 * This is priority #1 made concrete. It is safe to call on every vault open:
 * the first thing it does is a cheap `isCodeSetForWeek` read, and a week whose
 * code is already stored costs one RPC read and returns.
 *
 * Idempotent under races. Two players opening the vault in the same second can
 * both pass the read and both broadcast; the contract rejects the loser, and a
 * re-read confirms the code is set either way, so a lost race is a success.
 * The alternative — a Firebase lock — would add a failure mode (a lock held by
 * a crashed request) to protect against a duplicate transaction that costs a
 * fraction of a cent.
 */
export async function ensureWeeklyCodeOnChain(
  weekId: number,
  code: string,
  injected?: VaultClients | null,
): Promise<EnsureCodeResult> {
  const clients = injected !== undefined ? injected : getVaultClients()
  if (!clients) return { onChain: false, stored: false, error: 'not_configured' }
  if (!/^\d{4}$/.test(code)) return { onChain: false, stored: false, error: 'invalid_code' }

  const { publicClient, walletClient, account } = clients
  try {
    if (await isCodeOnChain(publicClient, weekId)) return { onChain: true, stored: false }

    const hash = await walletClient.writeContract({
      address: TREASURE_VAULT_ADDRESS,
      abi: TREASURE_VAULT_ABI,
      functionName: 'storeWeeklyVaultCode',
      args: [BigInt(weekId), code],
      account,
      chain: celo,
      dataSuffix: getServerAttributionSuffix(),
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return { onChain: true, stored: true, txHash: hash }
  } catch (err) {
    // Lost a race, or the write failed. Re-read: if the code is there, whoever
    // put it there did our job for us.
    const nowSet = await isCodeOnChain(clients.publicClient, weekId)
    return {
      onChain: nowSet,
      stored: false,
      error: nowSet ? undefined : err instanceof Error ? err.message : String(err),
    }
  }
}

export type VaultPayoutResult =
  | { ok: true; txHash: string; amount?: number; token?: string }
  | { ok: false; reason: VaultPayoutFailure; detail?: string }

/**
 * Pay one winner. ONE on-chain write in the normal case.
 *
 * `expectedCode` is the canonical Firebase code, not the player's raw input:
 * correctness was already authenticated off-chain, so submitting the canonical
 * string guarantees the contract's own string comparison matches. A self-heal
 * re-run must pay even if the player fat-fingers a digit the second time.
 */
export async function payVaultWinner(params: {
  weekId: number
  walletAddress: string
  expectedCode: string
  /** Injected by tests. Production never passes this. */
  clients?: VaultClients | null
}): Promise<VaultPayoutResult> {
  const { weekId, walletAddress, expectedCode } = params
  const clients = params.clients !== undefined ? params.clients : getVaultClients()
  if (!clients) return { ok: false, reason: 'not_configured' }

  const { publicClient, walletClient, account } = clients
  const weekBig = BigInt(weekId)
  const user = walletAddress as `0x${string}`

  // ── Preflight. Every one of these is a READ, and each maps to a reason the
  // player is actually told. This is what makes rule #4 true: nothing below
  // blames the pool without having looked at the pool.
  try {
    const claimed = await publicClient
      .readContract({ address: TREASURE_VAULT_ADDRESS, abi: TREASURE_VAULT_ABI, functionName: 'hasClaimedThisWeek', args: [user, weekBig] })
      .catch(() => false)
    if (claimed) return { ok: false, reason: 'already_claimed' }

    if (!(await isCodeOnChain(publicClient, weekId))) {
      // The caller is expected to have run ensureWeeklyCodeOnChain first. If it
      // still is not there, submitting would revert and burn gas for nothing.
      return { ok: false, reason: 'code_not_on_chain' }
    }

    const [available, reward] = await Promise.all([
      publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: TREASURE_VAULT_ABI, functionName: 'getAvailableVaultFunds' }) as Promise<bigint>,
      publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: VAULT_READ_ABI, functionName: 'vaultReward' }) as Promise<bigint>,
    ])
    if (available < reward) return { ok: false, reason: 'pool_empty' }

    const gas = await publicClient.getBalance({ address: account.address })
    if (gas < MIN_SIGNER_CELO_WEI) return { ok: false, reason: 'signer_out_of_gas' }
  } catch {
    // A preflight that cannot be read is an RPC problem, not a verdict. Fall
    // through and let the write itself decide — never refuse to pay because a
    // balance read timed out.
  }

  // ── The write, retried. A dropped broadcast is the failure this whole file
  // is about, and it is transient by nature: the next attempt usually lands on
  // a node that has caught up. Retrying is safe because the contract enforces
  // one claim per wallet per week — a duplicate that somehow does land reverts
  // rather than paying twice, and `already_claimed` above turns a
  // previously-succeeded attempt into a no-op instead of a second payment.
  let lastDetail: string | undefined
  for (let attempt = 0; attempt < PAYOUT_ATTEMPTS; attempt++) {
    try {
      const hash = await walletClient.writeContract({
        address: TREASURE_VAULT_ADDRESS,
        abi: TREASURE_VAULT_ABI,
        functionName: 'submitVaultCode',
        args: [user, weekBig, expectedCode],
        account,
        chain: celo,
        dataSuffix: getServerAttributionSuffix(),
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 })
      if (receipt.status !== 'success') {
        lastDetail = `reverted in ${hash}`
        return { ok: false, reason: 'reverted', detail: lastDetail }
      }
      const paid = await readPaidAmount(publicClient)
      return { ok: true, txHash: hash, ...paid }
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : String(err)

      // The tx may have landed even though we failed to hear about it. Ask the
      // contract before retrying — paying twice is far worse than reporting a
      // pending reward that is actually paid.
      const nowClaimed = await publicClient
        .readContract({ address: TREASURE_VAULT_ADDRESS, abi: TREASURE_VAULT_ABI, functionName: 'hasClaimedThisWeek', args: [user, weekBig] })
        .catch(() => false)
      if (nowClaimed) return { ok: false, reason: 'already_claimed', detail: lastDetail }

      if (attempt < PAYOUT_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, PAYOUT_BACKOFF_MS[attempt] ?? 1800))
      }
    }
  }
  return { ok: false, reason: 'rpc', detail: lastDetail }
}

/**
 * Store the code AND pay, sharing one nonce sequence.
 *
 * Only reachable when the very first person to open this week's vault also
 * solves it in the same request — priority #1 removes it for everyone else.
 * When it does happen, the nonce is read ONCE and incremented locally, because
 * asking a load-balanced RPC for the nonce a second time is precisely how the
 * second write got rejected before it was ever a transaction.
 */
export async function storeThenPay(params: {
  weekId: number
  walletAddress: string
  expectedCode: string
  /** Injected by tests. Production never passes this. */
  clients?: VaultClients | null
}): Promise<VaultPayoutResult> {
  const { weekId, walletAddress, expectedCode } = params
  const clients = params.clients !== undefined ? params.clients : getVaultClients()
  if (!clients) return { ok: false, reason: 'not_configured' }
  const { publicClient, walletClient, account } = clients

  if (await isCodeOnChain(publicClient, weekId)) {
    return payVaultWinner({ ...params, clients })
  }

  try {
    // ONE read. Both writes below are numbered from it.
    const baseNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })

    const storeHash = await walletClient.writeContract({
      address: TREASURE_VAULT_ADDRESS,
      abi: TREASURE_VAULT_ABI,
      functionName: 'storeWeeklyVaultCode',
      args: [BigInt(weekId), expectedCode],
      account,
      chain: celo,
      nonce: baseNonce,
      dataSuffix: getServerAttributionSuffix(),
    })

    const payHash = await walletClient.writeContract({
      address: TREASURE_VAULT_ADDRESS,
      abi: TREASURE_VAULT_ABI,
      functionName: 'submitVaultCode',
      args: [walletAddress as `0x${string}`, BigInt(weekId), expectedCode],
      account,
      chain: celo,
      nonce: baseNonce + 1,
      dataSuffix: getServerAttributionSuffix(),
    })

    await publicClient.waitForTransactionReceipt({ hash: storeHash, timeout: 60_000 })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: payHash, timeout: 60_000 })
    if (receipt.status !== 'success') return { ok: false, reason: 'reverted', detail: `reverted in ${payHash}` }

    const paid = await readPaidAmount(publicClient)
    return { ok: true, txHash: payHash, ...paid }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    // Whatever went wrong, the code may now be stored — in which case the
    // single-write path is available and is the better thing to fall back to.
    if (await isCodeOnChain(publicClient, weekId)) {
      return payVaultWinner({ ...params, clients })
    }
    return { ok: false, reason: 'rpc', detail }
  }
}

/**
 * What was actually paid, read off the contract. Best-effort by design: the
 * payout has already succeeded by the time this runs, so a failed read must
 * leave the amount unset rather than undo anything. The popup says "sent"
 * rather than inventing a figure — a wrong number there is worse than none.
 */
export async function readPaidAmount(publicClient: PublicClient): Promise<{ amount?: number; token?: string }> {
  try {
    const [reward, tokenAddr] = await Promise.all([
      publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: VAULT_READ_ABI, functionName: 'vaultReward' }) as Promise<bigint>,
      publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: VAULT_READ_ABI, functionName: 'currentRewardToken' }) as Promise<`0x${string}`>,
    ])
    const match = Object.values(MARKETPLACE_TOKENS).find(
      (t) => t.address.toLowerCase() === String(tokenAddr).toLowerCase(),
    )
    const decimals = match?.decimals ?? 18
    return { amount: Number(formatUnits(reward, decimals)), token: match?.symbol ?? 'USD' }
  } catch {
    return {}
  }
}
