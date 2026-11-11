import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress } from 'viem'
import { publicClient } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import { creditOne } from '@/lib/server/elixir'

// =============================================
// DROP-RATE ELIXIR BUY — $1 -> +1 elixir
// POST /api/elixir/buy
// Body: { wallet, txHash, token } | { wallet, devBypass: true }
//
// Same verify-and-record payment primitive as marketplace/verify and
// energy/refill: on-chain ERC20 transfer >= $1 to treasury, replay-protect
// the tx hash, then credit one elixir.
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

    if (body?.devBypass === true && isDevTestWallet(wallet)) {
      const state = await creditOne(db, buyer)
      return NextResponse.json({ success: true, ...state, devGrant: true })
    }

    const txHash = String(body?.txHash || '')
    const token = String(body?.token || '') as MarketplaceTokenSymbol
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 })
    const tokenCfg = MARKETPLACE_TOKENS[token]
    if (!tokenCfg) return NextResponse.json({ error: 'Unsupported token' }, { status: 400 })

    // replay protection
    const dedupSnap = await db.ref(`elixirTxHashes/${txHash}`).get()
    if (dedupSnap.exists()) {
      return NextResponse.json({ error: 'This transaction was already used' }, { status: 409 })
    }

    // confirm on-chain
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

    // match Transfer(from=buyer, to=treasury, value>=price)
    const priceWei = parseTokenAmount(String(GAME_CONFIG.elixir.priceUSD), token)
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
      } catch { /* not a Transfer log */ }
    }
    if (!matched) {
      return NextResponse.json({ error: 'No matching payment to treasury found in this tx' }, { status: 400 })
    }

    // `usd`: the price paid, so /api/stats can report revenue without
    // re-deriving it from today's config. See the note in marketplace/verify.
    await db.ref(`elixirTxHashes/${txHash}`).set({ wallet: buyer, token, usd: GAME_CONFIG.elixir.priceUSD, at: Date.now() })
    const state = await creditOne(db, buyer)
    return NextResponse.json({ success: true, ...state })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Elixir purchase failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
