import { NextRequest, NextResponse } from 'next/server'
import { decodeEventLog, parseAbi, getAddress, createWalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { celoTransport } from '@/lib/celoRpc'
import { publicClient } from '@/lib/web3-client'
import { getAdminDb } from '@/firebase-config'
import { maybeGiftReferralPass } from '@/lib/server/referrals'
import { MARKETPLACE_TOKENS, TREASURY_WALLET, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'
import { parseTokenAmount } from '@/lib/constants/tokens'
import { PASS_SBT_ADDRESS, PASS_SBT_ABI, getPassPriceUsd } from '@/lib/contract-abi'
import { getServerAttributionSuffix } from '@/lib/attribution-tag'

// =============================================
// PASSSBT PAID-MINT VERIFY + BACKEND MINT
// POST /api/passsbt/mint
//
// Body: { wallet, txHash, seasonId, token }
//   - wallet   : buyer address
//   - txHash   : the ERC20 transfer() tx to the treasury (0.30 USD equiv.)
//   - seasonId : which season to mint (e.g. 202607)
//   - token    : 'USDm' | 'USDC' | 'USDT'
//
// v2.1 (this session): PassSBTv2's mintPaidPass() used to pull a fixed
// USDm amount on-chain via transferFrom(). That's gone — instead this
// mirrors app/api/marketplace/verify/route.ts exactly: the frontend sends
// a plain ERC20 transfer() of 0.30 USD (in whichever of USDm/USDC/USDT the
// wallet holds most of) to TREASURY_WALLET, this route verifies that
// transfer really happened on-chain, hasn't been used before, and the
// season/user state is still valid — then, unlike Marketplace (which just
// records offchain ownership in Firebase), this route ALSO calls the new
// PassSBTv2.backendMintPass(wallet, seasonId) on-chain using the same
// BACKEND_PRIVATE_KEY signer already used by /api/vault/submit, so the
// user actually receives the soulbound NFT.
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

    const db = getAdminDb()
    if (!db) return NextResponse.json({ error: 'Server storage unavailable' }, { status: 500 })

    // 1) replay protection — a tx hash can only ever unlock ONE SUCCESSFUL
    //    mint. A record only blocks retries once status === 'success' (i.e.
    //    the on-chain backendMintPass() call actually went through and we
    //    have a mintTxHash to prove it). A 'pending' record left behind by a
    //    request that's still in flight, or a 'failed' record from an
    //    attempt where the mint itself reverted/errored, does NOT block a
    //    retry — otherwise a payment that succeeded but a mint that failed
    //    (wrong backend auth, backend out of gas, RPC hiccup, etc.) would
    //    permanently strand the user's payment with no pass and no way to
    //    recover, which is exactly the bug that caused pass #9.
    const dedupSnap = await db.ref(`passMintTxHashes/${txHash}`).get()
    if (dedupSnap.exists() && dedupSnap.val()?.status === 'success') {
      return NextResponse.json({ error: 'This transaction was already used' }, { status: 409 })
    }

    // 2) confirm the payment tx on-chain
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
    // at step 6 below already correctly does.
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

    // 3) find a matching ERC20 Transfer(from=buyer, to=treasury, value>=price)
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

    // 4) on-chain pre-flight: season must exist, not be sold out, user must
    //    not already hold a pass for this season. backendMintPass() checks
    //    the same things, but checking here first gives a clearer error
    //    than a generic revert would, and avoids spending backend gas on a
    //    call that's guaranteed to fail.
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

    // 5) mark tx as 'pending' (NOT 'used') before minting — this still
    //    stops a second request from racing in with the same payment tx
    //    while this one is in flight, but does NOT permanently lock the tx
    //    out if the mint below fails. Only step 6 succeeding flips this to
    //    'success', which is the only status that step 1 treats as final.
    await db.ref(`passMintTxHashes/${txHash}`).set({
      wallet: buyer,
      seasonId: seasonId.toString(),
      token,
      // The price paid, captured now. The pass price is owner-adjustable
      // on-chain, so without this a change to setPassPriceUsdCents() would
      // retroactively restate every past mint's value.
      usd: Number(passPriceUsd),
      at: Date.now(),
      status: 'pending',
    })

    // 6) backend-signed mint
    const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY as `0x${string}` | undefined
    if (!backendPrivateKey) {
      await db.ref(`passMintTxHashes/${txHash}`).update({ status: 'failed', error: 'Backend signer not configured' })
      return NextResponse.json({ error: 'Backend signer not configured' }, { status: 503 })
    }
    const account = privateKeyToAccount(backendPrivateKey)
    const transport = celoTransport()
    const walletClient = createWalletClient({ chain: celo, transport, account })

    let mintHash: `0x${string}`
    try {
      mintHash = await walletClient.writeContract({
        address: PASS_SBT_ADDRESS,
        abi: PASS_SBT_ABI,
        functionName: 'backendMintPass',
        args: [wallet as `0x${string}`, seasonId],
        account,
        dataSuffix: getServerAttributionSuffix(),
      })
      await publicClient.waitForTransactionReceipt({ hash: mintHash })
    } catch (mintErr: unknown) {
      // Payment already happened on-chain (step 2/3 above confirmed it) but
      // the mint itself failed — record WHY (so the next session doesn't
      // have to re-derive it from a generic "Transaction failed" message)
      // and leave status as 'failed' so this same payment tx can be retried
      // once the real cause (e.g. backend auth, gas) is fixed.
      const mintErrMsg = mintErr instanceof Error ? mintErr.message : 'Unknown mint error'
      await db.ref(`passMintTxHashes/${txHash}`).update({ status: 'failed', error: mintErrMsg.slice(0, 300) })
      return NextResponse.json(
        { error: `Payment received but mint failed: ${mintErrMsg.slice(0, 200)}` },
        { status: 502 },
      )
    }

    await db.ref(`passMintTxHashes/${txHash}`).update({ status: 'success', mintTxHash: mintHash })

    // Referral bonus (blueprint 2A): a referred player's first pass mint
    // gifts their referrer a free Season Pass too. Never throws.
    await maybeGiftReferralPass(db, wallet.toLowerCase())

    return NextResponse.json({ success: true, mintTxHash: mintHash })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Mint verification failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
