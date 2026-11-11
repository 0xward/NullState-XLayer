import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress } from 'viem'
import { publicClient } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import { normalizeRecord, toState, type EnergyRecord } from '@/lib/server/energy'

// =============================================
// ENERGY REFILL — $1 -> +5 bonus runs
// POST /api/energy/refill
// Body: { wallet, txHash, token } | { wallet, devBypass: true }
//
// Mirrors app/api/marketplace/verify/route.ts exactly (the reusable
// verify-and-record payment primitive): verifies an ERC20 transfer of at
// least GAME_CONFIG.energy.refillPriceUSD of the chosen stablecoin to the
// treasury, replay-protects the tx hash, then credits
// GAME_CONFIG.energy.refillRuns bonus runs. Bonus runs are not windowed —
// they persist until spent.
// =============================================

const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

// Same server-side-only dev allowlist as the marketplace (see the long
// comment in app/api/marketplace/verify/route.ts — do NOT enable in prod).
function isDevTestWallet(wallet: string): boolean {
  const raw = process.env.DEV_TEST_WALLETS || ''
  if (!raw.trim()) return false
  return raw.split(',').map(a => normalize(a.trim())).filter(Boolean).includes(normalize(wallet))
}

async function credit(db: NonNullable<ReturnType<typeof getAdminDb>>, wallet: string, runs: number) {
  const now = Date.now()
  const result = await db.ref(`energy/${wallet}`).transaction((cur: unknown) => {
    const rec = normalizeRecord(cur as Partial<EnergyRecord> | null, now)
    rec.bonus += runs
    return rec
  })
  const rec = normalizeRecord(result.snapshot.val() as Partial<EnergyRecord> | null, now)
  return toState(rec, now)
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

    // dev bypass (QA only — server-side allowlist, same rules as marketplace)
    if (body?.devBypass === true && isDevTestWallet(wallet)) {
      const state = await credit(db, buyer, GAME_CONFIG.energy.refillRuns)
      return NextResponse.json({ success: true, ...state, devGrant: true })
    }

    const txHash = String(body?.txHash || '')
    const token = String(body?.token || '') as MarketplaceTokenSymbol
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 })
    const tokenCfg = MARKETPLACE_TOKENS[token]
    if (!tokenCfg) return NextResponse.json({ error: 'Unsupported token' }, { status: 400 })

    // 1) replay protection — one tx hash, one refill
    const dedupSnap = await db.ref(`energyTxHashes/${txHash}`).get()
    if (dedupSnap.exists()) {
      return NextResponse.json({ error: 'This transaction was already used' }, { status: 409 })
    }

    // 2) confirm the tx on-chain (waitForTransactionReceipt — see the v43
    // race-condition note in marketplace/verify)
    let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>
    try {
      receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60_000,
      })
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
    const priceWei = parseTokenAmount(String(GAME_CONFIG.energy.refillPriceUSD), token)
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

    // 4) mark tx used + credit the bonus runs
    await db.ref(`energyTxHashes/${txHash}`).set({ wallet: buyer, token, at: Date.now() })
    const state = await credit(db, buyer, GAME_CONFIG.energy.refillRuns)
    return NextResponse.json({ success: true, ...state })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Refill failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
