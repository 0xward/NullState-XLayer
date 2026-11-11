import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem } from '@/lib/constants/marketplace'
import { activeTrialInfos, type TrialRecord } from '@/lib/server/trials'

// =============================================
// MARKETPLACE EQUIPPED-SLOT SAVE
// POST /api/marketplace/equip
//
// Body: { wallet, mainhand, body, outfit }  (each is an item id or null)
// `outfit` (Phase 9) is the cosmetic-skin slot — a purely visual equip, no
// gameplay effect, persisted here so the chosen skin survives device changes.
//
// Persists WHICH owned item is currently worn in each slot, in Firebase,
// keyed by wallet — same durability guarantee as marketplaceOwned. Before
// this endpoint existed, the equipped choice only ever lived in the HP's
// localStorage (see window.NS_saveEquipment in game.js), which meant
// uninstalling/reinstalling MiniPay (or switching devices) reset it back
// to "nothing equipped" even though the owned item itself was never lost.
//
// Response: { success: true, equipped: { mainhand, body, outfit } }
// =============================================

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    const mainhandRaw = body?.mainhand ?? null
    const bodyRaw = body?.body ?? null
    const outfitRaw = body?.outfit ?? null

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const buyer = normalize(wallet)

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // Only ever persist ids that (a) are real marketplace items in the
    // right slot, and (b) this wallet actually owns — never trust the
    // client's word for either, since this is a server-side save.
    // ARMORY TRIAL: active trial weapons count as owned for equipping,
    // and equipping an unactivated trial is the moment its 48h clock
    // starts ("in inventory until used" — growth blueprint 1B).
    const [ownedSnap, trialsSnap] = await Promise.all([
      db.ref(`marketplaceOwned/${buyer}`).get(),
      db.ref(`trials/${buyer}`).get(),
    ])
    const owned: string[] = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : []
    const trialRec = (trialsSnap.val() ?? null) as TrialRecord | null
    const activeTrials = activeTrialInfos(trialRec)
    for (const t of activeTrials) if (!owned.includes(t.itemId)) owned.push(t.itemId)

    function sanitize(id: unknown, slot: 'mainhand' | 'body' | 'outfit'): string | null {
      if (typeof id !== 'string' || !id) return null
      if (!owned.includes(id)) return null
      const item = getMarketplaceItem(id)
      if (!item || item.slot !== slot) return null
      return id
    }

    const equipped = {
      mainhand: sanitize(mainhandRaw, 'mainhand'),
      body: sanitize(bodyRaw, 'body'),
      outfit: sanitize(outfitRaw, 'outfit'), // Phase 9 cosmetic skin slot
    }

    // First equip of an unactivated trial starts its countdown.
    const worn = equipped.mainhand
    if (worn) {
      const t = activeTrials.find(x => x.itemId === worn && x.activatedAt == null)
      if (t) await db.ref(`trials/${buyer}/items/${worn}/activatedAt`).set(Date.now())
    }

    await db.ref(`marketplaceEquipped/${buyer}`).set({ ...equipped, at: Date.now() })

    return NextResponse.json({ success: true, equipped })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save equipped gear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
