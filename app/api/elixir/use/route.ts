import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { useOne } from '@/lib/server/elixir'

// =============================================
// DROP-RATE ELIXIR USE — drink one owned elixir
// POST /api/elixir/use   Body: { wallet }
// Response: { ok, owned, activeUntil, active }
//   ok=false -> owns none. Transactional (see lib/server/elixir.ts).
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
    const { ok, state } = await useOne(db, wallet, Date.now())
    return NextResponse.json({ ok, ...state })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Elixir use failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
