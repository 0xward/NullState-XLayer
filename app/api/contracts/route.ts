import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { walletAddressSchema, contractReportBodySchema } from '@/lib/validation'
import { normalizeWalletAddress, getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'
import { readDayState, reportMetric, contractsForDay } from '@/lib/server/dailyContracts'

// Reads ?wallet on GET, so it can only be served on demand.
export const dynamic = 'force-dynamic'

// =============================================
// DAILY CONTRACTS (GAME-DESIGN.md §5.2)
//
// GET  /api/contracts?wallet=0x...
//   -> { dayId, nextResetAt, completed, contracts: [{id,label,target,progress,done,reward}] }
//
// POST /api/contracts   Body: { wallet, metric, amount? }
//   Reported by game.js as the player kills, clears floors, opens containers
//   and burns loot.
//   -> the same state, plus `granted: [contractId]` for anything that just
//      finished and paid out.
//
// Rewards are Glitch Shards and NullState Point, credited the instant a bar
// fills — no claim step, matching how burning already works. Both are
// off-chain and cost the operator nothing; money stays weekly (§5, and the
// cancelled daily drip in GROWTH-BLUEPRINT.md §1A).
//
// Degrades OPEN like every other weekly/daily route here: with Firebase
// unconfigured this reports today's contracts at zero progress rather than
// failing. The worst case is that progress does not accumulate — never that
// the player is blocked from playing.
// =============================================

const EMPTY = () => {
  const dayId = getCurrentDayIdString()
  return {
    dayId,
    nextResetAt: getNextUtcMidnightMs(),
    completed: 0,
    contracts: contractsForDay(dayId).map((d) => ({
      id: d.id, metric: d.metric, label: d.label, target: d.target,
      progress: 0, done: false, reward: d.reward,
    })),
  }
}

export async function GET(req: NextRequest) {
  try {
    const parsed = walletAddressSchema.safeParse(req.nextUrl.searchParams.get('wallet') ?? '')
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid wallet address' },
        { status: 400 },
      )
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json(EMPTY(), { status: 200 })
    return NextResponse.json(await readDayState(db, normalizeWalletAddress(parsed.data)), { status: 200 })
  } catch (error) {
    console.error('[contracts] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = contractReportBodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ ...EMPTY(), granted: [] }, { status: 200 })

    const { wallet, metric, amount } = parsed.data
    const state = await reportMetric(db, normalizeWalletAddress(wallet), metric, amount ?? 1)
    return NextResponse.json(state, { status: 200 })
  } catch (error) {
    console.error('[contracts] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
