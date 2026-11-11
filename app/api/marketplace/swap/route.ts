import { NextRequest, NextResponse } from 'next/server'
import { getAddress } from 'viem'
import { getAdminDb } from '@/firebase-config'
import { getMarketplaceItem, TOKEN_SWAP_MAX_PRICE_USD } from '@/lib/constants/marketplace'

// =============================================
// MARKETPLACE TOKEN SWAP (Phase 5.5 #8)
// POST /api/marketplace/swap
//
// Body: { wallet, itemId }
//
// Off-chain equivalent of /api/marketplace/verify — instead of verifying a
// real USDm/USDC/USDT on-chain transfer, this deducts NullState Point from
// the player's balance (playerProfiles/{wallet}/nullstateTokenBalance) and
// grants marketplace ownership the same way a real purchase would. Only
// items with a `tokenPrice` set (Marketplace items $0.5–$2 — see
// lib/constants/marketplace.ts) are swap-eligible; anything above that
// must be bought with real currency via /api/marketplace/verify. The price
// check is re-validated here server-side — the client's "Swap" button
// being hidden for pricier items is a UX nicety, not the actual guard.
//
// Response: { success: true, owned: string[], newBalance: number }
// =============================================

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    const itemId = String(body?.itemId || '')

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const item = getMarketplaceItem(itemId)
    if (!item) return NextResponse.json({ error: 'Unknown item' }, { status: 400 })
    if (!item.tokenPrice) {
      return NextResponse.json(
        { error: 'This item cannot be swapped for NullState Point — buy with USDm/USDC/USDT instead' },
        { status: 400 }
      )
    }
    // Price ceiling on the free path. TOKEN_SWAP_MAX_PRICE_USD existed as a
    // documented rule that nothing enforced, and the data had already drifted
    // past it (three weapons priced $3–$4 carried a tokenPrice). Point is a
    // faucet currency — it is minted by burning loot, so anything reachable
    // with it is reachable for free. Checking the CEILING as well as the
    // presence of a tokenPrice means a stray tokenPrice on an expensive item is
    // a rejected swap rather than a silent giveaway of the top of the ladder.
    if (item.price > TOKEN_SWAP_MAX_PRICE_USD) {
      return NextResponse.json(
        { error: 'This item is above the NullState Point swap limit — buy with USDm/USDC/USDT instead' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    const normalizedWallet = normalize(wallet)

    // Already owned? Nothing to swap for.
    const alreadyOwnedSnap = await db.ref(`marketplaceOwned/${normalizedWallet}/${itemId}`).get()
    if (alreadyOwnedSnap.exists()) {
      const ownedSnap = await db.ref(`marketplaceOwned/${normalizedWallet}`).get()
      const owned = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : [itemId]
      return NextResponse.json({ error: 'You already own this item', owned }, { status: 409 })
    }

    // Point deduction (read-then-write).
    // BUGFIX: this used to be a `.transaction()` that returned `current`
    // (unchanged) when the balance was short. Returning a value COMMITS in
    // RTDB (only `undefined` aborts), so `committed` was always true — the
    // "not enough Point" branch was dead code and an under-funded swap GRANTED
    // the item for free. It also tripped the same cold-cache null-run hazard as
    // the craft route. Read the real balance first, check it, then write the
    // deducted total. Single-owner balance (only this wallet spends its Point),
    // so a read-then-write is safe here.
    const balanceRef = db.ref(`playerProfiles/${normalizedWallet}/nullstateTokenBalance`)
    const requiredTokens = item.tokenPrice
    const balSnap = await balanceRef.get()
    const currentBalance = (typeof balSnap.val() === 'number' ? balSnap.val() as number : 0)
    if (currentBalance < requiredTokens) {
      return NextResponse.json(
        { error: `Not enough NullState Point (need ${requiredTokens}, have ${currentBalance})` },
        { status: 400 }
      )
    }
    const newBalance = currentBalance - requiredTokens
    await balanceRef.set(newBalance)

    const updates: Record<string, unknown> = {}
    updates[`marketplaceOwned/${normalizedWallet}/${itemId}`] = {
      at: Date.now(),
      method: 'token_swap',
      tokensSpent: requiredTokens,
    }
    await db.ref().update(updates)

    const ownedSnap = await db.ref(`marketplaceOwned/${normalizedWallet}`).get()
    const owned = ownedSnap.exists() ? Object.keys(ownedSnap.val()) : [itemId]

    return NextResponse.json({ success: true, owned, newBalance })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Swap failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
