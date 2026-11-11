import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'

// =============================================
// GLITCH SHARD BALANCE (Phase 2, blueprint §2.2)
// GET /api/materials?wallet=0x...
// Response: { t1, t2, t3 }
// Materials are untradeable, wallet-bound and off-chain — the exact same
// trust model as NullState Point (/api/burn/record). Stored in the same
// Realtime DB as marketplace ownership: materials/{wallet} = {t1,t2,t3}.
// =============================================
export async function GET(req: NextRequest) {
  try {
    const wallet = String(req.nextUrl.searchParams.get('wallet') || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })
    const snap = await db.ref(`materials/${wallet}`).get()
    const v = (snap.exists() ? snap.val() : {}) as Record<string, unknown>
    const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
    return NextResponse.json({ t1: n(v.t1), t2: n(v.t2), t3: n(v.t3) })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Materials lookup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
