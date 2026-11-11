import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { walletAddressSchema } from '@/lib/validation'
import { normalizeWalletAddress, getCurrentWeekIdString } from '@/lib/vault-utils'

// Reads the ?walletAddress query param, so it can only be served on demand.
// Declaring it dynamic stops Next.js from attempting (and loudly failing) to
// statically prerender it at build time — the route table already marks it ƒ.
export const dynamic = 'force-dynamic'

// =============================================
// GOLDEN KEY — WEEKLY STATUS (Phase 5.5 #9A)
// GET /api/goldenkey/status?walletAddress=0x...
//
// Golden Key used to be a run-capped drop (2 per run, purely client-side —
// see the old goldenKeysRemaining counter in game.js). It's now capped at
// 1 PER WALLET PER WEEK, enforced server-side so it can't be farmed by
// starting new runs or reloading. The week boundary is the exact same
// ISO week used by the existing Vault code system (Monday 00:00 UTC —
// see lib/web3-client.ts getISOWeekId()), so Golden Key, the weekly Paper
// code, and Vault submission all reset in lockstep.
//
// This is a read-only check — game.js calls this once per run (see
// mount()/newGame() in public/game-engine/game.js) to decide whether this
// week's single Golden Key slot is still up for grabs. The actual claim
// is a separate atomic call (see /api/goldenkey/claim) made the moment a
// container's loot roll actually produces a Golden Key, so a status check
// alone can never consume the week's allowance.
//
// Response: { weekId, claimed: boolean, canClaim: boolean }
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
      // blocking every run from ever finding a Golden Key just because the
      // backend isn't wired up yet (matches how burn/vault routes degrade).
      return NextResponse.json({ weekId, claimed: false, canClaim: true }, { status: 200 })
    }

    const snap = await db.ref(`goldenKeyClaims/${weekId}/${normalizedWallet}`).get()
    const claimed = snap.exists()

    return NextResponse.json({ weekId, claimed, canClaim: !claimed }, { status: 200 })
  } catch (error) {
    console.error('[goldenkey/status] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
