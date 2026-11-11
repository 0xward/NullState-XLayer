import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { burnRecordBodySchema } from '@/lib/validation'
import { normalizeWalletAddress } from '@/lib/vault-utils'
import { getCurrentSeasonId } from '@/lib/web3-client'
import { reportMetric } from '@/lib/server/dailyContracts'

// =============================================
// BURN RECORD — NullState Point (Phase 5.5 #8)
// POST /api/burn/record
//
// Burning is fully OFF-CHAIN now. Items no longer feed an on-chain USDm
// weekly pool (the old recordBurn() call to NullStateReward.sol has been
// removed) — instead, the burn's total value is credited straight to the
// player's NullState Point balance in Firebase RTDB
// (playerProfiles/{wallet}/nullstateTokenBalance). There is no claim step:
// the balance is usable immediately for Marketplace "Swap" purchases
// (see app/api/marketplace/swap/route.ts). NullState Point is a
// faucet-only in-game asset — it cannot be withdrawn or cashed out.
//
// Body (sent by game.js's confirmBurn() -> nullstate-items-burned event,
// forwarded verbatim by DungeonGameWrapper.tsx):
//   {
//     wallet: string,
//     items: Array<{ id: string|number, name: string, rarity?: string, qty: number, burnValue: number }>,
//     totalValue: number,
//     timestamp: number,
//   }
//
// Response:
//   { success: true, burnId: string, totalValue: number, newBalance: number }
// =============================================

const MAX_ITEMS_PER_BURN = 20
const MIN_ITEM_VALUE = 1
const MAX_ITEM_VALUE = 500

interface RawBurnItem {
  id?: string | number
  name?: string
  rarity?: string
  qty?: number
  burnValue?: number
  icon?: string
  color?: string
}

function clampItemValue(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return Math.round(Math.min(MAX_ITEM_VALUE, Math.max(MIN_ITEM_VALUE, n)))
}

export async function POST(req: NextRequest) {
  try {
    const parsedBody = burnRecordBodySchema.safeParse(await req.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const { wallet, items, timestamp: rawTimestamp } = parsedBody.data
    const rawItems = items as RawBurnItem[]
    const timestamp =
      typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp)
        ? rawTimestamp
        : Date.now()

    // Reject oversized batches outright — a legit burn only ever queues a
    // handful of stash items at once; anything bigger is almost certainly
    // spam/exploit hitting this endpoint directly.
    if (rawItems.length > MAX_ITEMS_PER_BURN) {
      return NextResponse.json(
        { error: `Too many items in one burn (max ${MAX_ITEMS_PER_BURN})` },
        { status: 400 }
      )
    }

    // Never trust burnValue/totalValue from the client verbatim — clamp
    // every item to the sane 1–500 NullState Point range and recompute the
    // total server-side from the clamped values. game.js normally sends
    // correct numbers already, but this endpoint can be hit directly
    // without going through the game at all.
    const validatedItems = rawItems.map(it => {
      const qty = typeof it.qty === 'number' && it.qty > 0 ? Math.floor(it.qty) : 1
      const unitValue = clampItemValue(it.burnValue)
      // icon/color are display-only decoration for the Rewards screen's burn
      // history (components/game/RewardsScreen.tsx) — only accept values
      // that already match how game.js generates them (a same-origin sprite
      // path, a short CSS color token), never an arbitrary attacker-supplied
      // URL/string, even though React itself already escapes both safely.
      const icon =
        typeof it.icon === 'string' && /^\/sprites\/items\/[\w./-]+\.png$/.test(it.icon)
          ? it.icon
          : undefined
      const color =
        typeof it.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(it.color) ? it.color : undefined
      return {
        id: it.id !== undefined ? String(it.id) : 'unknown',
        name: typeof it.name === 'string' && it.name ? it.name : 'Unknown Item',
        rarity: typeof it.rarity === 'string' ? it.rarity : undefined,
        qty,
        burnValue: unitValue,
        icon,
        color,
      }
    })

    const totalValue = validatedItems.reduce((sum, it) => sum + it.burnValue * it.qty, 0)
    const itemCount = validatedItems.reduce((sum, it) => sum + it.qty, 0)

    const normalizedWallet = normalizeWalletAddress(wallet)
    const seasonId = getCurrentSeasonId()

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    // ── Credit NullState Point instantly (off-chain, atomic) ────────────
    const balanceRef = db.ref(`playerProfiles/${normalizedWallet}/nullstateTokenBalance`)
    const txResult = await balanceRef.transaction((current: number | null) => (current ?? 0) + totalValue)
    const newBalance = (txResult.snapshot?.val() as number) ?? totalValue

    const now = Date.now()
    const burnRef = db.ref(`burnRecords/${seasonId}/${normalizedWallet}`).push()
    const burnId: string = burnRef.key ?? `burn_${now}`

    const burnRecord = {
      burnId,
      wallet: normalizedWallet,
      items: validatedItems,
      itemCount,
      totalValue,
      timestamp,
      recordedAt: now,
    }

    const updates: Record<string, unknown> = {
      [`burnRecords/${seasonId}/${normalizedWallet}/${burnId}`]: burnRecord,
    }
    await db.ref().update(updates)

    // Bump lightweight player profile stats (mirrors app/api/player/profile
    // route's expectations of playerProfiles/{wallet}.stats.totalBurns).
    const statsRef = db.ref(`playerProfiles/${normalizedWallet}/stats`)
    const statsSnap = await statsRef.get()
    const prevStats = statsSnap.val() ?? { totalBurns: 0, totalRewards: 0, vaultAttempts: 0 }
    await statsRef.update({
      totalBurns: (prevStats.totalBurns ?? 0) + 1,
      totalRewards: (prevStats.totalRewards ?? 0) + totalValue,
    })

    // Daily Contract credit (GAME-DESIGN.md §5.2) lives HERE rather than in the
    // engine, because there are two ways to burn and only one of them is the
    // engine: the in-run inventory dispatches nullstate-items-burned, and the
    // out-of-game Rewards screen posts here directly. Crediting on the client
    // covered the first and silently missed the second — the owner burned from
    // Rewards and watched the contract not move.
    //
    // Both paths already funnel through this route, so this is the one place
    // that sees every burn. It is also strictly better than the client report
    // it replaces: the quantity is the one this route already validated and
    // clamped, so it cannot be inflated from outside.
    //
    // Best-effort — a contract that fails to tick must never fail a burn the
    // player has already been paid for.
    // Reported back so the caller can SAY a contract finished. Crediting in
    // silence is only half the fix: the owner's complaint was that burning from
    // Rewards did nothing visible, and a reward the player is not told about is
    // one they do not know they earned.
    let contracts: { granted: string[]; labels: string[] } | undefined
    try {
      const state = await reportMetric(db, normalizedWallet, 'burns', itemCount)
      if (state.granted.length) {
        contracts = {
          granted: state.granted,
          labels: state.granted
            .map((id) => state.contracts.find((c) => c.id === id)?.label)
            .filter((l): l is string => !!l),
        }
      }
    } catch (err) {
      console.error('[burn/record] daily-contract credit failed (burn kept):', err)
    }

    return NextResponse.json(
      { success: true, burnId, totalValue, newBalance, contracts },
      { status: 201 }
    )
  } catch (error) {
    console.error('[burn/record] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
