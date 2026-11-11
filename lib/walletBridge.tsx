'use client'

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'
import type { Account, PublicClient, Transport, WalletClient } from 'viem'

// The Celo chain TYPE, not the value. `typeof import(...)` is erased at
// compile time, so viem/chains never enters this module's runtime graph and
// the wagmi split stays intact — but the client below keeps Celo's formatters,
// which is what makes `feeCurrency` (CIP-64 fee abstraction) a known field on
// writeContract/sendTransaction. Typed as a plain WalletClient it is not, and
// every call site that pays gas in a stablecoin stops compiling.
type CeloChain = typeof import('viem/chains').celo
import type { MarketplaceTokenSymbol } from './constants/tokens'

// ─── Why a bridge sits between the app and wagmi ─────────────────────────────
// wagmi + viem is 350KB of the 1.14MB of JavaScript /game used to load before
// it could show anything — its single largest chunk, and PageSpeed measured
// most of it as unused at that point. Fair: the world map needs a wallet for
// exactly nothing. Nobody has bought, minted or crafted yet; they are looking
// at a map.
//
// It could not simply be deferred, because useWallet() called wagmi's hooks
// directly and hooks cannot be called conditionally — no WagmiProvider above
// them means a thrown error, not a graceful default. So the wallet's SHAPE is
// defined here, in a plain React context with no dependencies, and wagmi is
// mounted later as a sibling that publishes into it.
//
// Two consequences worth stating:
//  · Before wagmi mounts, useWallet() returns a coherent disconnected wallet.
//    Reads are correct; the actions throw NOT_READY rather than pretending to
//    have sent something. A caller that can reach a payment must gate on
//    `ready` (Web3Gate does this for the two screens that can).
//  · Children never move in the tree when wagmi arrives. It mounts BESIDE
//    them, not around them, so nothing unmounts, no state is lost and no
//    effect runs twice — which is what a naive `ready ? <Provider>…` would do.

export interface WalletBridgeValue {
  /** True once wagmi is mounted and the actions below can actually run. */
  ready: boolean
  address: string | null
  isConnected: boolean
  chainId: number | null
  isMiniPay: boolean
  /**
   * Connected, but the wallet is sitting on some other chain.
   *
   * NOT a cosmetic flag. wagmi's getConnectorClient throws
   * ConnectorChainMismatchError when the connector's chain is not the one
   * asked for, so useWalletClient({chainId: CELO}) resolves to undefined and
   * every payment path fails its `!walletClient` guard — which used to report
   * "Wallet not connected" to somebody whose wallet was perfectly connected.
   * OKX and most browser wallets open on their own default chain, so this is
   * the normal state for them until the switch lands. MiniPay is Celo-only and
   * can never be in it.
   */
  wrongNetwork: boolean
  celoBalance: string
  error: string | null
  insufficientFunds: boolean
  addCashUrl: string | null
  /** Read-only chain client, for balance checks. Null until wagmi mounts.
   *  Carried here so screens that only READ the chain (picking which
   *  stablecoin a player holds most of) don't have to sit inside
   *  WagmiProvider — which, now that wagmi mounts beside the app rather than
   *  around it, they no longer do. A type-only import, so viem stays out of
   *  this module's runtime graph. */
  publicClient: PublicClient | null
  /** Signing client, for the one on-chain write the app does outside
   *  payToTreasury: the Season Pass mint. Null until wagmi mounts. */
  walletClient: WalletClient<Transport, CeloChain, Account> | null
  connect: () => Promise<void>
  disconnect: () => void
  switchToCelo: () => Promise<void>
  payUsdmFee: (amountWei: bigint, toAddress: `0x${string}`) => Promise<string>
  payToTreasury: (priceUsd: number, token: MarketplaceTokenSymbol) => Promise<string>
}

const notReady = async (): Promise<never> => {
  throw new Error('Wallet is still loading — try again in a moment')
}

export const WALLET_BRIDGE_DEFAULT: WalletBridgeValue = {
  ready: false,
  address: null,
  isConnected: false,
  chainId: null,
  isMiniPay: false,
  wrongNetwork: false,
  celoBalance: '0.00',
  error: null,
  insufficientFunds: false,
  addCashUrl: null,
  publicClient: null,
  walletClient: null,
  connect: async () => {},
  disconnect: () => {},
  switchToCelo: async () => {},
  payUsdmFee: notReady,
  payToTreasury: notReady,
}

const ValueContext = createContext<WalletBridgeValue>(WALLET_BRIDGE_DEFAULT)
const PublishContext = createContext<(v: WalletBridgeValue) => void>(() => {})

export function useWalletBridge() {
  return useContext(ValueContext)
}

/** Used only by the wagmi island to push its state down. */
export function useWalletPublish() {
  return useContext(PublishContext)
}

export function WalletBridgeProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<WalletBridgeValue>(WALLET_BRIDGE_DEFAULT)
  // Stable identity: the island re-publishes on every account change, and an
  // unstable setter would make its effect fire on every render instead.
  const publish = useCallback((v: WalletBridgeValue) => setValue(v), [])
  const memo = useMemo(() => value, [value])

  return (
    <PublishContext.Provider value={publish}>
      <ValueContext.Provider value={memo}>{children}</ValueContext.Provider>
    </PublishContext.Provider>
  )
}
