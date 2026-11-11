'use client'

/**
 * Web3Providers.tsx
 *
 * The wallet layer for /game and /profile. What it no longer does is pull wagmi
 * + viem into the route's first load: that was 350KB raw, the single largest
 * chunk on /game, and PageSpeed measured most of it as unused at first paint.
 * It is unused, because the world map needs a wallet for nothing — nobody has
 * bought, minted or crafted yet, they are looking at a map.
 *
 * SHAPE: children are wrapped by the bridge and by WalletProvider, both of
 * which are dependency-free and render immediately. wagmi mounts as a SIBLING
 * of the children a moment later and publishes into the bridge. That sibling
 * position is deliberate — the obvious `ready ? <WagmiProvider>{children}` form
 * would move every child in the tree the instant wagmi arrived, unmounting the
 * world map and re-running every effect under it.
 *
 * TIMING: requestIdleCallback with a 1500ms ceiling. Idle so it never competes
 * with the map's own paint; the ceiling so a busy main thread cannot postpone
 * it indefinitely and leave someone unable to buy anything. Nothing that spends
 * money is reachable in under a second and a half — Shop, Craft and Pass are
 * two taps away — and if one ever were, useWallet()'s pay actions throw rather
 * than silently doing nothing.
 *
 * No manual connect button anywhere in the UI — connection is silent on
 * load. Only the injected connector is registered.
 */

import { ReactNode, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import WalletProvider from '@/lib/WalletProvider'
import { WalletBridgeProvider } from '@/lib/walletBridge'
import { PrivySignerBridgeProvider, privyAppId } from '@/lib/privySignerBridge'

// ssr:false because a wallet cannot exist on the server; it is also what keeps
// the wagmi chunk out of the server-rendered payload entirely.
const WagmiIsland = dynamic(() => import('@/lib/WagmiIsland'), { ssr: false })

// ─── The Privy signer island ────────────────────────────────────────────────
//
// Beside the app, never around it — the same rule WagmiIsland follows, and for
// the same reason: mounting a provider around the tree later would remount
// every child and lose their state.
//
// Loaded only when a Privy app id is configured. With no app id there is no
// Privy session to restore and no embedded wallet to keep alive, so nothing
// is downloaded at all.
//
// It renders no UI. Its only job is to keep a Privy signer alive for the rest
// of the session, so a player who signed in with Google an hour ago can still
// pay at the shop.
const PrivySignerIsland = dynamic(() => import('@/components/game/PrivySignerIsland'), { ssr: false })

const IDLE_CEILING_MS = 1500

function DeferredWagmi() {
  const [mount, setMount] = useState(false)

  useEffect(() => {
    const go = () => setMount(true)
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: IDLE_CEILING_MS })
      return () => w.cancelIdleCallback?.(id)
    }
    // Safari has no requestIdleCallback. A short timer is close enough — the
    // point is "after the first paint", not a precise moment.
    const t = setTimeout(go, 300)
    return () => clearTimeout(t)
  }, [])

  return mount ? <WagmiIsland /> : null
}

function DeferredPrivySigner() {
  const [mount, setMount] = useState(false)
  useEffect(() => {
    // Read in an effect, not during render: /game is prerendered, and the
    // app id is an env var compiled into the bundle — the check itself is
    // synchronous, but mounting a provider during render is not.
    if (privyAppId()) setMount(true)
  }, [])
  return mount ? <PrivySignerIsland /> : null
}

export default function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WalletBridgeProvider>
      <PrivySignerBridgeProvider>
        <WalletProvider>{children}</WalletProvider>
        <DeferredWagmi />
        <DeferredPrivySigner />
      </PrivySignerBridgeProvider>
    </WalletBridgeProvider>
  )
}
