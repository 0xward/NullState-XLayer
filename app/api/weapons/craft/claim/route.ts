import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { normalizeCraft } from '@/lib/server/weaponCraft'

// =============================================
// CLAIM A FINISHED CRAFT (Phase 5)
// POST /api/weapons/craft/claim   Body: { wallet }
//
// Applies the queued tier once the timer has elapsed, then clears the queue.
// Server re-checks completesAt, so a client with a fast/rigged clock can't
// claim early. Shards were already spent at start.
// Response: { success, itemId, tier } | 425 if not ready yet.
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

    const snap = await db.ref(`craftQueue/${wallet}`).get()
    const craft = normalizeCraft(snap.exists() ? snap.val() : null)
    if (!craft) return NextResponse.json({ error: 'No active craft' }, { status: 400 })

    const now = Date.now()
    if (now < craft.completesAt) {
      return NextResponse.json({ error: 'Craft not ready yet', remainingMs: craft.completesAt - now }, { status: 425 })
    }

    await db.ref().update({
      [`weaponTiers/${wallet}/${craft.itemId}`]: craft.targetTier,
      [`craftQueue/${wallet}`]: null,
    })
    return NextResponse.json({ success: true, itemId: craft.itemId, tier: craft.targetTier })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Craft claim failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
