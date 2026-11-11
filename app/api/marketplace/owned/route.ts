import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import { activeTrialInfos, type TrialRecord } from '@/lib/server/trials'

// GET /api/marketplace/owned?wallet=0x...
// Returns the list of marketplace equipment ids the wallet owns (offchain),
// plus which of those (if any) is currently equipped in each slot.
//
// ARMORY TRIAL (growth blueprint 1B): ACTIVE trial weapons are merged into
// `owned` so every downstream consumer — the engine's equip flow,
// DungeonGame's localStorage mirror, the Marketplace grid — treats them as
// equippable with zero extra plumbing. `trials` carries the countdown info
// (activatedAt/expiresAt) so UIs can badge them, and `trialIds` lets
// screens that must EXCLUDE trials (e.g. Crafting — trials can't evolve)
// filter them back out. Expired trials simply drop out of the merge here;
// the equipped-slot sanitizer below then auto-unequips them.
//
// Response: {
//   owned: string[],                      // purchased + active trials
//   trials: { itemId, activatedAt, expiresAt }[],
//   trialIds: string[],
//   equipped: { mainhand, body, outfit }, // each string|null
// }
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet') || ''
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    let normalized = wallet.toLowerCase()
    try { normalized = getAddress(wallet).toLowerCase() } catch { /* keep lowercased */ }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ owned: [], trials: [], trialIds: [], equipped: { mainhand: null, body: null, outfit: null } })

    const [ownedSnap, equippedSnap, trialsSnap] = await Promise.all([
      db.ref(`marketplaceOwned/${normalized}`).get(),
      db.ref(`marketplaceEquipped/${normalized}`).get(),
      db.ref(`trials/${normalized}`).get(),
    ])
    const purchased = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : []
    const trials = activeTrialInfos((trialsSnap.val() ?? null) as TrialRecord | null)
    const trialIds = trials.map(t => t.itemId).filter(id => !purchased.includes(id))
    const owned = [...purchased, ...trialIds]

    const equippedVal = equippedSnap.exists() ? equippedSnap.val() : {}
    // Never trust a stored equipped id that isn't in the current owned
    // list (e.g. leftover from before a refund/removal — or an expired
    // trial, which drops out of `owned` the moment its 48h are up).
    const equipped = {
      mainhand: equippedVal.mainhand && owned.includes(equippedVal.mainhand) ? equippedVal.mainhand : null,
      body: equippedVal.body && owned.includes(equippedVal.body) ? equippedVal.body : null,
      outfit: equippedVal.outfit && owned.includes(equippedVal.outfit) ? equippedVal.outfit : null, // Phase 9
    }
    return NextResponse.json({ owned, trials, trialIds, equipped })
  } catch {
    return NextResponse.json({ owned: [], trials: [], trialIds: [], equipped: { mainhand: null, body: null, outfit: null } })
  }
}
