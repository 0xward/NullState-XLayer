import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { goldenKeyClaimBodySchema } from '@/lib/validation'
import { normalizeWalletAddress, getCurrentWeekIdString } from '@/lib/vault-utils'

// =============================================
// GOLDEN KEY — WEEKLY CLAIM (Phase 5.5 #9A)
// POST /api/goldenkey/claim
// Body: { wallet: string }
//
// Called by game.js the moment a container's loot roll actually produces a
// Golden Key slot (see props.js rollLootSlots() -> window.NS_GOLDKEY.take()).
// The client already gates the roll on a status check made at run start
// (/api/goldenkey/status), but that's only an optimistic read — this route
// is the one atomic write that actually locks the week for this wallet, so
// two overlapping sessions (e.g. two tabs, or a stale cached status) can't
// both walk away with a key the same week. Uses an RTDB transaction on the
// same key the status route reads, so the two routes can never disagree.
//
// Response: { success: boolean, alreadyClaimed?: boolean, weekId: string }
// =============================================

export async function POST(req: NextRequest) {
  try {
    const parsedBody = goldenKeyClaimBodySchema.safeParse(await req.json())
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
      // run over it; the client-side run-cap (1 per run) still applies.
      return NextResponse.json({ success: true, weekId }, { status: 200 })
    }

    const claimRef = db.ref(`goldenKeyClaims/${weekId}/${normalizedWallet}`)

    // Atomic check-and-set: transaction() only commits if the current value
    // is still null/undefined at write time, so a race between two
    // near-simultaneous claims for the same wallet+week can only ever let
    // one of them through.
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
    console.error('[goldenkey/claim] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
