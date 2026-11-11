import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminFirestore } from '@/firebase-config'
import { prepareSeason, previousSeasonId, payoutCommands, prune } from '@/lib/server/seasonClose'
import { getCurrentSeasonId } from '@/lib/web3-client'
import { sweepPendingVaultPayouts } from '@/lib/server/vaultSweep'
import { recentWeekIdStrings } from '@/lib/vault-utils'

export const dynamic = 'force-dynamic'

// =============================================
// SEASON CLOSE — the cron half of GAME-DESIGN.md §9
//
// GET /api/cron/season   (Vercel Cron, 01:00 UTC every day)
//
// Freezes the ranking for the season that just ended, so the owner can pay it
// without deciding anything. Writes ONE record — seasonSnapshots/{seasonId} —
// and moves no money.
//
// WHY DAILY WHEN A SEASON ENDS MONTHLY. Because a monthly schedule fires ONCE
// and has no retry: a deploy in progress, a Firebase blip or a cold-start
// timeout on the 1st would leave the season unfrozen for a month — which is
// exactly the "silently does nothing" failure this whole feature exists to
// remove. Running daily makes a missed firing self-heal the next morning. On
// every other day of the month the season is already frozen and this returns
// `created: false` having written nothing, so the cost is one cheap request.
//
// WHY A GET. Vercel Cron issues GET requests and nothing else, and authenticates
// them by sending `Authorization: Bearer $CRON_SECRET`. So the verb is not a
// design choice; what makes it safe is that the work is idempotent by
// construction: prepareSeason() aborts its write if a snapshot already exists,
// so a re-run — a retry, a daily no-op, a manual curl — can never re-rank
// winners the owner has already read.
//
// It fails CLOSED when CRON_SECRET is unset: an unauthenticated caller must not
// be able to freeze a ranking early. Running it by hand is
//
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/season
//
// which is also the recovery path if a scheduled run is ever missed — the
// snapshot is taken from live XP, so a late run still produces the right answer
// as long as it is the first one.
// =============================================

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
    }
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getAdminDb()
    const fs = getAdminFirestore()
    if (!db || !fs) {
      return NextResponse.json({ error: 'Season service unavailable' }, { status: 503 })
    }

    // The season that just ended, not the one being played.
    const seasonId = previousSeasonId(getCurrentSeasonId())
    const { snapshot, created } = await prepareSeason(db, fs, seasonId)

    if (created) {
      // The one line an operator reads in the log. Named winners, because a
      // payout that goes to the wrong wallet is the failure that matters and
      // this is the last cheap chance to notice it.
      console.log('[cron/season] froze season ' + seasonId + ': '
        + snapshot.winners.map((w) => `#${w.rank} ${w.wallet} (${w.xp} xp, $${w.rewardUsd})`).join(' · '))
    }

    // Housekeeping rides on the same daily wake-up rather than a second cron:
    // it is the only scheduled thing this app has, the work is idempotent, and
    // a prune that fails must never stop a season being frozen — so it is
    // caught and reported rather than thrown.
    let pruned: string[] = []
    try {
      pruned = (await prune(db)).removed
      if (pruned.length) console.log('[cron/season] pruned ' + pruned.length + ' finished buckets')
    } catch (err) {
      console.error('[cron/season] prune failed (season still frozen):', err)
    }

    // ── Unpaid vault rewards ────────────────────────────────────────────────
    // Rides the same daily wake-up, for the same reasons as the prune above,
    // and for one more: it is the ONLY route to a stuck reward that does not
    // ask the player to re-clear Bunker 5 and kill the final boss to reach the
    // vault door again. The owner had to read the contract on celoscan to
    // recover his; a player cannot. See lib/server/vaultSweep.ts.
    //
    // Caught, never thrown: a payout that cannot be retried must not stop a
    // season being frozen.
    let vault = { checked: 0, paid: 0, stillPending: 0 }
    try {
      const swept = await sweepPendingVaultPayouts(db, { weekIds: recentWeekIdStrings() })
      vault = { checked: swept.checked, paid: swept.paid, stillPending: swept.stillPending }
      if (swept.checked) {
        console.log(
          `[cron/season] vault sweep: ${swept.paid}/${swept.checked} paid`
          + (swept.stillPending
            ? ' · still pending: ' + swept.outcomes
                .filter((o) => o.status === 'pending')
                .map((o) => `${o.wallet}@${o.weekId} (${o.reason})`)
                .join(' · ')
            : ''),
        )
      }
    } catch (err) {
      console.error('[cron/season] vault sweep failed (season still frozen):', err)
    }

    return NextResponse.json({
      seasonId,
      created,
      snapshot,
      pruned: pruned.length,
      vault,
      commands: payoutCommands(snapshot),
      note: created
        ? 'Season frozen. Run the commands above, then POST /api/season/status to mark it paid.'
        : 'Already frozen — nothing changed.',
    }, { status: 200 })
  } catch (error) {
    console.error('[cron/season] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
