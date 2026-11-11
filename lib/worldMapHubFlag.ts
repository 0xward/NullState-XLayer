'use client'

import { useEffect, useState } from 'react'

// Single source of truth for the world-map hub feature flag.
//
// Read by GameFlowManager (which screen to render), HowToPlayScreen (whether to
// document the map at all) and DungeonGame (whether the engine surfaces to the
// map after a cleared bunker), so all three can never disagree — the help text
// can't describe a screen the player isn't getting, and the engine can't walk
// them into the next act while the shell is waiting to show them a map.
//
// ── DEFAULT: ON (flipped 2026-07 after the pre-listing audit) ────────────────
// The world map is now the game's home screen. The old MainMenu list is NOT
// deleted — it stays reachable as a kill switch, because this is the first
// screen every player sees and "revert without shipping code" is worth keeping
// for a screen that central.
//
//   NEXT_PUBLIC_WORLDMAP_HUB=0  → the whole deployment falls back to the
//                                 classic menu (Vercel env var + redeploy, no
//                                 code change needed)
//   ?hub=0                      → this device falls back
//   ?hub=1                      → force the map on even when the env var says
//                                 '0', so the deployment-wide switch can still
//                                 be tested against from a single device
//
// Precedence is URL over env deliberately: the env var is the blunt
// deployment-wide instrument, the query param is how one person checks one
// device without changing what everyone else sees.

// The env half of the answer, evaluated identically on the server and in the
// browser (Next inlines NEXT_PUBLIC_* at build time). Split out because the
// hook needs a seed value that SSR can reproduce exactly — see below.
const ENV_DEFAULT = process.env.NEXT_PUBLIC_WORLDMAP_HUB !== '0'

export function readWorldMapHubFlag(): boolean {
  // The URL override is browser-only; on the server there is no location to
  // read and the env default is the whole answer.
  if (typeof window !== 'undefined') {
    try {
      const q = new URLSearchParams(window.location.search).get('hub')
      if (q === '1') return true
      if (q === '0') return false
    } catch { /* malformed query string — fall through to the env default */ }
  }
  return ENV_DEFAULT
}

// Seeded with the ENV value rather than `false`, then corrected in an effect if
// the URL overrides it.
//
// This matters now that the default is ON. `useEffect` runs AFTER paint, so a
// hook that started `false` and switched on in an effect would show every
// player a frame of the old menu list before the map replaced it — on the
// game's very first screen. Seeding from the env instead means the server HTML,
// the first client render and the committed state all already agree for the
// normal path, so nothing swaps and there is no hydration mismatch. Only the
// rare kill-switch path (`?hub=0`) costs a one-frame correction, which is an
// acceptable price for an escape hatch nobody uses by default.
export function useWorldMapHubFlag(): boolean {
  const [on, setOn] = useState(ENV_DEFAULT)
  useEffect(() => { setOn(readWorldMapHubFlag()) }, [])
  return on
}
