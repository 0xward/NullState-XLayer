import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSeasonId } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { seasonIdInputSchema, walletAddressSchema } from '@/lib/validation'
import { normalizeWalletAddress } from '@/lib/vault-utils'
import { BURN_HISTORY_DAYS } from '@/lib/server/seasonClose'

// Reads request.url query params, so it's always dynamic — declare it so the
// build doesn't try to prerender it statically and log DYNAMIC_SERVER_USAGE.
export const dynamic = 'force-dynamic'

// Fails fast with a normal, catchable error instead of letting a hung
// Firebase call (e.g. FIREBASE_DATABASE_URL pointing at the wrong region)
// run until Vercel's own function-timeout kicks in. A platform timeout
// returns its own HTML/plaintext error page instead of this route's JSON,
// which is why the Rewards screen was showing a raw parse error rather
// than a real message — see components/game/RewardsScreen.tsx.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms — check FIREBASE_DATABASE_URL/FIREBASE_SERVICE_ACCOUNT`)), ms)
    ),
  ])
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const walletAddressResult = walletAddressSchema.safeParse(searchParams.get('walletAddress') ?? '')
    if (!walletAddressResult.success) {
      return NextResponse.json(
        { error: walletAddressResult.error.issues[0]?.message ?? 'Invalid wallet address' },
        { status: 400 },
      )
    }

    const seasonIdInput = searchParams.get('seasonId')
    const seasonIdResult =
      seasonIdInput == null
        ? { success: true as const, data: String(getCurrentSeasonId()) }
        : seasonIdInputSchema.safeParse(seasonIdInput)
    if (!seasonIdResult.success) {
      return NextResponse.json(
        { error: seasonIdResult.error.issues[0]?.message ?? 'Invalid seasonId' },
        { status: 400 },
      )
    }

    const seasonId = Number(seasonIdResult.data)
    const normalizedWallet = normalizeWalletAddress(walletAddressResult.data)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Firebase Admin is not configured on the server' }, { status: 503 })
    }

    const [profileSnap, rewardSnap, burnSnap, rollupSnap] = await withTimeout(
      Promise.all([
        db.ref(`playerProfiles/${normalizedWallet}`).get(),
        db.ref(`rewards/${normalizedWallet}`).get(),
        db.ref(`burnRecords/${seasonId}/${normalizedWallet}`).get(),
        // What the prune already folded away. Without this the season totals
        // below shrink every time the cron runs — see BURN_HISTORY_DAYS.
        db.ref(`burnRollup/${seasonId}/${normalizedWallet}`).get(),
      ]),
      8000,
      'Firebase read'
    )

    const profile = profileSnap.val() ?? {
      walletAddress: normalizedWallet,
      nickname: 'Unknown Player',
      inventory: { health: 100, mana: 50, items: {} },
      stats: { totalBurns: 0, totalRewards: 0, vaultAttempts: 0 },
      joinedAt: null,
      currentSeasonId: seasonId,
      nullstateTokenBalance: 0,
    }

    const burns = burnSnap.exists() ? Object.values(burnSnap.val() ?? {}) : []
    const weeklyRewards = rewardSnap.val()?.weeklyRewards ?? {}
    const seasonBonus = rewardSnap.val()?.seasonBonus ?? {}

    // ── SEASON TOTALS: every burn, including the ones already pruned ────────
    //
    // These two numbers are the season's record and they must not move when a
    // row is deleted. `burnRollup` is what the prune folded old rows into
    // (lib/server/seasonClose.ts); the live rows are added on top. Before the
    // rollup existed, both were derived by summing the array below — which is
    // exactly why the array could never be trimmed without the totals silently
    // shrinking underneath the player.
    const rollup = (rollupSnap.val() ?? {}) as { events?: number; value?: number }
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
    const liveValue = (burns as any[]).reduce((sum, b) => sum + num(b?.totalValue), 0)
    const totalBurnedValue = num(rollup.value) + liveValue
    const totalBurnEvents = num(rollup.events) + burns.length

    // ── THE LIST: the last seven days, and nothing else ─────────────────────
    //
    // Owner: "history burn yang menumpuk, lebih baik tunjukan burn 7 hari
    // terakhir." The cutoff is applied HERE rather than in the client so a
    // season's worth of receipts never crosses the wire to be thrown away on
    // arrival. Rows older than the window still exist until the next prune
    // runs; they are counted, not shown.
    const cutoff = Date.now() - BURN_HISTORY_DAYS * 86400000
    const at = (b: any) => num(b?.recordedAt) || num(b?.timestamp)
    const recent = (burns as any[])
      .filter((b) => at(b) >= cutoff)
      .sort((a, b) => at(b) - at(a))

    return NextResponse.json({
      profile,
      summary: {
        totalBurnEvents,
        weeklyRewardEntries: Object.keys(weeklyRewards).length,
        seasonBonusEntries: Object.keys(seasonBonus).length,
        totalBurnedValue: Math.round(totalBurnedValue),
        nullstateTokenBalance:
          typeof profile?.nullstateTokenBalance === 'number' ? profile.nullstateTokenBalance : 0,
      },
      // Recent burn history — powers the "mining history" list on the Rewards
      // screen (components/game/RewardsScreen.tsx). Each entry mirrors the
      // shape written by POST /api/burn/record.
      burns: recent,
      // So the screen can say what it is showing and what it is not, instead of
      // leaving the player to wonder where last month's burns went.
      burnHistoryDays: BURN_HISTORY_DAYS,
      burnsHidden: Math.max(0, totalBurnEvents - recent.length),
    })
  } catch (error) {
    console.error('[player/profile] Error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
