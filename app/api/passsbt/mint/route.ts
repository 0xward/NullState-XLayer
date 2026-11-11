import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress, createWalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { xLayerTestnetChain, xlayerTestnetTransport } from '@/lib/xlayerRpc'
import { publicClient } from '@/lib/web3-client'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'
import { PASS_SBT_ADDRESS, PASS_SBT_ABI, getPassPriceUsd } from '@/lib/contract-abi'

// =============================================
// PASSSBT PAID-MINT VERIFY + BACKEND MINT
// POST /api/passsbt/mint
//
// Body: { wallet, txHash, seasonId, token }
//   - wallet   : buyer address
//   - txHash   : the ERC20 transfer() tx to the treasury (0.30 USD equiv.)
//   - seasonId : which season to mint (e.g. 202607)
//   - token    : 'USDC' | 'USDT' | 'TUSD' (tUSD on the testnet deployment)
//
// The frontend sends a plain ERC20 transfer() of 0.30 USD (in whichever
// accepted token the wallet holds most of — tUSD on the testnet deployment)
// to TREASURY_WALLET. This route verifies that transfer really happened
// on-chain and the season/user state is still valid, then calls
// PassSBTv3.backendMintPass(wallet, seasonId) on-chain using the same
// BACKEND_PRIVATE_KEY signer already used by /api/vault/submit, so the
// user actually receives the soulbound NFT.
//
// NO Firebase / server storage (user decision 2026-11-11): this route keeps
// no record of used payment transactions. Replay protection is on-chain:
//   (a) the payment tx must contain a matching Transfer(from=buyer,
//       to=treasury, value>=price) — step 2;
//   (b) the contract itself refuses a second mint for the same
//       wallet+season (hasPassForSeason pre-flight + backendMintPass()
//       requires !userMintedSeason) — step 3.
// KNOWN LIMITATION (cross-season reuse): a payment tx CAN be presented a
// second time for a DIFFERENT season, because no on-chain record links a
// payment tx to the mint it funded. An accounting check (total paid by the
// buyer to the treasury vs passes held) was considered and REJECTED as
// unsound: free passes exist (mintFreePass, whitelist, referral gifts,
// owner mints), so "passes held" does not imply "payments made". The live
// testnet wallet itself is the counterexample — it holds a free pass #1
// (season 202611, minted at init with no payment) plus a paid pass #2, so
// its total paid (0.30 tUSD) is less than (passes held) x price. The loss
// from a cross-season replay is bounded to one extra 0.30 testnet pass per
// reused payment, and each wallet+season stays one-pass-only.
// Retry behaviour: a payment whose mint failed (backend error, RPC hiccup)
// can simply be retried — nothing is recorded, and the on-chain pre-flight
// is the only gate. A retry after a successful mint mints nothing: the
// pre-flight returns 400 'Already have a pass for this season'.
//
// Response: { success: true, mintTxHash: string }
// =============================================

const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

function normalize(addr: string): string {
  try { return getAddress(addr).toLowerCase() } catch { return (addr || '').toLowerCase() }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const wallet   = String(body?.wallet || '')
    const txHash   = String(body?.txHash || '')
    const seasonIdRaw = body?.seasonId
    const token    = String(body?.token || '') as MarketplaceTokenSymbol

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 })

    let seasonId: bigint
    try {
      seasonId = BigInt(seasonIdRaw)
    } catch {
      return NextResponse.json({ error: 'Invalid seasonId' }, { status: 400 })
    }

    const tokenCfg = MARKETPLACE_TOKENS[token]
    if (!tokenCfg) return NextResponse.json({ error: 'Unsupported token' }, { status: 400 })

    if (!PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x') {
      return NextResponse.json({ error: 'PassSBT contract not configured' }, { status: 503 })
    }

    // 1) confirm the payment tx on-chain
    // NOTE (v43 fix): this used to call getTransactionReceipt(), which
    // queries the RPC exactly once and throws immediately
    // ("TransactionReceiptNotFoundError: ...could not be found") if the tx
    // hasn't been mined/indexed yet. The frontend calls this route right
    // after broadcasting the payment tx (see payToTreasury() in
    // WalletProvider.tsx, which returns the hash without waiting for any
    // confirmation), so that single query almost always lands before the
    // RPC node has the receipt — a near-guaranteed race condition, not an
    // occasional flake. waitForTransactionReceipt() polls until the
    // receipt shows up (or the timeout elapses), same as the mint tx check
    // at step 4 below already correctly does.
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

    // 2) find a matching ERC20 Transfer(from=buyer, to=treasury, value>=price)
    //    emitted by the chosen token contract
    // v3: price read live from PassSBTv3.passPriceUsdCents instead of a
    // hardcoded PASS_PRICE_USD constant, so backend and contract can never
    // disagree on price even after an owner calls setPassPriceUsdCents().
    const passPriceUsd = await getPassPriceUsd(publicClient)
    const priceWei = parseTokenAmount(passPriceUsd, token)
    const tokenAddr = normalize(tokenCfg.address)
    const treasury  = normalize(TREASURY_WALLET)
    const buyer     = normalize(wallet)
    let matched = false

    for (const lg of receipt.logs) {
      if (normalize(lg.address) !== tokenAddr) continue
      try {
        const dec = decodeEventLog({ abi: TRANSFER_ABI, data: lg.data, topics: lg.topics })
        if (dec.eventName !== 'Transfer') continue
        const to    = normalize(dec.args.to as string)
        const from  = normalize(dec.args.from as string)
        const value = dec.args.value as bigint
        if (to === treasury && from === buyer && value >= priceWei) { matched = true; break }
      } catch { /* not a Transfer log, skip */ }
    }
    if (!matched) {
      return NextResponse.json({ error: 'No matching payment to treasury found in this tx' }, { status: 400 })
    }

    // 3) on-chain pre-flight: season must exist, not be sold out, user must
    //    not already hold a pass for this season. backendMintPass() checks
    //    the same things, but checking here first gives a clearer error
    //    than a generic revert would, and avoids spending backend gas on a
    //    call that's guaranteed to fail. This is also the replay protection
    //    for the same wallet+season (see the header note): a payment tx that
    //    already funded a mint for this season is refused here, before any
    //    gas is spent.
    const [seasonInfo, alreadyHasPass] = await Promise.all([
      publicClient.readContract({
        address: PASS_SBT_ADDRESS,
        abi: PASS_SBT_ABI,
        functionName: 'getSeasonInfo',
        args: [seasonId],
      }) as Promise<[bigint, bigint, bigint, bigint]>,
      publicClient.readContract({
        address: PASS_SBT_ADDRESS,
        abi: PASS_SBT_ABI,
        functionName: 'hasPassForSeason',
        args: [wallet as `0x${string}`, seasonId],
      }) as Promise<boolean>,
    ])
    const [supply, minted, startDate] = seasonInfo
    if (startDate === BigInt(0)) {
      return NextResponse.json({ error: 'Season not initialized' }, { status: 400 })
    }
    if (minted >= supply) {
      return NextResponse.json({ error: 'Season sold out' }, { status: 400 })
    }
    if (alreadyHasPass) {
      return NextResponse.json({ error: 'Already have a pass for this season' }, { status: 400 })
    }

    // 4) backend-signed mint
    const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY as `0x${string}` | undefined
    if (!backendPrivateKey) {
      return NextResponse.json({ error: 'Backend signer not configured' }, { status: 503 })
    }
    const account = privateKeyToAccount(backendPrivateKey)
    const transport = xlayerTestnetTransport()
    const walletClient = createWalletClient({ chain: xLayerTestnetChain, transport, account })

    let mintHash: `0x${string}`
    try {
      mintHash = await walletClient.writeContract({
        address: PASS_SBT_ADDRESS,
        abi: PASS_SBT_ABI,
        functionName: 'backendMintPass',
        args: [wallet as `0x${string}`, seasonId],
        account,
      })
      await publicClient.waitForTransactionReceipt({ hash: mintHash })
    } catch (mintErr: unknown) {
      // Payment already happened on-chain (steps 1/2 above confirmed it) but
      // the mint itself failed. Nothing is recorded, so this same payment tx
      // can simply be retried once the real cause (e.g. backend auth, gas)
      // is fixed — the on-chain pre-flight is the only gate, and a retry
      // after a successful mint is refused by alreadyHasPass instead.
      const mintErrMsg = mintErr instanceof Error ? mintErr.message : 'Unknown mint error'
      return NextResponse.json(
        { error: `Payment received but mint failed: ${mintErrMsg.slice(0, 200)}` },
        { status: 502 },
      )
    }

    // Referral bonus (blueprint 2A) is DISABLED: it gifts the referrer a
    // free Season Pass, and the referral records live in Firebase, which
    // this deployment does not use (user decision 2026-11-11). The mint
    // itself does not depend on it.
    return NextResponse.json({ success: true, mintTxHash: mintHash })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Mint verification failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
