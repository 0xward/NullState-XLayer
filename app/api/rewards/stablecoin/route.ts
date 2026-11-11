import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits } from 'viem'
import { celo } from 'viem/chains'
import { celoTransport } from '@/lib/celoRpc'
import { getAdminDb } from '@/firebase-config'
import { walletAddressSchema } from '@/lib/validation'
import { normalizeWalletAddress } from '@/lib/vault-utils'
import { TREASURE_VAULT_ADDRESS } from '@/lib/contract-abi'
import { MARKETPLACE_TOKENS } from '@/lib/constants/tokens'

// Reads ?walletAddress, so it's always dynamic — declare it so the build
// doesn't try to prerender it statically and log DYNAMIC_SERVER_USAGE.
export const dynamic = 'force-dynamic'

// Minimal read ABI matching the DEPLOYED TreasureVault (public `vaultReward`
// getter, lowercase — the shared TREASURE_VAULT_ABI still carries the old
// `VAULT_REWARD` constant name, which the live contract no longer exposes).
const VAULT_READ_ABI = [
  { name: 'vaultReward', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'currentRewardToken', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

// address(lowercase) -> { symbol, decimals } for turning a reward-token address
// into a human amount. Built once at module load from the shared token table.
const TOKEN_BY_ADDRESS: Record<string, { symbol: string; decimals: number }> = {}
for (const t of Object.values(MARKETPLACE_TOKENS)) {
  TOKEN_BY_ADDRESS[t.address.toLowerCase()] = { symbol: t.symbol, decimals: t.decimals }
}

// Best-effort read of the vault's CURRENT per-win reward (amount + token
// symbol). Used only to fill in the display amount for older vault wins whose
// Firebase record predates amount-stamping (see /api/vault/submit). Wrapped so
// a flaky RPC never fails the history response — returns null and the entry
// just shows without an amount, exactly as before.
async function currentVaultRewardInfo(): Promise<{ amount: number; token: string } | null> {
  try {
    if (!TREASURE_VAULT_ADDRESS || TREASURE_VAULT_ADDRESS === '0x') return null
    const transport = celoTransport()
    const publicClient = createPublicClient({ chain: celo, transport })
    const [reward, tokenAddr] = await Promise.all([
      publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: VAULT_READ_ABI, functionName: 'vaultReward' }) as Promise<bigint>,
      publicClient.readContract({ address: TREASURE_VAULT_ADDRESS, abi: VAULT_READ_ABI, functionName: 'currentRewardToken' }) as Promise<`0x${string}`>,
    ])
    const info = TOKEN_BY_ADDRESS[String(tokenAddr).toLowerCase()] ?? { symbol: 'USD', decimals: 18 }
    return { amount: Number(formatUnits(reward, info.decimals)), token: info.symbol }
  } catch {
    return null
  }
}

// =============================================
// STABLECOIN REWARD HISTORY (Rewards screen — left tab)
// GET /api/rewards/stablecoin?walletAddress=0x...
//
// The "reward points" (NullState Point) side already has a history via
// /api/player/profile (burnRecords). This is its stablecoin counterpart:
// the real on-chain payouts a wallet has RECEIVED, aggregated from the
// Firebase records the game already writes. Firebase-only on purpose (no
// RPC) so the Rewards screen stays fast and can't fail on a flaky node.
//
// Two stablecoin sources produce history entries:
//   1. Treasure Vault wins  — vaultCompleted/{weekId}/{wallet}
//      (written by /api/vault/submit on a correct code; the reward is paid
//      on-chain in the same request). We surface { weekId, txHash, at }.
//   2. Season leaderboard bonus / weekly reward — rewards/{wallet}/... if a
//      backend/cron has logged them there (same node /api/player/profile
//      already reads). Surfaced defensively — absent nodes just yield an
//      empty list, never an error.
//
// The CLAIMABLE side (a top-3 season bonus you can still claim right now) is
// read live on the client via hooks/useReward.ts against NullStateRewardV2,
// not here — this route is the "already received" ledger only.
//
// Response: { history: StablecoinEntry[], totalEntries: number }
//   StablecoinEntry =
//     { kind: 'vault',  weekId, txHash: string|null, at: number }
//   | { kind: 'season', seasonId, amount?: number, token?: string, txHash?: string|null, at: number }
//   | { kind: 'weekly', weekId,  amount?: number, token?: string, txHash?: string|null, at: number }
// =============================================

interface StablecoinEntry {
  kind: 'vault' | 'season' | 'weekly'
  weekId?: number
  seasonId?: number
  amount?: number
  token?: string
  txHash?: string | null
  at: number
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export async function GET(req: NextRequest) {
  try {
    const walletResult = walletAddressSchema.safeParse(req.nextUrl.searchParams.get('walletAddress') ?? '')
    if (!walletResult.success) {
      return NextResponse.json(
        { error: walletResult.error.issues[0]?.message ?? 'Invalid wallet address' },
        { status: 400 },
      )
    }
    const wallet = normalizeWalletAddress(walletResult.data)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin is not configured on the server' }, { status: 503 })
    }

    const [vaultAllSnap, rewardsSnap] = await Promise.all([
      // Keyed vaultCompleted/{weekId}/{wallet}; read the tree once and pick
      // out this wallet's wins. The game has few active weeks, so this stays
      // small — revisit with a per-wallet index if it ever grows.
      db.ref('vaultCompleted').get(),
      db.ref(`rewards/${wallet}`).get(),
    ])

    const history: StablecoinEntry[] = []

    // ---- Treasure Vault wins ----
    // Collect first; some (older) records don't have amount/token stamped, so
    // we do ONE best-effort on-chain read of the current reward afterwards to
    // fill those in for display.
    let vaultEntriesNeedReward = false
    if (vaultAllSnap.exists()) {
      const byWeek = (vaultAllSnap.val() ?? {}) as Record<string, Record<string, any>>
      for (const [weekIdStr, wallets] of Object.entries(byWeek)) {
        const rec = wallets?.[wallet]
        if (!rec) continue
        const amount = num(rec.amount)
        if (amount === undefined) vaultEntriesNeedReward = true
        history.push({
          kind: 'vault',
          weekId: Number(weekIdStr),
          amount,
          token: typeof rec.token === 'string' ? rec.token : undefined,
          txHash: typeof rec.txHash === 'string' ? rec.txHash : null,
          at: num(rec.completedAt) ?? 0,
        })
      }
    }
    if (vaultEntriesNeedReward) {
      const info = await currentVaultRewardInfo()
      if (info) {
        for (const e of history) {
          if (e.kind === 'vault' && e.amount === undefined) {
            e.amount = info.amount
            e.token = e.token ?? info.token
          }
        }
      }
    }

    // ---- Season bonus / weekly reward ledger (if a backend logged it) ----
    const rewardsVal = (rewardsSnap.val() ?? {}) as {
      seasonBonus?: Record<string, any>
      weeklyRewards?: Record<string, any>
    }
    for (const [seasonIdStr, rec] of Object.entries(rewardsVal.seasonBonus ?? {})) {
      history.push({
        kind: 'season',
        seasonId: Number(seasonIdStr),
        amount: num((rec as any)?.amount),
        token: typeof (rec as any)?.token === 'string' ? (rec as any).token : undefined,
        txHash: typeof (rec as any)?.txHash === 'string' ? (rec as any).txHash : null,
        at: num((rec as any)?.claimedAt) ?? num((rec as any)?.at) ?? 0,
      })
    }
    for (const [weekIdStr, rec] of Object.entries(rewardsVal.weeklyRewards ?? {})) {
      history.push({
        kind: 'weekly',
        weekId: Number(weekIdStr),
        amount: num((rec as any)?.amount),
        token: typeof (rec as any)?.token === 'string' ? (rec as any).token : undefined,
        txHash: typeof (rec as any)?.txHash === 'string' ? (rec as any).txHash : null,
        at: num((rec as any)?.claimedAt) ?? num((rec as any)?.at) ?? 0,
      })
    }

    history.sort((a, b) => b.at - a.at)

    return NextResponse.json({ history, totalEntries: history.length })
  } catch (error) {
    console.error('[rewards/stablecoin] Error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
