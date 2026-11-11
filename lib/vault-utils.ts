import { getISOWeekId } from './web3-client'

export const MAX_VAULT_ATTEMPTS = 3

// Golden Key (Phase 5.5 #9A) and the weekly Paper code (#9B) share the exact
// same weekId scheme as the existing Vault code system (getISOWeekId() —
// YYYYWW, resets at the ISO week boundary = Monday 00:00 UTC). Re-exported
// here so API routes for all three features import one shared helper
// instead of each recomputing the week boundary slightly differently.
export function getCurrentWeekIdString(): string {
  return String(getISOWeekId())
}

// The weeks the pending-payout sweep has to look at (newest first).
//
// Not just the current one: a reward that goes pending late on a Sunday would
// otherwise be stranded by the ISO week rolling over at Monday 00:00 UTC before
// the cron next runs — the exact window in which a player is least able to go
// back and re-open the vault themselves. Derived by stepping back seven real
// days rather than subtracting 1 from the id, because week 1 of a year does not
// follow week 0 of the same year.
export function recentWeekIdStrings(now: number = Date.now(), count = 2): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(String(getISOWeekId(new Date(now - i * 7 * 86400000))))
  }
  return out
}

export function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase()
}

// TASK #7 — Season Pass DAILY perks use a UTC-day boundary (not the ISO week
// the Golden Key / Paper claims use). Day id = "YYYY-MM-DD" in UTC; the claim
// window resets at 00:00 UTC. Kept here next to getCurrentWeekIdString so all
// time-boundary claim helpers live in one place.
export function getCurrentDayIdString(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10) // "YYYY-MM-DD" (UTC)
}

// Next UTC midnight (ms epoch) — when today's daily claim window replenishes.
// Shown to the player as a countdown; also lets the client avoid a pointless
// claim attempt right before reset.
export function getNextUtcMidnightMs(now: number = Date.now()): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0)
}

export function parseWeekId(weekId: string | number | bigint): number {
  const value = Number(weekId)
  if (!Number.isInteger(value) || value < 200001 || value > 999953) {
    throw new Error('Invalid weekId')
  }
  return value
}

export function validateVaultCode(code: string): boolean {
  return /^\d{4}$/.test(code.trim())
}

export function getAttemptsRemaining(attemptsUsed: number): number {
  return Math.max(0, MAX_VAULT_ATTEMPTS - attemptsUsed)
}
