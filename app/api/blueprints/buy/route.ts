import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress } from 'viem'
import { publicClient } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'
import { GAME_CONFIG } from '@/lib/constants/game-config'

// =============================================
// PREMIUM SECTOR BLUEPRINT — purchase (Phase 8)
// POST /api/blueprints/buy
// Body: { wallet, txHash, token, sectorId } | { wallet, devBypass: true, sectorId }
//
// Mirrors app/api/energy/refill EXACTLY (the reusable verify-and-record payment
// primitive): verifies an ERC20 transfer of at least the sector's priceUSD to
// the treasury, replay-protects the tx hash, then records permanent ownership.
// Response: { success, owned: string[] }
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

function getSector(sectorId: string) {
  return GAME_CONFIG.premiumSectors.find(s => s.id === sectorId) || null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const sector = getSector(String(body?.sectorId || ''))
    if (!sector) return NextResponse.json({ error: 'Unknown sector' }, { status: 400 })
    const buyer = normalize(wallet)
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    const grant = async () => {
      await db.ref(`blueprintsOwned/${buyer}/${sector.id}`).set({ at: Date.now() })
      const snap = await db.ref(`blueprintsOwned/${buyer}`).get()
      const owned = snap.exists() ? Object.keys(snap.val()) : [sector.id]
      return owned
    }

    // dev bypass (QA only — server-side allowlist)
    if (body?.devBypass === true && isDevTestWallet(wallet)) {
      await db.ref(`blueprintsOwned/${buyer}/${sector.id}`).set({ at: Date.now(), devGrant: true })
      const owned = await grant()
      return NextResponse.json({ success: true, owned, devGrant: true })
    }

    const txHash = String(body?.txHash || '')
    const token = String(body?.token || '') as MarketplaceTokenSymbol
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 })
    const tokenCfg = MARKETPLACE_TOKENS[token]
    if (!tokenCfg) return NextResponse.json({ error: 'Unsupported token' }, { status: 400 })

    // 1) replay protection
    const dedupSnap = await db.ref(`blueprintTxHashes/${txHash}`).get()
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
    const priceWei = parseTokenAmount(String(sector.priceUSD), token)
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

    // 4) mark tx used + record ownership
    // `usd`: the price paid — see the note in marketplace/verify.
    await db.ref(`blueprintTxHashes/${txHash}`).set({ wallet: buyer, token, sectorId: sector.id, usd: sector.priceUSD, at: Date.now() })
    const owned = await grant()
    return NextResponse.json({ success: true, owned })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Blueprint purchase failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
