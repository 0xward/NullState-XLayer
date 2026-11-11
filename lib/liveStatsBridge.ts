// lib/liveStatsBridge.ts
//
// Single source of truth for "how far am I RIGHT NOW" while a run is active.
//
// Why this exists (item #10 fix, Option C):
// Before this file, three different screens showed three different numbers
// for the same wallet at the same moment:
//   - The in-game HUD (public/game-engine/game.js) reads straight from the
//     live `p.xp` / `p.level` / `p.kills` / `G.depth` vars inside the vanilla-
//     JS engine and paints the DOM directly (#xpFill, #lvl, #floor, #kills).
//     This is always the freshest number, because it never leaves the engine.
//   - SettingsModal read `playerProfile.xp/level` (Firestore, via
//     useContractPlayer's getLeaderboardEntry override) and `sessionStats`
//     (a separate bit of React state), both of which only update on death or
//     on save — so mid-run they lag behind the HUD.
//   - The in-game Leaderboard screen read Firestore too (getLeaderboard),
//     same lag.
//
// The fix: have the engine "announce" its live numbers every time it repaints
// the HUD (updateHUD() in game.js — the one choke point already called after
// every kill/level-up/floor-change/pickup), and have every React consumer
// (SettingsModal, the in-game Leaderboard's own-player row) subscribe to that
// announcement instead of waiting for a Firestore round-trip. Firestore is
// still the source of truth for OTHER players and for anything viewed
// outside an active run (e.g. the dashboard profile page) — this bridge only
// covers "my own live run," which is exactly the case that used to disagree
// with itself across screens.

export interface LiveRunStats {
  xp: number
  level: number
  kills: number
  floor: number
  xpForNext: number
  /** Current story bunker (1-based). 0 in the endless Abyss (no bunker). */
  bunker?: number
  /** Total story bunkers (5). */
  bunkerTotal?: number
}

const EVENT_NAME = 'nullstate:live-stats'

declare global {
  interface Window {
    __nullstateEmitLiveStats?: (stats: LiveRunStats) => void
  }
}

/**
 * Call once when the game engine mounts (see DungeonGame.tsx). Installs the
 * `window.__nullstateEmitLiveStats` hook that game.js calls (guarded with a
 * `typeof` check there, so nothing breaks if this hasn't run yet — the HUD's
 * own DOM update always happens regardless).
 *
 * Returns a cleanup function — call it when the engine unmounts so a stale
 * hook can't fire into a torn-down page.
 */
export function attachLiveStatsBridge(): () => void {
  if (typeof window === 'undefined') return () => {}

  window.__nullstateEmitLiveStats = (stats: LiveRunStats) => {
    window.dispatchEvent(new CustomEvent<LiveRunStats>(EVENT_NAME, { detail: stats }))
  }

  return () => {
    if (window.__nullstateEmitLiveStats) {
      delete window.__nullstateEmitLiveStats
    }
  }
}

/**
 * Subscribe to live stat updates. Returns an unsubscribe function.
 * Safe to call even if attachLiveStatsBridge() hasn't run yet (e.g. no
 * active run) — the callback simply never fires until a run starts.
 */
export function subscribeLiveStats(callback: (stats: LiveRunStats) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = (event: Event) => {
    callback((event as CustomEvent<LiveRunStats>).detail)
  }

  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
