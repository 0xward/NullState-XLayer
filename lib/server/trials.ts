import { getMarketplaceItem } from '@/lib/constants/marketplace'

// =============================================
// TIMED GEAR TRIALS — shared server helpers
//
// Two features grant timed trials into ONE store (trials/{wallet}):
//   1. ARMORY TRIAL (blueprint 1B): one-time pick-2 premium weapons, 48h
//      each, unlocked by clearing Act 1. Tracked via rec.armory so the
//      one-time gate is independent of referral-granted trials.
//   2. REFERRAL TIERS (blueprint 2A): tier rewards add extra weapon trials
//      with their own durations (72h / 48h / 168h).
//
//   trials/{wallet} = {
//     durationH: 48,                      // default when an item has none
//     armory?: { claimedAt: number },    // one-time Armory grant marker
//     items: { [itemId]: { activatedAt: number|null, durationH?: number } },
//   }
//
// A trial's clock starts ONLY on first equip (activatedAt — stamped by
// /api/marketplace/equip), not at grant. Active = not yet activated OR
// now < activatedAt + duration. Active trials are merged into
// /api/marketplace/owned's `owned` list so the engine equips them with
// ZERO engine changes; expired ones drop out on the next load (and the
// equipped-slot sanitizer unequips them). Crafting is unaffected: the
// craft routes validate against marketplaceOwned directly.
// =============================================

export const TRIAL_DURATION_H = 48
export const TRIAL_COUNT = 2

export interface TrialInfo {
  itemId: string
  activatedAt: number | null
  expiresAt: number | null // null until activated
  durationH: number
}

// A trial can be taken on any visible premium weapon (not the hidden
// starter, not pass-only items, not armor/outfits).
export function isTrialableWeapon(id: string): boolean {
  const item = getMarketplaceItem(id) as
    | { type?: string; hidden?: boolean; passOnly?: boolean }
    | undefined
  return !!item && item.type === 'weapon' && !item.hidden && !item.passOnly
}

// Cosmetic outfits claimable as the referral tier-3 permanent skin.
export function isClaimableSkin(id: string): boolean {
  const item = getMarketplaceItem(id) as
    | { type?: string; hidden?: boolean; passOnly?: boolean }
    | undefined
  return !!item && item.type === 'outfit' && !item.hidden && !item.passOnly
}

export interface TrialRecord {
  durationH?: number
  armory?: { claimedAt?: number }
  items?: Record<string, { activatedAt?: number | null; durationH?: number }>
  // legacy shape (pre-referral): grantedAt marked the armory claim
  grantedAt?: number
}

export function hasArmoryGrant(rec: TrialRecord | null): boolean {
  return !!(rec && (rec.armory?.claimedAt || rec.grantedAt))
}

export function activeTrialInfos(rec: TrialRecord | null, now = Date.now()): TrialInfo[] {
  if (!rec || !rec.items) return []
  const defMs = (rec.durationH ?? TRIAL_DURATION_H) * 3600_000
  const out: TrialInfo[] = []
  for (const [itemId, v] of Object.entries(rec.items)) {
    const durMs = typeof v?.durationH === 'number' ? v.durationH * 3600_000 : defMs
    const activatedAt = typeof v?.activatedAt === 'number' ? v.activatedAt : null
    const expiresAt = activatedAt == null ? null : activatedAt + durMs
    if (expiresAt != null && now >= expiresAt) continue // expired — gone
    out.push({ itemId, activatedAt, expiresAt, durationH: Math.round(durMs / 3600_000) })
  }
  return out
}
