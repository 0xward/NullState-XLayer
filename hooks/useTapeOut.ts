'use client'

import { useEffect, useState } from 'react'
import type { TapeOutSnapshot } from '@/lib/tapeout'

/**
 * Live TapeOut state for React screens. Reads through /api/tapeout (the
 * server does the on-chain reads; the browser never touches the RPC or a
 * wallet). Refreshes every minute; a module-level cache dedupes fetches
 * across components mounted at the same time (the hub strip and the
 * vault line both use this hook).
 *
 * On failure the hook reports the error and keeps the last good snapshot
 * visible — a dead RPC shows "unavailable", never a stale number passed
 * off as live.
 */

export interface UseTapeOutResult {
  data: TapeOutSnapshot | null
  loading: boolean
  error: string | null
  updatedAt: string | null
}

const REFRESH_MS = 60_000

let cached: { at: number; data: TapeOutSnapshot } | null = null
let inflight: Promise<TapeOutSnapshot> | null = null

async function fetchSnapshot(): Promise<TapeOutSnapshot> {
  const now = Date.now()
  if (cached && now - cached.at < REFRESH_MS) return cached.data
  if (!inflight) {
    inflight = fetch('/api/tapeout')
      .then(async (r) => {
        if (!r.ok) throw new Error(`tapeout_http_${r.status}`)
        return (await r.json()) as TapeOutSnapshot
      })
      .then((data) => {
        cached = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useTapeOut(): UseTapeOutResult {
  const [data, setData] = useState<TapeOutSnapshot | null>(cached?.data ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetchSnapshot()
        .then((d) => {
          if (!alive) return
          setData(d)
          setError(null)
          setLoading(false)
        })
        .catch((e) => {
          if (!alive) return
          setError(e instanceof Error ? e.message : 'tapeout_unavailable')
          setLoading(false)
        })
    }
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return { data, loading, error, updatedAt: data?.updatedAt ?? null }
}
