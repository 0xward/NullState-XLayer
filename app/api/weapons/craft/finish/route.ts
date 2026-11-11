import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress } from 'viem'
import { publicClient } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'
import { normalizeCraft, finishPriceUSD } from '@/lib/server/weaponCraft'

// =============================================
// FINISH NOW — skip the craft timer (Phase 5)
// POST /api/weapons/craft/finish
// Body: { wallet, txHash, token } | { wallet, devBypass: true }
//
// Price is TIERED by the craft's target tier (finishPriceUSD): $1 to finish a
// tier-2 craft, $2 for tier-3. Mirrors app/api/energy/refill exactly (on-chain
// ERC20-transfer verify + replay protection), then applies the tier and clears
// the queue in one step. The free path (waiting the timer out) always remains
// available via /api/weapons/craft/claim.
// =============================================

const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

function isDevTestWallet(wallet: string): boolean {
  const raw = process.env.DEV_TEST_WALLETS || ''
  if (!raw.trim()) return false
  return raw.split(',').map(a => normalize(a.trim())).filter(Boolean).includes(normalize(wallet))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const buyer = normalize(wallet)
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // There must be an active craft to finish.
    const snap = await db.ref(`craftQueue/${buyer}`).get()
    const craft = normalizeCraft(snap.exists() ? snap.val() : null)
    if (!craft) return NextResponse.json({ error: 'No active craft' }, { status: 400 })
    const price = finishPriceUSD(craft.targetTier)

    const apply = async () => {
      await db.ref().update({
        [`weaponTiers/${buyer}/${craft.itemId}`]: craft.targetTier,
        [`craftQueue/${buyer}`]: null,
      })
      return NextResponse.json({ success: true, itemId: craft.itemId, tier: craft.targetTier })
    }

    // dev bypass (QA only — server-side allowlist)
    if (body?.devBypass === true && isDevTestWallet(wallet)) {
      return apply()
    }

    const txHash = String(body?.txHash || '')
    const token = String(body?.token || '') as MarketplaceTokenSymbol
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 })
    const tokenCfg = MARKETPLACE_TOKENS[token]
    if (!tokenCfg) return NextResponse.json({ error: 'Unsupported token' }, { status: 400 })

    // 1) replay protection
    const dedupSnap = await db.ref(`craftFinishTxHashes/${txHash}`).get()
    if (dedupSnap.exists()) {
      return NextResponse.json({ error: 'This transaction was already used' }, { status: 409 })
    }

    // 2) confirm the tx on-chain
    let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>
    try {
      receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 60_000 })
    } catch {
      return NextResponse.json(
        { error: 'Payment transaction not confirmed yet — please wait a few seconds and try again' },
        { status: 400 },
      )
    }
    if (!receipt || receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction not confirmed' }, { status: 400 })
    }

    // 3) find a matching Transfer(from=buyer, to=treasury, value>=price)
    const priceWei = parseTokenAmount(String(price), token)
    const tokenAddr = normalize(tokenCfg.address)
    const treasury = normalize(TREASURY_WALLET)
    let matched = false
    for (const lg of receipt.logs) {
      if (normalize(lg.address) !== tokenAddr) continue
      try {
        const dec = decodeEventLog({ abi: TRANSFER_ABI, data: lg.data, topics: lg.topics })
        if (dec.eventName !== 'Transfer') continue
        if (
          normalize(dec.args.to as string) === treasury &&
          normalize(dec.args.from as string) === buyer &&
          (dec.args.value as bigint) >= priceWei
        ) { matched = true; break }
      } catch { /* not a Transfer log, skip */ }
    }
    if (!matched) {
      return NextResponse.json({ error: 'No matching payment to treasury found in this tx' }, { status: 400 })
    }

    // 4) mark tx used + finish the craft
    await db.ref(`craftFinishTxHashes/${txHash}`).set({ wallet: buyer, token, itemId: craft.itemId, targetTier: craft.targetTier, at: Date.now() })
    return apply()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Finish Now failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
