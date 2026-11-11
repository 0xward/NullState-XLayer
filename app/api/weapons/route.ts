import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { resolveItemId } from '@/lib/constants/marketplace'

// =============================================
// WEAPON EVOLUTION TIERS (Phase 4, blueprint §3)
// GET /api/weapons?wallet=0x...
// Response: { tiers: { [itemId]: number } }   (base/unowned weapons omit -> 1)
//
// Wallet-bound, off-chain — same trust model as materials/marketplace
// ownership. Stored in Realtime DB: weaponTiers/{wallet}/{itemId} = number.
// Keys are canonical (legacy ids resolved) so a re-skinned weapon keeps its
// tier.
// =============================================
export async function GET(req: NextRequest) {
  try {
    const wallet = String(req.nextUrl.searchParams.get('wallet') || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ tiers: {} })
    const snap = await db.ref(`weaponTiers/${wallet}`).get()
    const raw = (snap.exists() ? snap.val() : {}) as Record<string, unknown>
    const tiers: Record<string, number> = {}
    for (const [id, v] of Object.entries(raw)) {
      const t = typeof v === 'number' && isFinite(v) ? Math.max(1, Math.floor(v)) : 1
      const canon = resolveItemId(id)
      // If both a legacy id and its canonical id somehow carry a tier, keep the higher.
      tiers[canon] = Math.max(tiers[canon] || 1, t)
    }
    return NextResponse.json({ tiers })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Weapon tiers lookup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
