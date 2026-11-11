// Off-chain "Continue from last bunker" save/load.
//
// This is deliberately separate from the on-chain PlayerProfile (xp/level/
// kills committed to the NullState contract only when the character dies —
// see useContractPlayer.ts). This save is free (no wallet signature, no
// gas): it's a lightweight snapshot of *where the player currently is*
// (floor, inventory, in-run HP/xp/kills-not-yet-recorded-on-chain), stored
// in Firestore keyed by wallet address so it follows the player across
// devices/browsers.
//
// Single-use by design: consumed the moment it's loaded (see
// clearGameSession, called right after a successful load), matching the
// game's own "Death is permanent" ironman-save philosophy — you can't
// save-scum a fight by reloading an old snapshot.

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * What the player did to one floor, as a delta against the layout `runSeed`
 * regenerates. Indices into the generated enemy/decor arrays — see
 * `serializeFloors()` in game.js and GAME-DESIGN.md §8. `el`/`dl` are the array
 * lengths the delta was taken from; the engine drops the delta rather than
 * applying it if regeneration produces different counts.
 */
export interface FloorDelta {
  el: number
  dl: number
  c: boolean
  v: boolean
  b: boolean
  dead: number[]
  broken: number[]
  opened: Record<string, Array<{ s: string; k: string; i: number; q: number; a: number; t: boolean }>>
  rooms: number[]
}

export interface GameSessionSnapshot {
  charKey: string
  campaignActIndex: number
  depth: number
  maxDepthReached: number
  xp: number
  level: number
  kills: number
  hp: number
  inventory: { keys: number; relics: number; shards: number; items?: Record<string, number> }
  goldenKeysRemaining: number
  savedAt: number
  /** Seeds every floor of this run. Absent on saves written before §8. */
  runSeed?: number
  /** Per-depth deltas, keyed by depth. Absent on saves written before §8. */
  floors?: Record<string, FloorDelta> | null
  /** Where the player stood, so Continue resumes there and not at the lift. */
  at?: { x: number; y: number }
}

function docRef(walletAddress: string) {
  return doc(db, 'gameSessions', walletAddress.toLowerCase())
}

/**
 * Save (or overwrite) the current bunker snapshot for a wallet. Called from
 * the Settings > Save Game action and from the silent auto-save on
 * tab-hide/pagehide.
 */
export async function saveGameSession(
  walletAddress: string,
  snapshot: GameSessionSnapshot
): Promise<boolean> {
  try {
    await setDoc(docRef(walletAddress), snapshot)
    return true
  } catch (err) {
    console.error('[v0] Failed to save game session:', err)
    return false
  }
}

/**
 * Fetch the saved snapshot for a wallet, if any. Does NOT delete it — call
 * clearGameSession() separately once the snapshot has actually been applied
 * to a running game, so a failed/aborted load doesn't lose the save.
 */
export async function loadGameSession(
  walletAddress: string
): Promise<GameSessionSnapshot | null> {
  try {
    const snap = await getDoc(docRef(walletAddress))
    return snap.exists() ? (snap.data() as GameSessionSnapshot) : null
  } catch (err) {
    console.error('[v0] Failed to load game session:', err)
    return null
  }
}

/** Consume (delete) the saved snapshot — call right after a successful load. */
export async function clearGameSession(walletAddress: string): Promise<void> {
  try {
    await deleteDoc(docRef(walletAddress))
  } catch (err) {
    console.error('[v0] Failed to clear game session:', err)
  }
}

// ─── localStorage draft (Firestore write-reduction, Phase 1) ─────────────────
// The bunker snapshot is drafted to localStorage on every meaningful in-run
// change (cheap, instant, no quota) and only flushed to Firestore at the
// moments that matter — floor up, level up, death, tab-hide. This keeps a
// crash/refresh from losing progress WITHOUT hammering Firestore's free-tier
// write budget every few seconds (the old blind 15s interval capped us at
// ~80 concurrent players/hour; event-driven flushing lifts that ~10x).

function draftKey(walletAddress: string) {
  return `nullstate:session-draft:${walletAddress.toLowerCase()}`
}

/** Write the current snapshot to localStorage (synchronous, best-effort). */
export function saveGameSessionDraft(
  walletAddress: string,
  snapshot: GameSessionSnapshot
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(draftKey(walletAddress), JSON.stringify(snapshot))
  } catch {
    /* quota/private-mode — the Firestore flush is still the real safety net */
  }
}

/** Read a locally-drafted snapshot, if any (e.g. to recover after a crash). */
export function loadGameSessionDraft(
  walletAddress: string
): GameSessionSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(draftKey(walletAddress))
    return raw ? (JSON.parse(raw) as GameSessionSnapshot) : null
  } catch {
    return null
  }
}

/** Clear the local draft — call once its data is safely in Firestore. */
export function clearGameSessionDraft(walletAddress: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(draftKey(walletAddress))
  } catch {
    /* ignore */
  }
}
