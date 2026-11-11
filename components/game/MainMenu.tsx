'use client'

import { useWallet } from '@/lib/WalletProvider'
import { maskAddress } from '@/lib/addressMask'
import { PlayerProfile } from '@/lib/contract'

interface MainMenuProps {
  onContinueGame: (profile: PlayerProfile) => void
  onNewGame: () => void
  onLeaderboard: () => void
  onRewards: () => void
  onReferral: () => void
  onMintPass: () => void
  onMarketplace: () => void
  onCrafting: () => void
  onHowToPlay: () => void
  // Opens the Character Sheet. Declared here as well as on WorldMapHub because
  // GameFlowManager picks between the two at runtime (`useWorldMapHub ? … : …`)
  // and passes ONE set of props to whichever it chose — so their signatures
  // have to match. It is not a courtesy prop, though: the classic menu had the
  // same missing-inventory problem, where buying gear told you to equip it
  // somewhere that did not exist outside a run.
  onCharacter: (tab?: 'character' | 'items') => void
  /** Same reason as onCharacter: both menus receive one shared prop set. */
  onSettings: () => void
  playerProfile: PlayerProfile | null
  isLoadingProfile: boolean
}

// v72 redesign (user reference: Outlast main menu): the old filled
// HUD-style buttons are replaced with a plain centered TEXT menu over a
// blurred green-dungeon background (public/backgrounds/menu_bg.webp —
// cropped 9:16, gaussian-blurred ~50% and pre-darkened at build time so
// low-end phones don't pay for a CSS backdrop blur every frame).
// Each option is a quiet mono text row; the "primary" row (Continue when
// a save exists, otherwise New Game) gets the subtle boxed highlight the
// reference uses on its focused item. Tap targets stay >=44px for MiniPay.
function MenuItem({
  label,
  onClick,
  primary = false,
  disabled = false,
}: {
  label: string
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="block w-full min-h-11 py-2 font-mono uppercase transition-colors duration-150 disabled:cursor-not-allowed"
      style={{
        fontSize: primary ? 20 : 17,
        letterSpacing: '3px',
        color: disabled ? 'rgba(255,255,255,0.28)' : primary ? '#ffffff' : 'rgba(255,255,255,0.82)',
        textShadow: disabled ? 'none' : '0 2px 6px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6)',
        background: primary ? 'rgba(10,16,12,0.42)' : 'transparent',
        border: primary ? '1px solid rgba(255,255,255,0.22)' : '1px solid transparent',
        borderRadius: 2,
      }}
    >
      {label}
    </button>
  )
}

export default function MainMenu({
  onContinueGame,
  onNewGame,
  onLeaderboard,
  onRewards,
  onReferral,
  onMintPass,
  onMarketplace,
  onCrafting,
  onHowToPlay,
  onCharacter,
  onSettings,
  playerProfile,
  isLoadingProfile,
}: MainMenuProps) {
  // Footer identity: a REAL connected wallet shows its masked address; a guest
  // (plain Chrome visitor who never connected — `address` from useWallet()
  // falls back to a generated guest id, PR #43) shows "Guest Mode" instead of
  // that raw guest id, so we never present a fake "connected wallet".
  // `realAddress` is null for guests.
  const { realAddress } = useWallet()
  const hasSave = !!playerProfile?.isRegistered

  return (
    <div className="ns-home-root fixed inset-0 z-50 flex flex-col items-center overflow-y-auto ns-fade-in">
      {/* Blurred dungeon background (pre-processed asset, no live CSS blur) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url(/backgrounds/menu_bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      {/* Readability overlay: darker at the very top (title) and bottom
          (wallet/legal), lighter mid so the art still breathes */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 30%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.62) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[340px] px-6 flex flex-col items-center min-h-full py-10">
        {/* Title — Outlast-style: one huge distressed word, top center */}
        <h1
          className="font-display font-black text-white uppercase select-none ns-rise"
          style={{
            fontSize: 44,
            letterSpacing: '6px',
            lineHeight: 1,
            textShadow:
              '0 0 22px rgba(0,0,0,0.95), 0 3px 10px rgba(0,0,0,0.9), 0 0 46px rgba(0,255,136,0.18)',
          }}
        >
          NULLSTATE
        </h1>
        <div
          className="font-mono text-[9px] tracking-[5px] uppercase mt-2"
          style={{ color: 'rgba(255,255,255,0.45)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
        >
          bunker protocol
        </div>

        {/* v75 (user device test, MiniPay dev): the menu sat too high on
            tall screens because the column was top-anchored. flex-1
            spacers above and below the nav now center it vertically
            between the title block and the bottom wallet/legal block. */}
        <div className="flex-1 min-h-6" aria-hidden="true" />

        {isLoadingProfile && (
          <p
            className="font-mono text-[10px] tracking-[2px] animate-pulse mb-4"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            loading player profile...
          </p>
        )}

        {/* Menu — centered text list, reference order: primary first */}
        <nav className="w-full space-y-1 text-center ns-rise-2">
          <MenuItem
            label="Continue"
            primary={hasSave}
            disabled={!hasSave}
            onClick={hasSave ? () => onContinueGame(playerProfile!) : undefined}
          />
          <MenuItem label="New Game" primary={!hasSave} onClick={onNewGame} />
          <MenuItem label="Character & Items" onClick={() => onCharacter('character')} />
          <MenuItem label="Marketplace" onClick={onMarketplace} />
          <MenuItem label="Crafting" onClick={onCrafting} />
          <MenuItem label="Leaderboard" onClick={onLeaderboard} />
          <MenuItem label="Rewards" onClick={onRewards} />
          <MenuItem label="Referral" onClick={onReferral} />
          <MenuItem label="Mint Pass" onClick={onMintPass} />
          <MenuItem label="How to Play" onClick={onHowToPlay} />
          <MenuItem label="Settings" onClick={onSettings} />
        </nav>

        {hasSave && (
          <p
            className="font-mono text-[10px] tracking-[2px] mt-6"
            style={{ color: 'rgba(0,255,136,0.75)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
          >
            {playerProfile!.username.toUpperCase()} // LV {playerProfile!.level}
          </p>
        )}

        <div className="flex-1 min-h-6" aria-hidden="true" />

        {/* Wallet + legal links pinned to the bottom of the column.
            Support / Terms / Privacy MUST stay reachable from this first
            screen — MiniPay submission checklist requirement. */}
        <div className="mt-auto pt-10 w-full text-center ns-rise-3">
          {/* Real wallet -> masked address under a "wallet" label. Guest ->
              just "Guest Mode" (never the raw guest id). */}
          {realAddress ? (
            <>
              <p
                className="font-mono text-[9px] tracking-[2px] mb-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                wallet
              </p>
              <p
                className="font-mono text-[10px] break-all"
                style={{ color: 'rgba(255,255,255,0.55)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
              >
                {maskAddress(realAddress)}
              </p>
            </>
          ) : (
            <p
              className="font-mono text-[10px] tracking-[2px]"
              style={{ color: 'rgba(255,255,255,0.55)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
            >
              Guest Mode
            </p>
          )}
          <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
            <a
              href="https://t.me/nullstate_id"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-11 px-2 font-mono text-[10px] tracking-[2px] uppercase no-underline transition-colors duration-200"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Support
            </a>
            <span style={{ color: 'rgba(255,255,255,0.3)' }} aria-hidden="true">·</span>
            <a
              href="/terms"
              className="inline-flex items-center min-h-11 px-2 font-mono text-[10px] tracking-[2px] uppercase no-underline transition-colors duration-200"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Terms
            </a>
            <span style={{ color: 'rgba(255,255,255,0.3)' }} aria-hidden="true">·</span>
            <a
              href="/privacy"
              className="inline-flex items-center min-h-11 px-2 font-mono text-[10px] tracking-[2px] uppercase no-underline transition-colors duration-200"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Privacy
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
