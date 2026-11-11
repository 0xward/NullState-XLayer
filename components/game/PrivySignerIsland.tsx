'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { celo } from 'viem/chains'
import { privyAppId } from '@/lib/privyGateFlag'
import PrivySignerPublisher from './PrivySignerPublisher'

// ─── The one PrivyProvider that outlives the login screen ────────────────────
//
// OWNER: *"harus bisa pembayaran juga lewat privy."*
//
// The gate screen is short-lived — it unmounts the moment the player is signed
// in — so a provider that lived only inside it could not sign anything an hour
// later at the shop. This mounts beside the app (lib/Web3Providers.tsx) and
// stays for the session.
//
// It renders NO UI at all. Everything it knows reaches the rest of the app
// through lib/privySignerBridge, which is why nothing remounts when it arrives
// a second after the map.
//
// The config is deliberately the same object shape PrivyGate uses. Both are
// pinned to Celo — `defaultChain` decides where an embedded wallet is CREATED,
// `supportedChains` is what an external wallet is asked to be on — and both use
// the same `celo` from viem/chains that lib/WagmiIsland.tsx gives wagmi, so
// there is exactly one idea of which network this game runs on.

export default function PrivySignerIsland() {
  const appId = privyAppId()
  // No credential, no provider. The gate treats a missing app id as "off"
  // rather than rendering a login that cannot complete; the same rule has to
  // hold here, or Privy throws on mount for a deployment that set the flag and
  // forgot the id.
  if (!appId) return null
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['google', 'email', 'wallet'],
        appearance: { theme: 'dark', accentColor: '#39ff9a' },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: celo,
        supportedChains: [celo],
      }}
    >
      <PrivySignerPublisher />
    </PrivyProvider>
  )
}
