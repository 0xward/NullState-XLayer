'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useWallet } from '@/lib/WalletProvider'
import { useContractPlayer } from '@/lib/useContractPlayer'
import { PlayerProfile, LeaderboardEntry } from '@/lib/contract'
import { loadGameSession, loadGameSessionDraft, clearGameSession, saveGameSession, saveGameSessionDraft } from '@/lib/gameSessionService'
import { migrateGuestProgress, getStoredGuestId } from '@/lib/guestMigration'
import { getStoredAuthAddress, hasSkippedSignIn, storePayoutAddress, getStoredPayoutAddress } from '@/lib/authIdentity'
import { useAccountActions } from '@/lib/useAccountActions'
import { readHighestAct, recordHighestAct, stashCampaignResume, takeCampaignResume } from '@/lib/campaignProgress'
import MainMenu from './MainMenu'
import WorldMapHub from './WorldMapHub'
import { useWorldMapHubFlag } from '@/lib/worldMapHubFlag'
import { usePrivyGateFlag, liftGateVeil } from '@/lib/privyGateFlag'
import { markCampaignComplete } from '@/lib/campaignComplete'
import NewGameConfirmModal from './NewGameConfirmModal'
import WelcomeGiftModal from './WelcomeGiftModal'

// ─── Code-split (PSI v58: ~96 KiB unused JS di initial load) ────────────────
// Screen-screen ini cuma dirender setelah user klik sesuatu di MainMenu
// (lihat switch `phase` di bawah — cuma satu phase yang aktif di satu waktu),
// jadi gak perlu ikut ke initial JS bundle /game. `ssr:false` karena semua
// ini 'use client' component yang gak butuh SEO/first-paint (halaman /game
// sendiri sudah `force-dynamic`, gak di-index buat konten dalam game).
// DungeonGameWrapper membungkus DungeonGame.tsx (808 baris, game engine —
// komponen terberat di codebase ini), jadi men-split wrapper-nya otomatis
// ikut men-split game engine-nya juga.
const UsernameSetup = dynamic(() => import('./UsernameSetup'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING WALKER SETUP" />,
})
// Split hardest of all: this one pulls firebase/auth behind it, which is a
// separate entry point from the Firestore SDK the rest of the app already
// loads. Most players never render it — everyone in MiniPay, everyone with a
// wallet, everyone who has skipped once — so it must never be in the initial
// chunk.
const SignInScreen = dynamic(() => import('./SignInScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING SIGN IN" />,
})
// The Privy gate is TEMPORARY scaffolding for a talent.app judging period and
// pulls a large SDK, so it is loaded only when the flag is on and the player is
// outside MiniPay. `ssr: false` because Privy is browser-only. See
// lib/privyGateFlag.ts for why this is off by default.
const PrivyGate = dynamic(() => import('./PrivyGate'), { ssr: false })

const Leaderboard = dynamic(() => import('./Leaderboard'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING LEADERBOARD" />,
})
const RewardsScreen = dynamic(() => import('./RewardsScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING REWARDS" />,
})
const ReferralScreen = dynamic(() => import('./ReferralScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING REFERRAL" />,
})
const SeasonPassScreen = dynamic(() => import('./SeasonPassScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING SEASON PASS" />,
})
const MarketplaceScreen = dynamic(() => import('./MarketplaceScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING MARKETPLACE" />,
})
const CraftingScreen = dynamic(() => import('./CraftingScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING CRAFTING" />,
})
const HowToPlayScreen = dynamic(() => import('./HowToPlayScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING GUIDE" />,
})
const CharacterSheet = dynamic(() => import('./CharacterSheet'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING CHARACTER" />,
})
const SettingsScreen = dynamic(() => import('./SettingsScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING SETTINGS" />,
})
const DungeonGameWrapper = dynamic(() => import('./DungeonGameWrapper'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING DUNGEON" />,
})

// Fallback minimal yang cocok sama tema terminal/hijau NullState, dipakai
// selagi chunk async di atas masih di-fetch (biasanya cuma sekejap di
// koneksi normal — ini bukan buat dungeon engine yang beneran loading asset).
function ScreenLoadingFallback({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-null-bg">
      <div className="font-mono text-[11px] tracking-[4px] text-null-green uppercase animate-pulse">
        // {label}...
      </div>
    </div>
  )
}

type GamePhase = 'menu' | 'sign-in' | 'username-setup' | 'character-select' | 'game' | 'leaderboard' | 'rewards' | 'referral' | 'season-pass' | 'marketplace' | 'crafting' | 'how-to-play' | 'character' | 'settings'

/**
 * GameFlowManager orchestrates the entire NullState game flow:
 * 1. Show MainMenu with wallet connection
 * 2. Handle Continue/New Game/Leaderboard options
 * 3. Show UsernameSetup for new players (Knight is the sole default character)
 * 4. Pass to DungeonGame for actual gameplay
 * 5. Show Leaderboard when requested
 *
 * All player progress is stored ON-CHAIN via the contract.
 */
export default function GameFlowManager() {
  const { address, isConnected, realAddress, isGuest, isSignedIn, isMiniPay, walletReady, connect } = useWallet()
  const {
    playerProfile,
    isLoading: isLoadingProfile,
    profileSettled,
    setPlayerUsername,
    fetchPlayerProfile,
    fetchLeaderboard
  } = useContractPlayer(address || undefined)

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [characterTab, setCharacterTab] = useState<'character' | 'items'>('character')
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false)
  const [selectedUsername, setSelectedUsername] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  // Tracks whether the current run was entered via "New Game" (true) or
  // "Continue" (false) — threaded down to DungeonGame so its mount effect
  // knows whether to load the saved bunker session or skip it entirely.
  // See handleNewGame/handleContinueGame below.
  const [isNewRun, setIsNewRun] = useState(false)
  // Which run the player chose from the menu — threaded to the engine so it
  // skips the canvas title/preview and starts that mode directly.
  const [startMode, setStartMode] = useState<'new' | 'continue' | 'cycle' | 'abyss' | 'raid'>('new')
  /** Which bunker a raid targets. Null for every other start mode. */
  const [raidActIndex, setRaidActIndex] = useState<number | null>(null)
  // True while handleNewGame is checking Firestore for an existing saved
  // session (so the New Game button can show a brief pending state if the
  // caller wants it — currently unused by MainMenu but kept for parity with
  // the other loading flags here).
  const [checkingNewGame, setCheckingNewGame] = useState(false)
  // Set only when /api/referrals reports a first-time bind, so the welcome
  // gift is announced once and never again.
  const [welcomeGift, setWelcomeGift] = useState<{ weaponId: string; hours: number } | null>(null)
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false)

  // Render the world-map hub instead of the classic MainMenu when the flag is
  // on (see lib/worldMapHubFlag.ts — OFF by default). HowToPlayScreen reads the
  // same flag, so the help text always matches the screen the player gets.
  const useWorldMapHub = useWorldMapHubFlag()
  const privyGateOn = usePrivyGateFlag()

  // Bunker cleared → surface back to the world map, so the run's progress lands
  // somewhere visible (the ✓ appears, the next bunker loses its fog) instead of
  // the engine walking the player straight into the next act. Only with the hub
  // on; the classic menu keeps the uninterrupted flow it always had.
  //
  // The draft is written SYNCHRONOUSLY before the phase flips: WorldMapHub reads
  // that same localStorage draft on mount, so the map can't paint the bunker we
  // just finished while a network write is still in flight.
  useEffect(() => {
    if (!useWorldMapHub) return
    const onCleared = () => {
      try {
        const NSG = (window as { NullStateGame?: { getSaveSnapshot?: () => unknown } }).NullStateGame
        const raw = NSG?.getSaveSnapshot?.() as Parameters<typeof saveGameSession>[1] | undefined
        if (raw && address) {
          // Floor 1, always. A cleared bunker means the next descent starts a
          // NEW bunker, and the engine restores `depth` straight into
          // startDepth — so persisting the floor the vault was on (5) made
          // ENTER drop the player into the next bunker already on floor 5,
          // skipping the four floors they had just unlocked.
          //
          // game.js resets its cached snapshot at the same moment and for the
          // same reason; this is the shell refusing to write a deep floor after
          // a clear under any circumstances, because it is the last thing
          // standing between that value and the player's saved game.
          const snap = { ...raw, depth: 1, maxDepthReached: 1 }
          // Bank the high-water mark BEFORE the snapshot is the only record of
          // it. The map reads progress from here, not from the live session, so
          // a later raid on an earlier bunker cannot walk it backwards — see
          // lib/campaignProgress.ts.
          if (typeof snap.campaignActIndex === 'number') recordHighestAct(address, snap.campaignActIndex)
          saveGameSessionDraft(address, snap)
          saveGameSession(address, snap).catch(() => { /* draft already covers the map */ })
        }
      } catch { /* never block the return to the map on a save problem */ }
      setPhase('menu')
    }
    // A RAID finishing is not the campaign finishing (GAME-DESIGN.md §7), and
    // it must not be handled by onCleared above — that writes the engine's
    // current campaignActIndex as the saved session, which for a raid is the
    // bunker being farmed. A player who had cleared all five and raided the
    // first would come back with ENTER pointing at Bunker 1.
    //
    // So the raid's loot and level are kept (the run snapshot is real progress)
    // while campaignActIndex is forced back to the true high-water mark before
    // it is written. recordHighestAct is never called here: raiding a bunker
    // you already beat unlocks nothing.
    const onRaidCleared = () => {
      // The stash is consumed FIRST, and unconditionally.
      //
      // It used to be taken inside the `if (raw)` below, which meant that any
      // path where the engine had no snapshot to give — it never mounted, it
      // was already torn down, getSaveSnapshot threw — left the stash on disk.
      // A leaked stash is not inert: the NEXT raid to finish would read it and
      // restore a campaign position from two raids ago. Caught by the
      // end-to-end test, which traced one write of the key and no removal.
      //
      // Discarding it when there is nothing to write is the right outcome
      // anyway: no snapshot means the saved draft was never overwritten, so it
      // still holds the campaign position the stash was insurance for.
      const resume = address ? takeCampaignResume(address) : null
      try {
        const NSG = (window as { NullStateGame?: { getSaveSnapshot?: () => unknown } }).NullStateGame
        const raw = NSG?.getSaveSnapshot?.() as Parameters<typeof saveGameSession>[1] | undefined
        if (raw && address) {
          // Put the campaign back exactly where the raid found it — act, floor
          // and all — while keeping everything the raid earned. Falls back to
          // the high-water mark on floor 1 if there was no campaign run to
          // preserve (a player who had already cleared everything).
          const snap = {
            ...raw,
            campaignActIndex: resume ? resume.campaignActIndex : readHighestAct(address),
            depth: resume ? resume.depth : 1,
            maxDepthReached: resume ? resume.maxDepthReached : 1,
          }
          saveGameSessionDraft(address, snap)
          saveGameSession(address, snap).catch(() => { /* draft already covers the map */ })
        }
      } catch { /* never block the return to the map on a save problem */ }
      setPhase('menu')
    }
    // THE CAMPAIGN ENDS ON THE MAP, not on a screen with no exit.
    //
    // Owner, after the vault: "setelah buka vault itu aku masuk menu abbys."
    // The finale used to hand the player to the engine's own title screen —
    // the pre-map home screen — where the HUD is hidden, Save & Exit is gone
    // and nothing leads back. See finishCampaign() in game.js.
    //
    // It saves exactly like an ordinary clear, with one difference: the act
    // index is NOT advanced, because there is no Bunker 6. The map reads
    // Bunker 5 as beaten off the PROTOCOL ZERO flag instead, which is also what
    // makes it raidable — and raiding Bunker 5 is how the weekly vault is
    // reached for the rest of the player's time in the game.
    const onCampaignComplete = () => {
      markCampaignComplete(address)
      try {
        const NSG = (window as { NullStateGame?: { getSaveSnapshot?: () => unknown } }).NullStateGame
        const raw = NSG?.getSaveSnapshot?.() as Parameters<typeof saveGameSession>[1] | undefined
        if (raw && address) {
          const snap = { ...raw, depth: 1, maxDepthReached: 1 }
          if (typeof snap.campaignActIndex === 'number') recordHighestAct(address, snap.campaignActIndex)
          saveGameSessionDraft(address, snap)
          saveGameSession(address, snap).catch(() => { /* draft already covers the map */ })
        }
      } catch { /* never block the return to the map on a save problem */ }
      setPhase('menu')
    }

    window.addEventListener('nullstate-bunker-cleared', onCleared)
    window.addEventListener('nullstate-raid-cleared', onRaidCleared)
    window.addEventListener('nullstate-campaign-complete', onCampaignComplete)
    return () => {
      window.removeEventListener('nullstate-bunker-cleared', onCleared)
      window.removeEventListener('nullstate-raid-cleared', onRaidCleared)
      window.removeEventListener('nullstate-campaign-complete', onCampaignComplete)
    }
  }, [useWorldMapHub, address])

  // Owner: everyone who clicks Play Game should count as a player right away.
  //
  // They always had an id — a wallet, or a guest id in localStorage — but the
  // first thing that ever RECORDED it was the energy row written by starting a
  // run. So a person who opened the game, looked at the world map and left
  // existed only on their own device, and the stats page could not see them.
  //
  // This is that record, fired once when the game shell mounts with an id in
  // hand. Deliberately fire-and-forget: it is a dashboard number, and it must
  // never delay the map painting or surface an error to someone who just
  // wanted to play. Once per mount, not per render, so a re-render storm
  // cannot turn one player into a write loop.
  const seenSent = useRef(false)
  useEffect(() => {
    if (!address || seenSent.current) return
    seenSent.current = true
    fetch('/api/player/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: address,
        guest: !!isGuest,
        // `guest` alone cannot answer the only question that costs money.
        // isGuest is false for an ACCOUNT player — see WalletProvider, where
        // guestAddress is not minted once an account address exists — so a
        // hash-derived key that can never release a transfer was recorded as
        // indistinguishable from a real wallet. `kind` says which it is.
        kind: realAddress ? 'wallet' : isSignedIn ? 'account' : 'guest',
        // And where a prize could actually go, when there is such a place.
        payout: getStoredPayoutAddress(),
      }),
    }).catch(() => { /* a missed count is not worth a single visible failure */ })
  }, [address, isGuest, realAddress, isSignedIn])

  // If wallet disconnects, go back to menu
  useEffect(() => {
    if (!isConnected) {
      setPhase('menu')
    }
  }, [isConnected])

  // Referral bind (growth blueprint 2A). A share link lands on
  // /game?ref=CODE — stash the code immediately (the wallet may not be
  // connected yet), then bind it server-side once a real wallet exists.
  // The server is idempotent (binds once ever, rejects self-referrals),
  // so re-running on every mount is harmless.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref && /^[A-Za-z0-9]{6,12}$/.test(ref)) localStorage.setItem('nullstate-refcode-pending', ref.toUpperCase())
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    if (!realAddress || typeof window === 'undefined') return
    let code: string | null = null
    try { code = localStorage.getItem('nullstate-refcode-pending') } catch { /* ignore */ }
    if (!code) return
    fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bind', wallet: realAddress, code }),
    })
      .then(r => r.json())
      .then(d => {
        // Bound (or already bound / self-ref rejected) — either way the
        // pending code has served its purpose.
        if (d && (d.success || d.error)) {
          try { localStorage.removeItem('nullstate-refcode-pending') } catch { /* ignore */ }
        }
        // The server sets `welcome` only on the FIRST bind, so showing it here
        // announces the gift exactly once. Announcing it matters as much as
        // granting it: a weapon the player never learns about does nothing to
        // stop them leaving on the screen where they'd otherwise notice their
        // inviter is the only one being rewarded.
        if (d?.welcome?.weaponId) setWelcomeGift(d.welcome)
      })
      .catch(() => { /* offline — keep pending, retry next mount */ })
  }, [realAddress])

  // Guest → wallet migration (Phase 1). The moment a real wallet connects while
  // a local guest id still exists, move the guest's off-chain progress onto the
  // wallet (fill-the-gaps, wallet wins — see lib/guestMigration.ts), then
  // refresh the profile so the migrated username/session show up immediately.
  useEffect(() => {
    if (!realAddress || !getStoredGuestId()) return
    let cancelled = false
    ;(async () => {
      await migrateGuestProgress(realAddress)
      if (!cancelled) fetchPlayerProfile()
    })()
    return () => { cancelled = true }
  }, [realAddress, fetchPlayerProfile])

  // Coming back from a sign-in that left the page.
  //
  // Two ways out and back: an email link opened from the inbox, and a Google
  // redirect on a browser that would not open the popup. Both land here on a
  // fresh page load with the auth session already established, and both have to
  // be finished off — Firebase knows who the player is, but nothing has turned
  // that into the address the rest of the app is keyed by yet.
  //
  // Guarded three ways so this never costs anything for the overwhelming
  // majority who never signed in at all: MiniPay is out, an already-adopted
  // account is out, and firebase/auth is only import()ed after the URL itself
  // says there is something to finish.
  useEffect(() => {
    if (isMiniPay || getStoredAuthAddress()) return
    let cancelled = false
    ;(async () => {
      const hasLinkInUrl = typeof window !== 'undefined' && window.location.href.includes('apiKey=')
      if (!hasLinkInUrl && !sessionStorage.getItem('ns-signin-redirecting')) return
      try {
        const auth = await import('@/lib/firebaseAuth')
        const user = auth.isEmailLinkCallback()
          ? await auth.completeEmailSignIn()
          : await auth.resumeRedirectSignIn()
        if (user && !cancelled) {
          sessionStorage.removeItem('ns-signin-redirecting')
          await acct.adopt(user.uid, user.email ?? user.displayName)
          // Drop the one-time credentials out of the address bar so a shared or
          // bookmarked URL cannot replay them.
          window.history.replaceState({}, '', window.location.pathname)
        }
      } catch {
        /* An expired or already-used link is not an error worth a screen —
           the player is simply still signed out, and the prompt still works. */
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMiniPay])

  // Actually begins a fresh run (marks isNewRun so DungeonGame's mount
  // effect skips loading any saved bunker snapshot). v72 (user finding #2):
  // REGISTERED players now skip the username-setup screen entirely and drop
  // straight into the game — they already have a saved username (Firestore
  // `usernames/<address>`; nothing about the name is on-chain), and
  // being routed back through "SET USERNAME" on every New Game read as a
  // blocking bug popup. Only first-time (unregistered) players see setup.
  const proceedToNewGame = () => {
    setStartMode('new')
    setRaidActIndex(null)
    setIsNewRun(true)
    goPlaying(playerProfile?.isRegistered ? 'game' : 'username-setup')
  }

  // Raid an already-cleared bunker (GAME-DESIGN.md §7). isNewRun is FALSE on
  // purpose despite this being a fresh descent: isNewRun is what makes
  // DungeonGame wipe the saved session, and a raid must never destroy the
  // campaign save the player is midway through. The engine builds the run from
  // scratch either way — see startRaid() in game.js.
  const handleRaid = (actIndex: number) => {
    // Remember where the campaign was standing. A raid shares the same saved
    // session document, so without this a player farming Bunker 1 would come
    // back to find their Bunker 3 run reset to floor 1. Put back by
    // onRaidCleared. See lib/campaignProgress.ts.
    if (address) {
      const draft = loadGameSessionDraft(address)
      stashCampaignResume(address, draft ? {
        campaignActIndex: draft.campaignActIndex,
        depth: draft.depth,
        maxDepthReached: draft.maxDepthReached,
      } : null)
    }
    setStartMode('raid')
    setRaidActIndex(actIndex)
    setIsNewRun(false)
    goPlaying('game')
  }

  // ── ENDGAME: The Null Abyss and New Game+ ────────────────────────────────
  //
  // The comment that used to sit here said these were "NOT menu entries" and
  // were entered from the engine's post-campaign title screen. That was true,
  // and it was the bug: with the world map on, that screen is reached only by
  // finishing the campaign, hides the HUD, and has no way back to the map. The
  // owner cracked the vault and found himself in it.
  //
  // Both are pure start modes the engine already understands (startAbyss /
  // startCycle in game.js), so this is the same three lines handleRaid uses.
  //
  // Neither touches the saved campaign: startAbyss and startCycle both clear
  // SAVED_SESSION and build their own run, and the map's own progress record
  // (lib/campaignProgress.ts) is monotonic and separate. Nothing is stashed for
  // the same reason a raid stashes — an abyss dive is not a bunker, so there is
  // no act index it could write back.
  const handleAbyss = () => {
    setStartMode('abyss')
    setRaidActIndex(null)
    setIsNewRun(false)
    goPlaying('game')
  }

  const handleCycle = () => {
    setStartMode('cycle')
    setRaidActIndex(null)
    setIsNewRun(false)
    goPlaying('game')
  }

  // Where the player was headed when the sign-in screen interrupted them.
  // Whatever they choose there — sign in, use a wallet, or skip — they end up
  // here, so the prompt never changes where a tap was going to take them.
  const pendingPhase = useRef<GamePhase>('game')

  /**
   * Start playing, offering the account once on the way if it would help.
   *
   * Both entry points route through here — ENTER on the world map and New Game
   * in the menu — because the first is how a guest actually starts a run. An
   * earlier version hung this off the New Game path only and off
   * `playerProfile.isRegistered`, and it could never have fired: isRegistered
   * is hardcoded true for anyone holding a Firebase username (see the comment
   * in lib/useContractPlayer.ts), so the branch that offered the screen was
   * unreachable and most guests never pass through New Game anyway.
   */
  const goPlaying = (next: GamePhase) => {
    // OWNER: *"halaman login google email yg lama matikan aja, fungsi yg lama
    // juga kan sebenernya sama aja kaya fungsi privy skrg."* He is right — both
    // end in the same derived account address, so with the gate on this screen
    // would be a SECOND way to make the same account, using a different
    // mechanism, asked at a different moment.
    //
    // Stated as a condition rather than left to fall out of the skip flag. It
    // already could not appear (the gate stores an identity or remembers the
    // skip, and both make shouldOfferSignIn() false), but "cannot happen
    // because of a side effect three functions away" is how a screen comes
    // back. With the flag off this line does nothing and the old screen returns
    // exactly as it was.
    if (!privyGateOn && shouldOfferSignIn()) {
      pendingPhase.current = next
      setPhase('sign-in')
      return
    }
    setPhase(next)
  }

  // ── Save-your-progress: who gets asked, and who never does ─────────────────
  //
  // Four ways to not be asked, and each one is a case where asking would be
  // wrong rather than merely unnecessary:
  //
  //   isMiniPay      MiniPay's listing rules require zero-click connection. A
  //                  screen between the player and the game is the friction
  //                  they reject, and the wallet is already there anyway.
  //   realAddress    They have a wallet. It already does everything an account
  //                  does and more.
  //   authAddress    Already signed in. Asking again says the first time did
  //                  not count.
  //   skipped        They said no. Asking on every New Game is how a prompt
  //                  becomes a nag.
  //
  // Note this is only reached on the not-yet-registered path — a returning
  // player who taps New Game drops straight into the game, which is the v72
  // finding above and is not being undone here.
  const shouldOfferSignIn = () =>
    !isMiniPay && !realAddress && !getStoredAuthAddress() && !hasSkippedSignIn()

  // ── THE PRIVY GATE ────────────────────────────────────────────────────────
  //
  // Owner: it must appear "setelah loading/splash pertama" — i.e. on arrival,
  // not on the way into a run like the Firebase screen it stands in for. That
  // is deliberate on his side: the talent.app judges need to see the wallet +
  // Google option without having to press anything first.
  //
  // It reuses `shouldOfferSignIn()` verbatim rather than writing a second
  // condition, so the four people who are never asked stay never asked — and
  // the first of those four is MiniPay. This gate cannot reach them.
  //
  // Skippable, per the owner's choice: a player who declines plays as a guest
  // exactly as before. Declining is remembered, so it asks once and not again.
  const [gateDone, setGateDone] = useState(false)

  // ── THE MINIPAY FLASH, AND WHY WAITING WAS THE WRONG FIX ──────────────────
  //
  // OWNER, testing inside MiniPay: *"masih sempet muncul halaman loginnya,
  // meskipun sekedip langsung hilang."* He is right that it matters — a screen
  // between the player and the game is exactly what MiniPay's listing rules
  // reject, and "only for a moment" is not a defence.
  //
  // The cause was timing, not logic. `isMiniPay` is read from window.ethereum
  // inside WagmiIsland, and lib/Web3Providers.tsx mounts that island on
  // requestIdleCallback with a 1500ms ceiling — so the bridge served its
  // default `isMiniPay: false` to a MiniPay player for up to a second and a
  // half, and shouldOfferSignIn() answered "yes, ask them".
  //
  // The obvious fix — hold the gate until `walletReady` — was written, measured
  // and thrown away. It works, but it costs the thing this screen exists for:
  //
  //     inside MiniPay   gate never appeared (0 of 165 polls over 5s)  ✓
  //     outside          map at 50ms, gate at 1272ms                   ✗
  //
  // A login that lands on top of a map the player has already been looking at
  // for a second IS the bug he reported the first time. So the wait is gone and
  // the guarantee moved into lib/privyGateFlag.ts, which reads MiniPay straight
  // off window.ethereum and needs nothing mounted — correct on the very first
  // render, and re-checked for a beat afterwards in case injection is late.
  //
  // `walletReady` stays in the destructure above deliberately unused by this
  // rule: shouldOfferSignIn()'s own `!isMiniPay` is the third guard, and it
  // arrives when wagmi does.
  const showPrivyGate = privyGateOn && !gateDone && shouldOfferSignIn()

  // The one case the inline script cannot decide for itself: it can read
  // localStorage and window.ethereum, but not whether an injected wallet is
  // about to connect — that needs wagmi. So if the sheet went down and the gate
  // turns out not to be coming, lift it as soon as the wallet situation is
  // known. `walletReady` is that moment. (The script's own 3s timer is the
  // backstop for a React that never arrives at all.)
  useEffect(() => {
    if (walletReady && !showPrivyGate) liftGateVeil()
  }, [walletReady, showPrivyGate])

  // The identity work itself lives in lib/useAccountActions — Settings needs
  // the same three actions, and the migrate-then-store ORDER is too easy to get
  // wrong in a second copy. What stays here is only the part this screen owns:
  // where the player goes afterwards.
  const acct = useAccountActions(fetchPlayerProfile)

  const handleSignInGoogle = async () => {
    await acct.signInGoogle()
    setPhase(pendingPhase.current)
  }

  const handleSignInWallet = async () => {
    await connect()
    setPhase(pendingPhase.current)
  }

  const handleSignInSkip = () => {
    acct.rememberSkipped()
    setPhase(pendingPhase.current)
  }

  // New Game+ and The Null Abyss live on the WORLD MAP (under ≡ MENU, and in
  // the one-time reveal the first time it opens after the ending) — see
  // handleAbyss/handleCycle below. The classic MainMenu still routes them
  // through the engine's title screen, which is fine there: with the hub off,
  // that screen is the home screen and DESCEND is always on it.

  const handleNewGame = async () => {
    if (!address) {
      proceedToNewGame()
      return
    }
    setCheckingNewGame(true)
    try {
      const existing = await loadGameSession(address)
      if (existing) {
        // Don't touch/clear it yet — just ask. The save only gets erased
        // if the player explicitly confirms below.
        setShowNewGameConfirm(true)
      } else {
        proceedToNewGame()
      }
    } catch {
      // Firestore unreachable etc — fail open and let the player start a
      // fresh run rather than getting stuck, same fail-open behavior as
      // DungeonGame's own loadGameSession() catch.
      proceedToNewGame()
    } finally {
      setCheckingNewGame(false)
    }
  }

  // v72 (user finding #2): fire-and-forget. The old version awaited
  // clearGameSession BEFORE proceeding, which froze the modal on slow
  // networks. isNewRun=true already guarantees DungeonGame won't load the
  // stale save while the delete completes in the background.
  const handleConfirmNewGame = () => {
    setShowNewGameConfirm(false)
    if (address) {
      clearGameSession(address).catch(() => { /* retried implicitly: isNewRun run overwrites the save on next auto-save */ })
    }
    proceedToNewGame()
  }

  // v72 (user finding #2): the modal now also offers "Continue Saved Run"
  // so the player genuinely chooses between the two paths, instead of New
  // Game being the only actionable outcome once the popup was open.
  const handleContinueFromModal = () => {
    setShowNewGameConfirm(false)
    if (playerProfile?.isRegistered) {
      handleContinueGame(playerProfile)
    }
  }

  const handleCancelNewGame = () => {
    setShowNewGameConfirm(false)
  }

  const handleContinueGame = (profile: PlayerProfile) => {
    // Jump straight into the game with their existing profile
    setStartMode('continue')
    setIsNewRun(false)
    goPlaying('game')
  }

  const handleUsernameSet = async (username: string) => {
    try {
      setError(null)
      setSelectedUsername(username)

      // Registration is now fully OFF-CHAIN (Phase 0): there is no register()
      // tx anymore. A player exists the moment they claim a Firebase username —
      // for real wallets and guests alike. Combat, XP and progress all live
      // off-chain; only reward payouts touch the chain later on.
      await setPlayerUsername(username)

      // Move to game
      setPhase('game')
    } catch (err) {
      const message = (err as any)?.message || 'Failed to set up player'
      setError(message)
    }
  }

  const handleLeaderboardClick = async () => {
    setPhase('leaderboard')
    setIsLoadingLeaderboard(true)
    try {
      const entries = await fetchLeaderboard()
      setLeaderboardEntries(entries)
    } catch (err) {
      console.error('[v0] Failed to load leaderboard:', err)
    } finally {
      setIsLoadingLeaderboard(false)
    }
  }

  const handleBackToMenu = () => {
    setPhase('menu')
    setError(null)
  }

  const handleRewardsClick = () => {
    // Re-fetch before showing Rewards: playerProfile is otherwise only
    // fetched once on wallet connect (see useContractPlayer.ts), so without
    // this a player who connects then plays a session would see stale
    // xp/level here even after recordRunProgress has already synced the
    // real numbers to Firestore on save/death.
    fetchPlayerProfile()
    setPhase('rewards')
  }

  const handleMintPassClick = () => {
    setPhase('season-pass')
  }

  const handleReferralClick = () => {
    setPhase('referral')
  }

  const handleMarketplaceClick = () => {
    setPhase('marketplace')
  }

  const handleCraftingClick = () => {
    setPhase('crafting')
  }

  const handleHowToPlayClick = () => {
    setPhase('how-to-play')
  }

  // Two doors into the same room: the player plate opens CHARACTER, the BAG
  // button opens ITEMS. The tab is remembered on the way in rather than reset,
  // so tapping the bag never lands you on a page about your crit chance.
  const handleCharacterClick = (tab: 'character' | 'items' = 'character') => {
    setCharacterTab(tab)
    setPhase('character')
  }

  const handleSettingsClick = () => {
    setPhase('settings')
  }

  // ── THE PRIVY GATE, AHEAD OF EVERYTHING ───────────────────────────────────
  //
  // Above `phase === 'menu'` on purpose, and it was BELOW it in the first
  // version — which is the whole bug the owner hit: the map is what 'menu'
  // renders, so the gate could not appear until something moved the phase off
  // it, and the login turned up AFTER the world map instead of before it.
  //
  // OWNER: *"harusnya sebelum user membuka maps, jd di awal banget persis
  // setelah user klik Play game di landing page."*
  //
  // Nothing else may render first. This is the first screen of the session.
  if (showPrivyGate) {
    return (
      <PrivyGate
        onAuthenticated={async (uid, label, payoutAddress) => {
          // Through the SAME adopt() the Firebase screen uses: derive an
          // address from the id, carry the guest's progress onto it, store the
          // identity. Nothing about Privy is special here — adopt() only ever
          // wanted a stable id, and this is one. Without this the screen's own
          // promise ("it follows you anywhere") would be false.
          try {
            // The embedded wallet FIRST, so that even a failed migration leaves
            // the player with somewhere a prize could be sent.
            storePayoutAddress(payoutAddress)
            await acct.adopt(uid, label)
          } finally {
            // Even a failed migration must not trap the player on this screen.
            setGateDone(true)
          }
        }}
        onSkip={() => { acct.rememberSkipped(); setGateDone(true) }}
      />
    )
  }

  // PHASE: MENU
  if (phase === 'menu') {
    // Same props for both — the hub is a drop-in swap for the classic menu.
    const MenuScreen = useWorldMapHub ? WorldMapHub : MainMenu
    return (
      <>
        <MenuScreen
          onContinueGame={handleContinueGame}
          onNewGame={handleNewGame}
          onRaid={handleRaid}
          onAbyss={handleAbyss}
          onCycle={handleCycle}
          onLeaderboard={handleLeaderboardClick}
          onRewards={handleRewardsClick}
          onReferral={handleReferralClick}
          onMintPass={handleMintPassClick}
          onMarketplace={handleMarketplaceClick}
          onCrafting={handleCraftingClick}
          onHowToPlay={handleHowToPlayClick}
          onCharacter={handleCharacterClick}
          onSettings={handleSettingsClick}
          playerProfile={playerProfile}
          isLoadingProfile={isLoadingProfile}
          profileSettled={profileSettled}
        />
        <NewGameConfirmModal
          open={showNewGameConfirm}
          onConfirm={handleConfirmNewGame}
          onContinue={playerProfile?.isRegistered ? handleContinueFromModal : null}
          onCancel={handleCancelNewGame}
        />
        <WelcomeGiftModal
          weaponId={welcomeGift?.weaponId ?? null}
          hours={welcomeGift?.hours ?? 0}
          onClose={() => setWelcomeGift(null)}
        />
      </>
    )
  }

  // PHASE: SIGN IN — offered once, before the name, and only to the players
  // who have nothing keeping their progress. See shouldOfferSignIn(). Off
  // entirely while the Privy gate is on; see goPlaying().
  if (phase === 'sign-in') {
    return (
      <SignInScreen
        onGoogle={handleSignInGoogle}
        onEmail={acct.signInEmail}
        onWallet={handleSignInWallet}
        onSkip={handleSignInSkip}
        emailSent={acct.emailSentTo}
      />
    )
  }

  // PHASE: CHARACTER SELECT
  if (phase === 'username-setup' && !playerProfile?.isRegistered) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.95)] p-6">
        {/* Glow orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,255,136,0.08) 0%, rgba(0,170,255,0.03) 40%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        <div className="relative z-10 max-w-2xl w-full text-center">
          {/* Title */}
          <div className="font-mono text-[11px] tracking-[6px] text-null-green uppercase mb-8">
            // NULLSTATE // NEW GAME
          </div>

          <h2 className="font-display font-black text-null-white mb-8" style={{ fontSize: '52px' }}>
            NEW WALKER
          </h2>

          {/* Username setup component */}
          <UsernameSetup
            onUsernameSet={handleUsernameSet}
            onCancel={handleBackToMenu}
            isLoading={isLoadingProfile}
          />

          {error && (
            <div className="mt-4 p-3 bg-[rgba(255,59,48,0.2)] border border-[rgba(255,59,48,0.5)] text-null-red font-mono text-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // PHASE: USERNAME SETUP (shown inside above, so this is redundant, but kept for clarity)
  if (phase === 'username-setup') {
    return (
      <UsernameSetup
        onUsernameSet={handleUsernameSet}
        onCancel={handleBackToMenu}
        isLoading={isLoadingProfile}
      />
    )
  }

  // PHASE: LEADERBOARD
  if (phase === 'leaderboard') {
    return (
      <Leaderboard
        onBack={handleBackToMenu}
        isLoading={isLoadingLeaderboard}
        entries={leaderboardEntries}
        currentWalletAddress={address}
      />
    )
  }

  // PHASE: REWARDS
  if (phase === 'rewards') {
    return (
      <RewardsScreen
        onBack={handleBackToMenu}
        address={address || undefined}
        playerProfile={playerProfile}
      />
    )
  }

  // PHASE: REFERRAL
  if (phase === 'referral') {
    return (
      <ReferralScreen
        onBack={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: SEASON PASS
  if (phase === 'season-pass') {
    return (
      <SeasonPassScreen
        onBack={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: MARKETPLACE
  if (phase === 'marketplace') {
    return (
      <MarketplaceScreen
        onBack={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: CRAFTING (Phase 4 — weapon evolution)
  if (phase === 'crafting') {
    return (
      <CraftingScreen
        onBack={handleBackToMenu}
        onGoToRun={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: HOW TO PLAY (Phase 2 — "The Loop" + progression explainer)
  if (phase === 'how-to-play') {
    return <HowToPlayScreen onBack={handleBackToMenu} />
  }

  // PHASE: CHARACTER / ITEMS — the only place outside a run where a player can
  // see and equip what they own. Before it existed, buying a weapon told you to
  // "equip it in your inventory" and there was no inventory to open.
  if (phase === 'character') {
    return (
      <CharacterSheet
        onBack={handleBackToMenu}
        onMarketplace={handleMarketplaceClick}
        playerProfile={playerProfile}
        initialTab={characterTab}
      />
    )
  }

  // PHASE: SETTINGS — the preferences that make sense OUTSIDE a run. The
  // in-run SettingsModal keeps the run-scoped half (Save Game, Exit, session
  // stats); this one owns the preferences, which are now persisted so both read
  // the same values.
  if (phase === 'settings') {
    return (
      <SettingsScreen
        onBack={handleBackToMenu}
        playerProfile={playerProfile}
        setPlayerUsername={setPlayerUsername}
      />
    )
  }

  // PHASE: GAME
  if (phase === 'game') {
    return (
      <DungeonGameWrapper
        playerProfile={playerProfile}
        setPlayerUsername={setPlayerUsername}
        isNewRun={isNewRun}
        startMode={startMode}
        raidActIndex={raidActIndex}
      />
    )
  }

  return null
}
