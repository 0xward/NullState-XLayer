import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { normalizeCraft } from '@/lib/server/weaponCraft'

// =============================================
// ACTIVE CRAFT STATUS (Phase 5)
// GET /api/weapons/craft?wallet=0x...
// Response: { craft: {itemId,targetTier,startedAt,completesAt} | null, serverNow }
//
// The client polls this on mount and drives its countdown off completesAt.
// serverNow lets the UI correct for client clock skew so the timer reads true.
// =============================================
export async function GET(req: NextRequest) {
  try {
    const wallet = String(req.nextUrl.searchParams.get('wallet') || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ craft: null, serverNow: Date.now() })
    const snap = await db.ref(`craftQueue/${wallet}`).get()
    const craft = normalizeCraft(snap.exists() ? snap.val() : null)
    return NextResponse.json({ craft, serverNow: Date.now() })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Craft status lookup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
