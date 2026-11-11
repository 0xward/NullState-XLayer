import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// =============================================
// GLITCH SHARD END-OF-RUN CREDIT (Phase 2, blueprint §2.2)
// POST /api/materials/credit   Body: { wallet, t1, t2, t3 }
// Response: { success, t1, t2, t3 }  (new totals)
//
// Called once per CLEARED bunker run by the engine's materials bridge with
// the run's shard haul (already degraded by the RunSession death
// multiplier client-side). Trust model matches /api/burn/record — client-
// reported, off-chain faucet material with server-side sanity clamps:
// per-call caps sized to ~2x the maximum theoretically lootable in one
// clean run, so a tampered client can't mint meaningful amounts.
// =============================================

const PER_CALL_CAP = { t1: 40, t2: 40, t3: 40 } as const

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const clamp = (x: unknown, cap: number) =>
      typeof x === 'number' && isFinite(x) ? Math.min(cap, Math.max(0, Math.floor(x))) : 0
    const add = {
      t1: clamp(body?.t1, PER_CALL_CAP.t1),
      t2: clamp(body?.t2, PER_CALL_CAP.t2),
      t3: clamp(body?.t3, PER_CALL_CAP.t3),
    }
    if (add.t1 + add.t2 + add.t3 === 0) {
      return NextResponse.json({ error: 'Nothing to credit' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })
    const result = await db.ref(`materials/${wallet}`).transaction((cur: unknown) => {
      const v = (cur || {}) as Record<string, unknown>
      const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
      return { t1: n(v.t1) + add.t1, t2: n(v.t2) + add.t2, t3: n(v.t3) + add.t3 }
    })
    const totals = (result.snapshot.val() || { t1: 0, t2: 0, t3: 0 }) as { t1: number; t2: number; t3: number }
    return NextResponse.json({ success: true, ...totals })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Materials credit failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
