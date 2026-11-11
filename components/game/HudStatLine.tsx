'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLiveStats } from './LiveStatsProvider'

interface HudStatLineProps {
  walletAddress?: string | null
  /** True when ANY full-screen modal/overlay is open (React or vanilla-JS).
   *  DungeonGame.tsx computes this via useState + MutationObserver and passes
   *  it down. When true the line fully unmounts so it never overlaps the
   *  inventory / container / item-zoom / vault / settings overlays. */
  hidden?: boolean
}

// HUD redesign (owner): a single compact stat line — "Point · Level · Floor ·
// Kills" — pinned top-left just under the HP/XP bars. It replaces both the old
// standalone "POINT" pill (TokenBalanceWidget) and the oversized LV/FLOOR/KILLS
// stat boxes that used to sit in the top-right corner. Level/Floor/Kills come
// live from the engine via useLiveStats(); Point is the off-chain NullState
// Point balance (same source the old pill used).
export default function HudStatLine({ walletAddress, hidden }: HudStatLineProps) {
  const address = walletAddress ?? undefined
  const [point, setPoint] = useState<number | null>(null)
  const live = useLiveStats()

  const refresh = useCallback(() => {
    if (!address) return
    fetch(`/api/player/profile?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => {
        const bal = d?.summary?.nullstateTokenBalance
        setPoint(typeof bal === 'number' ? bal : 0)
      })
      .catch(() => { /* offline — keep last known value */ })
  }, [address])

  useEffect(() => {
    refresh()
    // Burns happen mid-run inside the canvas — poll occasionally so the line
    // reflects a fresh burn without a page reload.
    const id = setInterval(refresh, 20000)
    return () => clearInterval(id)
  }, [refresh])

  if (hidden) return null

  const fmt = (n: number | null | undefined) =>
    typeof n === 'number' ? Math.round(n).toLocaleString() : '—'

  return (
    <div className="ns-hud-statwrap" aria-label="Player stats">
      {/* Progress stats stay bundled in the box as before */}
      <div className="ns-hud-statline">
        <span className="ns-hud-stat">
          <span className="k">Level</span><span className="v">{fmt(live?.level)}</span>
        </span>
        <span className="ns-hud-stat">
          <span className="k">Bunker</span>
          <span className="v">
            {typeof live?.bunker === 'number'
              ? (live.bunker > 0 ? `${live.bunker}/${live.bunkerTotal ?? 5}` : 'Abyss')
              : '—'}
          </span>
        </span>
        <span className="ns-hud-stat">
          <span className="k">Floor</span><span className="v">{fmt(live?.floor)}</span>
        </span>
        <span className="ns-hud-stat">
          <span className="k">Kills</span><span className="v">{fmt(live?.kills)}</span>
        </span>
      </div>
      {/* Point is the currency — pulled out into its own gold "tag" (same pill
          style as the How-To-Play tokens) directly under Level, so it reads as
          special rather than just another progress number. */}
      <div className="ns-hud-point">
        <span className="k">Point</span><span className="v">{fmt(point)}</span>
      </div>
    </div>
  )
}
