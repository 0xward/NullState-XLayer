import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { readSeasonStatus, payoutCommands, markSeasonPaid } from '@/lib/server/seasonClose'

export const dynamic = 'force-dynamic'

// =============================================
// SEASON PAYOUT STATUS (GAME-DESIGN.md §9)
//
// GET  /api/season/status
//   -> { currentSeasonId, lastClosedSeasonId, snapshot, awaitingPayout, commands }
//   Read-only. `commands` are the exact deposit-reward.js lines for the frozen
//   top 3 — the point of preparing automatically is that paying is a paste, not
//   a judgement call.
//
// POST /api/season/status   Body: { seasonId, note? }   Header: x-admin-secret
//   Marks a season paid, after the owner has signed the on-chain publish and
//   deposit THEMSELVES. It only ever sets a flag: it cannot move money, cannot
//   change who won, and cannot un-mark a season.
//
// WHY THERE IS NO ROUTE THAT PAYS. The owner's decision (recorded in §9) was
// "prepare automatically, I still sign". Paying from here would need the
// deployer private key in the server environment; this repo is public and that
// key is the one that owns both reward contracts. Everything up to the
// signature is automated instead.
//
// The GET is public on purpose. It exposes who won a season that has ended and
// whether they have been paid — which is exactly the thing players should be
// able to check without asking, and the thing that makes a forgotten payout
// visible instead of silent.
// =============================================

export async function GET() {
  try {
    const db = getAdminDb()
    if (!db) {
      return NextResponse.json({ error: 'Season service unavailable' }, { status: 503 })
    }
    const status = await readSeasonStatus(db)
    return NextResponse.json(
      { ...status, commands: status.snapshot ? payoutCommands(status.snapshot) : [] },
      { status: 200, headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    console.error('[season/status] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.ADMIN_SECRET
    // Fails CLOSED. With no secret configured there is no way to authenticate
    // the caller, and this endpoint writes a record players can read — so it
    // refuses rather than defaulting to open.
    if (!secret) {
      return NextResponse.json({ error: 'ADMIN_SECRET is not configured' }, { status: 503 })
    }
    if (req.headers.get('x-admin-secret') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const seasonId = Number(body?.seasonId)
    if (!Number.isInteger(seasonId) || seasonId < 200001 || seasonId > 999912) {
      return NextResponse.json({ error: 'Invalid seasonId (expected YYYYMM)' }, { status: 400 })
    }
    const note = typeof body?.note === 'string' ? body.note.slice(0, 200) : undefined

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Season service unavailable' }, { status: 503 })

    const snapshot = await markSeasonPaid(db, seasonId, note)
    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshot for that season — it has not closed yet' }, { status: 404 })
    }
    return NextResponse.json({ success: true, snapshot }, { status: 200 })
  } catch (error) {
    console.error('[season/status] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
