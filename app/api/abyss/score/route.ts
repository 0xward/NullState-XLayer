import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import { getCurrentSeasonId } from '@/lib/web3-client'

// =============================================
// NULL ABYSS — season depth score (growth blueprint 3B)
//
// The Abyss is the competitive endgame: your DEEPEST floor this season is
// your rank, and the season top-3 (real stablecoin) are the deepest divers.
// This records only the max depth per wallet per season.
//
// POST /api/abyss/score  Body: { wallet, depth }
//   -> { success, bestDepth }   (server keeps max(existing, depth))
//
// GET  /api/abyss/score?seasonId=YYYYMM&limit=20
//   -> { seasonId, ranking: [{ wallet, depth, at }], top3: [...] }
//   The owner reads top3 to publish the on-chain leaderboard for the season
//   bonus payout (scripts/deposit-reward.js update-leaderboard). Season id
//   defaults to the current YYYYMM.
// =============================================

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}
const isWallet = (w: string) => /^0x[a-fA-F0-9]{40}$/.test(w)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    const depth = Number(body?.depth)
    if (!isWallet(wallet)) return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    if (!Number.isFinite(depth) || depth < 1 || depth > 100000) {
      return NextResponse.json({ error: 'Invalid depth' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 503 })

    const seasonId = getCurrentSeasonId()
    const ref = db.ref(`abyssScores/${seasonId}/${normalize(wallet)}`)
    // Keep only the best (deepest) — an atomic max.
    const tx = await ref.transaction((cur: { depth?: number } | null) => {
      const prev = typeof cur?.depth === 'number' ? cur.depth : 0
      if (Math.floor(depth) <= prev) return undefined // not an improvement — abort
      return { depth: Math.floor(depth), at: Date.now() }
    })
    const bestDepth = (tx.snapshot?.val() as { depth?: number } | null)?.depth ?? Math.floor(depth)
    return NextResponse.json({ success: true, bestDepth })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to record score'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const seasonId = req.nextUrl.searchParams.get('seasonId') || String(getCurrentSeasonId())
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20))
    const db = getAdminDb()
    if (!db) return NextResponse.json({ seasonId, ranking: [], top3: [] })

    const snap = await db.ref(`abyssScores/${seasonId}`).get()
    const val = (snap.val() ?? {}) as Record<string, { depth?: number; at?: number }>
    const ranking = Object.entries(val)
      .map(([wallet, v]) => ({ wallet, depth: Number(v?.depth) || 0, at: Number(v?.at) || 0 }))
      .filter(r => r.depth > 0)
      .sort((a, b) => b.depth - a.depth || a.at - b.at) // deeper first; earlier breaks ties
      .slice(0, limit)
    return NextResponse.json({ seasonId, ranking, top3: ranking.slice(0, 3) })
  } catch {
    return NextResponse.json({ seasonId: String(getCurrentSeasonId()), ranking: [], top3: [] })
  }
}
