'use client'

import { useState } from 'react'
// Its own stylesheet, not styles/game.css — that one blocks the world map's
// first paint and this screen is two taps away. See the header in signin.css.
import { GoogleMark, MailMark, WalletMark } from './SignInMarks'
import '@/styles/signin.css'

// ─── Save-your-progress screen ───────────────────────────────────────────────
// Sits between starting a run and SET USERNAME, for players who are not in
// MiniPay and have no wallet. It exists because until now those players were
// guests forever: progress lived in one browser's localStorage under a random
// id, so clearing site data — or opening the game on another phone — lost
// everything.
//
// THREE RULES, none of them cosmetic:
//
//  1. It is never rendered inside MiniPay. MiniPay's listing requirements are
//     explicit that connection there is zero-click, and a screen between the
//     player and the game is exactly the friction they reject. GameFlowManager
//     owns that check.
//
//  2. Skip is a real option and looks like one. A dismissable prompt that is
//     hard to dismiss is worse than no prompt. The choice is remembered, so
//     declining once means declining for good.
//
//  3. No button may say "Connect Wallet". check:copy rejects the phrase
//     anywhere under components/ and app/, because inside MiniPay it is always
//     the wrong prompt. "I already have a wallet" says the same thing to the
//     only people who need it.
//
// It is also honest about what an account is NOT. Signing in gives you a name
// and progress that follow you; it does not give you a wallet, so it cannot buy
// or claim. Saying so here is cheaper than a confused player discovering it at
// the Marketplace.

export type SignInMethod = 'google' | 'email' | 'wallet'

interface SignInScreenProps {
  onGoogle: () => Promise<void>
  onEmail: (email: string) => Promise<void>
  onWallet: () => void
  onSkip: () => void
  /** Shown after an email link is sent, so the player knows to go look. */
  emailSent?: string | null
}

export default function SignInScreen({
  onGoogle, onEmail, onWallet, onSkip, emailSent = null,
}: SignInScreenProps) {
  const [busy, setBusy] = useState<SignInMethod | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const run = async (method: SignInMethod, fn: () => Promise<void>) => {
    setBusy(method)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const submitEmail = () => {
    const trimmed = email.trim()
    // Deliberately loose. The real check is whether the link arrives; a strict
    // pattern here only ever rejects addresses that would have worked.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('That does not look like an email address.')
      return
    }
    run('email', () => onEmail(trimmed))
  }

  const disabled = busy !== null

  return (
    <div className="ns-signin-root">
      <div className="ns-signin-orb" aria-hidden="true" />

      <div className="ns-signin-panel">
        {/* Corner brackets, the same device the world map uses to mark a
            selected bunker. They are what stops this reading as a web form
            dropped into a game. */}
        <span className="ns-signin-frame" aria-hidden="true" />

        <div className="ns-signin-kicker">
          {/* Braced on purpose. The bare form — the way the other screens write
              their `//` kickers — trips react/jsx-no-comment-textnodes, which
              is where 34 of this repo's lint errors already come from. Same
              rendered output, one fewer thing on the pile. */}
          {'// SAVE YOUR PROGRESS'}
        </div>

        <h2 className="ns-signin-title">
          {emailSent ? 'CHECK YOUR INBOX' : 'KEEP YOUR RUN'}
        </h2>

        <p className="ns-signin-lede">
          {emailSent
            ? <>We sent a link to <span className="ns-signin-em">{emailSent}</span>. Open it and you are in.</>
            : <>Your run lives in this browser only. Sign in and it follows you anywhere.</>}
        </p>

        {!emailSent && (
          <div className="ns-signin-stack">
            <button
              onClick={() => run('google', onGoogle)}
              disabled={disabled}
              className="ns-signin-btn is-google"
            >
              <span className="ns-signin-ico"><GoogleMark /></span>
              <span>{busy === 'google' ? 'Opening…' : 'Continue with Google'}</span>
            </button>

            {showEmail ? (
              <div className="ns-signin-stack">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitEmail() }}
                  placeholder="you@example.com"
                  disabled={disabled}
                  className="ns-signin-input"
                />
                <button onClick={submitEmail} disabled={disabled || !email.trim()} className="ns-signin-btn is-send">
                  <span className="ns-signin-ico"><MailMark /></span>
                  <span>{busy === 'email' ? 'Sending…' : 'Send me a link'}</span>
                </button>
              </div>
            ) : (
              <button onClick={() => setShowEmail(true)} disabled={disabled} className="ns-signin-btn">
                <span className="ns-signin-ico"><MailMark /></span>
                <span>Continue with email</span>
              </button>
            )}

            <button onClick={onWallet} disabled={disabled} className="ns-signin-btn">
              <span className="ns-signin-ico"><WalletMark /></span>
              <span>I already have a wallet</span>
            </button>
          </div>
        )}

        {error && <div className="ns-signin-error">{error}</div>}

        <button onClick={onSkip} disabled={disabled} className="ns-signin-skip">
          Skip for now →
        </button>

        <p className="ns-signin-foot">
          An account saves your name and progress. Buying items and claiming
          rewards needs a wallet — you can add one later.
        </p>
      </div>
    </div>
  )
}
