'use client'

import { useEffect } from 'react'
import { useWallets, getEmbeddedConnectedWallet } from '@privy-io/react-auth'
import { createWalletClient, custom, encodeFunctionData } from 'viem'
import { xLayerChain } from '@/lib/xlayerRpc'
import { usePrivySignerPublish, PRIVY_SIGNER_DEFAULT } from '@/lib/privySignerBridge'
import { ERC20_ABI } from '@/lib/contract-abi'
import {
  MARKETPLACE_TOKENS, TREASURY_WALLET, parseTokenAmount,
  type MarketplaceTokenSymbol,
} from '@/lib/constants/tokens'

// ─── Turning a Privy embedded wallet into something that can pay ─────────────
//
// Renders nothing. It lives inside PrivyProvider, reads the embedded wallet,
// builds a viem WalletClient from its EIP-1193 provider, and publishes it into
// lib/privySignerBridge so screens outside the provider can spend from it.
//
// ── WHY viem DIRECTLY, RATHER THAN @privy-io/wagmi ──────────────────────────
//
// Chessify uses @privy-io/wagmi, which replaces wagmi's own WagmiProvider so
// Privy wallets appear as connectors. That is the right call in an app with ONE
// provider tree. This app has two on purpose: lib/WagmiIsland.tsx serves
// browser wallets and must keep working with zero Privy code loaded, and
// mounting a second, competing WagmiProvider beside it is how you get two
// sources of truth for "which wallet is connected".
//
// A viem client built straight from the provider avoids that entirely. It is
// also less code: everything downstream — payToTreasury, usePassSBT,
// useReward — already takes a WalletClient and does not care where it came
// from.
//
// ── X LAYER, ASSERTED RATHER THAN ASSUMED ───────────────────────────────────
//
// The provider is pinned to X Layer, and the wallet is asked to switch first
// if it is anywhere else. Privy's own docs are explicit that switchChain does
// NOT update providers already handed out, so the provider is requested AFTER
// the switch — asking in the other order returns a client that still signs for
// the old chain, which is exactly the failure the owner hit in the OKX browser.

export default function PrivySignerPublisher() {
  const { wallets, ready } = useWallets()
  const publish = usePrivySignerPublish()

  useEffect(() => {
    let cancelled = false
    if (!ready) { publish(PRIVY_SIGNER_DEFAULT); return }

    const wallet = getEmbeddedConnectedWallet(wallets) ?? wallets[0] ?? null
    if (!wallet) { publish({ ...PRIVY_SIGNER_DEFAULT, ready: true }); return }

    ;(async () => {
      try {
        // Order matters — see the note above. Switch, THEN take the provider.
        if (wallet.chainId !== `eip155:${xLayerChain.id}`) {
          await wallet.switchChain(xLayerChain.id)
        }
        const provider = await wallet.getEthereumProvider()
        if (cancelled) return
        const address = wallet.address as `0x${string}`
        const walletClient = createWalletClient({
          account: address,
          chain: xLayerChain,
          transport: custom(provider),
        })
        // The same transfer WagmiIsland's payToTreasury builds, from the same
        // constants — one treasury address, one token table. Only the signer
        // differs, which is the entire point. Gas is paid in OKB, so the
        // embedded wallet needs a small OKB balance to spend.
        const payToTreasury = async (priceUsd: number, token: string): Promise<string> => {
          const sym = token as MarketplaceTokenSymbol
          const cfg = MARKETPLACE_TOKENS[sym]
          if (!cfg) throw new Error('Unsupported token')
          const amountWei = parseTokenAmount(String(priceUsd), sym)
          if (amountWei <= BigInt(0)) throw new Error('Invalid price')
          const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [TREASURY_WALLET as `0x${string}`, amountWei],
          })
          return walletClient.sendTransaction({
            account: address,
            chain: xLayerChain,
            to: cfg.address as `0x${string}`,
            data,
            value: BigInt(0),
          })
        }
        publish({ ready: true, address, walletClient, payToTreasury })
      } catch {
        // A wallet that will not move to X Layer cannot pay here, and saying so by
        // publishing nothing is better than publishing a client that fails on
        // every send. The player keeps their account and their progress either
        // way — this only ever gates spending.
        if (!cancelled) publish({ ...PRIVY_SIGNER_DEFAULT, ready: true })
      }
    })()

    return () => { cancelled = true }
    // wallets is a new array identity on most renders, so the effect keys on
    // the two things that actually change the answer.
  }, [ready, wallets, publish])

  return null
}
