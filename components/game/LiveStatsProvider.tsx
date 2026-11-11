'use client'

// LiveStatsProvider — the single React-side source of truth for "my current
// run's" XP/Level/Kills/Floor while the game engine is mounted.
//
// See lib/liveStatsBridge.ts for the full rationale (item #10 fix, Option C).
// Short version: SettingsModal and the in-game Leaderboard screen used to
// each read their own slightly-stale copy of these numbers (Firestore, only
// synced on death/save). This provider subscribes directly to the engine's
// own live values instead, so every consumer inside this provider agrees
// with the HUD at all times during an active run.
//
// `stats` is `null` whenever no run is currently mounted (e.g. on the main
// menu, or viewing the dashboard/profile page outside the game) — consumers
// should fall back to their existing Firestore-backed props in that case.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { subscribeLiveStats, LiveRunStats } from '@/lib/liveStatsBridge'

const LiveStatsContext = createContext<LiveRunStats | null>(null)

export function LiveStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<LiveRunStats | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeLiveStats(setStats)
    return unsubscribe
  }, [])

  return <LiveStatsContext.Provider value={stats}>{children}</LiveStatsContext.Provider>
}

/**
 * Returns the current run's live stats, or null if no run is active.
 * Callers should fall back to their Firestore-backed data when this is null.
 */
export function useLiveStats(): LiveRunStats | null {
  return useContext(LiveStatsContext)
}
