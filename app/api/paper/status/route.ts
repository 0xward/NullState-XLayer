import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { walletAddressSchema } from '@/lib/validation'
import { normalizeWalletAddress, getCurrentWeekIdString } from '@/lib/vault-utils'
import { ensureWeeklyCodeInDb } from '@/lib/server/vaultCode'

// Reads ?walletAddress, so it's always dynamic — declare it so the build
// doesn't try to prerender it statically and log a DYNAMIC_SERVER_USAGE error.
export const dynamic = 'force-dynamic'

// =============================================
// PAPER — WEEKLY STATUS + LAZY CODE GENERATION (Phase 5.5 #9B)
// GET /api/paper/status?walletAddress=0x...
//
// Two things live behind this one read:
//  1. Whether THIS wallet has already found this week's Paper (capped at
//     1/wallet/week, same server-enforced pattern as Golden Key — see
//     paperClaims/{weekId}/{wallet}, mirrors goldenKeyClaims/).
//  2. The week's shared vault code itself (vaultCodes/{weekId} — the SAME
//     path /api/vault/submit reads from). Paper doesn't have its own
//     separate code; it's the item that lets a player VIEW the one global
//     weekly vault code. If nobody has looked yet this week, that path is
//     still empty, so this route
//     lazy-generates a random 4-digit code the first time anyone asks —
//     no cron job, first request of the week wins the generation via an
//     RTDB transaction (so two overlapping "first" requests can't produce
//     two different codes).
//
// The code is only returned once the wallet has actually claimed Paper
// this week (claimed:true) — a status check alone should not hand out the
// secret to a wallet that hasn't found the item. That check is enforced
// here in `code` being null vs a string, NOT by hiding the endpoint,
// since /api/paper/claim (called at the moment of pickup) is what flips
// claimed to true for a wallet in the first place.
//
// Response: { weekId, claimed: boolean, canClaim: boolean, code: string|null }
// =============================================

export async function GET(req: NextRequest) {
  try {
    const walletAddress = req.nextUrl.searchParams.get('walletAddress') ?? ''
    const parsedWallet = walletAddressSchema.safeParse(walletAddress)
    if (!parsedWallet.success) {
      return NextResponse.json(
        { error: parsedWallet.error.issues[0]?.message ?? 'Invalid wallet address' },
        { status: 400 },
      )
    }

    const normalizedWallet = normalizeWalletAddress(parsedWallet.data)
    const weekId = getCurrentWeekIdString()

    const db = getAdminDb()
    if (!db) {
      // Firebase not configured — fail OPEN (canClaim: true) rather than
      // blocking every run, matching the Golden Key route. No code to
      // hand back either way.
      return NextResponse.json({ weekId, claimed: false, canClaim: true, code: null }, { status: 200 })
    }

    const claimSnap = await db.ref(`paperClaims/${weekId}/${normalizedWallet}`).get()
    const claimed = claimSnap.exists()

    let code: string | null = null
    if (claimed) {
      code = await ensureWeeklyCodeInDb(db, weekId)
    }

    return NextResponse.json({ weekId, claimed, canClaim: !claimed, code }, { status: 200 })
  } catch (error) {
    console.error('[paper/status] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
