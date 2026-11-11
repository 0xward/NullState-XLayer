'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { xLayerTestnetChain } from '@/lib/xlayerRpc'
import { privyAppId } from '@/lib/privySignerBridge'
import PrivySignerPublisher from './PrivySignerPublisher'

// ─── The one PrivyProvider that outlives the login screen ────────────────────
//
// OWNER: *"harus bisa pembayaran juga lewat privy."*
//
// A login screen is short-lived — it unmounts the moment the player is signed
// in — so a provider that lived only inside it could not sign anything an hour
// later at the shop. This mounts beside the app (lib/Web3Providers.tsx) and
// stays for the session.
//
// It renders NO UI at all. Everything it knows reaches the rest of the app
// through lib/privySignerBridge, which is why nothing remounts when it arrives
// a second after the map.
//
// The config is pinned to X Layer Testnet — `defaultChain` decides where an embedded
// wallet is CREATED, `supportedChains` is what an external wallet is asked to
// be on — using the same chain object lib/WagmiIsland.tsx gives wagmi, so
// there is exactly one idea of which network this game runs on.

export default function PrivySignerIsland() {
  const appId = privyAppId()
  // No credential, no provider. A deployment without an app id falls back to
  // the ordinary flow rather than rendering a login that cannot complete;
  // the same rule has to hold here, or Privy throws on mount for a deployment
  // that forgot the id.
  if (!appId) return null
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['google', 'email', 'wallet'],
        appearance: { theme: 'dark', accentColor: '#39ff9a' },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: xLayerTestnetChain,
        supportedChains: [xLayerTestnetChain],
      }}
    >
      <PrivySignerPublisher />
    </PrivyProvider>
  )
}
