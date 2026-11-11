// ─── Season identity ─────────────────────────────────────────────────────────
// Season ids are YYYYMM, matching PassSBTv3.sol (202607 = July 2026). Six
// seasons, one per month, July–December 2026.
//
// These used to live inside SeasonPassScreen. Pulled out because the world map
// now shows pass status too, and a second copy of "which season is it" is
// exactly the kind of duplicate that drifts — the two screens would eventually
// disagree about what month it is.

export const SEASON_IDS: readonly bigint[] = [
  BigInt(202607),
  BigInt(202608),
  BigInt(202609),
  BigInt(202610),
  BigInt(202611),
  BigInt(202612),
]

/** The season running right now, clamped to the program's real range so
 *  testing outside Jul–Dec 2026 never leaves every card marked inactive. */
export function currentSeasonId(): bigint {
  const now = new Date()
  const ymNow = BigInt(now.getUTCFullYear() * 100 + (now.getUTCMonth() + 1))
  if (ymNow < SEASON_IDS[0]) return SEASON_IDS[0]
  if (ymNow > SEASON_IDS[SEASON_IDS.length - 1]) return SEASON_IDS[SEASON_IDS.length - 1]
  return ymNow
}

/** 1-based season number for display ("Season 2"), or null for an id outside
 *  the program — a pass minted against an unknown season should read as
 *  unknown rather than silently become Season 1. */
export function seasonNumberOf(id: bigint | number | null | undefined): number | null {
  if (id == null) return null
  const target = BigInt(id)
  const idx = SEASON_IDS.findIndex(s => s === target)
  return idx === -1 ? null : idx + 1
}

/** UTC month name for a season id, e.g. "August 2026". */
export function seasonLabel(id: bigint | number | null | undefined): string | null {
  if (id == null) return null
  const n = Number(id)
  const year = Math.floor(n / 100)
  const month = n % 100
  if (month < 1 || month > 12) return null
  const name = new Date(Date.UTC(year, month - 1, 1))
    .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  return `${name} ${year}`
}

/** Whether a held pass is for the season currently running. A pass is monthly:
 *  next month it stops being active and a new one has to be minted. */
export function isPassCurrent(passSeasonId: bigint | number | null | undefined): boolean {
  if (passSeasonId == null) return false
  return BigInt(passSeasonId) === currentSeasonId()
}
