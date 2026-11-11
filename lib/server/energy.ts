// Server-side Energy/Action accounting (Genius blueprint Phase 1).
//
// One energy = one fresh bunker entry. Stored in the same Firebase Realtime
// DB the marketplace ownership records use (getAdminDb), keyed by wallet:
//
//   energy/{wallet} = { windowStart: number, usedFree: number, bonus: number }
//
// The free allowance resets at 00:00 UTC, the same instant Daily Contracts and
// the login streak reset. `windowStart` now holds the UTC day the allowance was
// last spent against; a record from an earlier day is lazily reset on read, so
// there is still no cron behind it.
//
// WHY THIS CHANGED (audit, GAME-DESIGN.md §9b). It used to be a ROLLING 24h
// window opened by the first spend, which put two different meanings of "a day"
// side by side on one status bar: the ◇ contracts chip and the 🔥 streak chip
// rolled over at midnight while the ⚡ chip rolled over 24h after you happened
// to press ENTER. A player who played at 20:00 got new contracts four hours
// later and new energy twenty-four hours later, with nothing on screen
// explaining why. One clock is worth more than the pacing the rolling window
// bought — and a fixed reset is what a habit is built on, which is the entire
// point of the daily layer.
//
// It is also slightly MORE generous: play at 20:00 and the allowance is back at
// midnight rather than the following evening. That is a deliberate trade — the
// $1 refill sells to players who want more than the free five in one sitting,
// and that motivation is untouched.
//
// Purchased bonus runs are NOT dated: they were paid for, so they persist until
// spent.
//
// All mutation goes through Realtime DB transactions so two concurrent
// spend calls can never double-consume the same run.

import { GAME_CONFIG } from '@/lib/constants/game-config'
import { getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'

export interface EnergyRecord {
  /**
   * The UTC day the free allowance was last spent against, as ms-since-epoch of
   * that day's 00:00. Zero means "nothing spent yet".
   *
   * Kept as a number under the same field name on purpose: records written by
   * the old rolling-window code hold a spend TIMESTAMP, and any timestamp from
   * before today's midnight compares as an earlier day — so old records reset
   * on first read exactly as intended, with no migration and no player losing
   * or gaining a run at the changeover.
   */
  windowStart: number
  usedFree: number
  bonus: number
}

export interface EnergyState {
  freeRemaining: number
  bonus: number
  total: number
  resetAt: number // when the free window replenishes (ms epoch)
}

const CFG = GAME_CONFIG.energy

/** 00:00 UTC of the day `now` falls in, as ms since epoch. */
export function utcDayStart(now: number): number {
  return Date.parse(getCurrentDayIdString(now) + 'T00:00:00.000Z')
}

/** Normalize a raw DB record (possibly null) against the current time. */
export function normalizeRecord(raw: Partial<EnergyRecord> | null, now: number): EnergyRecord {
  const rec: EnergyRecord = {
    windowStart: typeof raw?.windowStart === 'number' ? raw.windowStart : 0,
    usedFree: typeof raw?.usedFree === 'number' ? raw.usedFree : 0,
    bonus: typeof raw?.bonus === 'number' ? raw.bonus : 0,
  }
  // Anything stamped before today's midnight belongs to a finished day. This is
  // also what silently migrates the old rolling-window records: they hold a
  // spend timestamp, which is either from today (keep the count — the player
  // already used those runs today) or from before it (reset, as it should).
  if (rec.windowStart < utcDayStart(now)) {
    rec.windowStart = 0
    rec.usedFree = 0
  }
  return rec
}

export function toState(rec: EnergyRecord, now: number): EnergyState {
  const freeRemaining = Math.max(0, CFG.freeRunsPerDay - rec.usedFree)
  return {
    freeRemaining,
    bonus: rec.bonus,
    total: freeRemaining + rec.bonus,
    // Always the next 00:00 UTC — the same instant the contracts chip and the
    // streak chip are counting down to, which is the whole point.
    resetAt: getNextUtcMidnightMs(now),
  }
}

/**
 * Attempt to consume one run inside a Realtime DB transaction.
 * Returns the post-spend state plus ok=false when no energy was available.
 */
export async function spendOne(
  db: { ref: (path: string) => { transaction: (fn: (cur: unknown) => unknown) => Promise<{ committed: boolean; snapshot: { val: () => unknown } }> } },
  wallet: string,
  now: number,
): Promise<{ ok: boolean; state: EnergyState }> {
  let ok = false
  const result = await db.ref(`energy/${wallet}`).transaction((cur: unknown) => {
    const rec = normalizeRecord(cur as Partial<EnergyRecord> | null, now)
    ok = false
    if (rec.usedFree < CFG.freeRunsPerDay) {
      // Stamp the DAY, not the moment. Writing `now` would still work today,
      // but it would leave records that only look right by accident.
      rec.windowStart = utcDayStart(now)
      rec.usedFree += 1
      ok = true
    } else if (rec.bonus > 0) {
      rec.bonus -= 1
      ok = true
    }
    return rec // always write the (possibly just lazily-reset) record back
  })
  const rec = normalizeRecord(result.snapshot.val() as Partial<EnergyRecord> | null, now)
  return { ok, state: toState(rec, now) }
}
