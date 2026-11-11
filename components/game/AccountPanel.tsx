'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useWallet } from '@/lib/WalletProvider'
import { maskAddress } from '@/lib/addressMask'
import { getStoredAuthLabel } from '@/lib/authIdentity'
import { useAccountActions } from '@/lib/useAccountActions'
// Shares SignInScreen's stylesheet — both are account UI, both are a tap away
// from the map, and neither belongs in the critical-path styles/game.css.
import '@/styles/signin.css'

const SignInScreen = dynamic(() => import('./SignInScreen'), { ssr: false })

// ─── The account block, shared by both Settings surfaces ─────────────────────
// It exists because the sign-in feature shipped one-way in every direction:
// a player who skipped the prompt could never see it again (shouldOfferSignIn
// checks hasSkippedSignIn and nothing else offered it), and a player who signed
// in could never sign out — signOutAccount had no caller at all. Settings said
// "Guest Mode" either way.
//
// Settings rather than the world map's ≡ menu, for one reason that outweighs
// the rest: Settings exists on BOTH surfaces. SettingsModal opens from inside a
// run and SettingsScreen from the map, so one block covers both. The ≡ menu is
// map-only, which would leave a player mid-run — the player with the most
// progress to lose — unable to reach it.
//
// Skip therefore goes back to meaning "not now". The prompt still never nags on
// the way into a run, but the door is no longer locked behind it.

interface AccountPanelProps {
  /** Refresh the profile after the identity changes under it. */
  onChanged?: () => void | Promise<void>
  /** Layout hook so each Settings surface can keep its own spacing. */
  className?: string
}

export default function AccountPanel({ onChanged, className = '' }: AccountPanelProps) {
  const { realAddress, isMiniPay, isSignedIn, connect } = useWallet()
  const [showSignIn, setShowSignIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const acct = useAccountActions(onChanged)

  const label = isSignedIn ? getStoredAuthLabel() : null

  // Inside MiniPay the wallet is the account and there is nothing to offer —
  // the same rule that keeps the prompt off the way into a run.
  const canSignIn = !isMiniPay && !realAddress && !isSignedIn

  const doSignOut = async () => {
    setBusy(true)
    try { await acct.signOut() } finally { setBusy(false) }
  }

  return (
    <>
      <div className={className}>
        <p className="ns-acct-label">Account</p>

        <p className="ns-acct-value">
          {realAddress ? maskAddress(realAddress) : isSignedIn ? (label ?? 'Signed in') : 'Guest'}
        </p>

        {canSignIn && (
          <>
            {/* This line used to end "Open NullState in MiniPay to keep it if
                you reinstall" — the only advice available before accounts
                existed, and wrong now that a better one does. It is also the
                exact sentence where a guest learns their progress is fragile,
                which makes it the right place to put the way out. */}
            <p className="ns-acct-hint">
              Your progress lives on this device only. Clearing site data or
              switching phones loses it.
            </p>
            <button onClick={() => setShowSignIn(true)} className="ns-acct-btn">
              Save my progress
            </button>
          </>
        )}

        {isSignedIn && (
          <>
            <p className="ns-acct-hint">
              Your progress follows this account on any device.
            </p>
            <button onClick={doSignOut} disabled={busy} className="ns-acct-btn is-quiet">
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        )}
      </div>

      {showSignIn && (
        <SignInScreen
          onGoogle={async () => { await acct.signInGoogle(); setShowSignIn(false) }}
          onEmail={acct.signInEmail}
          onWallet={async () => { await connect(); setShowSignIn(false) }}
          // Closing from Settings is NOT the same as declining on the way into
          // a run: they came here deliberately, so it must not set the flag
          // that stops the prompt appearing. Nothing to remember — just close.
          onSkip={() => { acct.clearEmailSent(); setShowSignIn(false) }}
          emailSent={acct.emailSentTo}
        />
      )}
    </>
  )
}
