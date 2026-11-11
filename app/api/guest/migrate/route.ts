import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getCurrentWeekIdString, getCurrentDayIdString } from '@/lib/vault-utils'
import { migrateTimeBoxed } from '@/lib/server/guestMigrate'

// POST /api/guest/migrate
// Body: { guestAddress: string, walletAddress: string }
//
// Phase 1 (guest mode): when a player who has been playing as a guest finally
// connects a real wallet, move the off-chain progress they accumulated under
// their local guest id onto the wallet account. This handles the Realtime DB
// half (NullState Point, materials, owned/equipped gear, weapon tiers,
// blueprints, elixir); the Firestore half (username + bunker save) is done
// client-side in lib/guestMigration.ts.
//
// Merge policy = "fill the gaps, wallet wins" (owner decision):
//   • Fungible balances (Point, materials) are ADDED together.
//   • Owned collections (gear, blueprints, weapon tiers) are UNIONed — the
//     wallet keeps everything it already had, and gains anything the guest had.
//   • Single-value slots (equipped gear, elixir) are only filled if the wallet
//     doesn't already have its own value — real wallet data is never overwritten.
//   • TIME-BOXED records (this week's Vault Fragments and item claims, today's
//     contracts, the login streak) follow their own rules — see
//     lib/server/guestMigrate.ts. They were missing entirely until an audit found
//     that converting to a wallet wiped the week's progress toward USDT.
// After a successful merge the guest's Realtime DB nodes are deleted so the
// same progress can't be migrated twice.

const ADDR = /^0x[a-fA-F0-9]{40}$/

function num(x: unknown): number {
  return typeof x === 'number' && isFinite(x) ? x : 0
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const guest = String(body?.guestAddress || '').toLowerCase()
    const wallet = String(body?.walletAddress || '').toLowerCase()

    if (!ADDR.test(guest) || !ADDR.test(wallet)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }
    if (guest === wallet) {
      return NextResponse.json({ error: 'guest and wallet are the same' }, { status: 400 })
    }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // Read every guest + wallet node we might merge, in parallel.
    const paths = {
      gPoint: `playerProfiles/${guest}/nullstateTokenBalance`,
      wPoint: `playerProfiles/${wallet}/nullstateTokenBalance`,
      gStats: `playerProfiles/${guest}/stats`,
      wStats: `playerProfiles/${wallet}/stats`,
      gMat: `materials/${guest}`,
      wMat: `materials/${wallet}`,
      gOwned: `marketplaceOwned/${guest}`,
      wOwned: `marketplaceOwned/${wallet}`,
      gEquip: `marketplaceEquipped/${guest}`,
      wEquip: `marketplaceEquipped/${wallet}`,
      gTiers: `weaponTiers/${guest}`,
      wTiers: `weaponTiers/${wallet}`,
      gBlue: `blueprintsOwned/${guest}`,
      wBlue: `blueprintsOwned/${wallet}`,
      gElixir: `elixir/${guest}`,
      wElixir: `elixir/${wallet}`,
    }
    const snaps = await Promise.all(
      Object.values(paths).map((p) => db.ref(p).get())
    )
    const val = (i: number) => (snaps[i].exists() ? snaps[i].val() : null)
    const keys = Object.keys(paths)
    const get = (k: keyof typeof paths) => val(keys.indexOf(k))

    const updates: Record<string, unknown> = {}
    const migrated: Record<string, unknown> = {}

    // Point — additive.
    const guestPoint = num(get('gPoint'))
    if (guestPoint > 0) {
      updates[paths.wPoint] = num(get('wPoint')) + guestPoint
      migrated.point = guestPoint
    }

    // Materials {t1,t2,t3} — additive per tier.
    const gMat = (get('gMat') || {}) as Record<string, unknown>
    if (Object.keys(gMat).length) {
      const wMat = (get('wMat') || {}) as Record<string, unknown>
      const merged: Record<string, number> = {}
      for (const t of ['t1', 't2', 't3']) merged[t] = num(wMat[t]) + num(gMat[t])
      updates[paths.wMat] = merged
      migrated.materials = gMat
    }

    // Owned gear — union (never remove what the wallet already owns).
    const gOwned = (get('gOwned') || {}) as Record<string, unknown>
    const wOwned = (get('wOwned') || {}) as Record<string, unknown>
    const gainedItems: string[] = []
    for (const itemId of Object.keys(gOwned)) {
      if (!(itemId in wOwned)) {
        updates[`${paths.wOwned}/${itemId}`] = gOwned[itemId]
        gainedItems.push(itemId)
      }
    }
    if (gainedItems.length) migrated.gear = gainedItems

    // Equipped slots — fill only empty slots, and only with an item the wallet
    // will actually own after this merge.
    const gEquip = (get('gEquip') || {}) as Record<string, unknown>
    const wEquip = (get('wEquip') || {}) as Record<string, unknown>
    const ownedAfter = new Set([...Object.keys(wOwned), ...gainedItems])
    for (const slot of ['mainhand', 'body', 'outfit']) {
      const g = gEquip[slot]
      if (!wEquip[slot] && typeof g === 'string' && ownedAfter.has(g)) {
        updates[`${paths.wEquip}/${slot}`] = g
      }
    }

    // Weapon tiers — fill-gap per item id (keep the wallet's own tier if set).
    const gTiers = (get('gTiers') || {}) as Record<string, unknown>
    const wTiers = (get('wTiers') || {}) as Record<string, unknown>
    for (const id of Object.keys(gTiers)) {
      if (!(id in wTiers)) updates[`${paths.wTiers}/${id}`] = gTiers[id]
    }

    // Blueprints — union.
    const gBlue = (get('gBlue') || {}) as Record<string, unknown>
    const wBlue = (get('wBlue') || {}) as Record<string, unknown>
    for (const id of Object.keys(gBlue)) {
      if (!(id in wBlue)) updates[`${paths.wBlue}/${id}`] = gBlue[id]
    }

    // Elixir — fill only if the wallet has no elixir state of its own.
    if (get('gElixir') && !get('wElixir')) {
      updates[paths.wElixir] = get('gElixir')
    }

    // Stats — fill only if the wallet has none.
    if (get('gStats') && !get('wStats')) {
      updates[paths.wStats] = get('gStats')
    }

    // ── THIS WEEK'S AND TODAY'S PROGRESS ────────────────────────────────
    //
    // Found by audit, and it was the worst thing in this route: none of the
    // time-boxed records moved. A guest who spent the week opening containers
    // arrived at the wallet with ZERO Vault Fragments — losing the entire path
    // to that week's USDT at the exact moment they converted. Connecting a
    // wallet is the thing we most want them to do, and it was the thing that
    // cost them the most.
    //
    // Each is keyed by the CURRENT week or day: older buckets are dead weight
    // that resets on its own, and a guest with a streak or fragments from three
    // weeks ago has nothing worth carrying.
    const weekId = getCurrentWeekIdString()
    const dayId = getCurrentDayIdString()
    const timeBoxed = await migrateTimeBoxed(db, guest, wallet, weekId, dayId)
    Object.assign(migrated, timeBoxed)

    if (Object.keys(updates).length) {
      await db.ref().update(updates)
    }

    // Cleanup: remove the guest's nodes so this can't be replayed.
    await Promise.all([
      db.ref(`playerProfiles/${guest}`).remove(),
      db.ref(`materials/${guest}`).remove(),
      db.ref(`marketplaceOwned/${guest}`).remove(),
      db.ref(`marketplaceEquipped/${guest}`).remove(),
      db.ref(`weaponTiers/${guest}`).remove(),
      db.ref(`blueprintsOwned/${guest}`).remove(),
      db.ref(`elixir/${guest}`).remove(),
      db.ref(`energy/${guest}`).remove(),
      db.ref(`vaultFragments/${weekId}/${guest}`).remove(),
      db.ref(`paperClaims/${weekId}/${guest}`).remove(),
      db.ref(`goldenKeyClaims/${weekId}/${guest}`).remove(),
      db.ref(`dailyContracts/${dayId}/${guest}`).remove(),
      db.ref(`loginStreak/${guest}`).remove(),
    ])

    return NextResponse.json({ success: true, migrated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Guest migration failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
