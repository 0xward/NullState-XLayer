'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GiBroadsword, GiLightningTrio, GiPotionBall, GiPadlock } from 'react-icons/gi'
import { attachLiveStatsBridge, subscribeLiveStats } from '@/lib/liveStatsBridge'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/WalletProvider'
import { PlayerProfile } from '@/lib/contract'
import { loadGameSession, saveGameSession, clearGameSession, saveGameSessionDraft, clearGameSessionDraft } from '@/lib/gameSessionService'
import { pickBestPaymentToken, type MarketplaceTokenSymbol } from '@/lib/constants/tokens'
import { recordRunKills, recordRunProgress } from '@/lib/leaderboardService'
import { GAME_CONFIG } from '@/lib/constants/game-config'
import { readWorldMapHubFlag } from '@/lib/worldMapHubFlag'
import { DEFAULT_SETTINGS, loadGameSettings, saveGameSettings } from '@/lib/gameSettings'
import { applyAudioSettings, setMusicVolume as setStoredMusicVolume, setSfxEnabled as setStoredSfxEnabled, setSoundMuted as setStoredSoundMuted } from '@/lib/audioControl'
import SettingsModal from './SettingsModal'
import { LiveStatsProvider } from './LiveStatsProvider'
import SaveConfirmModal from './SaveConfirmModal'
import HudStatLine from './HudStatLine'
import { loadEngineScript } from '@/lib/engineScript'
import '@/styles/dungeon.css'

// ─────────────────────────────────────────────────────────────────────────────
// DungeonGame — real-time canvas dungeon crawler (NULL_STATE // THE FORSAKEN
// DEPTHS) ported into the Next.js app. The proven vanilla-JS engine lives in
// /public/game-engine/* and exposes window.NullStateGame.{mount,unmount}. The
// engine's on-chain NULL_STRIKE is bridged to the existing wagmi wallet so the
// whole app uses ONE wallet system (RainbowKit / MiniPay / MetaMask on Celo).
// ─────────────────────────────────────────────────────────────────────────────

// The cache-busting build tag moved to lib/engineScript.ts along with the rest
// of the URL policy — these are static public/ files, so they get no automatic
// content hash and need `?v=<deploy>` to stop the CDN serving yesterday's copy.
const ENGINE_SCRIPTS = [
  'audio.js',
  'assets.js',
  'story.js',
  'story_campaign.js',
  'dungeon.js',
  'items.js',
  'marketplace-items.js',
  'props.js',
  'monster-config.js',
  'effects.js',
  'entities.js',
  'outdoor.js',
  'run-session.js',
  'game.js',
]

// Load the engine scripts exactly once, in order. lib/engineScript.ts owns
// which copy is served (minified in production, readable in dev) and the
// dedupe, so audio.js loaded earlier by MusicController is not fetched twice.
let enginePromise: Promise<void> | null = null
function loadEngine(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).NullStateGame) return Promise.resolve()
  if (enginePromise) return enginePromise

  enginePromise = ENGINE_SCRIPTS.reduce<Promise<void>>(
    (chain, name) => chain.then(() => loadEngineScript(name)),
    Promise.resolve()
  )

  return enginePromise
}

interface DungeonGameProps {
  playerProfile: PlayerProfile | null
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
  // True when entered via "New Game" — see GameFlowManager.tsx. When true,
  // the mount effect below skips loadGameSession() entirely instead of
  // silently resuming whatever bunker was last saved.
  isNewRun?: boolean
  // Which run the Main Menu chose. Passed to the engine's mount() as
  // startMode so it drops straight into play (no canvas title/preview):
  // 'new' | 'continue' | 'cycle' (New Game+) | 'abyss' (The Null Abyss).
  startMode?: 'new' | 'continue' | 'cycle' | 'abyss' | 'raid'
  /** Which bunker a raid targets; null for every other mode. */
  raidActIndex?: number | null
}

export default function DungeonGame({ playerProfile, setPlayerUsername, isNewRun, startMode, raidActIndex }: DungeonGameProps) {
  const wallet = useWallet()
  const router = useRouter()

  const [showSettings, setShowSettings] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  // Issue #2 fix: single source of truth for "is ANY full-screen overlay
  // open right now", used to hide TokenBalanceWidget instead of leaving it
  // floating on top of every modal. Covers both React-driven overlays
  // (showSettings gates SettingsModal; showExitConfirm gates both the
  // exit-confirm dialog AND SaveConfirmModal, which share the one flag) and
  // the vanilla-engine overlays (#invPanel, #containerWindow, #vaultWindow —
  // shown/hidden by game.js toggling a 'hidden' class, not React state) via
  // a MutationObserver watching those three DOM nodes. One gate, not
  // one-off checks scattered per modal.
  const [vanillaOverlayOpen, setVanillaOverlayOpen] = useState(false)
  // Seeded from the stored preferences instead of hardcoded defaults. These
  // used to reset on every mount, so muting the game lasted exactly one run —
  // leave the bunker and it was loud again. loadGameSettings() is SSR-safe and
  // falls back to these same defaults when storage is unavailable.
  const [soundMuted, setSoundMuted] = useState(DEFAULT_SETTINGS.soundMuted)
  const [musicVolume, setMusicVolume] = useState(DEFAULT_SETTINGS.musicVolume)
  const [sfxEnabled, setSfxEnabled] = useState(DEFAULT_SETTINGS.sfxEnabled)
  const [screenShakeEnabled, setScreenShakeEnabled] = useState(DEFAULT_SETTINGS.screenShakeEnabled)
  const [sessionStats, setSessionStats] = useState<{ depth: number; kills: number } | null>(null)
  // Phase 1 (Genius blueprint §2.6): out-of-energy modal state. Set by the
  // engine's energy bridge when a fresh bunker entry is denied; cleared on
  // successful refill or dismiss. `resetAt` drives the countdown line.
  const [energyModal, setEnergyModal] = useState<{ resetAt: number } | null>(null)
  const [energyBusy, setEnergyBusy] = useState(false)
  const [energyMsg, setEnergyMsg] = useState<string | null>(null)
  const [energyNow, setEnergyNow] = useState(Date.now())
  // Phase 2: banked Glitch Shard cache (ref, not state — read by the engine
  // via the materials bridge on its own repaint schedule, never re-renders React).
  const materialsRef = useRef<{ t1: number; t2: number; t3: number } | null>(null)
  // Phase 3 (blueprint §2.6): Drop-Rate Elixir. owned = unused elixirs,
  // activeUntil = ms epoch the 2x-drop buff expires. window.NS_DROPBUFF_UNTIL
  // (read by items.js rollItemDrop) is mirrored from activeUntil.
  const [elixir, setElixir] = useState<{ owned: number; activeUntil: number }>({ owned: 0, activeUntil: 0 })
  const [elixirModal, setElixirModal] = useState(false)
  const [elixirBusy, setElixirBusy] = useState(false)
  const [elixirMsg, setElixirMsg] = useState<string | null>(null)
  const [uiNow, setUiNow] = useState(Date.now())
  useEffect(() => {
    if (!energyModal) return
    const t = setInterval(() => setEnergyNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [energyModal])
  // ── WHAT TOMORROW IS WORTH ────────────────────────────────────────────────
  //
  // Running out of energy is the ONE moment this game knows for certain that
  // the player is about to stop. Until now the screen said "you are done" and
  // offered a $1 refill — a closing, and a bill.
  //
  // /stats says 78 people played this week and 1 played today. Whatever else is
  // true, nothing here was giving anyone a reason to come back, and this is the
  // single highest-leverage placement in the game for one.
  //
  // A GET, never the POST the map uses. Opening this modal must not register a
  // visit or hand out a day's reward — the streak is earned by opening the game
  // tomorrow, and quietly claiming it here would take that away.
  const [streakPeek, setStreakPeek] = useState<{
    day: number; streak: number; claimedToday: boolean
    ladder: { kind: string; amount: number; tier?: string }[]
    tomorrow: { kind: string; amount: number; tier?: string } | null
  } | null>(null)
  useEffect(() => {
    if (!energyModal) return
    const addr = walletRef.current.address
    if (!addr || streakPeek) return
    let alive = true
    fetch(`/api/streak?wallet=${encodeURIComponent(addr)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || d.error || !Array.isArray(d.ladder) || !d.ladder.length) return
        setStreakPeek({
          day: d.day ?? 1,
          streak: d.streak ?? 0,
          claimedToday: !!d.claimedToday,
          ladder: d.ladder,
          tomorrow: d.tomorrow ?? null,
        })
      })
      .catch(() => { /* offline — the modal just keeps its original two lines */ })
    return () => { alive = false }
  }, [energyModal, streakPeek])
  // 1Hz tick while an elixir buff is active or its modal is open (for the
  // countdown), otherwise idle.
  const elixirActive = elixir.activeUntil > uiNow
  useEffect(() => {
    if (!elixirActive && !elixirModal) return
    const t = setInterval(() => setUiNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [elixirActive, elixirModal])
  // Mirror the buff expiry into the engine global rollItemDrop() reads.
  useEffect(() => {
    ;(window as unknown as { NS_DROPBUFF_UNTIL?: number }).NS_DROPBUFF_UNTIL = elixir.activeUntil
  }, [elixir.activeUntil])

  const isDevWallet =
    !!wallet.address &&
    (process.env.NEXT_PUBLIC_DEV_TEST_WALLETS || '')
      .split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
      .includes(wallet.address.toLowerCase())

  /**
   * Which stablecoin to charge this wallet in.
   *
   * Both dollar purchases in this file used to hardcode 'USDm'. Every other
   * paid flow — Marketplace, Crafting, blueprints, shard packs — asks
   * pickBestPaymentToken which of USDm/USDC/USDT the wallet actually holds the
   * most of, which is also MiniPay's "Dynamic Adaptation" requirement.
   *
   * Hardcoding it meant a wallet holding USDC but no USDm sent a transfer that
   * moved nothing, and the server then correctly reported "No matching payment
   * to treasury found in this tx". Owner hit exactly that on elixir in the OKX
   * browser, with every other purchase working — because every other purchase
   * asked first.
   *
   * Falls back to USDm on any read failure, which is what pickBestPaymentToken
   * itself does, so a flaky RPC degrades to the old behaviour rather than
   * blocking the sale.
   */
  const bestToken = async (addr: string): Promise<MarketplaceTokenSymbol> => {
    try {
      return await pickBestPaymentToken(walletRef.current.publicClient, addr as `0x${string}`)
    } catch {
      return 'USDm'
    }
  }

  const handleEnergyRefill = async () => {
    if (energyBusy) return
    const addr = walletRef.current.address
    if (!addr) return
    setEnergyBusy(true)
    setEnergyMsg(isDevWallet ? 'DEV: requesting free refill…' : 'Sending $1…')
    try {
      let txHash = ''
      let token: MarketplaceTokenSymbol = 'USDm'
      if (!isDevWallet) {
        token = await bestToken(addr)
        txHash = await walletRef.current.buyMarketplaceItem(1, token)
        setEnergyMsg('Payment sent — verifying on-chain…')
      }
      const res = await fetch('/api/energy/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet ? { wallet: addr, devBypass: true } : { wallet: addr, txHash, token },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refill failed')
      setEnergyMsg(null)
      setEnergyModal(null) // energy restored — walk back to the door to enter
    } catch (e: unknown) {
      setEnergyMsg(e instanceof Error ? e.message : 'Refill failed')
    } finally {
      setEnergyBusy(false)
    }
  }

  // Phase 3: refresh elixir state from the server (owned + active buff).
  const refreshElixir = useCallback(async () => {
    const addr = walletRef.current.address
    if (!addr) return
    try {
      const r = await fetch(`/api/elixir?wallet=${addr}`)
      const d = await r.json()
      if (r.ok && typeof d?.owned === 'number') {
        setElixir({ owned: d.owned, activeUntil: d.activeUntil || 0 })
      }
    } catch { /* offline — keep last known */ }
  }, [])

  const handleElixirBuy = async () => {
    if (elixirBusy) return
    const addr = walletRef.current.address
    if (!addr) return
    setElixirBusy(true)
    setElixirMsg(isDevWallet ? 'DEV: requesting free elixir…' : 'Sending $1…')
    try {
      let txHash = ''
      let token: MarketplaceTokenSymbol = 'USDm'
      if (!isDevWallet) {
        token = await bestToken(addr)
        txHash = await walletRef.current.buyMarketplaceItem(1, token)
        setElixirMsg('Payment sent — verifying on-chain…')
      }
      const res = await fetch('/api/elixir/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet ? { wallet: addr, devBypass: true } : { wallet: addr, txHash, token },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')
      setElixir({ owned: data.owned ?? 0, activeUntil: data.activeUntil ?? 0 })
      setElixirMsg('✓ Elixir added — drink it to start the 2× drop buff.')
    } catch (e: unknown) {
      setElixirMsg(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setElixirBusy(false)
    }
  }

  const handleElixirUse = async () => {
    if (elixirBusy) return
    const addr = walletRef.current.address
    if (!addr) return
    setElixirBusy(true)
    setElixirMsg('Drinking…')
    try {
      const res = await fetch('/api/elixir/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: addr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Use failed')
      if (!data.ok) { setElixirMsg('No elixirs to drink — buy one first.'); return }
      setElixir({ owned: data.owned ?? 0, activeUntil: data.activeUntil ?? 0 })
      setElixirMsg('✦ Loot sharpens. 2× drop chance is active.')
    } catch (e: unknown) {
      setElixirMsg(e instanceof Error ? e.message : 'Use failed')
    } finally {
      setElixirBusy(false)
    }
  }

  const refreshSessionStats = () => {
    const NSG = (window as any).NullStateGame
    if (!NSG || typeof NSG.getSaveSnapshot !== 'function') {
      setSessionStats(null)
      return null
    }
    const snap = NSG.getSaveSnapshot()
    setSessionStats(snap ? { depth: snap.depth, kills: snap.kills } : null)
    return snap
  }

  const handleSaveGame = async (): Promise<boolean> => {
    const NSG = (window as any).NullStateGame
    const addr = wallet.address
    if (!NSG || !addr) return false
    const snap = NSG.getSaveSnapshot?.()
    if (!snap) return false
    const ok = await saveGameSession(addr, snap)
    // Kill count is otherwise only folded into the leaderboard when the
    // player dies (on-chain executeAction -> recordRunKills, see
    // useContractPlayer.ts). A manual Save & Exit never triggers that
    // on-chain event, so without this the leaderboard's totalKills stayed
    // stuck at whatever it was after the last death, even though the run's
    // real kill count kept climbing. recordRunKills is dedup-safe (see
    // leaderboardService.ts) so calling it here plus later on death can't
    // double-count, and this never touches/loses the on-chain kill history.
    // GUEST runs never touch the public leaderboard (owner: guests play + save
    // to Firebase but "tidak masuk leaderboard"). The bunker save itself above
    // still persists so a guest can Continue; only these leaderboard writes are
    // skipped.
    if (!wallet.isGuest) {
      if (typeof snap.kills === 'number') {
        recordRunKills(addr, snap.kills)
      }
      // Same reasoning applies to xp/level: combat and progression are now
      // fully off-chain (no executeAction / register() tx), so xp/level live
      // only in Firestore. recordRunProgress keeps the Rewards screen's
      // numbers (which read from useContractPlayer -> this same Firestore
      // doc) in sync with what the in-game HUD actually shows.
      if (typeof snap.xp === 'number' && typeof snap.level === 'number') {
        recordRunProgress(addr, snap.xp, snap.level)
      }
    }
    return ok
  }

  // All three audio controls go through lib/audioControl, the single place that
  // stores a preference AND pushes the whole resulting state into the engine.
  //
  // They used to call NSG.toggleSound/toggleSfx directly, which is how the
  // master switch ended up broken: NSG.toggleSound maps to the engine's
  // toggleMute, and that only silences the MUSIC bed — effects kept playing
  // through a switch labelled "Sound". audioControl derives both from one
  // model (SFX audible = not muted AND effects wanted), so no control can
  // set half the picture any more.
  const handleToggleSound = () => {
    const next = setStoredSoundMuted(!soundMuted)
    setSoundMuted(next.soundMuted)
    setSfxEnabled(next.sfxEnabled)
  }

  const handleMusicVolumeChange = (value: number) => {
    setMusicVolume(setStoredMusicVolume(value).musicVolume)
  }

  const handleToggleSfx = () => {
    setSfxEnabled(setStoredSfxEnabled(!sfxEnabled).sfxEnabled)
  }

  const handleToggleScreenShake = () => {
    const NSG = (window as any).NullStateGame
    const enabled = NSG?.toggleScreenShake?.()
    const v = enabled !== undefined ? !!enabled : !screenShakeEnabled
    setScreenShakeEnabled(v)
    saveGameSettings({ screenShakeEnabled: v })
  }

  const handleOpenSettings = () => {
    refreshSessionStats()
    setShowSettings(true)
  }

  const handleExitClick = () => {
    refreshSessionStats()
    setShowExitConfirm(true)
  }

  const handleSaveAndExit = async () => {
    await handleSaveGame()
    router.push('/')
  }

  const handleExitWithoutSaving = () => {
    router.push('/')
  }

  // Keep the latest wallet in a ref so the engine bridge always reads
  // current values (wagmi state changes between renders after connect()).
  const walletRef = useRef(wallet)
  walletRef.current = wallet

  // Keep the engine's WALLET_ADDRESS in sync so the 'nullstate-items-burned'
  // event always carries the correct address, even if the wallet connects
  // (or switches accounts) after the engine has already mounted.
  useEffect(() => {
    const NSG = (window as any).NullStateGame
    NSG?.setWalletAddress?.(wallet.address ?? null)
  }, [wallet.address])

  // Issue #2 fix: watch the three vanilla-engine overlay DOM nodes
  // (#invPanel, #containerWindow — e.g. the Rotten Armoire, #vaultWindow)
  // for their 'hidden' class flipping. game.js is the single place that
  // toggles that class open/closed already (openContainerWindow(),
  // toggleInventory(), openVaultWindow(), closeVaultWindow(), etc.) —
  // rather than teaching every one of those call sites to also update React
  // state, observe the DOM once here and derive one boolean from it.
  useEffect(() => {
    // Extended to cover every full-screen overlay the engine uses:
    // itemZoom (tap-to-inspect), liftMenu, death screen, story/tutorial,
    // title screen — all of which can appear while the POINT pill is rendered
    // and would otherwise be occluded by it.
    const ids = ['invPanel', 'containerWindow', 'vaultWindow', 'itemZoom', 'liftMenu', 'death', 'story', 'tutorial']
    const nodes = ids.map(id => document.getElementById(id)).filter((n): n is HTMLElement => !!n)
    if (nodes.length === 0) return

    const recompute = () => {
      const anyOpen = nodes.some(n => !n.classList.contains('hidden'))
      setVanillaOverlayOpen(anyOpen)
    }

    recompute()
    const observer = new MutationObserver(recompute)
    nodes.forEach(n => observer.observe(n, { attributes: true, attributeFilter: ['class'] }))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    // The chain bridge handed to the engine. NULL_STRIKE is now FREE
    // (Phase 0 — owner decision): the special is gated by an in-engine
    // cooldown instead of an on-chain fee, so this bridge is a no-op that
    // always resolves successfully. Kept only to satisfy the engine's
    // NS_CHAIN.ultiTx() -> { ok, demo, hash } contract at mount time.
    const chain = {
      async ultiTx() {
        return { ok: true, demo: true, hash: null }
      },
    }

    // Block the browser's native pull-to-refresh / overscroll gesture while
    // the game is mounted. The CSS (overscroll-behavior + touch-action on
    // .ns-game-root) handles most cases, but some Android Chrome versions
    // still trigger pull-to-refresh from a touchmove that starts outside
    // any touch-action:none element, so this is a JS-level backstop.
    // Passive:false is required for preventDefault() to actually take effect.
    const preventPullToRefresh = (e: TouchEvent) => {
      if (e.touches.length > 1) return // allow pinch gestures to pass through untouched
      const target = e.target as HTMLElement
      // These rely on native touch scrolling/dragging — the Settings modal
      // (scrollable panel + the volume <input type="range"> slider) was
      // missing here, which is why on touch browsers (mobile Chrome, and
      // especially in-app browsers like OKX Wallet / MiniPay that route ALL
      // touchmove through this same global listener) the settings popup
      // couldn't be scrolled and the volume slider felt stuck/janky: every
      // touchmove on top of it was being preventDefault()-ed before the
      // browser's native scroll/slider-drag handling ever got a chance to run.
      if (target.closest('.inv-panel-inner, .lift-floor-list, .ns-settings-panel, .ns-settings-slider')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false })

    // Item #10 fix (Option C): holds the detach function returned by
    // attachLiveStatsBridge() once the engine mounts (see below), so the
    // cleanup at the bottom of this effect can tear it down cleanly.
    let detachLiveStatsBridge: (() => void) | null = null

    loadEngine()
      .then(async () => {
        if (cancelled) return
        const NSG = (window as any).NullStateGame
        if (!NSG || typeof NSG.mount !== 'function') return

        const addr = walletRef.current.address
        let savedSession = null as any
        if (addr) {
          if (startMode === 'raid') {
            // A RAID builds its own run from scratch (startRaid in game.js), so
            // it needs no snapshot — and must not go near the one on disk. The
            // Continue branch below CONSUMES the save it reads, which for a raid
            // would silently delete the campaign the player is midway through.
            // Nothing loaded, nothing cleared.
          } else if (isNewRun) {
            // Entered via "New Game" (GameFlowManager already asked for
            // confirmation if a save existed — see NewGameConfirmModal).
            // Deliberately skip loadGameSession() so this run always starts
            // from a clean Bunker 1, and proactively clear whatever's left
            // in Firestore so a later "Continue" can't resurrect a session
            // the player was already told would be discarded.
            try { await clearGameSession(addr) } catch { /* best-effort */ }
          } else {
            try {
              savedSession = await loadGameSession(addr)
              if (savedSession) {
                // Single-use: consume it now so a stale reload can't replay it.
                await clearGameSession(addr)
              }
            } catch {
              /* no saved session, or Firebase unreachable — fall through to a fresh run */
            }
          }
          // Refresh the Marketplace "owned equipment" + "equipped slots"
          // caches from the server BEFORE the engine mounts. game.js's
          // newGame() reads these exact localStorage keys synchronously the
          // moment a run starts (see loadPersistedEquipment() in game.js) —
          // without this, a purchase/equip made on another device (or
          // before the reinstall wiped this HP's localStorage) wouldn't
          // show up in the dungeon's Inventory/Gear tab until the player
          // happened to open the Marketplace screen first. Equipped slots
          // are persisted server-side (Firebase, per wallet — see
          // /api/marketplace/equip) precisely so they survive a MiniPay
          // uninstall/reinstall the same way owned items already do; the
          // localStorage copy here is just an instant-read cache of that.
          // Best-effort: if this fails (offline, etc.) whatever's already
          // cached from a previous visit still applies.
          try {
            const res = await fetch(`/api/marketplace/owned?wallet=${addr}`)
            const data = await res.json()
            if (Array.isArray(data?.owned)) {
              localStorage.setItem(`nullstate-owned-${addr.toLowerCase()}`, JSON.stringify(data.owned))
            }
            if (data?.equipped) {
              localStorage.setItem(`nullstate-equipped-${addr.toLowerCase()}`, JSON.stringify(data.equipped))
            }
          } catch {
            /* offline / API unreachable — keep whatever's already cached */
          }
          // TASK #7 — resolve active Season-Pass status (on-chain hasPass) and
          // write the holder flag to localStorage BEFORE the engine mounts, so
          // game.js loadPersistedEquipment() grants the exclusive skin
          // synchronously on this run (mirrors the owned/equipped cache above).
          // The pass status is SHOWN to the player in the Settings modal, not
          // the HUD (owner: no pass badge in-game).
          try {
            const pr = await fetch(`/api/passsbt/perks?wallet=${addr}`)
            const pd = await pr.json()
            const holder = pr.ok && pd?.hasPass === true
            localStorage.setItem(`nullstate-pass-${addr.toLowerCase()}`, holder ? '1' : '0')
          } catch {
            /* offline — keep whatever flag is already cached */
          }
        }
        if (cancelled) return

        // Item #10 fix (Option C): attach the live-stats bridge right before
        // the engine mounts, so game.js's very first updateHUD() call (which
        // fires as part of NSG.mount -> newGame()/loadSession()) already has
        // a listener ready. Detached in this effect's cleanup below.
        detachLiveStatsBridge = attachLiveStatsBridge()

        NSG.mount({
          chain,
          // Skip the canvas title/preview and start the chosen run directly.
          // Fall back to new/continue from isNewRun for any caller that
          // doesn't pass an explicit mode.
          startMode: startMode ?? (isNewRun ? 'new' : 'continue'),
          // Which bunker a RAID re-enters (GAME-DESIGN.md §7). Ignored by every
          // other start mode; the engine clamps it to a real act either way.
          raidActIndex: typeof raidActIndex === 'number' ? raidActIndex : null,
          // With the world-map hub on, clearing a bunker surfaces back to the
          // map instead of auto-walking into the next act (see game.js
          // onOutdoorAdvanceToNextAct). Off = the classic uninterrupted flow.
          worldMapHub: readWorldMapHubFlag(),
          // New Game = a total reset (owner): the run starts at Level 1 / 0 XP
          // regardless of career level. Continue keeps the player's level.
          // Gear/skins/Points/crafting/pass/referrals are separate systems and
          // are untouched either way.
          initialStats: isNewRun
            ? { xp: 0, level: 1 }
            : playerProfile
              ? { xp: playerProfile.xp, level: playerProfile.level }
              : null,
          savedSession,
          // Phase 1 energy bridge — server-authoritative spend at every
          // FRESH bunker entry. Fail-open by design: wallet-less mounts and
          // network/server errors return ok:true so connectivity can never
          // lock a player out of the game (the server still enforces the
          // real cap next time it's reachable).
          energy: {
            trySpend: async () => {
              const addr = walletRef.current.address
              if (!addr) return { ok: true }
              try {
                const r = await fetch('/api/energy/spend', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ wallet: addr }),
                })
                const d = await r.json()
                if (!r.ok) return { ok: true }
                return d
              } catch {
                return { ok: true }
              }
            },
            onExhausted: (state: { resetAt?: number }) => {
              setEnergyMsg(null)
              setEnergyModal({ resetAt: state?.resetAt || Date.now() + 24 * 3600 * 1000 })
            },
          },
          // Phase 2 materials bridge — banked Glitch Shard balance (cached in
          // a ref for the engine's inventory display) + end-of-run credit.
          materials: {
            banked: () => materialsRef.current,
            credit: async (payout: { t1: number; t2: number; t3: number }) => {
              const addr = walletRef.current.address
              if (!addr) return null
              try {
                const r = await fetch('/api/materials/credit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ wallet: addr, ...payout }),
                })
                const d = await r.json()
                if (r.ok && d?.success) {
                  materialsRef.current = { t1: d.t1 || 0, t2: d.t2 || 0, t3: d.t3 || 0 }
                }
                return d
              } catch {
                return null
              }
            },
          },
        })
        // Seed the banked-materials cache (best-effort; display-only).
        {
          const addr = walletRef.current.address
          if (addr) {
            fetch(`/api/materials?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                if (d && typeof d.t1 === 'number') {
                  materialsRef.current = { t1: d.t1, t2: d.t2 || 0, t3: d.t3 || 0 }
                }
              })
              .catch(() => { /* display-only cache — offline is fine */ })
            // Phase 4 — seed the wallet's weapon-evolution tiers into the engine
            // so an evolved weapon renders its extra ATK + tint/glow the moment
            // this run mounts (NS_EQUIP.setTiers re-applies equipment).
            fetch(`/api/weapons?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                const tiers = d && d.tiers && typeof d.tiers === 'object' ? d.tiers : null
                if (tiers) {
                  const NS = (window as unknown as { NS_EQUIP?: { setTiers?: (m: Record<string, number>) => void } }).NS_EQUIP
                  NS?.setTiers?.(tiers)
                }
              })
              .catch(() => { /* offline — base tiers, non-critical */ })
            // Phase 8 — seed owned Premium Sector Blueprints so an owned act's
            // run spawns its guaranteed Glitch-Shard cache (NS_EQUIP.setBlueprints).
            fetch(`/api/blueprints?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                const owned = d && Array.isArray(d.owned) ? d.owned : null
                if (owned) {
                  const NS = (window as unknown as { NS_EQUIP?: { setBlueprints?: (l: string[]) => void } }).NS_EQUIP
                  NS?.setBlueprints?.(owned)
                }
              })
              .catch(() => { /* offline — no bonus caches, non-critical */ })
            // TASK #7 — bridge active pass status into the engine so the
            // exclusive skin grant survives a live shop-owned push (setOwned)
            // and the Gear tab re-injects it. The pre-mount localStorage flag
            // already granted it for this run's initial load; this keeps the
            // engine's PASS_HOLDER flag in sync if hasPass resolved late.
            fetch(`/api/passsbt/perks?wallet=${addr}`)
              .then(r => r.json())
              .then(d => {
                const NS = (window as unknown as { NS_EQUIP?: { setPassHolder?: (v: boolean) => void } }).NS_EQUIP
                NS?.setPassHolder?.(d?.hasPass === true)
              })
              .catch(() => { /* offline — flag already applied from localStorage */ })
            refreshElixir() // Phase 3: seed elixir state + mirror the buff global
          }
        }
        NSG.setWalletAddress?.(walletRef.current.address ?? null)

        // Push the player's SAVED preferences into the freshly-mounted engine.
        // Before this existed the engine started at its own defaults every
        // mount and React simply agreed with it, which is why muting the game
        // never survived leaving a run.
        const prefs = loadGameSettings()
        applyAudioSettings(prefs)
        setSoundMuted(prefs.soundMuted)
        setMusicVolume(prefs.musicVolume)
        setSfxEnabled(prefs.sfxEnabled)
        // Screen shake is engine-only (no Audio2 involvement) and has no
        // getter, so the stored value IS the truth; push it only when it
        // differs from the engine's on-by-default.
        if (!prefs.screenShakeEnabled) NSG.toggleScreenShake?.()
        setScreenShakeEnabled(prefs.screenShakeEnabled)
      })
      .catch(err => console.error('NullState engine failed to load:', err))

    // ── Auto-save (Phase 1: event-driven, Firestore-write-frugal) ──────────
    // Old model: a blind setInterval(silentSave, 15000) wrote the bunker doc
    // AND both leaderboard docs every 15s for every active player. On
    // Firestore's free tier (20k writes/day) that capped us at ~80 concurrent
    // players/hour before writes silently started failing ("game mati diam-
    // diam"). New model:
    //   • Draft the snapshot to localStorage on EVERY meaningful change
    //     (cheap, instant, no quota) so a crash/refresh never loses progress.
    //   • Flush to Firestore only at moments that matter — floor up, level up,
    //     tab-hide/unload — coalesced through a short debounce, plus a slow
    //     60s safety net (was 15s). This lifts the ceiling to ~700-1000
    //     concurrent players/hour on the same free tier.
    const readSnapshot = () => {
      const NSG = (window as any).NullStateGame
      const addr = walletRef.current.address
      if (!NSG || !addr || typeof NSG.getSaveSnapshot !== 'function') return null
      const snap = NSG.getSaveSnapshot()
      return snap ? { addr, snap } : null
    }

    // Tracks whether the local draft has advanced past what's in Firestore,
    // so the slow safety net can skip the write when nothing has changed.
    let dirty = false

    // Cheap local draft — no network, no quota. Called liberally.
    const writeDraft = () => {
      const cur = readSnapshot()
      if (cur) { saveGameSessionDraft(cur.addr, cur.snap); dirty = true }
    }

    // The real network write: bunker snapshot + (for non-guests) leaderboard.
    const flushToFirestore = () => {
      const cur = readSnapshot()
      if (!cur) return
      const { addr, snap } = cur
      saveGameSession(addr, snap)
      clearGameSessionDraft(addr) // draft is now safely upstream
      dirty = false
      // Guests save their bunker but never enter the leaderboard.
      if (!walletRef.current.isGuest && typeof snap.kills === 'number') recordRunKills(addr, snap.kills)
      if (!walletRef.current.isGuest && typeof snap.xp === 'number' && typeof snap.level === 'number') {
        recordRunProgress(addr, snap.xp, snap.level)
      }
    }

    // Debounced flush — coalesces a burst of meaningful events (e.g. a
    // level-up on the same frame as a floor change) into one Firestore write.
    let flushTimer: number | null = null
    const scheduleFlush = () => {
      writeDraft() // capture immediately in case the page dies before the flush
      if (flushTimer !== null) return
      flushTimer = window.setTimeout(() => {
        flushTimer = null
        flushToFirestore()
      }, 2500)
    }

    // Immediate flush for page-teardown paths (tab hide / unload). Cancels any
    // pending debounce so we don't double-write.
    const flushNow = () => {
      if (flushTimer !== null) { window.clearTimeout(flushTimer); flushTimer = null }
      flushToFirestore()
    }

    // Drive flushes off the engine's live-stats announcements (emitted from
    // updateHUD() after every kill/level-up/floor-change/pickup). We only
    // spend a Firestore write when the FLOOR or LEVEL actually advances; every
    // other tick just refreshes the cheap local draft.
    let lastFloor = -1
    let lastLevel = -1
    const unsubscribeStats = subscribeLiveStats((s) => {
      const floorUp = lastFloor >= 0 && s.floor > lastFloor
      const levelUp = lastLevel >= 0 && s.level > lastLevel
      lastFloor = s.floor
      lastLevel = s.level
      if (floorUp || levelUp) scheduleFlush()
      else writeDraft()
    })

    // Death/respawn: fold the run into Firestore right away (the wrapper also
    // records leaderboard kills/xp on this event; this additionally persists
    // the bunker snapshot so "Continue" reflects where they fell).
    const onDeath = () => flushNow()
    window.addEventListener('nullstate-player-death', onDeath)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushNow()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // pagehide/beforeunload are the teardown backstops for an accidental
    // refresh (pull-to-refresh, reload in OKX/MiniPay's in-app browser) that
    // would otherwise tear the page down before a write reaches the network.
    // The localStorage draft (written on every meaningful change above) is the
    // true belt-and-suspenders here — even if these flushes are cut off, the
    // draft survives the reload.
    window.addEventListener('pagehide', flushNow)
    window.addEventListener('beforeunload', flushNow)
    // Slow safety net (was 15s). Only writes when the draft has advanced
    // since the last flush — an idle player costs zero Firestore writes.
    const autosaveInterval = window.setInterval(() => { if (dirty) flushNow() }, 60000)

    return () => {
      cancelled = true
      document.removeEventListener('touchmove', preventPullToRefresh)
      unsubscribeStats()
      window.removeEventListener('nullstate-player-death', onDeath)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushNow)
      window.removeEventListener('beforeunload', flushNow)
      if (flushTimer !== null) window.clearTimeout(flushTimer)
      window.clearInterval(autosaveInterval)
      if (detachLiveStatsBridge) detachLiveStatsBridge()
      const NSG = (window as any).NullStateGame
      if (NSG && typeof NSG.unmount === 'function') NSG.unmount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    // Item #10 fix (Option C): everything rendered below — including
    // SettingsModal — can now call useLiveStats() to read the exact same
    // live xp/level/kills/floor numbers the canvas HUD is painting, instead
    // of a Firestore snapshot that only updates on death/save.
    <LiveStatsProvider>
    <div className="ns-game-root">
      <div id="app">
        <canvas id="game" />

        {/* HUD redesign (owner): the top-left "◂ EXIT" button was removed —
            Exit now lives INSIDE Settings, directly under Save Game (see
            SettingsModal's onExit). That frees the top-left corner so the
            HP/XP bars + the compact stat line can sit flush against it. */}

        {/* Compact stat line — "Point · Level · Floor · Kills", pinned top-left
            just under the bars. Replaces the old standalone POINT pill AND the
            oversized top-right LV/FLOOR/KILLS boxes. Fully unmounts (not just
            z-index'd behind) whenever ANY full-screen overlay is open —
            Settings, the exit-confirm dialog, the inventory panel, a loot
            container, or the weekly Vault — so it never overlaps them. */}
        <HudStatLine
          walletAddress={wallet.address}
          hidden={showSettings || showExitConfirm || vanillaOverlayOpen}
        />

        {/* Low-HP vignette — see #12. Opacity is driven entirely from
            game.js's updateHUD() (proportional to how far below the 20%
            HP threshold the player currently is), never by CSS alone, so
            it always matches the HP bar's own tier exactly. Sits above the
            canvas but below all interactive HUD controls (pointer-events
            stays off so it never blocks taps). */}
        <div id="hpVignette" className="hp-vignette" />

        {/* HUD */}
        <div id="hud" className="hidden">
          {/* HUD redesign (owner): only the HP/XP bars live here now, shifted
              hard into the top-left corner and cropped shorter. The old
              top-right LV/FLOOR/KILLS stat boxes were removed — those numbers
              are now in the compact React <HudStatLine> under the bars (the
              engine still emits them via the live-stats bridge). */}
          <div className="hud-top">
            <div className="hud-left">
              <div className="bar-row">
                <span className="bar-label">HP</span>
                <div className="bar hp">
                  <div id="hpFill" className="bar-fill" />
                  <span id="hpText" className="bar-text">100/100</span>
                </div>
              </div>
              <div className="bar-row">
                <span className="bar-label">XP</span>
                <div className="bar xp">
                  <div id="xpFill" className="bar-fill" />
                  <span id="xpText" className="bar-text">0/200</span>
                </div>
              </div>
            </div>
          </div>

          <div id="floorBanner" className="floor-banner" />

          {/* Punch list #1 follow-up (v39b): compact English warning toast,
              shown every time Take/Take All hits an item's stack cap.
              Separate element from #floorBanner on purpose — that one is
              the big lore-y "FLOOR SECURED" banner, this is a small plain
              warning that fades in/out on its own (see showStashFullWarning
              in game.js). */}
          <div id="stashFullWarning" className="stash-full-warning" />

          <div id="log" className="log" />

          {/* ── Right-hand control rail (settings / bag / elixir / mute) ──
              Owner: use the map's buttons in here too, and at the map's size.

              The four used to be positioned one by one, each with its own
              `top:` in two orientations — eight numbers that had to agree for
              the cluster to look like a cluster. They are one flex column now,
              so the size and the gap are each stated once and the run of
              buttons cannot drift apart again.

              Icons are the rail's own files at the rail's own 46px (they were
              30px, which is why they read as a different, smaller control set
              than the map two taps away). Sizing lives in dungeon.css rather
              than inline here, so the short-viewport rule can actually shrink
              them — an inline style would have won over it. */}
          <div className="ns-hud-rail">
          {/* Settings button — progress, save game, username, sound, links.
              First in the column because that is where it has always been on
              screen; the old `top:` values put it above the bag even though
              the bag came first in the markup. */}
          <button
            type="button"
            className="ns-settings-trigger is-mapicon"
            aria-label="Settings"
            onClick={handleOpenSettings}
          >
            {/* Same gear the world map rail uses. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ns-hud-ico" src="/worldmap/icons/gear.webp" alt="" aria-hidden="true" width={46} height={46} />
          </button>

          <button id="invBtn" className="inv-btn is-mapicon" aria-label="Inventory">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ns-hud-ico" src="/worldmap/icons/bag.webp" alt="" aria-hidden="true" width={46} height={46} />
          </button>
          {/* Phase 3 — Drop-Rate Elixir button. Sits under the settings gear
              in the same right-hand control cluster. Shows a live countdown
              badge while the 2× buff is active, or an owned-count badge when
              elixirs are stocked but not yet drunk. */}
          <button
            type="button"
            className="ns-elixir-trigger is-mapicon"
            aria-label="Drop-Rate Elixir"
            onClick={() => { setElixirModal(true); setElixirMsg(null); refreshElixir() }}
          >
            {/* Generated to match the rail set — see assets-src/worldmap/icons. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ns-hud-ico" src="/worldmap/icons/elixir.webp" alt="" aria-hidden="true" width={46} height={46} />
            {elixirActive ? (
              <span className="ns-elixir-badge ns-elixir-badge-timer">
                {(() => {
                  const ms = Math.max(0, elixir.activeUntil - uiNow)
                  const m = Math.floor(ms / 60000)
                  const s = Math.floor((ms % 60000) / 1000)
                  return `${m}:${String(s).padStart(2, '0')}`
                })()}
              </span>
            ) : elixir.owned > 0 ? (
              <span className="ns-elixir-badge">{elixir.owned}</span>
            ) : null}
          </button>
          {/* Mute toggle — always-visible one-tap sound on/off in the HUD
              cluster (owner: "mute gampang dilihat"). Mirrors the same
              handleToggleSound + soundMuted state the Settings modal uses, so
              the two stay in sync. Icon + red tint reflect the muted state. */}
          <button
            type="button"
            className={`ns-mute-trigger is-mapicon${soundMuted ? ' is-muted' : ''}`}
            aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
            aria-pressed={soundMuted}
            onClick={handleToggleSound}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="ns-hud-ico"
              src={soundMuted ? '/worldmap/icons/volume_off.webp' : '/worldmap/icons/volume.webp'}
              alt="" aria-hidden="true" width={46} height={46}
            />
          </button>
          </div>
          {/* Inventory — a centered modal (like #containerWindow/#itemZoom)
              rather than a small corner panel, so it never sits under the
              minimap/settings gear and always has room to show a full,
              legible 5-column item grid. */}
          <div id="invPanel" className="overlay hidden">
            <div className="inv-panel-inner">
              <div className="inv-panel-head">
                <span>INVENTORY</span>
                <button id="invClose" className="inv-close" aria-label="Close">✕</button>
              </div>
              <div className="inv-vitals">
                <div className="inv-vital-row">
                  <span className="bar-label">HP</span>
                  <div className="bar hp"><div id="invHpFill" className="bar-fill" /><span id="invHpText" className="bar-text">100/100</span></div>
                </div>
                <div className="inv-vital-row">
                  <span className="bar-label">XP</span>
                  <div className="bar xp"><div id="invXpFill" className="bar-fill" /><span id="invXpText" className="bar-text">0/200</span></div>
                </div>
              </div>
              {/* Phase 2: Glitch Shard strip (run + banked) — filled by
                  updateInventoryPanel() in game.js; hidden until any exist. */}
              <div id="invMaterials" className="inv-materials hidden" />
              <div className="inv-tabs">
                <button className="inv-tab active" data-tab="loot">LOOT</button>
                <button className="inv-tab" data-tab="food">FOOD</button>
                <button className="inv-tab" data-tab="equipment">GEAR</button>
              </div>
              <div id="invItems" className="inv-items">
                <div className="inv-empty" id="invEmpty">No items yet — explore the depths.</div>
              </div>
              <div id="burnSummary" className="burn-summary" />
              <button id="burnConfirm" className="big-btn burn-confirm" disabled>BURN SELECTED</button>
            </div>
          </div>

          <div id="touchControls" className="touch hidden">
            <div id="stick" className="stick"><div id="stickNub" className="nub" /></div>
            <button id="atkBtn" className="atk" aria-label="Attack"><GiBroadsword aria-hidden size={26} /></button>
          </div>

          <div className="hint">WASD / Arrows · move&nbsp;&nbsp;·&nbsp;&nbsp;SPACE / J / Click · attack&nbsp;&nbsp;·&nbsp;&nbsp;E · interact</div>
        </div>

        {/* Phase 1 — OUT OF ENERGY modal. Shown when a fresh bunker entry is
            denied by /api/energy/spend. The free path (wait for the 24h
            window) is always shown side-by-side with the paid refill, per
            the blueprint's "tempting, not predatory" guardrail. */}
        {energyModal && (
          <div className="overlay" style={{ zIndex: 40 }}>
            <div className="lift-inner" style={{ textAlign: 'center' }}>
              <div className="logo" style={{ fontSize: '20px' }}>OUT OF ENERGY</div>
              <div className="subtitle">// THE DEPTHS DEMAND REST</div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#cfeede', margin: '14px 0 4px' }}>
                You&apos;ve used your {GAME_CONFIG.energy.freeRunsPerDay} free runs.
              </p>
              <p style={{ fontSize: 13, color: '#ffd166', margin: '0 0 14px' }}>
                Free energy restores in{' '}
                <b>
                  {(() => {
                    const ms = Math.max(0, energyModal.resetAt - energyNow)
                    const h = Math.floor(ms / 3600000)
                    const m = Math.floor((ms % 3600000) / 60000)
                    return `${h}h ${String(m).padStart(2, '0')}m`
                  })()}
                </b>
              </p>
              {/* TOMORROW. The reason to come back, placed at the exact moment
                  the player is deciding whether to. Only drawn once there is a
                  real streak to show — a ladder with nothing on it is furniture,
                  and a player who has never logged a day is not being reminded
                  of anything. */}
              {streakPeek && streakPeek.ladder.length > 0 && streakPeek.streak > 0 && (
                <div className="ns-exit-streak">
                  <p className="ns-exit-streak-h">
                    <span aria-hidden="true">🔥</span> {streakPeek.streak}-day streak · come back tomorrow
                  </p>
                  <ol className="ns-streak-ladder">
                    {streakPeek.ladder.map((r, i) => {
                      const dayNo = i + 1
                      const banked = dayNo < streakPeek.day
                        || (dayNo === streakPeek.day && streakPeek.claimedToday)
                      // TOMORROW is the lit tile here, not today — today is spent,
                      // and the whole point of this screen is the next one.
                      const next = dayNo === (streakPeek.claimedToday ? streakPeek.day + 1 : streakPeek.day)
                      const jackpot = dayNo === streakPeek.ladder.length
                      return (
                        <li
                          key={dayNo}
                          className={`ns-streak-day${banked ? ' is-done' : ''}${next ? ' is-today' : ''}${jackpot ? ' is-jackpot' : ''}`}
                        >
                          <span className="ns-streak-daynum">{jackpot ? '★7' : dayNo}</span>
                          <span className={`ns-streak-ico is-${r.kind}`} aria-hidden="true">
                            {r.kind === 'point' ? '◆' : r.kind === 'shard' ? '◈' : '⚡'}
                          </span>
                          <span className="ns-streak-amt">{r.kind === 'energy' ? `+${r.amount}` : r.amount}</span>
                          {banked && <span className="ns-streak-tick" aria-hidden="true">✓</span>}
                        </li>
                      )
                    })}
                  </ol>
                  {streakPeek.tomorrow && (
                    <p className="ns-exit-streak-note">
                      Tomorrow pays <b>
                        +{streakPeek.tomorrow.amount}{' '}
                        {streakPeek.tomorrow.kind === 'point' ? 'Point'
                          : streakPeek.tomorrow.kind === 'shard' ? `Shard ${String(streakPeek.tomorrow.tier || '').toUpperCase()}`
                          : 'energy'}
                      </b> just for opening the game.
                    </p>
                  )}
                </div>
              )}
              {energyMsg && (
                <p style={{ fontSize: 12, color: '#9df5cf', margin: '0 0 10px' }}>{energyMsg}</p>
              )}
              <button
                className="big-btn"
                style={{ width: '100%' }}
                disabled={energyBusy}
                onClick={handleEnergyRefill}
              >
                <GiLightningTrio aria-hidden className="mr-1.5 inline-block align-[-0.15em]" size={15} />
                REFILL +{GAME_CONFIG.energy.refillRuns} — ${GAME_CONFIG.energy.refillPriceUSD}
              </button>
              <button
                className="ghost-btn"
                style={{ marginTop: 10 }}
                disabled={energyBusy}
                onClick={() => { setEnergyModal(null); setEnergyMsg(null) }}
              >
                ▾ wait for free energy
              </button>
            </div>
          </div>
        )}

        {/* Phase 3 — DROP-RATE ELIXIR modal. Drink an owned elixir to start
            the 30-min 2× drop buff, or buy one for $1. The free path (playing
            without the buff) is inherent — this only sweetens loot, never
            gates it — so no "wait" CTA is needed here. */}
        {elixirModal && (
          <div className="overlay" style={{ zIndex: 40 }}>
            <div className="lift-inner" style={{ textAlign: 'center' }}>
              <div className="logo" style={{ fontSize: '20px' }}>DROP-RATE ELIXIR</div>
              <div className="subtitle">// SHARPEN THE LOOT</div>
              {elixirActive ? (
                <p style={{ fontSize: 13, color: '#b46bff', margin: '14px 0 4px' }}>
                  ✦ Buff active —{' '}
                  <b>
                    {(() => {
                      const ms = Math.max(0, elixir.activeUntil - uiNow)
                      const m = Math.floor(ms / 60000)
                      const s = Math.floor((ms % 60000) / 1000)
                      return `${m}:${String(s).padStart(2, '0')}`
                    })()}
                  </b>{' '}
                  left
                </p>
              ) : (
                <p style={{ fontSize: 13, lineHeight: 1.6, color: '#cfeede', margin: '14px 0 4px' }}>
                  Doubles your chance at rarer loot for {GAME_CONFIG.elixir.durationMin} minutes.
                </p>
              )}
              <p style={{ fontSize: 12, color: '#9db4c4', margin: '0 0 12px' }}>
                In stock: <b style={{ color: '#eafff5' }}>{elixir.owned}</b>
              </p>
              {elixirMsg && (
                <p style={{ fontSize: 12, color: '#9df5cf', margin: '0 0 10px' }}>{elixirMsg}</p>
              )}
              <button
                className="big-btn"
                style={{ width: '100%' }}
                disabled={elixirBusy || elixir.owned < 1}
                onClick={handleElixirUse}
              >
                ✦ DRINK ELIXIR{elixir.owned > 0 ? ` (${elixir.owned})` : ''}
              </button>
              <button
                className="big-btn"
                style={{ width: '100%', marginTop: 10 }}
                disabled={elixirBusy}
                onClick={handleElixirBuy}
              >
                <GiPotionBall aria-hidden className="mr-1.5 inline-block align-[-0.15em]" size={15} />
                BUY ELIXIR — ${GAME_CONFIG.elixir.priceUSD}
              </button>
              <button
                className="ghost-btn"
                style={{ marginTop: 10 }}
                disabled={elixirBusy}
                onClick={() => { setElixirModal(false); setElixirMsg(null) }}
              >
                ▾ close
              </button>
            </div>
          </div>
        )}

        {/* Lift floor-select popup (sibling of #hud, like the other overlays
            below, so it isn't subject to #hud's pointer-events:none) */}
        <div id="liftMenu" className="overlay hidden">
          <div className="lift-inner">
            <div className="logo" style={{fontSize:'22px'}}>LIFT</div>
            <div className="subtitle">// SELECT FLOOR</div>
            <div id="liftFloorList" className="lift-floor-list" />
            <button id="liftCancel" className="ghost-btn">▾ cancel</button>
          </div>
        </div>

        {/* Dark loading transition, used whenever the lift changes floors */}
        <div id="loadingFade" className="loading-fade hidden">
          <div id="loadingFadeText" className="loading-fade-text" />
        </div>

        {/* Scene loader — retro pixel "LOADING…" bar on a black screen, shown
            while the first scene (outdoor/bunker) preloads on Continue / New
            Game so the wait reads as "rendering", not a frozen/black error.
            VISIBLE BY DEFAULT: every DungeonGame mount loads a scene, and
            rendering it un-hidden means React paints the loader on the very
            first frame — BEFORE the HUD/stats can flash on a black canvas
            (owner: "klik → HUD dulu baru loading" was the bug). game.js drives
            the fill and only hides it once the scene has actually painted.
            Deliberately NOT the logo splash. */}
        <div id="sceneLoader" className="scene-loader" aria-hidden="true">
          <div className="scene-loader-box">
            <div className="scene-loader-label">LOADING...</div>
            <div className="scene-loader-bar">
              <div id="sceneLoaderFill" className="scene-loader-fill" />
            </div>
          </div>
        </div>

        {/* Title screen — HIDDEN BY DEFAULT (owner: New Game/Continue must go
            straight into play, never flash this preview). The engine only
            reveals it when it actually wants it: a demo/no-startMode mount, or
            the post-campaign screen (returnToTitleScreen). Every Main Menu
            entry passes a startMode, so this stays hidden and the run starts
            immediately. */}
        <div id="title" className="overlay hidden">
          <div className="title-inner">
            <div className="logo">NULL_STATE</div>
            <div className="subtitle">// THE FORSAKEN DEPTHS</div>
            <p className="lore" id="titleLore" />
            <div className="char-select char-select-single">
              <div className="char-btn selected" data-char="knight">
                <div className="char-prev" id="prevKnight" /><span>KNIGHT</span>
              </div>
            </div>
            <button id="startBtn" className="big-btn">DESCEND ▾</button>
            {/* Post-completion endgame entries — the engine (game.js boot())
                unhides these only after this wallet finishes the campaign
                (PROTOCOL ZERO). Hidden for first-time players. */}
            <button id="cycleBtn" className="big-btn big-btn-alt" style={{ display: 'none' }}>NEW GAME+ ▾</button>
            <button id="abyssBtn" className="big-btn big-btn-alt" style={{ display: 'none' }}>THE NULL ABYSS ▾</button>
            <div className="title-foot">Every fall costs you. The depths remember.</div>
          </div>
        </div>

        {/* Story / cutscene overlay */}
        <div id="story" className="overlay hidden">
          <div className="story-inner">
            <p id="storyText" className="story-text" />
            <button id="storyNext" className="ghost-btn">▾ continue</button>
          </div>
        </div>

        {/* Tutorial overlay — animated how-to-play, shown once before the
            first bunker. Each slide pairs a small animated visual demo
            with a short line of text, rather than a plain text popup. */}
        <div id="tutorial" className="overlay hidden">
          <div className="tutorial-inner">
            <div id="tutorialVisual" className="tutorial-visual">
              {/* slide 1: movement — animated virtual joystick demoing a circular drag */}
              <div className="tut-slide" data-slide="move">
                <div className="tut-stick-base">
                  <div id="tutStickNub" className="tut-stick-nub" />
                </div>
              </div>
              {/* slide 2: auto-attack — sword swing arc pulsing toward a target dot */}
              <div className="tut-slide hidden" data-slide="attack">
                <div className="tut-attack-demo">
                  <div className="tut-hero-dot" />
                  <div id="tutSwingArc" className="tut-swing-arc" />
                  <div className="tut-enemy-dot" />
                </div>
              </div>
              {/* slide 3: clear the floor — lock icon that unlocks */}
              <div className="tut-slide hidden" data-slide="clear">
                <div className="tut-lock-demo">
                  <div id="tutLockIcon" className="tut-lock-icon"><GiPadlock aria-hidden size={28} /></div>
                  <div id="tutLiftGlow" className="tut-lift-glow" />
                </div>
              </div>
              {/* slide 4: ulti / NULL_STRIKE — pulsing lightning bolt */}
              <div className="tut-slide hidden" data-slide="ulti">
                <div className="tut-ulti-demo">
                  <div id="tutBolt" className="tut-bolt"><GiLightningTrio aria-hidden size={30} /></div>
                  <div className="tut-hp-bar"><div id="tutHpFill" className="tut-hp-fill" /></div>
                </div>
              </div>
            </div>
            <p id="tutorialText" className="tutorial-text" />
            <div className="tutorial-dots">
              <span className="tut-dot" data-i="0" />
              <span className="tut-dot" data-i="1" />
              <span className="tut-dot" data-i="2" />
              <span className="tut-dot" data-i="3" />
            </div>
            <button id="tutorialNext" className="ghost-btn">▾ got it</button>
          </div>
        </div>

        {/* Context-sensitive action button — shows a NULL_STRIKE icon+label
            near a boss in range, or an OPEN icon+label near a clear-room
            container. Driven every frame by updateActionButton() in game.js
            (icons injected via nsIcon() — game-icons.net). */}
        <button id="actionBtn" className="action-btn hidden" />

        {/* Dual-panel container window (loot on the left, your stash on
            the right — mirrors renderContainerSlots()/renderStashPanel()
            in game.js). */}
        <div id="containerWindow" className="overlay hidden">
          <div className="container-inner">
            <div id="containerTitle" className="container-title" />
            <div className="container-panels">
              <div id="containerLootPanel" className="container-panel loot-panel">
                <div className="container-panel-label">LOOT</div>
                <div id="containerItems" className="inv-items container-items" />
                <div id="containerEmpty" className="inv-empty">Empty.</div>
              </div>
              <div className="container-panel inv-panel">
                <div className="container-panel-label">YOUR INVENTORY</div>
                <div id="containerPlayerItems" className="inv-items container-items" />
                <div id="containerPlayerEmpty" className="inv-empty">No items yet.</div>
              </div>
            </div>
            <div className="container-btns">
              <button id="containerTakeAll" className="big-btn">TAKE ALL</button>
              <button id="containerClose" className="ghost-btn">▾ close</button>
            </div>
          </div>
        </div>

        {/* Weekly Vault code-submit window (Bunker 5 "THE LAST LIGHT",
            Phase 5.5 #9C/#10) — appears when the player OPENs the sealed
            vault door that spawns after that bunker's boss falls. Talks to
            /api/vault/submit directly from game.js (see
            openVaultWindow()/submitVaultCode()); no React state needed. */}
        <div id="vaultWindow" className="overlay hidden">
          <div className="vault-inner">
            <div className="vault-title">SEALED VAULT DOOR</div>
            <div className="vault-sub">Enter the 4-digit code from this week&apos;s Paper.</div>
            {/* Filled by refreshVaultRequirements() on every open: which of the
                two weekly items the wallet actually holds, and what to do when
                one is missing. Without it the screen was a blank code box with
                no way to tell why nothing worked. */}
            <div id="vaultReq" className="vault-req" />
            {/* readOnly + no autofocus: the pad below is the keyboard. See the
                keypad note in game.js — the OS keyboard was the reported lag. */}
            <input id="vaultCodeInput" className="vault-code-input" readOnly inputMode="none" maxLength={4} placeholder="0000" autoComplete="off" aria-label="Vault code" />
            <div id="vaultPad" className="vault-pad">
              <button type="button" className="vault-key" data-key="1">1</button>
              <button type="button" className="vault-key" data-key="2">2</button>
              <button type="button" className="vault-key" data-key="3">3</button>
              <button type="button" className="vault-key" data-key="4">4</button>
              <button type="button" className="vault-key" data-key="5">5</button>
              <button type="button" className="vault-key" data-key="6">6</button>
              <button type="button" className="vault-key" data-key="7">7</button>
              <button type="button" className="vault-key" data-key="8">8</button>
              <button type="button" className="vault-key" data-key="9">9</button>
              <button type="button" className="vault-key is-alt" data-key="clear" aria-label="Clear">CLR</button>
              <button type="button" className="vault-key" data-key="0">0</button>
              <button type="button" className="vault-key is-alt" data-key="del" aria-label="Delete">⌫</button>
            </div>
            <div id="vaultMsg" className="vault-msg" />
            <div className="vault-btns">
              <button id="vaultSubmitBtn" className="big-btn">SUBMIT</button>
              <button id="vaultClose" className="ghost-btn">▾ BACK TO THE BUNKER</button>
              {/* Spelled out because it is irreversible: this is what ends the
                  last bunker and rolls the ending. */}
              <button id="vaultLeave" className="ghost-btn is-danger">LEAVE WITHOUT OPENING →</button>
            </div>
          </div>
        </div>

        {/* THE WIN. Owner, after actually cracking a vault: "tidak ada pop up
            untuk user, pop up menang usdt dan jumlahnya, dan penjelasan auto
            transfer."

            He was right, and it was the worst gap in the game. The single
            moment real money moves — the entire reason this game exists — was
            one line of text inside the code panel reading "Reward sent to your
            wallet", with NO amount, NO currency, and no explanation that the
            transfer is automatic. It then disappeared 1.4 seconds later when
            the bunker auto-finished. The server had already read the exact
            amount and token off the contract to stamp the Rewards history, and
            simply did not return them.

            Nothing here auto-dismisses. The player closes it. */}
        <div id="vaultWinWindow" className="overlay hidden">
          <div className="vwin-inner">
            <div className="vwin-burst" aria-hidden="true" />
            <div className="vwin-title">VAULT CRACKED</div>
            <div id="vwinAmount" className="vwin-amount" />
            <div id="vwinNote" className="vwin-note" />
            <a id="vwinTx" className="vwin-tx hidden" target="_blank" rel="noopener noreferrer">View the transaction ↗</a>
            <button id="vwinClose" className="big-btn vwin-btn">CONTINUE</button>
          </div>
        </div>

        {/* Item zoom overlay — opened by tapping a slot in #invPanel (stash,
            shows BURN) or the LOOT side of #containerWindow (container slot,
            shows TAKE). Only one of the two action buttons is ever visible
            at a time; toggled in game.js via openItemZoom()/closeItemZoom(). */}
        <div id="itemZoom" className="overlay hidden">
          <div className="item-zoom-inner">
            {/* Wrapper is position:relative so the Paper code (below) can sit
                overlaid directly on top of the icon art like ink on paper,
                instead of as a separate block underneath. Only meaningful in
                'paper-code' mode — game.js toggles the .paper-code modifier
                on this wrap; every other mode renders it at the old plain
                88x88 size with the code hidden, unaffected. */}
            <div id="itemZoomIconWrap" className="item-zoom-icon-wrap">
              <img id="itemZoomIcon" className="item-zoom-icon" src="" alt="" draggable={false} />
              {/* Paper reveal (Phase 5.5 #9B) — shows this week's shared vault
                  code, fetched live from /api/paper/status when opened in
                  'paper-code' mode. Hidden/empty for every other mode. */}
              <div id="itemZoomCode" className="item-zoom-code hidden" />
            </div>
            <div id="itemZoomName" className="item-zoom-name" />
            <div id="itemZoomQty" className="item-zoom-qty" />
            <div id="itemZoomValue" className="item-zoom-value" />
            <div className="item-zoom-btns">
              <button id="itemZoomTake" className="item-zoom-btn take hidden">TAKE</button>
              <button id="itemZoomBurn" className="item-zoom-btn burn hidden">BURN</button>
            </div>
            <button id="itemZoomClose" className="item-zoom-close">▾ close</button>
          </div>
        </div>

        {/* Death screen */}
        <div id="death" className="overlay hidden">
          <div className="death-inner">
            <div className="death-title">YOU DIED</div>
            <div id="deathSub" className="death-sub" />
            <div id="deathStats" className="death-stats" />
            <button id="reviveBtn" className="big-btn">RISE AGAIN ▾</button>
          </div>
        </div>
      </div>

      {/* React-managed overlays — kept as siblings of #app (which the vanilla
          engine owns) so they're untouched by the engine's own DOM writes. */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        address={wallet.address}
        playerProfile={playerProfile}
        sessionStats={sessionStats}
        soundMuted={soundMuted}
        onToggleSound={handleToggleSound}
        musicVolume={musicVolume}
        onMusicVolumeChange={handleMusicVolumeChange}
        sfxEnabled={sfxEnabled}
        onToggleSfx={handleToggleSfx}
        screenShakeEnabled={screenShakeEnabled}
        onToggleScreenShake={handleToggleScreenShake}
        onSaveGame={handleSaveGame}
        setPlayerUsername={setPlayerUsername}
        onExit={() => { setShowSettings(false); handleExitClick() }}
      />
      <SaveConfirmModal
        open={showExitConfirm}
        canSave={!!sessionStats}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
    </LiveStatsProvider>
  )
}
