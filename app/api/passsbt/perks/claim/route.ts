import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import { getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'
import { hasActivePass } from '@/lib/server/pass'
import { normalizeRecord, toState, type EnergyRecord } from '@/lib/server/energy'

// =============================================
// SEASON PASS — DAILY PERK CLAIM
// POST /api/passsbt/perks/claim   Body: { wallet, kind: 'energy' | 'shards' }
//
// Grants one of the pass holder's daily perks, at most once per UTC day:
//   energy  -> +GAME_CONFIG.pass.dailyEnergyRuns bonus energy runs
//   shards  -> +GAME_CONFIG.pass.dailyShards Glitch Shards
//
// Safety model:
//   1. hasActivePass(wallet) is read ON-CHAIN — a non-holder can never claim,
//      and the read fails CLOSED (see lib/server/pass.ts).
//   2. A one-per-UTC-day gate at passPerkClaims/{dayId}/{wallet}/{kind} uses
//      the same first-writer-wins RTDB transaction as the Golden Key claim, so
//      two concurrent requests can't double-grant.
//   3. Only AFTER the gate commits do we credit. Both credits are pure
//      INCREMENTS (the RTDB fn always returns a value), so they are immune to
//      the "conditional-abort on the initial null-cache run" footgun that
//      bit the deduct paths. If the credit itself throws, we roll the gate
//      back so the day isn't burned without a grant.
//
// Response: { success, kind, dayId, nextResetAt, energy?/shards? new totals }
// =============================================

const PASS = GAME_CONFIG.pass

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '').toLowerCase()
    const kind = String(body?.kind || '')

    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    if (kind !== 'energy' && kind !== 'shards') {
      return NextResponse.json({ error: 'Invalid perk kind' }, { status: 400 })
    }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // 1) on-chain holder check (fails closed)
    const holder = await hasActivePass(wallet)
    if (!holder) {
      return NextResponse.json({ error: 'No active Season Pass for this wallet' }, { status: 403 })
    }

    const now = Date.now()
    const dayId = getCurrentDayIdString(now)
    const nextResetAt = getNextUtcMidnightMs(now)
    const claimRef = db.ref(`passPerkClaims/${dayId}/${wallet}/${kind}`)

    // 2) atomic once-per-day gate (first writer wins, same as goldenkey/claim)
    const gate = await claimRef.transaction((current: unknown) => {
      if (current !== null) return undefined // abort — already claimed today
      return { claimedAt: now }
    })
    if (!gate.committed) {
      return NextResponse.json(
        { success: false, alreadyClaimed: true, kind, dayId, nextResetAt },
        { status: 200 },
      )
    }

    // 3) credit — pure increment (footgun-safe). Roll the gate back on failure.
    try {
      if (kind === 'energy') {
        const runs = PASS.dailyEnergyRuns
        const result = await db.ref(`energy/${wallet}`).transaction((cur: unknown) => {
          const rec = normalizeRecord(cur as Partial<EnergyRecord> | null, now)
          rec.bonus += runs
          return rec
        })
        const rec = normalizeRecord(result.snapshot.val() as Partial<EnergyRecord> | null, now)
        return NextResponse.json({
          success: true, kind, dayId, nextResetAt,
          granted: { runs },
          energy: toState(rec, now),
        })
      } else {
        const add = PASS.dailyShards
        const result = await db.ref(`materials/${wallet}`).transaction((cur: unknown) => {
          const v = (cur || {}) as Record<string, unknown>
          const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
          return {
            t1: n(v.t1) + (add.t1 || 0),
            t2: n(v.t2) + (add.t2 || 0),
            t3: n(v.t3) + (add.t3 || 0),
          }
        })
        const totals = (result.snapshot.val() || { t1: 0, t2: 0, t3: 0 }) as { t1: number; t2: number; t3: number }
        return NextResponse.json({
          success: true, kind, dayId, nextResetAt,
          granted: add,
          shards: totals,
        })
      }
    } catch (creditErr) {
      // credit failed after the gate locked — free the day so the holder can
      // retry, then surface the error.
      await claimRef.set(null).catch(() => { /* best-effort rollback */ })
      const msg = creditErr instanceof Error ? creditErr.message : 'Perk credit failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Perk claim failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
