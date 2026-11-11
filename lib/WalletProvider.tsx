'use client'

// NOTHING FROM wagmi OR viem MAY BE IMPORTED HERE. This module sits on /game's
// first-load path (useWallet is called by the world map), and a single eager
// import of wagmi from anywhere on that path pulls all 350KB of it back into
// the initial chunk, undoing the split in lib/Web3Providers.tsx. Everything
// that needs them lives in lib/WagmiIsland.tsx.
import { ReactNode, useMemo } from 'react'
import { NavbarWalletContext } from './NavbarWalletContext'
import { useWalletBridge } from './walletBridge'
import type { MarketplaceTokenSymbol } from './constants/tokens'
// Both are deliberately dependency-free (no firebase, no wagmi) precisely so
// they can be imported here without violating the rule above.
import { GUEST_STORAGE_KEY, generateAutoUsername } from './guestIdentity'
import { writeCachedProfile } from './profileCache'
import { getStoredAuthAddress } from './authIdentity'
import { usePrivySigner } from './privySignerBridge'

// ─── Contract config ─────────────────────────────────────────────────────────

export const NULLSTATE_ADDRESS  = '0xE6C471DD3C715DB8B10457113867885AFA12eC13' as `0x${string}`
export const CELO_CHAIN_ID      = 42220
export const CELO_SEPOLIA_CHAIN_ID = 11142220

// Phase 0: NullState.sol has been RETIRED — combat/registration are fully
// off-chain and NULL_STRIKE is FREE. The old game ABI is intentionally empty;
// the `payUsdmFee()` helper below remains a generic ERC20 transfer used by
// other flows, not by NULL_STRIKE.
export const NULLSTATE_ABI = [] as const

// ─── Types ───────────────────────────────────────────────────────────────────
// NOTE (removed 2026-07-12): `ExecuteActionParams`, `PlayerData`, and
// `RaidData` were only used by the dead functions removed above (see the
// NOTE comments further down this file) — deleted alongside them.

// Extra context values that GameFullUI expects beyond wagmi hooks
interface WalletExtras {
  isMiniPay: boolean
  celoBalance: string
  error: string | null
  insufficientFunds: boolean
  addCashUrl: string | null
  // Plain ERC20 USDm transfer() to an arbitrary address (e.g. the reward
  // contract, to fund the weekly pool for a NULL_STRIKE cast). Does NOT
  // touch NullState.sol / executeAction.
  payUsdmFee: (amountWei: bigint, toAddress: `0x${string}`) => Promise<string>
  // Marketplace purchase: plain ERC20 transfer() of `priceUsd` worth of the
  // chosen stablecoin (USDm/USDC/USDT) to the treasury wallet. No contract.
  buyMarketplaceItem: (priceUsd: number, token: MarketplaceTokenSymbol) => Promise<string>
  // Same function as buyMarketplaceItem, generic name — used by PassSBT
  // minting (usePassSBT.ts) so that call site doesn't read like it's
  // buying a marketplace item.
  payToTreasury: (priceUsd: number, token: MarketplaceTokenSymbol) => Promise<string>
}

// ─── Guest identity (no-wallet play) ─────────────────────────────────────────
// So the game can be REGISTERED and PLAYED without connecting a wallet — needed
// for the MiniPay listing review (the Celo team may open it in a plain Chrome
// tab or MiniPay dev mode) and for anyone just trying it out. We mint a stable,
// wallet-SHAPED id (0x + 40 hex) once and keep it in localStorage, so every
// Firebase-keyed route (username, saves, materials, energy — all validate
// /^0x[0-9a-f]{40}$/) accepts it exactly like a real wallet. It is NEVER an
// on-chain account: it can't sign or send transactions, so buying and
// leaderboard entry are gated off for guests (see `isGuest` / `realAddress`).
const GUEST_KEY = GUEST_STORAGE_KEY
function getGuestAddress(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const existing = localStorage.getItem(GUEST_KEY)
    if (existing && /^0x[0-9a-fA-F]{40}$/.test(existing)) return existing.toLowerCase()
    const bytes = new Uint8Array(20)
    ;(window.crypto || (window as unknown as { msCrypto: Crypto }).msCrypto).getRandomValues(bytes)
    const id = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(GUEST_KEY, id)

    // FIRST PAINT — the one branch where the name needs no network.
    //
    // The world map's LCP element is the player's name. For a returning visitor
    // profileCache already answers instantly, but a first-ever open has empty
    // storage, so the plate waits on /api/player/identity: PageSpeed measured
    // 2,500ms of element render delay against an LCP of 6.1s. That route's
    // answer for an address with no username is generateAutoUsername(address) —
    // a pure function of the address we are holding right here.
    //
    // This line is the only place that can know the derived name is definitely
    // correct: the id did not exist a moment ago, so nothing can have set a
    // custom name for it. Seeding anywhere later would have to guess, and a
    // guess that lost would rename the player on screen — the exact thing the
    // skeleton was added to stop.
    //
    // The live fetch still runs and still overwrites this; it just no longer
    // has anything waiting on it.
    writeCachedProfile({
      walletAddress: id,
      username: generateAutoUsername(id),
      xp: 0,
      level: 1,
      kills: 0,
      isRegistered: true,
    })

    return id
  } catch { return null }
}

// ─── Convenience hook (keeps GameFullUI API unchanged) ────────────────────────
// Reads the bridge, never wagmi. That is the whole point: this hook is called
// from the world map, which now renders before wagmi has loaded (see
// lib/walletBridge.tsx). Calling wagmi hooks here would make that impossible —
// hooks cannot be skipped, and without a WagmiProvider above them they throw.
export function useWallet() {
  const w = useWalletBridge()

  // No-wallet fallback: hand back a wallet-shaped id as `address` so all
  // Firebase-keyed flows (save, username, materials, energy) work unchanged.
  // `realAddress` stays null so on-chain paths — purchases, leaderboard entry —
  // can be gated off exactly as before.
  //
  // Three tiers, most-authoritative first:
  //
  //   realAddress  a wallet. Can sign, so it is the only one that can pay or
  //                claim. Always wins — a signed-in player who connects a
  //                wallet is telling us which identity they mean.
  //   authAddress  a Firebase account, as an address (see lib/authIdentity.ts).
  //                Cannot sign, but is the same on every device they sign in
  //                on, which is the whole reason the account exists.
  //   guestAddress a random local id. Cannot sign and dies with localStorage.
  //
  // The guest id is only minted when the first two are absent — otherwise
  // signing in would leave a stray guest identity behind it, and the next
  // sign-out would land the player on a stranger's progress.
  const privy = usePrivySigner()
  const realAddress = w.address ?? null
  const pay = w.walletClient ? w.payToTreasury : (privy.payToTreasury ?? w.payToTreasury)
  const authAddress = realAddress ? null : getStoredAuthAddress()
  const guestAddress = realAddress || authAddress ? null : getGuestAddress()
  const isGuest = !realAddress && !!guestAddress

  return {
    address:      realAddress ?? authAddress ?? guestAddress ?? null,
    realAddress,
    isGuest,
    /** Signed into a Firebase account. Still cannot sign a transaction. */
    isSignedIn:   !realAddress && !!authAddress,
    chainId:      w.chainId,
    isConnected:  w.isConnected,
    // True while wagmi itself is still loading, which is the honest answer to
    // "are we in the middle of working out the wallet situation".
    isConnecting: !w.ready,
    walletReady:  w.ready,
    isMiniPay:    w.isMiniPay,
    // Connected, wrong chain. Screens that can spend need this because it is
    // the difference between "you have no wallet" and "your wallet is one tap
    // away from working" — and until now both reported the former.
    wrongNetwork: w.wrongNetwork,
    celoBalance:  w.celoBalance,
    error:        w.error,
    insufficientFunds: w.insufficientFunds,
    addCashUrl:   w.addCashUrl,
    publicClient: w.publicClient,
    // ── WHICH WALLET SIGNS ────────────────────────────────────────────────
    //
    // wagmi's, whenever there is one. A player who connected MiniPay or a
    // browser wallet has told us which wallet they mean, and that answer
    // outranks an embedded wallet they may not even know they have.
    //
    // Privy's only when wagmi has none. That is the Google/email player, whose
    // embedded wallet is the only thing they can sign with.
    //
    // Note what does NOT change: `address` above. The save is keyed on the
    // account address derived in lib/authIdentity.ts, and re-keying it onto the
    // embedded wallet would orphan every document already stored under it. The
    // embedded wallet is where money comes FROM; it is not who the player IS.
    walletClient: w.walletClient ?? privy.walletClient,
    connect:      w.connect,
    disconnect:   w.disconnect,
    switchToCelo: w.switchToCelo,
    payUsdmFee:   w.payUsdmFee,
    // Same precedence, same reason. `pay` resolves to wagmi's payToTreasury
    // unless there is no wagmi wallet and Privy has published one of its own —
    // implemented in the lazy island so viem never reaches this module.
    buyMarketplaceItem: pay, // kept for MarketplaceScreen.tsx, unchanged behavior
    payToTreasury: pay,
  }
}

// ─── Public WalletProvider ───────────────────────────────────────────────────
// Provides NavbarWalletContext from the bridge. It used to be fed by wagmi
// hooks directly, which meant this component could not exist until wagmi did.

export default function WalletProvider({ children }: { children: ReactNode }) {
  const w = useWalletBridge()
  const navbarWallet = useMemo(() => ({
    isConnected: w.isConnected,
    address: w.address,
    isMiniPay: w.isMiniPay,
    error: w.error,
    addCashUrl: w.addCashUrl,
  }), [w.isConnected, w.address, w.isMiniPay, w.error, w.addCashUrl])

  return (
    <NavbarWalletContext.Provider value={navbarWallet}>
      {children}
    </NavbarWalletContext.Provider>
  )
}
