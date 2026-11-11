import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import { getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'
import { hasActivePass } from '@/lib/server/pass'

// =============================================
// SEASON PASS — DAILY PERKS STATUS (read-only)
// GET /api/passsbt/perks?wallet=0x...
//
// Tells the client whether this wallet is an active-season pass holder and,
// if so, whether today's daily perks (energy bonus run + Glitch-Shard
// stipend) have already been claimed this UTC day. Purely informational — the
// claim route (./claim) re-checks everything atomically before granting.
//
// Response: {
//   hasPass, dayId, nextResetAt,
//   energy: { amount, claimedToday },
//   shards: { amount: {t1,t2,t3}, claimedToday }
// }
// =============================================

const PASS = GAME_CONFIG.pass

export async function GET(req: NextRequest) {
  try {
    const wallet = String(req.nextUrl.searchParams.get('wallet') || '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }

    const now = Date.now()
    const dayId = getCurrentDayIdString(now)
    const nextResetAt = getNextUtcMidnightMs(now)

    const hasPass = await hasActivePass(wallet)

    // Non-holders (and guests) get a valid, honest "no perks" response rather
    // than an error, so the UI can render the FREE-path state cleanly.
    let energyClaimed = false
    let shardsClaimed = false
    if (hasPass) {
      const db = getAdminDb()
      if (db) {
        const [e, s] = await Promise.all([
          db.ref(`passPerkClaims/${dayId}/${wallet}/energy`).get(),
          db.ref(`passPerkClaims/${dayId}/${wallet}/shards`).get(),
        ])
        energyClaimed = e.exists()
        shardsClaimed = s.exists()
      }
    }

    return NextResponse.json({
      hasPass,
      dayId,
      nextResetAt,
      energy: { amount: PASS.dailyEnergyRuns, claimedToday: energyClaimed },
      shards: { amount: PASS.dailyShards, claimedToday: shardsClaimed },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Perks lookup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
