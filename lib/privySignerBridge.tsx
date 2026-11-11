'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Account, Transport, WalletClient } from 'viem'

// The X Layer chain TYPE, not the value — same erased-`typeof import(...)`
// pattern as lib/walletBridge.tsx, so viem stays out of this module's
// runtime graph.
type XLayerChain = typeof import('./xlayerRpc').xLayerChain

// ─── The Privy signer, published rather than wrapped ─────────────────────────
//
// OWNER: *"kedepannya aku gatau bakal ada org yg buka game ku lewat browser dan
// konek privy, jadi harus bisa pembayaran juga lewat privy."*
//
// The obvious way to do that is what Chessify does — wrap the whole app in
// PrivyProvider (see src/app/providers.tsx in jadonamite/playchessify). We
// cannot: that ships the Privy SDK to every player on every route, for a
// screen most of them are never shown, on the connections least able to afford
// the download. It is the same reason lib/walletBridge.tsx exists for wagmi.
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
// never need gas. This app does not: gas is paid in OKB, the native token,
// and the player keeps a small OKB balance for it. A player holding only USDT
// still needs that OKB — the shop says so when the balance is short, rather
// than hiding it behind a sponsor. Owner's call: no smart wallet, no bundler,
// no extra service to keep funded.

/** The Privy app id, or null when it is not configured. */
export function privyAppId(): string | null {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

export interface PrivySignerValue {
  /** True once the island has mounted and Privy has settled. */
  ready: boolean
  /**
   * The embedded wallet's address — a REAL key the player controls, and the
   * only address here that can sign. Null when the player has no Privy wallet.
   */
  address: `0x${string}` | null
  /** Signing client for that wallet, pinned to X Layer. Null until it exists. */
  walletClient: WalletClient<Transport, XLayerChain, Account> | null
  /**
   * Send `priceUsd` of a stablecoin to the treasury from the embedded wallet.
   *
   * Mirrors the bridge's own payToTreasury so the shop can call one shape and
   * not care which wallet is paying. Implemented inside the LAZY island rather
   * than here on purpose: doing the encoding in this file would pull viem into
   * the main bundle, which is the exact cost lib/WagmiIsland.tsx exists to
   * avoid — and a player who never signs in with Google must not pay for a
   * code path they can never reach.
   *
   * Gas is paid in OKB, the native token, so the embedded wallet needs a
   * small OKB balance to spend — same as any other wallet here.
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
