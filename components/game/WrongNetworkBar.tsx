'use client'

import { useCallback, useState } from 'react'
import { useWallet } from '@/lib/WalletProvider'

// ─── Connected, but not on Celo ──────────────────────────────────────────────
//
// OWNER, testing in the OKX in-app browser: *"posisi auto connect tapi gabisa
// mint pass dan buy ada tulisan 'wallet not connected'."*
//
// His wallet was connected. It was on OKX's default chain, and wagmi's
// getConnectorClient throws ConnectorChainMismatchError when the connector's
// chain is not the one asked for — so useWalletClient({chainId: CELO}) resolved
// to undefined and every payment reported a connection problem that did not
// exist.
//
// WagmiIsland now asks the wallet to switch the moment it lands on the wrong
// chain, which fixes it for anyone who taps Approve. This bar is for the rest:
// someone who declined, or a wallet that ignores the request. It says the true
// thing and gives them the one control that fixes it.
//
// Rendered only on the three screens that can actually spend. Not global,
// because a player who never opens the shop does not need to be told which
// chain the shop wants — and never inside MiniPay, which cannot reach this
// state at all.
//
// The copy deliberately avoids the phrase check:copy bans. It also names Celo
// rather than saying "wrong network", because "wrong" without a target is a
// complaint rather than an instruction.

export default function WrongNetworkBar() {
  const { wrongNetwork, switchToCelo } = useWallet()
  const [busy, setBusy] = useState(false)

  const onSwitch = useCallback(async () => {
    setBusy(true)
    try {
      await switchToCelo()
    } finally {
      // The wallet owns the prompt, so there is nothing to await past the
      // request. Clearing shortly after keeps a declined prompt from leaving
      // the button stuck.
      setTimeout(() => setBusy(false), 1200)
    }
  }, [switchToCelo])

  if (!wrongNetwork) return null

  return (
    <div className="mb-4 rounded border border-[#e8bd6f]/40 bg-[#e8bd6f]/10 p-3 font-mono text-sm text-[#f2cd82]">
      <div>Your wallet is on another network. NullState runs on Celo.</div>
      <button
        type="button"
        onClick={onSwitch}
        disabled={busy}
        className="mt-2 inline-block rounded border border-[#f2cd82]/60 px-3 py-1 text-xs uppercase tracking-wider text-[#f2cd82] disabled:opacity-50"
      >
        {busy ? 'Asking your wallet…' : 'Switch to Celo'}
      </button>
    </div>
  )
}
