import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'

// =============================================
// PREMIUM SECTOR BLUEPRINTS — ownership (Phase 8)
// GET /api/blueprints?wallet=0x...
// Response: { owned: string[] }   (sectorIds this wallet owns)
//
// Off-chain, wallet-bound — same trust model + storage shape as marketplace
// ownership. Realtime DB: blueprintsOwned/{wallet}/{sectorId}.
// =============================================
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet') || ''
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    let normalized = wallet.toLowerCase()
    try { normalized = getAddress(wallet).toLowerCase() } catch { /* keep lowercased */ }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ owned: [] })
    const snap = await db.ref(`blueprintsOwned/${normalized}`).get()
    const owned = snap.exists() ? Object.keys(snap.val()) : []
    return NextResponse.json({ owned })
  } catch {
    return NextResponse.json({ owned: [] })
  }
}
