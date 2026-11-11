import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { normalizeWalletAddress } from '@/lib/vault-utils'
import {
  readStreak, touchStreak, describeReward, STREAK_LADDER, SHIELD_EARN_AFTER,
} from '@/lib/server/loginStreak'

// Reads ?wallet on GET, so it can only ever be served on demand — declare it
// dynamic or the build tries to prerender it and logs DYNAMIC_SERVER_USAGE.
export const dynamic = 'force-dynamic'

// =============================================
// LOGIN STREAK (GAME-DESIGN.md §5.3)
//
// GET  /api/streak?wallet=0x...
//   -> { dayId, streak, best, day, claimedToday, today, tomorrow, ladder }
//   Pure read. Never advances anything, so the profile screen and any other
//   passive reader can call it freely.
//
// POST /api/streak   Body: { wallet }
//   Registers today's visit and pays for it, at most once per UTC day.
//   -> the same state plus `granted` (the reward, or null if today was already
//      counted) and `grantedLabel` for the UI to show without re-deriving it.
//
// Guests are first-class here. A guest id has the same 20-byte shape as a
// wallet (see /api/player/seen), so it keys the same records — and a player who
// has not connected a wallet yet is exactly the player a retention mechanic is
// for. Every currency it pays is off-chain, so nothing about this needs a
// signature.
//
// Degrades OPEN, matching every other daily route here: with Firebase
// unconfigured this reports "no streak" rather than failing. The worst case is
// that the chip does not appear — never that the map breaks.
// =============================================

const EMPTY = {
  streak: 0,
  best: 0,
  day: 1,
  claimedToday: false,
  today: STREAK_LADDER[0],
  tomorrow: STREAK_LADDER[1],
  shield: 0,
  shieldIn: SHIELD_EARN_AFTER,
}

function walletFrom(raw: string | null | undefined): string | null {
  const w = String(raw || '').toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(w) ? normalizeWalletAddress(w) : null
}

export async function GET(req: NextRequest) {
  try {
    const wallet = walletFrom(req.nextUrl.searchParams.get('wallet'))
    if (!wallet) return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })

    const db = getAdminDb()
    if (!db) return NextResponse.json({ ...EMPTY, ladder: STREAK_LADDER, shieldEarnAfter: SHIELD_EARN_AFTER }, { status: 200 })

    const state = await readStreak(db, wallet)
    return NextResponse.json({ ...state, ladder: STREAK_LADDER, shieldEarnAfter: SHIELD_EARN_AFTER }, { status: 200 })
  } catch (error) {
    console.error('[streak] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = walletFrom(body?.wallet)
    if (!wallet) return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })

    const db = getAdminDb()
    if (!db) return NextResponse.json({ ...EMPTY, granted: null, ladder: STREAK_LADDER, shieldEarnAfter: SHIELD_EARN_AFTER }, { status: 200 })

    const state = await touchStreak(db, wallet)
    return NextResponse.json(
      {
        ...state,
        grantedLabel: state.granted ? describeReward(state.granted) : null,
        ladder: STREAK_LADDER,
        shieldEarnAfter: SHIELD_EARN_AFTER,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[streak] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
