'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PrivyProvider, usePrivy, useLoginWithOAuth } from '@privy-io/react-auth'
// The chain object itself, from viem — Privy takes a viem Chain, and this is
// the same `celo` lib/WagmiIsland.tsx configures wagmi with, so the two cannot
// drift onto different ideas of which network the game runs on.
import { celo } from 'viem/chains'
import { privyAppId, liftGateVeil } from '@/lib/privyGateFlag'
import { GoogleMark, MailMark, WalletMark } from './SignInMarks'
import '@/styles/signin.css'

// ─── Wallet and Google, on one screen ────────────────────────────────────────
//
// OWNER: *"harusnya langsung munculkan Login gmail, email, wallet."*
//
// The first version had ONE button that opened Privy's modal and let the player
// choose inside it. That was wrong twice over. It hid the three things the
// screen exists to offer behind a press — a player who wants Google cannot see
// that Google is on offer — and it also shipped with class names this app's
// stylesheet does not define (`ns-signin-card`, `ns-signin-sub`), so it rendered
// as unstyled text on a black rectangle. Both are fixed here by using the SAME
// markup and the SAME stylesheet as SignInScreen: the bracket frame, the plate
// fill, the white Google button, the bevelled clips.
//
// Each button opens Privy's modal already narrowed to one method, so the choice
// is made HERE, on a screen that looks like the game, and Privy only handles the
// mechanics of the method that was chosen.
//
// ── WHY THIS FILE EXISTS AT ALL, RATHER THAN A PROVIDER AT THE ROOT ─────────
//
// `@privy-io/react-auth` is a large SDK. Putting its provider in the app layout
// would ship it to every player on every route — including MiniPay, which must
// never see this screen and whose players would pay for it in download size on
// exactly the connection least able to afford it. /game's bundle was already a
// PageSpeed finding once.
//
// So the provider is mounted HERE, inside a component that is itself lazily
// imported, and only rendered when the gate is on. With the flag off — the
// default — nothing in this file is downloaded.

type Method = 'google' | 'email' | 'wallet'

interface PrivyGateProps {
  /**
   * Called once Privy reports an authenticated user, with the id to key the
   * player's progress by and a human label for Settings.
   *
   * The id is Privy's own user id (a `did:privy:…` string), NOT a wallet
   * address. It is fed to the same deriveAuthAddress() the Firebase path uses,
   * which is what makes the promise on this screen true: the same Privy account
   * on another device derives the same address and finds the same save. A
   * wallet address would key the account on something the app cannot verify a
   * signature for, which is exactly the two-layer split lib/authIdentity.ts
   * describes — account keys identify, they never authorise.
   */
  onAuthenticated: (
    uid: string,
    label?: string | null,
    /**
     * The embedded wallet Privy creates for a player who arrived without one.
     * A REAL address with a real key the player controls, which is the only
     * thing a season prize can be sent to — the derived account address above
     * is a hash of the id and can receive money but never release it.
     */
    payoutAddress?: string | null,
  ) => void | Promise<void>
  /** "Skip for now" — the player declines and plays as a guest. */
  onSkip: () => void
}

/** The inner half: everything that needs the Privy context. */
function GateInner({ onAuthenticated, onSkip }: PrivyGateProps) {
  const { ready, authenticated, user, login } = usePrivy()
  const { initOAuth } = useLoginWithOAuth()
  const [busy, setBusy] = useState<Method | null>(null)
  const adopted = useRef(false)

  // This screen is its own full-screen backdrop, so the sheet the inline script
  // laid over the prerendered map has nothing left to hide. Lifting it here
  // rather than in the layout is what makes the handover seamless: the sheet
  // goes only once something is definitely drawn on top of it.
  useEffect(() => { liftGateVeil() }, [])

  // Privy restores an existing session asynchronously. Someone who already
  // linked an account must not be asked again — that is the same rule the
  // Firebase path follows via getStoredAuthAddress().
  //
  // Guarded by a ref because adopting migrates guest progress onto the derived
  // address, and Privy re-renders this component several times as it settles
  // (ready → authenticated → user hydrated). Running that twice would be a
  // second migration over documents the first one already moved.
  useEffect(() => {
    if (!ready || !authenticated || !user || adopted.current) return
    adopted.current = true
    void onAuthenticated(
      user.id,
      user.google?.email ?? user.email?.address ?? user.wallet?.address ?? null,
      user.wallet?.address ?? null,
    )
  }, [ready, authenticated, user, onAuthenticated])

  const start = useCallback((method: Method) => {
    setBusy(method)
    // Narrowed to the one method the player pressed. Privy's modal would
    // otherwise re-ask the question this screen just answered.
    login({ loginMethods: [method] })
    // The modal belongs to Privy, so there is no promise to await. Clear the
    // pending state shortly after it has been asked to open, or a dismissed
    // modal would leave the button stuck reading "Opening…" forever.
    setTimeout(() => setBusy(null), 1500)
  }, [login])

  // ── GOOGLE SKIPS PRIVY'S SCREEN ENTIRELY ──────────────────────────────────
  //
  // OWNER: *"itu kalo aku klik google, ga muncul 2x pop up kan? layar privy
  // juga maksudku."* It did. `login({loginMethods:['google']})` opens Privy's
  // modal showing a single Google button — the same question this screen just
  // asked, asked again — and only then hands off to Google.
  //
  // initOAuth goes straight to Google with no Privy UI at all, so the tap on
  // "Continue with Google" is the last thing before Google's own account
  // chooser. It is a full-page redirect rather than a popup, which is also the
  // right shape on a phone: popups are what mobile browsers block.
  //
  // Privy marks the hook @experimental, so it cannot be the only path. If it
  // throws, this falls back to the modal — one extra screen is a worse login,
  // an unrecoverable one is no login at all.
  const startGoogle = useCallback(async () => {
    setBusy('google')
    try {
      await initOAuth({ provider: 'google' })
    } catch {
      login({ loginMethods: ['google'] })
      setTimeout(() => setBusy(null), 1500)
    }
    // No success branch clears `busy` on purpose: the page is navigating to
    // Google, and a button that flips back to "Continue with Google" while the
    // redirect is in flight invites a second tap.
  }, [initOAuth, login])

  const disabled = !ready || busy !== null

  return (
    <div className="ns-signin-root">
      <div className="ns-signin-orb" aria-hidden="true" />

      <div className="ns-signin-panel">
        {/* Corner brackets, the same device the world map uses to mark a
            selected bunker. They are what stops this reading as a web form
            dropped into a game. */}
        <span className="ns-signin-frame" aria-hidden="true" />

        <div className="ns-signin-kicker">{'// SAVE YOUR PROGRESS'}</div>

        <h2 className="ns-signin-title">KEEP YOUR RUN</h2>

        <p className="ns-signin-lede">
          Your run lives in this browser only. Sign in and it follows you anywhere.
        </p>

        <div className="ns-signin-stack">
          <button
            type="button"
            onClick={startGoogle}
            disabled={disabled}
            className="ns-signin-btn is-google"
          >
            <span className="ns-signin-ico"><GoogleMark /></span>
            <span>{busy === 'google' ? 'Opening…' : 'Continue with Google'}</span>
          </button>

          <button
            type="button"
            onClick={() => start('email')}
            disabled={disabled}
            className="ns-signin-btn"
          >
            <span className="ns-signin-ico"><MailMark /></span>
            <span>{busy === 'email' ? 'Opening…' : 'Continue with email'}</span>
          </button>

          {/* Never the phrase check:copy bans — and this screen is never shown
              inside MiniPay anyway. It also says the true thing: this button is
              for people who ALREADY have one, not an instruction to go get one. */}
          <button
            type="button"
            onClick={() => start('wallet')}
            disabled={disabled}
            className="ns-signin-btn"
          >
            <span className="ns-signin-ico"><WalletMark /></span>
            <span>{busy === 'wallet' ? 'Opening…' : 'I already have a wallet'}</span>
          </button>
        </div>

        <button type="button" onClick={onSkip} className="ns-signin-skip">
          Skip for now →
        </button>

        <p className="ns-signin-foot">
          An account saves your name and progress across devices. Buying items and
          claiming rewards needs a wallet — you can add one later.
        </p>
      </div>
    </div>
  )
}

/**
 * The provider wrapper. Returns null when there is no app id, so a deployment
 * that turns the flag on and forgets the credential falls back to the ordinary
 * flow instead of rendering a login that can never complete.
 */
export default function PrivyGate(props: PrivyGateProps) {
  const appId = privyAppId()
  if (!appId) return null
  return (
    <PrivyProvider
      appId={appId}
      config={{
        // All three, so each button's narrowed call has something to narrow to.
        loginMethods: ['google', 'email', 'wallet'],
        appearance: { theme: 'dark', accentColor: '#39ff9a' },
        // An embedded wallet for anyone who arrives without one, so a Google
        // sign-in still ends with an address the rewards system can pay.
        // Nested under `ethereum` — Privy v3 splits the setting per chain
        // family, and the flat form silently does nothing.
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        // ── CELO, OR THE WALLET IS BORN USELESS ───────────────────────────
        //
        // Unset, Privy defaults an embedded wallet to Ethereum mainnet — the
        // same class of bug the owner just hit in the OKX browser, where a
        // perfectly connected wallet could not pay because it was on the wrong
        // chain. A wallet minted here has exactly one job: hold a prize and, in
        // time, pay for things on Celo.
        //
        // `defaultChain` is what an embedded wallet is created on;
        // `supportedChains` is the list an EXTERNAL wallet is asked to be in.
        // Both, so neither kind of player arrives somewhere the game cannot
        // transact.
        defaultChain: celo,
        supportedChains: [celo],
      }}
    >
      <GateInner {...props} />
    </PrivyProvider>
  )
}
