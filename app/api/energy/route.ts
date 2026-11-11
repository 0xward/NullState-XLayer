import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { normalizeRecord, toState } from '@/lib/server/energy'

// =============================================
// ENERGY STATE (read-only)
// GET /api/energy?wallet=0x...
// Response: { freeRemaining, bonus, total, resetAt }
// Lazy-reset semantics: a stale 24h window reads as fully replenished; the
// actual DB write happens on the next spend/refill (see lib/server/energy).
// =============================================
export async function GET(req: NextRequest) {
  try {
    const wallet = String(req.nextUrl.searchParams.get('wallet') || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })
    const now = Date.now()
    const snap = await db.ref(`energy/${wallet}`).get()
    const rec = normalizeRecord(snap.exists() ? snap.val() : null, now)
    return NextResponse.json(toState(rec, now))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Energy lookup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
