import { GAME_CONFIG } from '@/lib/constants/game-config'

// =============================================
// WEAPON CRAFT QUEUE (Phase 5) — shared server helpers
// One active craft per wallet, stored server-authoritatively in Realtime DB
// (craftQueue/{wallet}). The timer gates real money (Finish Now), so all of
// start / claim / finish live in API routes — the client only reads the record
// for its countdown and can never shorten it.
// =============================================

export interface CraftRecord {
  itemId: string        // canonical marketplace weapon id being evolved
  targetTier: number    // tier the craft completes into (>= 2)
  startedAt: number     // ms epoch
  completesAt: number   // ms epoch — Date.now() >= this => claimable
}

const CRAFT_CFG = GAME_CONFIG.weaponEvolution.craft

// Milliseconds a craft into `targetTier` takes. Falls back to the longest
// configured duration for any unexpected tier.
export function craftDurationMs(targetTier: number): number {
  const map = CRAFT_CFG.durationHoursByTargetTier
  const hrs = map[targetTier] ?? Math.max(...Object.values(map))
  return Math.max(0, hrs) * 3_600_000
}

// USD price to Finish Now (skip the timer) for a craft into `targetTier`.
export function finishPriceUSD(targetTier: number): number {
  const map = CRAFT_CFG.finishNowPriceUSDByTargetTier
  return map[targetTier] ?? Math.max(...Object.values(map))
}

export function firstCraftInstant(): boolean {
  return !!CRAFT_CFG.firstCraftInstant
}

// Validate a stored/queued craft record. Returns null for anything malformed
// or already-consumed so callers can treat "no valid craft" uniformly.
export function normalizeCraft(cur: unknown): CraftRecord | null {
  if (!cur || typeof cur !== 'object') return null
  const o = cur as Record<string, unknown>
  const itemId = typeof o.itemId === 'string' ? o.itemId : ''
  const targetTier = typeof o.targetTier === 'number' && isFinite(o.targetTier) ? Math.floor(o.targetTier) : 0
  const startedAt = typeof o.startedAt === 'number' && isFinite(o.startedAt) ? o.startedAt : 0
  const completesAt = typeof o.completesAt === 'number' && isFinite(o.completesAt) ? o.completesAt : 0
  if (!itemId || targetTier < 2) return null
  return { itemId, targetTier, startedAt, completesAt }
}
