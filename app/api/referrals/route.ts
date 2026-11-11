import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import {
  INVITEE_WELCOME,
  REFERRAL_TIERS,
  ensureRefCode,
  type ReferralTierKey,
} from '@/lib/server/referrals'
import {
  activeTrialInfos,
  isClaimableSkin,
  isTrialableWeapon,
  type TrialRecord,
} from '@/lib/server/trials'

// =============================================
// REFERRALS (growth blueprint 2A)
//
// GET  /api/referrals?wallet=0x..
//   -> { code, count, claims: {t1?,t3?,t10?}, boundTo: string|null }
//
// POST /api/referrals  Body: { action, wallet, ... }
//   action 'bind'   { code }        invitee binds to a referrer's code
//                                   (once ever, never self, code must exist)
//   action 'credit' {}              invitee reports Act-1 clear -> referrer's
//                                   count increments (once per invitee)
//   action 'claim'  { tier, weaponIds?, skinId? }
//     t1  (1 ref):   1 weapon, 72h trial
//     t3  (3 refs):  1 permanent skin + 3 weapons, 48h trials
//     t10 (10 refs): 2 weapons, 168h trials each
//   All grants are one-time per tier, validated server-side.
// =============================================

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}
const isWallet = (w: string) => /^0x[a-fA-F0-9]{40}$/.test(w)

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet') || ''
    if (!isWallet(wallet)) return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    const me = normalize(wallet)
    const db = getAdminDb()
    if (!db) return NextResponse.json({ code: null, count: 0, claims: {}, boundTo: null })

    const code = await ensureRefCode(db, me)
    const [recSnap, boundSnap] = await Promise.all([
      db.ref(`referrals/${me}`).get(),
      db.ref(`referredBy/${me}`).get(),
    ])
    const rec = recSnap.val() ?? {}
    return NextResponse.json({
      code,
      count: typeof rec.count === 'number' ? rec.count : 0,
      claims: rec.claims ?? {},
      boundTo: boundSnap.val()?.referrer ?? null,
      tiers: REFERRAL_TIERS,
    })
  } catch {
    return NextResponse.json({ code: null, count: 0, claims: {}, boundTo: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    const wallet = String(body?.wallet || '')
    if (!isWallet(wallet)) return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    const me = normalize(wallet)
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 503 })

    // ---- bind: invitee ties themself to a referrer's code (once, ever) ----
    if (action === 'bind') {
      const code = String(body?.code || '').toUpperCase().trim()
      if (!/^[A-Z0-9]{6,12}$/.test(code)) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
      const refWalletSnap = await db.ref(`refCodes/${code}`).get()
      const referrer = refWalletSnap.val()
      if (typeof referrer !== 'string' || !isWallet(referrer)) {
        return NextResponse.json({ error: 'Unknown referral code' }, { status: 404 })
      }
      if (normalize(referrer) === me) return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
      const tx = await db.ref(`referredBy/${me}`).transaction((cur: unknown) =>
        cur ? undefined : { referrer: normalize(referrer), at: Date.now() }
      )

      // The invitee's welcome weapon. Gated on tx.committed, which is only true
      // on the FIRST bind — the client re-runs this on every mount, so an
      // ungated grant would top the trial up forever.
      //
      // Granted, then reported. `welcome` is only non-null when the grant
      // actually happened this call, so the UI can announce it exactly once
      // instead of every time the page reloads.
      let welcome: { weaponId: string; hours: number } | null = null
      if (tx.committed && isTrialableWeapon(INVITEE_WELCOME.weaponId)) {
        await db.ref(`trials/${me}`).transaction((cur: TrialRecord | null) => {
          const next: TrialRecord = cur ? { ...cur } : { durationH: 48 }
          next.items = { ...(next.items || {}) }
          // Never clobber a trial of the same weapon that is already running —
          // same rule the tier claim below follows.
          const existing = next.items[INVITEE_WELCOME.weaponId]
          if (!existing || activeTrialInfos({ items: { [INVITEE_WELCOME.weaponId]: existing } }).length === 0) {
            next.items[INVITEE_WELCOME.weaponId] = { activatedAt: null, durationH: INVITEE_WELCOME.hours }
          }
          return next
        })
        welcome = { weaponId: INVITEE_WELCOME.weaponId, hours: INVITEE_WELCOME.hours }
      }

      // Already bound is fine/idempotent — never surface an error for it.
      return NextResponse.json({ success: true, bound: tx.committed, welcome })
    }

    // ---- credit: invitee cleared Act 1 -> count for their referrer ----
    if (action === 'credit') {
      const boundSnap = await db.ref(`referredBy/${me}`).get()
      const referrer: string | undefined = boundSnap.val()?.referrer
      if (!referrer) return NextResponse.json({ success: true, credited: false })
      const credRef = db.ref(`referrals/${referrer}/credited/${me}`)
      const tx = await credRef.transaction((cur: unknown) => (cur ? undefined : true))
      if (tx.committed) {
        await db.ref(`referrals/${referrer}/count`).transaction((c: number | null) => (c ?? 0) + 1)
      }
      return NextResponse.json({ success: true, credited: tx.committed })
    }

    // ---- claim: tier rewards ----
    if (action === 'claim') {
      const tier = String(body?.tier || '') as ReferralTierKey
      const cfg = REFERRAL_TIERS[tier]
      if (!cfg) return NextResponse.json({ error: 'Unknown tier' }, { status: 400 })

      const weaponIds: string[] = Array.from(new Set((Array.isArray(body?.weaponIds) ? body.weaponIds : []).map(String)))
      const skinId: string | null = typeof body?.skinId === 'string' ? body.skinId : null
      if (weaponIds.length !== cfg.weapons) {
        return NextResponse.json({ error: `Pick exactly ${cfg.weapons} weapon(s)` }, { status: 400 })
      }
      for (const id of weaponIds) {
        if (!isTrialableWeapon(id)) return NextResponse.json({ error: `"${id}" is not a trialable weapon` }, { status: 400 })
      }
      if (cfg.skin) {
        if (!skinId || !isClaimableSkin(skinId)) {
          return NextResponse.json({ error: 'Pick a skin' }, { status: 400 })
        }
      }

      const countSnap = await db.ref(`referrals/${me}/count`).get()
      const count = Number(countSnap.val() ?? 0)
      if (count < cfg.refs) {
        return NextResponse.json({ error: `Needs ${cfg.refs} completed referral(s) — you have ${count}` }, { status: 400 })
      }

      // One-time claim reservation (atomic).
      const claimRef = db.ref(`referrals/${me}/claims/${tier}`)
      const tx = await claimRef.transaction((cur: unknown) =>
        cur ? undefined : { at: Date.now(), weaponIds, skinId: cfg.skin ? skinId : null }
      )
      if (!tx.committed) return NextResponse.json({ error: 'Tier already claimed' }, { status: 409 })

      // Grant weapon trials (merge into the shared trials record; per-item
      // duration; never clobber an already-active trial of the same item).
      await db.ref(`trials/${me}`).transaction((cur: TrialRecord | null) => {
        const next: TrialRecord = cur ? { ...cur } : { durationH: 48 }
        next.items = { ...(next.items || {}) }
        for (const id of weaponIds) {
          if (!next.items[id] || activeTrialInfos({ items: { [id]: next.items[id] } }).length === 0) {
            next.items[id] = { activatedAt: null, durationH: cfg.weaponHours }
          }
        }
        return next
      })
      // Grant the permanent skin (tier 3).
      if (cfg.skin && skinId) {
        await db.ref(`marketplaceOwned/${me}/${skinId}`).set({ at: Date.now(), referralReward: tier })
      }
      return NextResponse.json({ success: true, tier, weaponIds, skinId: cfg.skin ? skinId : null })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Referral request failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
