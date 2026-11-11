import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import {
  TRIAL_COUNT,
  TRIAL_DURATION_H,
  activeTrialInfos,
  hasArmoryGrant,
  isTrialableWeapon,
  type TrialRecord,
} from '@/lib/server/trials'

// =============================================
// ARMORY TRIAL (growth blueprint 1B)
//
// GET  /api/trials?wallet=0x..
//   -> { eligible: boolean, durationH, trials: TrialInfo[] }
//   eligible = this wallet has never taken its one-time trial grant.
//   (Whether the PLAYER has cleared Act 1 is a client-side flag — the
//   stake here is two temporary weapons, so client attestation is
//   proportionate; the server only enforces the one-grant-per-wallet cap.)
//
// POST /api/trials   Body: { wallet, itemIds: string[TRIAL_COUNT] }
//   Grants the trial. Validates: no prior grant (atomic transaction),
//   exactly TRIAL_COUNT distinct ids, every id a visible premium weapon.
// =============================================

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet') || ''
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const db = getAdminDb()
    if (!db) return NextResponse.json({ eligible: false, durationH: TRIAL_DURATION_H, trials: [] })

    const snap = await db.ref(`trials/${normalize(wallet)}`).get()
    const rec = (snap.val() ?? null) as TrialRecord | null
    return NextResponse.json({
      eligible: !hasArmoryGrant(rec),
      durationH: TRIAL_DURATION_H,
      trials: activeTrialInfos(rec),
    })
  } catch {
    return NextResponse.json({ eligible: false, durationH: TRIAL_DURATION_H, trials: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    const itemIdsRaw = body?.itemIds

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    if (!Array.isArray(itemIdsRaw)) {
      return NextResponse.json({ error: 'itemIds must be an array' }, { status: 400 })
    }
    const itemIds = Array.from(new Set(itemIdsRaw.map(String)))
    if (itemIds.length !== TRIAL_COUNT) {
      return NextResponse.json({ error: `Pick exactly ${TRIAL_COUNT} different weapons` }, { status: 400 })
    }
    for (const id of itemIds) {
      if (!isTrialableWeapon(id)) {
        return NextResponse.json({ error: `"${id}" is not a trialable premium weapon` }, { status: 400 })
      }
    }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 503 })

    const ref = db.ref(`trials/${normalize(wallet)}`)
    // Atomic one-time grant: two racing requests can only commit one armory
    // claim. Referral trials may already live in the record — merge, never
    // overwrite them.
    const tx = await ref.transaction((current: TrialRecord | null) => {
      if (hasArmoryGrant(current)) return undefined // abort — already granted
      const next: TrialRecord = current ? { ...current } : { durationH: TRIAL_DURATION_H }
      next.armory = { claimedAt: Date.now() }
      next.items = { ...(next.items || {}) }
      for (const id of itemIds) next.items[id] = { activatedAt: null, durationH: TRIAL_DURATION_H }
      return next
    })
    if (!tx.committed) {
      return NextResponse.json({ error: 'Trial already claimed for this wallet' }, { status: 409 })
    }

    const rec = (tx.snapshot?.val() ?? null) as TrialRecord | null
    return NextResponse.json({
      success: true,
      durationH: TRIAL_DURATION_H,
      trials: activeTrialInfos(rec),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to grant trial'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
