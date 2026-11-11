'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { PlayerProfile } from '@/lib/contract'
import { usernameSchema } from '@/lib/validation'
import AccountPanel from './AccountPanel'
import { usePassSBT } from '@/hooks/usePassSBT'
import '@/styles/settings.css'

interface SessionStats {
  depth: number
  kills: number
}

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  /** the raw address is NOT rendered (v75 MiniPay compliance removed it), but
      it IS used to read the wallet's Season Pass status (TASK #7) shown below. */
  address?: string | null
  playerProfile: PlayerProfile | null
  sessionStats: SessionStats | null
  soundMuted: boolean
  onToggleSound: () => void
  musicVolume: number
  onMusicVolumeChange: (value: number) => void
  sfxEnabled: boolean
  onToggleSfx: () => void
  screenShakeEnabled: boolean
  onToggleScreenShake: () => void
  onSaveGame: () => Promise<boolean>
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
  /** HUD redesign (owner): Exit moved out of the top-left corner into Settings,
      directly under Save Game. Triggers the same save-before-exit flow the old
      "◂ EXIT" button did (opens the exit-confirm dialog). */
  onExit: () => void
}

export default function SettingsModal({
  open,
  onClose,
  address,
  playerProfile,
  sessionStats,
  soundMuted,
  onToggleSound,
  musicVolume,
  onMusicVolumeChange,
  sfxEnabled,
  onToggleSfx,
  screenShakeEnabled,
  onToggleScreenShake,
  onSaveGame,
  setPlayerUsername,
  onExit,
}: SettingsModalProps) {
  const [usernameInput, setUsernameInput] = useState(playerProfile?.username || '')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // document.body only exists in the browser, and this renders through a
  // portal. DungeonGame imports it with ssr:false so today it never runs on
  // the server — but nothing in this file says so, and a future import without
  // that flag would crash the render instead of degrading. Gating on a mount
  // flag rather than `typeof document` also keeps server and first client
  // render agreeing, so it can never trip hydration either.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // TASK #7 (owner request): the pass badge is NOT shown on the in-game HUD.
  // Instead a connected wallet that has minted the active-season pass sees a
  // "Season N Pass — Active" line here in Settings. hasPass is read on-chain
  // (true only for the currently-active season) and passSeasonId is the minted
  // season id (e.g. 202607 = July 2026 = Season 1); the season program runs
  // Jul–Dec 2026, so season number = (month - 6).
  const { hasPass, passSeasonId, isLoading: passLoading } = usePassSBT(address ?? undefined)
  const passSeasonNumber = (() => {
    const month = Number(passSeasonId) % 100
    const n = month - 6
    return n >= 1 && n <= 6 ? n : null
  })()

  useEffect(() => {
    if (open) {
      setUsernameInput(playerProfile?.username || '')
      setUsernameStatus('idle')
      setSaveStatus('idle')
    }
  }, [open, playerProfile?.username])

  if (!open || !mounted) return null

  const handleUsernameSave = async () => {
    if (!usernameInput.trim() || usernameInput === playerProfile?.username) return
    setUsernameStatus('saving')
    setUsernameError(null)
    try {
      const parsedUsername = usernameSchema.parse(usernameInput)
      await setPlayerUsername(parsedUsername)
      setUsernameStatus('saved')
    } catch (err) {
      setUsernameStatus('error')
      setUsernameError(err instanceof Error ? err.message : 'Failed to update username')
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    const ok = await onSaveGame()
    setSaveStatus(ok ? 'saved' : 'error')
  }

  // Rendered on document.body, not where this component sits in the tree.
  // DungeonGame mounts it inside .ns-game-root, whose stylesheet resets margin
  // and padding on every descendant so the vanilla engine's markup starts from
  // a known state. That reset is a plain `.ns-game-root *`, the same
  // specificity as this panel's own `.ns-settings-panel` rules, so whichever
  // stylesheet the bundler happened to concatenate last won — and in
  // production that was the reset, which flattened every padding in here and
  // put the panel edge-to-edge against the phone's screen.
  //
  // Scoping the reset instead was the first attempt and was worse: adding an
  // id to the selector outranked every panel rule INSIDE the game too, so the
  // HUD bars and the loot window lost their insets as well.
  //
  // A portal ends the argument rather than winning it. The modal is
  // position:fixed and belongs to the viewport, not to the game root, so it
  // has no reason to be nested in it; out here nothing resets it, and
  // .ns-game-root's touch-action:none no longer fights the panel's own scroll.
  return createPortal(
    <div className="ns-settings-overlay" role="dialog" aria-label="Settings">
      <div className="ns-settings-panel">
        {/* Header mirrors the world map's Settings screen — same title, same
            bordered leave-button — so the two read as one menu system. The map
            spells the game's name out as a "// NULLSTATE" kicker above the
            title; here the brand mark already is that word, so it takes the
            kicker's place instead of repeating it. */}
        <div className="ns-settings-header">
          <div className="ns-settings-title-wrap">
            <Image
              src="/NullState_Logo_Transparent.webp"
              alt="NullState"
              width={90}
              height={22}
              className="ns-settings-logo-corner"
            />
            <div className="ns-settings-title">SETTINGS</div>
          </div>

          <button className="ns-settings-close" onClick={onClose} aria-label="Close settings">
            ✕ Close
          </button>
        </div>

        {/* Progress panel removed (owner: it duplicates the in-game HUD, which
            already shows Level / XP / Floor / Kills live). */}

        {/* Season Pass status (TASK #7) — shown here in Settings instead of on
            the HUD. A connected wallet that has minted the active season's pass
            sees a green "Season N Pass — Active" line; otherwise a muted note. */}
        <div className="ns-settings-section">
          <div className="ns-settings-label">Season Pass</div>
          {!address ? (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>
              Open NullState in MiniPay to mint a Season Pass.
            </p>
          ) : passLoading ? (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>Checking pass…</p>
          ) : hasPass ? (
            <div className="ns-settings-pass">
              ◆ Season {passSeasonNumber ?? passSeasonId.toString()} Pass — Active
            </div>
          ) : (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>
              No active Season Pass. Mint one from the Season Pass screen to unlock
              perks.
            </p>
          )}
        </div>

        {/* Save Game */}
        <div className="ns-settings-section">
          <div className="ns-settings-label">Save Game</div>
          <p className="ns-settings-hint">
            Saves your current floor and inventory so you can continue from this
            exact bunker next time. This does not record kills or XP on-chain —
            that only happens when your character dies.
          </p>
          <button
            className="ns-settings-btn-primary"
            onClick={handleSave}
            disabled={!sessionStats || saveStatus === 'saving'}
          >
            {saveStatus === 'saving'
              ? 'Saving…'
              : saveStatus === 'saved'
              ? '✓ Saved'
              : saveStatus === 'error'
              ? 'Failed — try again'
              : 'Save Game'}
          </button>
          {!sessionStats && (
            <p className="ns-settings-hint" style={{ marginTop: 6 }}>
              Nothing to save right now — you&apos;re not inside a bunker.
            </p>
          )}

          {/* Exit — moved here from the old top-left "◂ EXIT" button. Same
              chunky primary style as Save Game (owner spec). Opens the
              save-before-exit dialog so a run is never lost by accident. */}
          <button
            className="ns-settings-btn-primary"
            style={{ marginTop: 10 }}
            onClick={onExit}
          >
            ◂ Exit to Home
          </button>
        </div>

        {/* Wallet + Username */}
        <div className="ns-settings-section">
          {/* v75 MiniPay compliance: raw wallet address removed from
              Settings entirely (user decision) — no address shown here. */}
          <div className="ns-settings-label">
            Username
          </div>
          <div className="ns-settings-username-row">
            <input
              className="ns-settings-input"
              value={usernameInput}
              maxLength={32}
              onChange={e => {
                setUsernameInput(e.target.value)
                setUsernameStatus('idle')
              }}
              placeholder="Enter a username"
            />
            <button
              className="ns-settings-btn-secondary"
              onClick={handleUsernameSave}
              disabled={
                usernameStatus === 'saving' ||
                !usernameInput.trim() ||
                usernameInput === playerProfile?.username
              }
            >
              {usernameStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
          {usernameStatus === 'saved' && (
            <p className="ns-settings-success">Username updated.</p>
          )}
          {usernameStatus === 'error' && (
            <p className="ns-settings-error">{usernameError}</p>
          )}
        </div>

        {/* Account. Directly under the name, because it is the same subject:
            what the player is called and what that name is attached to. This
            surface matters more than the map's — a player mid-run is the one
            with progress worth not losing. */}
        <div className="ns-settings-section">
          <AccountPanel />
        </div>

        {/* Sound — laid out like the map's "Sound & feel" card: one card label,
            then sentence-case rows each carrying the hint that says what the
            switch actually does. */}
        <div className="ns-settings-section">
          <div className="ns-settings-label">Sound &amp; feel</div>

          <div className="ns-settings-row" style={{ opacity: soundMuted ? 0.45 : 1 }}>
            <span className="ns-settings-rowtext"><span className="t">Music volume</span></span>
            <span className="ns-settings-volume-value">{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            className="ns-settings-slider"
            min={0}
            max={100}
            step={1}
            value={Math.round(musicVolume * 100)}
            disabled={soundMuted}
            onChange={e => onMusicVolumeChange(Number(e.target.value) / 100)}
            aria-label="Music volume"
          />

          {/* MASTER switch: music AND effects. It used to be wired straight to
              the engine's toggleMute, which only silences the music bed — so
              "Sound off" left every hit and menu tap still audible. It now goes
              through lib/audioControl, the one place that derives both. */}
          <div className="ns-settings-row" style={{ marginTop: 16 }}>
            <span className="ns-settings-rowtext">
              <span className="t">Sound</span>
              <span className="h">The master switch — music and effects</span>
            </span>
            <button
              className={`ns-settings-toggle-switch ${!soundMuted ? 'is-on' : ''}`}
              onClick={onToggleSound}
              role="switch"
              aria-checked={!soundMuted}
              aria-label="Toggle sound"
            >
              <span className="ns-settings-toggle-knob" />
            </button>
          </div>

          {/* Dimmed while the master switch is off — effects cannot be heard
              then whatever this says. The preference is still remembered. */}
          <div className="ns-settings-row" style={{ marginTop: 16, opacity: soundMuted ? 0.45 : 1 }}>
            <span className="ns-settings-rowtext">
              <span className="t">Sound effects</span>
              <span className="h">Hits, pickups, menu taps</span>
            </span>
            <button
              className={`ns-settings-toggle-switch ${sfxEnabled ? 'is-on' : ''}`}
              onClick={onToggleSfx}
              role="switch"
              aria-checked={sfxEnabled}
              aria-label="Toggle SFX"
            >
              <span className="ns-settings-toggle-knob" />
            </button>
          </div>

          {/* Screen Shake toggle — punch list #10 (v38). Accessibility option
              for players sensitive to the camera shake on hits/kills/NULL_STRIKE;
              doesn't touch hit-stop, knockback, or particle FX, just the
              camera-offset wobble itself (see render() in game.js). */}
          <div className="ns-settings-row" style={{ marginTop: 16 }}>
            <span className="ns-settings-rowtext">
              <span className="t">Screen shake</span>
              <span className="h">Turn off if the camera movement bothers you</span>
            </span>
            <button
              className={`ns-settings-toggle-switch ${screenShakeEnabled ? 'is-on' : ''}`}
              onClick={onToggleScreenShake}
              role="switch"
              aria-checked={screenShakeEnabled}
              aria-label="Toggle screen shake"
            >
              <span className="ns-settings-toggle-knob" />
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="ns-settings-section ns-settings-links">
          <a
            href="mailto:0xward.dev@gmail.com?subject=NullState%20Feedback"
            className="ns-settings-link ns-settings-feedback-link"
          >
            Feedback &amp; Suggestions
          </a>

          {/*
            Support / Terms / Privacy — required by MiniPay's Mini App
            submission checklist to be reachable from *inside* the app, not
            just the marketing landing page (/game never renders Footer.tsx).
            This is the one place every player can reach via the Settings
            button regardless of where they entered the app.
          */}
          <div className="ns-settings-legal-row">
            <a
              href="https://t.me/nullstate_id"
              rel="noopener noreferrer"
              className="ns-settings-link"
            >
              Support
            </a>
            <span className="ns-settings-legal-sep" aria-hidden="true">·</span>
            <a href="/terms" className="ns-settings-link">
              Terms
            </a>
            <span className="ns-settings-legal-sep" aria-hidden="true">·</span>
            <a href="/privacy" className="ns-settings-link">
              Privacy
            </a>
            <span className="ns-settings-legal-sep" aria-hidden="true">·</span>
            <a href="/stats" className="ns-settings-link">
              Stats
            </a>
          </div>

          <div className="ns-settings-footer-logos">
            <a
              href="https://github.com/0xward/NullState"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/github.png" alt="GitHub" width={26} height={26} />
            </a>
            <a
              href="https://celoscan.io/address/0xe6c471dd3c715db8b10457113867885afa12ec13"
              rel="noopener noreferrer"
              aria-label="Celoscan"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/celoscan.png" alt="Celoscan" width={26} height={26} />
            </a>
            <a
              href="https://talent.app/~/projects/86c0509c-3167-46cd-8a58-36bb9c5b9777"
              rel="noopener noreferrer"
              aria-label="Talent Protocol"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/talent-protocol.jpg" alt="Talent Protocol" width={26} height={26} />
            </a>
            <a
              href="https://www.minipay.xyz"
              rel="noopener noreferrer"
              aria-label="MiniPay"
              className="ns-settings-footer-logo-link"
            >
              <Image src="/footer-logos/minipay.png" alt="MiniPay" width={26} height={26} />
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
