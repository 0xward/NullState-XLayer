import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { normalizeRecord, toState } from '@/lib/server/elixir'

// =============================================
// DROP-RATE ELIXIR STATE (read-only)
// GET /api/elixir?wallet=0x...
// Response: { owned, activeUntil, active }
// =============================================
export async function GET(req: NextRequest) {
  try {
    const wallet = String(req.nextUrl.searchParams.get('wallet') || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })
    const snap = await db.ref(`elixir/${wallet}`).get()
    const rec = normalizeRecord(snap.exists() ? snap.val() : null)
    return NextResponse.json(toState(rec, Date.now()))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Elixir lookup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
