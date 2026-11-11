'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Account, Transport, WalletClient } from 'viem'
import type { Chain as CeloChain } from 'viem'

// ─── The Privy signer, published rather than wrapped ─────────────────────────
//
// OWNER: *"kedepannya aku gatau bakal ada org yg buka game ku lewat browser dan
// konek privy, jadi harus bisa pembayaran juga lewat privy."*
//
// The obvious way to do that is what Chessify does — wrap the whole app in
// PrivyProvider (see src/app/providers.tsx in jadonamite/playchessify). We
// cannot: that ships the Privy SDK to every MiniPay player, for a screen they
// are never shown, on the connections least able to afford the download. It is
// the same reason lib/walletBridge.tsx exists for wagmi.
//
// So this is walletBridge's shape again, one layer over: a context that is
// ALWAYS mounted and costs nothing (no Privy import anywhere in this file), and
// an island that mounts the SDK beside the app and publishes into it. Nothing
// remounts when Privy arrives a second later, and with the gate off nothing is
// downloaded at all.
//
// ── WHAT IS PUBLISHED, AND WHAT IS DELIBERATELY NOT ─────────────────────────
//
// A signer. Not an identity.
//
// The player's save is keyed on the address in lib/authIdentity.ts — SHA-256 of
// their Privy id — and that must not change just because they now also have an
// embedded wallet: re-keying would orphan every document already stored under
// the old address. So the embedded wallet appears here as somewhere money can
// come FROM, while `address` in WalletProvider keeps meaning who the player IS.
//
// ── AND WHY THERE IS NO SMART WALLET HERE ───────────────────────────────────
//
// Chessify pairs Privy with ERC-4337 and a Pimlico bundler so social players
// never need gas. On Celo that is a solution to a problem the chain already
// solved: CIP-64 lets gas be paid in a stablecoin, and this app already does it
// (pickBestFeeCurrency in lib/constants/tokens.ts). A player holding only USDT
// can pay for a $1 item with no CELO, no bundler, no sponsor, and no extra
// service to keep funded. Owner's call: *"lanjut pakai CIP-64 aja, jangan smart
// wallet."*

export interface PrivySignerValue {
  /** True once the island has mounted and Privy has settled. */
  ready: boolean
  /**
   * The embedded wallet's address — a REAL key the player controls, and the
   * only address here that can sign. Null when the player has no Privy wallet.
   */
  address: `0x${string}` | null
  /** Signing client for that wallet, pinned to Celo. Null until it exists. */
  walletClient: WalletClient<Transport, CeloChain, Account> | null
  /**
   * Send `priceUsd` of a stablecoin to the treasury from the embedded wallet.
   *
   * Mirrors the bridge's own payToTreasury so the shop can call one shape and
   * not care which wallet is paying. Implemented inside the LAZY island rather
   * than here on purpose: doing the encoding in this file would pull viem into
   * the main bundle, which is the exact cost lib/WagmiIsland.tsx exists to
   * avoid — and a MiniPay player must not pay for a code path they can never
   * reach.
   *
   * Gas is paid in the same stablecoin (CIP-64), so a player holding only USDT
   * needs no CELO. That is why this needs no smart wallet and no sponsor.
   */
  payToTreasury: ((priceUsd: number, token: string) => Promise<string>) | null
}

export const PRIVY_SIGNER_DEFAULT: PrivySignerValue = {
  ready: false,
  address: null,
  walletClient: null,
  payToTreasury: null,
}

const ValueContext = createContext<PrivySignerValue>(PRIVY_SIGNER_DEFAULT)
const PublishContext = createContext<(v: PrivySignerValue) => void>(() => {})

/** Read the Privy signer. Safe anywhere — returns the default until it exists. */
export function usePrivySigner(): PrivySignerValue {
  return useContext(ValueContext)
}

/** The island's end of the bridge. */
export function usePrivySignerPublish() {
  return useContext(PublishContext)
}

export function PrivySignerBridgeProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<PrivySignerValue>(PRIVY_SIGNER_DEFAULT)
  // The publisher is stable, so the island's effect does not re-fire on every
  // render of this provider — the same guarantee walletBridge makes.
  const publish = useMemo(() => setValue, [])
  return (
    <PublishContext.Provider value={publish}>
      <ValueContext.Provider value={value}>{children}</ValueContext.Provider>
    </PublishContext.Provider>
  )
}
