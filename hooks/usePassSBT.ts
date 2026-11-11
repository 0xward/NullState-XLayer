'use client'

import { useState, useEffect, useCallback } from 'react'
import { pickBestFeeCurrency, pickBestPaymentToken, type MarketplaceTokenSymbol } from '@/lib/constants/tokens'
import { useWallet } from '@/lib/WalletProvider'
import { getUserFriendlyError, MINIPAY_ADD_CASH_URL } from '@/lib/errorUtils'
import {
  PASS_SBT_ADDRESS,
  PASS_SBT_ABI,
  getPassPriceUsd,
} from '@/lib/contract-abi'

export interface SeasonInfo {
  supply: bigint
  minted: bigint
  startDate: bigint
  endDate: bigint
}

export function usePassSBT(walletAddress: string | undefined) {
  // Chain clients come from the wallet bridge, not from wagmi's hooks. This
  // hook is called by the world map's player plate, which now renders before
  // wagmi has loaded; a wagmi hook here would throw rather than return null.
  // Both are null until then, and every path below already guards on that —
  // the pass badge simply lights up a moment after the map does.
  //
  // payToTreasury: plain ERC20 transfer() of a USD amount, in whichever
  // stablecoin, to TREASURY_WALLET (see lib/WalletProvider.tsx). Reused
  // here for the v2.1 flexible-payment pass mint flow — see
  // mintPaidPassFlexible below.
  const { payToTreasury, publicClient, walletClient, wrongNetwork } = useWallet()

  const [hasPass, setHasPass] = useState<boolean>(false)
  const [passSeasonId, setPassSeasonId] = useState<bigint>(BigInt(0))
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set only when a mint fails specifically due to a token-balance
  // shortfall (native gas OR every stablecoin) — lets the UI offer a
  // MiniPay "Add Cash" shortcut instead of just showing red text.
  const [insufficientFunds, setInsufficientFunds] = useState(false)
  // Fine-grained phase for the paid-mint flow: paying (treasury transfer)
  // is a separate tx from the backend's mint call, so a single isLoading
  // boolean isn't informative enough for the button label / status text.
  const [mintTxPhase, setMintTxPhase] = useState<
    'idle' | 'paying' | 'verifying' | 'minting'
  >('idle')
  // Which stablecoin the last mint attempt actually paid with — set right
  // before sending the treasury transfer, so the UI can show e.g. "Paying
  // with USDC…" even though the displayed price is token-agnostic.
  const [payingToken, setPayingToken] = useState<MarketplaceTokenSymbol | null>(null)
  // TASK #7: the pass price shown to the player is now read LIVE from the
  // contract (getPassPriceUsd -> PassSBTv3.passPriceUsdCents), the exact same
  // number the mint charges and the backend verifies, so the button can never
  // display an amount that diverges from what's charged. Was previously a
  // hardcoded "0.3 USDT" label in SeasonPassCard. null while loading.
  const [passPriceUsd, setPassPriceUsd] = useState<string | null>(null)

  const fetchPassStatus = useCallback(async () => {
    if (!walletAddress || !publicClient || !PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x') return

    setIsLoading(true)
    setError(null)

    try {
      const [pass, season] = await Promise.all([
        publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'hasPass',
          args: [walletAddress as `0x${string}`],
        }),
        publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'getUserPassSeason',
          args: [walletAddress as `0x${string}`],
        }),
      ])

      setHasPass(pass as boolean)
      setPassSeasonId(season as bigint)
    } catch (err) {
      console.error('[usePassSBT] fetchPassStatus error:', err)
      setError((err as Error)?.message ?? 'Failed to fetch pass status')
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress, publicClient])

  const checkWhitelist = useCallback(
    async (seasonId: bigint): Promise<boolean> => {
      if (!walletAddress || !publicClient || !PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x')
        return false

      try {
        const result = await publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'isWhitelisted',
          args: [walletAddress as `0x${string}`, seasonId],
        })
        setIsWhitelisted(result as boolean)
        return result as boolean
      } catch (err) {
        console.error('[usePassSBT] checkWhitelist error:', err)
        return false
      }
    },
    [walletAddress, publicClient],
  )

  const getSeasonInfo = useCallback(
    async (seasonId: bigint): Promise<SeasonInfo | null> => {
      if (!publicClient || !PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x') return null

      try {
        const result = await publicClient.readContract({
          address: PASS_SBT_ADDRESS,
          abi: PASS_SBT_ABI,
          functionName: 'getSeasonInfo',
          args: [seasonId],
        })
        const [supply, minted, startDate, endDate] = result as [bigint, bigint, bigint, bigint]
        return { supply, minted, startDate, endDate }
      } catch (err) {
        console.error('[usePassSBT] getSeasonInfo error:', err)
        return null
      }
    },
    [publicClient],
  )

  // v2.1 flexible-payment paid-mint flow, replacing the old
  // approve()+mintPaidPass() USDm-only path:
  //   1. detect which of USDm/USDC/USDT the wallet holds the most of
  //   2. send 0.30 USD equivalent of that token to TREASURY_WALLET (plain
  //      transfer(), same as Marketplace purchases)
  //   3. POST the tx hash to /api/passsbt/mint, which verifies the payment
  //      on-chain and then calls PassSBTv2.backendMintPass() to actually
  //      hand over the soulbound NFT
  // The price is shown to the player token-agnostically as a plain USD amount
  // read LIVE from the contract (passPriceUsd above, see SeasonPassCard.tsx)
  // since all 3 accepted tokens are 1:1 USD-pegged — only the token actually
  // charged varies based on the wallet's balances.
  const mintPaidPassFlexible = useCallback(
    async (seasonId: bigint): Promise<{ success: boolean; mintTxHash: `0x${string}` }> => {
      // The message the owner actually hit in the OKX browser. walletClient is
      // undefined on any chain but Celo — wagmi's getConnectorClient throws
      // ConnectorChainMismatchError, useWalletClient swallows it into
      // `data: undefined` — so "not connected" was reported to someone whose
      // wallet was connected and one tap from working. Name the real problem.
      if (wrongNetwork) {
        throw new Error('Wrong network — NullState runs on Celo. Switch your wallet to Celo and try again.')
      }
      if (!walletClient || !publicClient || !walletClient.account) {
        throw new Error('Wallet not connected')
      }

      setIsLoading(true)
      setError(null)
      setInsufficientFunds(false)
      setMintTxPhase('paying')

      try {
        const token = await pickBestPaymentToken(publicClient, walletClient.account.address)
        setPayingToken(token)

        // v3: price read live from PassSBTv3.passPriceUsdCents instead of
        // a hardcoded constant, so the amount the user pays always matches
        // what the backend will verify (see getPassPriceUsd in
        // lib/contract-abi.ts).
        const passPriceUsd = await getPassPriceUsd(publicClient)
        const payTxHash = await payToTreasury(Number(passPriceUsd), token)

        setMintTxPhase('verifying')
        const res = await fetch('/api/passsbt/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: walletClient.account.address,
            txHash: payTxHash,
            seasonId: seasonId.toString(),
            token,
          }),
        })

        setMintTxPhase('minting')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to verify payment and mint pass')

        await fetchPassStatus()
        return { success: true, mintTxHash: data.mintTxHash as `0x${string}` }
      } catch (err) {
        // payToTreasury already routes wallet/RPC errors through the shared
        // friendly-error translator and sets insufficientFunds itself; a
        // failure from our own /api/passsbt/mint call surfaces here as a
        // plain Error with the server's message, which is already
        // human-readable (see route.ts's NextResponse.json({ error }) calls).
        const message = (err as Error)?.message ?? 'Failed to mint pass'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
        setMintTxPhase('idle')
        setPayingToken(null)
      }
    },
    [walletClient, publicClient, payToTreasury, fetchPassStatus, wrongNetwork],
  )

  useEffect(() => {
    if (walletAddress) fetchPassStatus()
  }, [walletAddress, fetchPassStatus])

  // TASK #7: fetch the live on-chain price once the public client is ready, so
  // the mint button shows the real charge amount (e.g. "$10") rather than a
  // hardcoded label. Read-only; independent of wallet connection.
  useEffect(() => {
    let cancelled = false
    if (!publicClient || !PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x') return
    getPassPriceUsd(publicClient)
      .then((usd) => { if (!cancelled) setPassPriceUsd(usd) })
      .catch(() => { /* leave null — the card falls back to a plain label */ })
    return () => { cancelled = true }
  }, [publicClient])

  return {
    hasPass,
    passSeasonId,
    isWhitelisted,
    isLoading,
    error,
    insufficientFunds,
    addCashUrl: insufficientFunds ? MINIPAY_ADD_CASH_URL : null,
    mintTxPhase,
    payingToken,
    passPriceUsd,
    fetchPassStatus,
    checkWhitelist,
    getSeasonInfo,
    mintPaidPassFlexible,
  }
}
