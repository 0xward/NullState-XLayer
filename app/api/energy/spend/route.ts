import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { spendOne } from '@/lib/server/energy'

// =============================================
// ENERGY SPEND — consume one run (server-authoritative)
// POST /api/energy/spend   Body: { wallet }
// Response: { ok, freeRemaining, bonus, total, resetAt }
//   ok=false -> nothing was consumed; resetAt drives the countdown UI.
// Called by the game engine (via the DungeonGame energy bridge) at the
// moment a FRESH bunker entry starts. Continuing a saved run never calls
// this. Uses a Realtime DB transaction so concurrent taps can't
// double-spend (see lib/server/energy.ts).
// =============================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })
    const { ok, state } = await spendOne(db, wallet, Date.now())
    return NextResponse.json({ ok, ...state })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Energy spend failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
