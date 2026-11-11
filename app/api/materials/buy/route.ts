import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress } from 'viem'
import { publicClient } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'
import { GAME_CONFIG } from '@/lib/constants/game-config'

// =============================================
// GLITCH SHARD PACK — $1 -> +5 shards of a PLAYER-CHOSEN tier (Phase 4, §3, Q3)
// POST /api/materials/buy
// Body: { wallet, txHash, token, tier } | { wallet, devBypass: true, tier }
//   - tier: 't1' | 't2' | 't3' (or 1|2|3) — which shard tier to top up.
//
// Mirrors app/api/energy/refill EXACTLY (the reusable verify-and-record
// payment primitive): verifies an ERC20 transfer of at least
// GAME_CONFIG.weaponEvolution.shardPack.priceUSD of the chosen stablecoin to
// the treasury, replay-protects the tx hash, then credits shardPack.shards to
// the chosen tier. This is the PAID path — the crafting screen always shows it
// beside the FREE "run the act that drops this shard" path.
// =============================================

const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

// Server-side-only dev allowlist (same rules as marketplace/verify + energy/refill).
function isDevTestWallet(wallet: string): boolean {
  const raw = process.env.DEV_TEST_WALLETS || ''
  if (!raw.trim()) return false
  return raw.split(',').map(a => normalize(a.trim())).filter(Boolean).includes(normalize(wallet))
}

// Accept 't1'|'t2'|'t3' or 1|2|3; return the canonical key or null.
function parseTier(v: unknown): 't1' | 't2' | 't3' | null {
  const s = String(v ?? '').toLowerCase()
  if (s === 't1' || s === '1') return 't1'
  if (s === 't2' || s === '2') return 't2'
  if (s === 't3' || s === '3') return 't3'
  return null
}

async function credit(
  db: NonNullable<ReturnType<typeof getAdminDb>>,
  wallet: string,
  tier: 't1' | 't2' | 't3',
  amount: number,
) {
  const result = await db.ref(`materials/${wallet}`).transaction((cur: unknown) => {
    const v = (cur || {}) as Record<string, unknown>
    const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
    const next = { t1: n(v.t1), t2: n(v.t2), t3: n(v.t3) }
    next[tier] += amount
    return next
  })
  return (result.snapshot.val() || { t1: 0, t2: 0, t3: 0 }) as { t1: number; t2: number; t3: number }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet = String(body?.wallet || '')
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    }
    const tier = parseTier(body?.tier)
    if (!tier) return NextResponse.json({ error: 'Invalid tier (t1|t2|t3)' }, { status: 400 })
    const buyer = normalize(wallet)
    const pack = GAME_CONFIG.weaponEvolution.shardPack
    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // dev bypass (QA only — server-side allowlist)
    if (body?.devBypass === true && isDevTestWallet(wallet)) {
      const totals = await credit(db, buyer, tier, pack.shards)
      return NextResponse.json({ success: true, tier, ...totals, devGrant: true })
    }

    const txHash = String(body?.txHash || '')
    const token = String(body?.token || '') as MarketplaceTokenSymbol
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 })
    const tokenCfg = MARKETPLACE_TOKENS[token]
    if (!tokenCfg) return NextResponse.json({ error: 'Unsupported token' }, { status: 400 })

    // 1) replay protection — one tx hash, one pack
    const dedupSnap = await db.ref(`materialsTxHashes/${txHash}`).get()
    if (dedupSnap.exists()) {
      return NextResponse.json({ error: 'This transaction was already used' }, { status: 409 })
    }

    // 2) confirm the tx on-chain
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
    const priceWei = parseTokenAmount(String(pack.priceUSD), token)
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

    // 4) mark tx used + credit the shards
    // `usd`: the price paid — see the note in marketplace/verify.
    await db.ref(`materialsTxHashes/${txHash}`).set({ wallet: buyer, token, tier, usd: pack.priceUSD, at: Date.now() })
    const totals = await credit(db, buyer, tier, pack.shards)
    return NextResponse.json({ success: true, tier, ...totals })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Shard pack purchase failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
