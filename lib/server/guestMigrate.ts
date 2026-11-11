// Guest -> wallet migration for TIME-BOXED progress (this week's, today's).
//
// FOUND BY AUDIT. /api/guest/migrate moved Point, materials, gear, tiers,
// blueprints and elixir — and none of the records keyed by week or day. A guest
// who spent the week opening containers arrived at their new wallet with ZERO
// Vault Fragments, losing the entire path to that week's USDT at the exact
// moment they converted. Connecting a wallet is the single thing we most want a
// player to do, and it was the thing that cost them the most.
//
// It lives here rather than inside the route for the same reason every other
// rule-carrying module does: the route should be validation and plumbing, and
// merge arithmetic that decides who keeps a week of progress deserves to be
// readable and testable on its own (npm run test:migrate).

import type { getAdminDb } from '@/firebase-config'
import { SHIELD_EARN_AFTER } from '@/lib/server/loginStreak'

type AdminDb = NonNullable<ReturnType<typeof getAdminDb>>

function num(x: unknown): number {
  return typeof x === 'number' && isFinite(x) ? x : 0
}

/**
 * Move this week's and today's progress across.
 *
 * Merge rules follow what each record MEANS, not one blanket policy:
 *
 *   fragments  ADD — two part-filled bars are one fuller bar. This is the one
 *              that matters: fragments are the guaranteed path to the weekly
 *              USDT (GAME-DESIGN.md §5.1).
 *   claims     FILL — a claim record means "already had this item this week".
 *              Carrying it over is what stops the wallet earning a second Old
 *              Paper in the same week the guest already earned one. Never
 *              overwritten, so a wallet that claimed on its own keeps its
 *              record and its timestamp.
 *   contracts  MAX per contract — the two ids played the same day against the
 *              same three objectives; taking the higher progress is right and
 *              adding would let a player double-count a day by converting.
 *   streak     MAX — days in a row is not a balance, and whichever id has the
 *              longer run is the one the player actually kept.
 *
 * Everything is clamped by the reader anyway (contracts clamp to target,
 * fragments only unlock at thresholds), so no rule here can over-grant.
 */
export async function migrateTimeBoxed(
  db: AdminDb,
  guest: string,
  wallet: string,
  weekId: string,
  dayId: string,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}

  // Fragments — additive.
  const gFrag = (await db.ref(`vaultFragments/${weekId}/${guest}`).get()).val()
  if (typeof gFrag === 'number' && gFrag > 0) {
    const tx = await db.ref(`vaultFragments/${weekId}/${wallet}`).transaction((cur: unknown) =>
      (typeof cur === 'number' && Number.isFinite(cur) ? Math.max(0, Math.floor(cur)) : 0) + Math.floor(gFrag))
    out.fragments = tx.snapshot?.val() ?? gFrag
  }

  // Weekly item claims — fill only, so the week's one-per-wallet cap survives.
  for (const p of ['paperClaims', 'goldenKeyClaims']) {
    const g = (await db.ref(`${p}/${weekId}/${guest}`).get()).val()
    if (!g) continue
    const committed = await db.ref(`${p}/${weekId}/${wallet}`).transaction((cur: unknown) => {
      if (cur !== null) return undefined      // the wallet already has one
      return g
    })
    if (committed.committed) out[p] = true
  }

  // Today's contracts — per-objective max.
  const gDay = (await db.ref(`dailyContracts/${dayId}/${guest}`).get()).val()
  if (gDay && typeof gDay === 'object') {
    await db.ref(`dailyContracts/${dayId}/${wallet}`).transaction((cur: unknown) => {
      const w = (cur && typeof cur === 'object' ? cur : {}) as Record<string, unknown>
      const merged: Record<string, number> = {}
      for (const k of new Set([...Object.keys(w), ...Object.keys(gDay as object)])) {
        merged[k] = Math.max(num(w[k]), num((gDay as Record<string, unknown>)[k]))
      }
      return merged
    })
    out.contracts = true
  }

  // Login streak — the longer run wins.
  //
  // The shield is merged separately and generously in BOTH directions: it is an
  // earned protection, and connecting a wallet is not a reason to take one away
  // from either side. Whichever record held one, the merged record holds one,
  // and the earn-back threshold is the sooner of the two.
  type StreakRow = { streak?: number; best?: number; lastDayId?: string; shield?: number; shieldAt?: number }
  const gStreak = (await db.ref(`loginStreak/${guest}`).get()).val() as StreakRow | null
  if (gStreak && num(gStreak.streak) > 0) {
    await db.ref(`loginStreak/${wallet}`).transaction((cur: unknown) => {
      const w = (cur || {}) as StreakRow
      const shield = Math.min(1, Math.max(num(w.shield), num(gStreak.shield)))
      // 0 means "never written" on either side, and must not win a min().
      const ats = [num(w.shieldAt), num(gStreak.shieldAt)].filter((n) => n > 0)
      const shieldAt = ats.length ? Math.min(...ats) : SHIELD_EARN_AFTER
      if (num(w.streak) >= num(gStreak.streak)) {
        // Keep the wallet's run, but never lose the bigger trophy.
        return { ...w, best: Math.max(num(w.best), num(gStreak.best)), shield, shieldAt }
      }
      return {
        streak: num(gStreak.streak),
        best: Math.max(num(w.best), num(gStreak.best)),
        lastDayId: gStreak.lastDayId || '',
        shield,
        shieldAt,
      }
    })
    out.streak = num(gStreak.streak)
  }

  return out
}
