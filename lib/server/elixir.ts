// Server-side Drop-Rate Elixir accounting (Genius blueprint Phase 3, §2.6).
//
//   elixir/{wallet} = { owned: number, activeUntil: number }
//
// owned      = unused elixirs bought but not yet drunk
// activeUntil = ms epoch the current drop-rate buff expires (0 = none)
//
// Same off-chain, wallet-bound trust model as energy/materials. All mutation
// goes through Realtime DB transactions so concurrent buy/use can't race.

import { GAME_CONFIG } from '@/lib/constants/game-config'

export interface ElixirRecord {
  owned: number
  activeUntil: number
}

export interface ElixirState {
  owned: number
  activeUntil: number
  active: boolean
}

export function normalizeRecord(raw: Partial<ElixirRecord> | null): ElixirRecord {
  return {
    owned: typeof raw?.owned === 'number' && raw.owned > 0 ? Math.floor(raw.owned) : 0,
    activeUntil: typeof raw?.activeUntil === 'number' && raw.activeUntil > 0 ? raw.activeUntil : 0,
  }
}

export function toState(rec: ElixirRecord, now: number): ElixirState {
  return {
    owned: rec.owned,
    activeUntil: rec.activeUntil,
    active: rec.activeUntil > now,
  }
}

export function durationMs(): number {
  return GAME_CONFIG.elixir.durationMin * 60 * 1000
}

type TxDb = {
  ref: (path: string) => {
    transaction: (fn: (cur: unknown) => unknown) => Promise<{ committed: boolean; snapshot: { val: () => unknown } }>
  }
}

/** Credit one purchased elixir. */
export async function creditOne(db: TxDb, wallet: string): Promise<ElixirState> {
  const result = await db.ref(`elixir/${wallet}`).transaction((cur: unknown) => {
    const rec = normalizeRecord(cur as Partial<ElixirRecord> | null)
    rec.owned += 1
    return rec
  })
  return toState(normalizeRecord(result.snapshot.val() as Partial<ElixirRecord> | null), Date.now())
}

/**
 * Consume one owned elixir and (re)start the buff window. Extends from the
 * later of now / current expiry so drinking two doesn't waste the overlap.
 * Returns ok=false when the player owns none.
 */
export async function useOne(db: TxDb, wallet: string, now: number): Promise<{ ok: boolean; state: ElixirState }> {
  let ok = false
  const dur = durationMs()
  const result = await db.ref(`elixir/${wallet}`).transaction((cur: unknown) => {
    const rec = normalizeRecord(cur as Partial<ElixirRecord> | null)
    ok = false
    if (rec.owned > 0) {
      rec.owned -= 1
      rec.activeUntil = Math.max(now, rec.activeUntil) + dur
      ok = true
    }
    return rec
  })
  return { ok, state: toState(normalizeRecord(result.snapshot.val() as Partial<ElixirRecord> | null), now) }
}
