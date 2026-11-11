import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { paperClaimBodySchema } from '@/lib/validation'
import { normalizeWalletAddress, getCurrentWeekIdString } from '@/lib/vault-utils'

// =============================================
// PAPER — WEEKLY CLAIM (Phase 5.5 #9B)
// POST /api/paper/claim
// Body: { wallet: string }
//
// Mirrors /api/goldenkey/claim exactly: called by game.js the moment a
// container's loot roll actually produces a Paper slot (see props.js
// rollLootSlots() -> window.NS_PAPER.take()). Locks the wallet's weekly
// allowance (1/wallet/week) via an RTDB transaction on paperClaims/{weekId}
// so two overlapping sessions can't both walk away with one. This route
// does NOT reveal the week's code — see /api/paper/status for that (only
// returns the code once claimed is true for that wallet).
//
// Response: { success: boolean, alreadyClaimed?: boolean, weekId: string }
// =============================================

export async function POST(req: NextRequest) {
  try {
    const parsedBody = paperClaimBodySchema.safeParse(await req.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const normalizedWallet = normalizeWalletAddress(parsedBody.data.wallet)
    const weekId = getCurrentWeekIdString()

    const db = getAdminDb()
    if (!db) {
      // Firebase not configured — nothing to persist, but don't fail the
      // run over it (matches goldenkey/claim degrade behavior).
      return NextResponse.json({ success: true, weekId }, { status: 200 })
    }

    const claimRef = db.ref(`paperClaims/${weekId}/${normalizedWallet}`)

    const txResult = await claimRef.transaction((current: unknown) => {
      if (current !== null) return undefined // abort — already claimed
      return { claimedAt: Date.now() }
    })

    if (!txResult.committed) {
      return NextResponse.json(
        { success: false, alreadyClaimed: true, weekId },
        { status: 200 },
      )
    }

    return NextResponse.json({ success: true, weekId }, { status: 200 })
  } catch (error) {
    console.error('[paper/claim] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
