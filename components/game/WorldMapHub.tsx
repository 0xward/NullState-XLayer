'use client'

import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { maskAddress } from '@/lib/addressMask'
import { PlayerProfile } from '@/lib/contract'
import { loadGameSession, loadGameSessionDraft } from '@/lib/gameSessionService'
import { readHighestAct } from '@/lib/campaignProgress'
import { readCampaignComplete, takeEndgameReveal } from '@/lib/campaignComplete'
import { bunkerProfile, riskPips, lengthNote } from '@/lib/constants/bunkers'
import DailyStatusBar from './DailyStatusBar'
import { useEquippedPortrait } from '@/lib/heroPortrait'
import { usePassSBT } from '@/hooks/usePassSBT'
import { isPassCurrent, seasonNumberOf } from '@/lib/season'
import { MusicButton, useMusic } from '@/components/MusicController'
import { playUiSound, type UiSound } from '@/lib/uiSound'

// ─── World-Map Hub (Phase 1+2 — behind a feature flag) ───────────────────────
// A game-style landing that REPLACES MainMenu when enabled (?hub=1 or
// NEXT_PUBLIC_WORLDMAP_HUB=1). Pure UI-layer swap: same props as MainMenu,
// same handlers, so every downstream screen is untouched.
//
// Design rules taken from how shipped world-map games actually behave
// (Last Day on Earth's global map, standard mobile level-select):
//   1. The map ART already draws the five bunker doors. We do NOT paint another
//      door on top — we HIGHLIGHT the one that's yours with a ground-anchored
//      ring, so it reads as a place on the map instead of a floating sticker.
//   2. Tapping a node NEVER travels immediately. It selects, and the bottom bar
//      shows that bunker's name/state (and, when locked, the requirement).
//      A second, explicit tap on ENTER is what starts the run.
//   3. Locked places stay visible under drifting fog with a padlock — shown,
//      not hidden, with the requirement spelled out.
//   4. Cleared places get a ✓ stamp and sit dimmed.
//
// Node coordinates are in MAP-NATIVE percentages and live inside a wrapper that
// keeps the map's own aspect ratio, so markers stay glued to the painted doors
// on every screen size (a plain background-cover would drift per device).
//
// All user-facing copy is English, matching the rest of the game's UI.

interface WorldMapHubProps {
  onContinueGame: (profile: PlayerProfile) => void
  onNewGame: () => void
  /**
   * Re-enter an already-cleared bunker as a fresh raid (GAME-DESIGN.md §7).
   * Costs one energy, exactly like a first descent — grinding having a price is
   * what keeps the refill meaningful.
   */
  onRaid: (actIndex: number) => void
  /**
   * THE NULL ABYSS — the endless descent below Bunker 5, unlocked by finishing
   * the campaign (GAME-DESIGN.md §3B).
   *
   * It lives here now because it had nowhere else to live. The engine's own
   * title screen was the only door to it, and with this map as the home screen
   * that screen is only ever reached by finishing the campaign — at which point
   * the player is stranded on it, since it hides the HUD and leads nowhere.
   * See lib/campaignComplete.ts.
   */
  onAbyss: () => void
  /** NEW GAME+ (Null Cycles). Same unlock, same reason for being here. */
  onCycle: () => void
  onLeaderboard: () => void
  onRewards: () => void
  onReferral: () => void
  onMintPass: () => void
  onMarketplace: () => void
  onCrafting: () => void
  onHowToPlay: () => void
  // Opens the Character Sheet. The plate lands on 'character', the BAG rail
  // button on 'items' — same screen, two doors.
  onCharacter: (tab?: 'character' | 'items') => void
  onSettings: () => void
  playerProfile: PlayerProfile | null
  isLoadingProfile: boolean
  /** False until the first profile lookup has finished, win or lose. */
  profileSettled: boolean
}

const MAP = '/worldmap/map-bg.webp'
// The trail and door lamps, lifted out of the art so they can be animated —
// see scripts/build-map-path-overlay.js. Perfectly registered because it is
// literally the map's own pixels.
const MAP_PATH = '/worldmap/map-path.webp'
// WebP, not PNG. As PNGs these nine icons were 372KB — the single biggest
// download on /game, for artwork that occupies 46 CSS px. They are 45KB now.
// The PNG masters live in assets-src/worldmap/icons/ and are re-encoded by
// scripts/build-worldmap-icons.js.
const IC = (n: string) => `/worldmap/icons/${n}.webp`
const HOWTO_SEEN_KEY = 'ns-howto-seen'

// The five campaign bunkers, positioned over the doors painted into the map art.
// `act` is the engine's 0-based campaignActIndex (campaignActIndex===4 is
// "THE LAST LIGHT" — see public/game-engine/game.js).
//
// Progression runs BOTTOM → TOP: bunker 1 sits at the foot of the map (the
// near, safe end) and the run climbs the trail toward THE LAST LIGHT at the
// top, which the art draws as the largest structure — so the map's own visual
// weight matches the campaign's difficulty curve. Listed in screen order
// (top-most first) for readability; `act` carries the real sequence.
// x/y = the DOOR's centre. gy = the ground immediately in front of it, where
// the active ring lies.
//
// These are MEASURED off map-bg.webp, not eyeballed: the art was overlaid with
// a 1% grid and each doorway read off directly (the two green lamps flanking
// every entrance make the centre unambiguous). The first pass was placed by
// eye and every marker sat slightly off its door — worst on Frostline, which
// was 3% high, i.e. floating above the doorway.
//
// If the map art is ever regenerated these must be re-measured; there is no
// way to derive them from the image automatically.
const NODES = [
  { act: 4, name: 'THE LAST LIGHT',   x: 35.0, y: 12.0, gy: 14.8 },
  { act: 3, name: 'HOLLOW MARKET',    x: 62.3, y: 34.0, gy: 36.8 },
  { act: 2, name: 'FROSTLINE BUNKER', x: 36.5, y: 52.0, gy: 55.2 },
  { act: 1, name: 'SUNKEN FIELD',     x: 60.7, y: 66.5, gy: 69.3 },
  { act: 0, name: 'TREELINE BUNKER',  x: 45.8, y: 81.3, gy: 84.2 },
] as const

type NodeState = 'cleared' | 'active' | 'locked'

function RailBtn({
  icon, label, onClick, hot = false, badge, sound = 'panel',
}: {
  icon: string; label: string; onClick: () => void; hot?: boolean; badge?: string
  sound?: UiSound
}) {
  return (
    <button
      onClick={() => { playUiSound(sound); onClick() }}
      className="ns-hub-rail relative block w-[52px] text-center"
      style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.7))' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon} alt={label} width={46} height={46}
        style={{
          width: 46, height: 46, display: 'block', margin: '0 auto', imageRendering: 'pixelated',
          filter: hot ? 'drop-shadow(0 0 7px rgba(255,207,77,.65))' : undefined,
        }}
      />
      <span className="block font-mono uppercase" style={{ fontSize: 8, letterSpacing: '.3px', color: '#e2efe9', marginTop: 1, textShadow: '0 1px 2px #000' }}>
        {label}
      </span>
      {badge && (
        <span
          className="absolute font-mono font-extrabold"
          style={{
            top: -2, right: 3, minWidth: 15, height: 15, padding: '0 3px', fontSize: 8,
            // Both pairs failed WCAG AA. At 8px this is small text, so it needs
            // 4.5:1 and the amber sat at 4.32 — near enough to pass by eye,
            // which is exactly why it survived. Deepening the browns and reds
            // keeps the badge colours recognisable: amber now 7.82:1, red
            // 5.43:1. PageSpeed flagged the amber on /game (Accessibility 95).
            background: badge === 'SOON' ? '#4a3610' : '#cc2434',
            color: badge === 'SOON' ? '#ffcf4d' : '#fff',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #000',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

export default function WorldMapHub({
  onContinueGame, onNewGame, onRaid, onAbyss, onCycle, onLeaderboard, onRewards, onReferral,
  onMintPass, onMarketplace, onCrafting, onHowToPlay, onCharacter, onSettings,
  playerProfile, isLoadingProfile, profileSettled,
}: WorldMapHubProps) {
  const { realAddress, address } = useWallet()
  const hasSave = !!playerProfile?.isRegistered

  // Show the placeholder while the name is genuinely unknown, and only then.
  //
  // Two earlier versions of this condition were both wrong, in opposite ways.
  // `isLoadingProfile` alone hid the name from everyone who already had one —
  // profileCache sets a returning player's profile and the refresh then runs
  // behind it, so the loading flag is true at the exact moment the correct name
  // is already in state. `isLoadingProfile && !playerProfile` never fired at
  // all: this component is server-rendered, and on the first client render
  // isLoading is still false, so the plate committed to "WALKER" before the
  // effect had run and the skeleton was dead code.
  //
  // profileSettled is what actually answers the question. It is false on the
  // server and false on the client's first render — so both render the same
  // placeholder and hydration matches — and it flips once the lookup finishes,
  // win or lose, so a failed fetch falls back to WALKER instead of leaving a
  // shimmer on screen forever.
  const nameUnknown = !playerProfile && !profileSettled

  // The avatar follows what the player has equipped, so the face on the map is
  // the character they'll actually walk into the bunker with.
  const { portrait } = useEquippedPortrait(address)

  // Season Pass. A pass is MONTHLY: holding one for a past season is not the
  // same as holding the current one, so the plate only lights up for a pass
  // that is live right now — otherwise the badge would keep promising perks
  // that expired.
  const { muted: musicMuted, toggle: toggleMusic } = useMusic()

  const { hasPass, passSeasonId } = usePassSBT(realAddress || undefined)
  const passLive = hasPass && isPassCurrent(passSeasonId)
  const passNo = seasonNumberOf(passSeasonId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Which bunker the player is currently in, from the saved run. The local
  // draft answers instantly (localStorage); the Firestore copy then corrects it
  // if the player continued on another device. Defaults to bunker 1.
  // Both of these hold an ACT number (0-4), not an array index — NODES is
  // ordered by screen position (top-first), so the two no longer line up.
  const [currentAct, setCurrentAct] = useState(0)
  const [selectedAct, setSelectedAct] = useState(0)
  // Set the first time the player taps a bunker. After that, a late progress
  // load may still correct `currentAct` but must never move their selection.
  const userPicked = useRef(false)

  // PROTOCOL ZERO. Read after mount, never during render: it comes from
  // localStorage, which the server cannot see, and reading it inline would make
  // the server HTML and the first client render disagree. Same discipline the
  // how-to-play prompt below already follows.
  const [campaignDone, setCampaignDone] = useState(false)
  // The one-time "here is what you just unlocked" panel. The campaign ending
  // used to be announced by dumping the player on a screen listing two modes
  // with no explanation of either; this says what they are, once, on the map.
  const [reveal, setReveal] = useState(false)
  useEffect(() => {
    const done = readCampaignComplete(address)
    setCampaignDone(done)
    if (done && takeEndgameReveal(address)) setReveal(true)
  }, [address])

  useEffect(() => {
    if (!address) return
    let alive = true
    // Progress is the HIGH-WATER MARK, not the live session's act index. Those
    // used to be the same number, and stopped being once raids existed: raiding
    // Bunker 1 sets the session index to 0, the in-run autosave persists it, and
    // reading it straight back here would show a five-bunker veteran a map with
    // Bunker 1 active and 3-5 locked. readHighestAct takes the max and writes it
    // back, so an existing player is seeded from their own save on first view
    // and a raid can never walk it backwards. See lib/campaignProgress.ts.
    const apply = (act: number | undefined) => {
      if (!alive) return
      const maxAct = NODES.length - 1
      const highest = readHighestAct(address, act, maxAct)
      setCurrentAct(highest)
      // The clamp keeps the DEFAULT selection inside the player's progress. It
      // must not survive a tap: `apply` runs twice — once from the instant
      // localStorage draft and again when the Firestore copy lands, typically a
      // network round trip later, which is exactly while the player is looking
      // at the map. Without this guard, tapping a locked bunker to read what it
      // holds snapped the selection back on its own, with no explanation.
      setSelectedAct((prev) => (userPicked.current || prev <= highest ? prev : highest))
    }
    apply(loadGameSessionDraft(address)?.campaignActIndex)
    loadGameSession(address).then((s) => apply(s?.campaignActIndex)).catch(() => {})
    return () => { alive = false }
  }, [address])

  // The help prompt glows until the player has opened How to Play once. Stored
  // per browser (not per wallet) so a guest who later connects isn't re-nagged.
  const [howToSeen, setHowToSeen] = useState(true) // assume seen until we can read storage — avoids a flash of the prompt
  useEffect(() => {
    try { setHowToSeen(window.localStorage.getItem(HOWTO_SEEN_KEY) === '1') } catch { setHowToSeen(true) }
  }, [])

  const openHowToPlay = () => {
    setHowToSeen(true)
    try { window.localStorage.setItem(HOWTO_SEEN_KEY, '1') } catch { /* storage blocked — prompt just returns next visit */ }
    onHowToPlay()
  }

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  // Finishing the campaign has to make the LAST bunker read as beaten, and
  // nothing else could say so: `currentAct` is a high-water mark clamped to the
  // last act, so Bunker 5 sat on "active" forever and the button still said
  // ENTER after the ending had rolled. It says RAID now — which is not cosmetic,
  // because raiding Bunker 5 is how the weekly vault is reached for the whole
  // rest of the player's time in the game.
  //
  // ALL five, not just the last one. There is no "next" bunker after the
  // campaign, so leaving one of them "active" would point the player at a
  // descent that does not exist — and a saved game lost or replaced after the
  // ending would otherwise show a finished player a map with bunkers locked.
  const stateOf = (act: number): NodeState =>
    campaignDone || act < currentAct ? 'cleared'
      : act === currentAct ? 'active' : 'locked'

  const nodeByAct = (act: number) => NODES.find((n) => n.act === act)
  const sel = nodeByAct(selectedAct) ?? NODES[NODES.length - 1]
  const selState = stateOf(sel.act)
  const canEnter = selState === 'active' || selState === 'cleared'

  // A cleared bunker is no longer a dead end. The campaign is the tutorial; the
  // map is the game (GAME-DESIGN.md §2), so every bunker you have beaten stays
  // open to raid for loot, shards and vault fragments. It costs one energy,
  // same as a first descent — said out loud here rather than discovered.
  const profile = bunkerProfile(sel.act)
  const enterLabel = selState === 'active' ? (hasSave ? 'ENTER ▸' : 'START ▸')
    : selState === 'cleared' ? 'RAID ▸' : 'LOCKED'
  const subline = selState === 'active'
    ? (hasSave ? `Bunker ${sel.act + 1} · Continue your descent` : `Bunker ${sel.act + 1} · Begin your descent`)
    : selState === 'cleared' ? `Bunker ${sel.act + 1} · Cleared · Raid again (1 energy)`
      : `Locked · Clear ${nodeByAct(sel.act - 1)?.name ?? 'the previous bunker'} first`

  const startRun = () => {
    if (!canEnter) { playUiSound('denied'); return }
    playUiSound('confirm')
    if (selState === 'cleared') { onRaid(sel.act); return }
    if (hasSave) onContinueGame(playerProfile!)
    else onNewGame()
  }

  return (
    <div className="ns-home-root fixed inset-0 z-50 overflow-hidden ns-fade-in" style={{ background: '#060b09' }}>
      {/* Map layer — keeps the art's own aspect ratio so node markers stay glued
          to the painted doors regardless of screen size (see .ns-hub-map). */}
      <div className="ns-hub-map">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* fetchPriority="high": this is the LCP element on /game, and
            PageSpeed flagged it explicitly — the request was discoverable in
            the initial document but competing with everything else at default
            priority. The browser cannot know a full-bleed decorative-looking
            <img> is the thing the user is waiting for. LCP was 2.7s. */}
        <img
          src={MAP} alt="" aria-hidden="true"
          fetchPriority="high" decoding="async"
          style={{ width: '100%', height: '100%', display: 'block', filter: 'brightness(1.12) contrast(1.06) saturate(1.05)' }}
        />

        {/* Mist. The trail can only ever animate the ~0.3% of the map that is
            painted trail; everything else was frozen. This drifts across the
            whole surface, which is what stops the map reading as a photograph
            between pulses. */}
        <span className="ns-hub-mist" aria-hidden="true" />

        {/* The trail and the door lamps, extracted from the art itself, so this
            layer is the same pixels in the same place and cannot fall out of
            register. It breathes on its own. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MAP_PATH} alt="" aria-hidden="true" className="ns-hub-path" />

        {/* The travelling light. The band inside is a plain gradient that slides
            down the map; the WRAPPER is masked by the trail, so the band is only
            ever painted on the trail's own pixels and the light appears to run
            along it. The mask never moves, which is the whole point — an earlier
            version moved a masked copy of the trail instead, which just slid a
            duplicate of the wrong stretch of trail down the screen. */}
        <span className="ns-hub-flow" aria-hidden="true">
          <span className="ns-hub-flow-band" />
        </span>

        {/* Embers drifting up off the map — cheap, and the difference between
            a screen that is alive and one that is a picture. */}
        <span className="ns-hub-motes" aria-hidden="true" />

        {NODES.map((n) => {
          const st = stateOf(n.act)
          const isSel = n.act === selectedAct
          return (
            <span key={n.act}>
              {/* The ring lies on the GROUND IN FRONT of the door, so it is
                  positioned at the node's own measured ground percentage rather
                  than nudged down inside the marker box. Inside the box its
                  offset scaled with the box, which is why it drifted off the
                  ground on different screens. */}
              {st === 'active' && (
                <span
                  className="ns-hub-ground"
                  aria-hidden="true"
                  style={{ left: `${n.x}%`, top: `${n.gy}%` }}
                >
                  <span className="ns-hub-ring" />
                </span>
              )}

              <button
                onClick={() => {
                  playUiSound(st === 'locked' ? 'denied' : 'tick')
                  userPicked.current = true
                  setSelectedAct(n.act)
                }}
                aria-label={`${n.name} — ${st}`}
                aria-pressed={isSel}
                className={`absolute ns-hub-node is-${st}${isSel ? ' is-sel' : ''}`}
                style={{
                  left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%,-50%)',
                  width: 66, height: 66, zIndex: 4, background: 'none', border: 'none', padding: 0,
                }}
              >
                {/* Selection has to be unmistakable — the old treatment was a
                    faint white glow that vanished against the lit snow, so
                    players could not tell a tap had registered. Four corner
                    brackets, drawn only for the selected node. */}
                {isSel && <span className="ns-hub-pick" aria-hidden="true" />}

                {/* LOCKED — fog rolls over the painted door, padlock sits on it */}
                {st === 'locked' && (
                  <>
                    <span className="ns-hub-fog" aria-hidden="true" />
                    <span className="ns-hub-fog ns-hub-fog-b" aria-hidden="true" />
                    <span className="ns-hub-lock" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={IC('lock')} alt="" width={30} height={30} />
                    </span>
                  </>
                )}

                {/* CLEARED — a ✓ stamp on the door, the place sits quiet */}
                {st === 'cleared' && <span className="ns-hub-done" aria-hidden="true">✓</span>}

                {/* ACTIVE — a chevron nodding over the doorway */}
                {st === 'active' && <span className="ns-hub-chev" aria-hidden="true">▼</span>}
              </button>
            </span>
          )
        })}
      </div>

      {/* Vignette so the chrome stays legible over the art */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 66% at 50% 42%, transparent 58%, rgba(3,7,5,.5) 100%),' +
            'linear-gradient(0deg, rgba(4,8,6,.92) 3%, transparent 20%),' +
            'linear-gradient(180deg, rgba(4,8,6,.6), transparent 13%)',
        }}
        aria-hidden="true"
      />

      {/* ── Player plate (top-left) — octagon-cut to match the rail icons ──
          Now a real button into the Character Sheet. It used to draw a literal
          "✕" as the avatar, which reads as an error or a close button, not as a
          person — and it wasn't tappable, so the one thing on screen that looks
          like "you" did nothing. The avatar is the knight's own idle sprite. */}
      <button
        onClick={() => { playUiSound('panel'); onCharacter('character') }}
        aria-label={passLive ? `Open character sheet — Season ${passNo ?? ''} Pass holder` : 'Open character sheet'}
        className={`absolute ns-hub-plate${passLive ? ' is-pass' : ''}`}
        style={{ top: 10, left: 10, zIndex: 6 }}
      >
        <span
          className="ns-hub-avatar"
          aria-hidden="true"
          style={{ backgroundImage: `url(${portrait})` }}
        />
        <span className="font-mono leading-none">
          {/* The name is the last thing on this plate to know what it says: the
              profile is a network round-trip, and until it lands there is no
              username to render. Showing "WALKER" during that window and then
              swapping in the real name is a visible rewrite of the one label
              that identifies the player — it reads as the screen correcting
              itself. The skeleton holds the same box at the same size and
              stays quiet until there is something true to put in it. */}
          {nameUnknown
            ? <span className="ns-hub-name ns-hub-name--skeleton" aria-label="Loading player name" />
            : <span className="ns-hub-name">{hasSave ? playerProfile!.username.toUpperCase() : 'WALKER'}</span>}
          {/* Same reasoning as the name: "NEW SIGNAL" flipping to "LV 3" a
              second later tells the player they were briefly someone else. */}
          {nameUnknown
            ? <span className="ns-hub-lv ns-hub-lv--skeleton" aria-hidden="true" />
            : (
              <span className="ns-hub-lv">
                {passLive
                  ? `LV ${playerProfile?.level ?? 1} · S${passNo ?? '?'} PASS`
                  : hasSave ? `LV ${playerProfile!.level}` : 'NEW SIGNAL'}
              </span>
            )}
        </span>
      </button>

      {/* ── Help + ≡ MENU (top-right) ──
          The "?" sits outside the menu because a first-time player shouldn't
          have to open a menu to find out how the game works. Until it's tapped
          once it pulses with a "read me first" label; tapping stores a flag so
          the prompt never returns. */}
      <div className="absolute flex items-center gap-2" style={{ top: 12, right: 12, zIndex: 6 }}>
        <div className="relative">
          <button
            onClick={() => { playUiSound('panel'); openHowToPlay() }}
            aria-label="How to play"
            className={`ns-hub-help font-mono${howToSeen ? '' : ' is-new'}`}
          >
            ?
          </button>
          {!howToSeen && (
            <span className="ns-hub-help-tip font-mono" aria-hidden="true">NEW? READ FIRST</span>
          )}
        </div>
        {/* Music. Same control and same stored preference as the landing page
            and the in-run Settings, so turning it off once turns it off
            everywhere instead of per screen. */}
        <MusicButton muted={musicMuted} onToggle={toggleMusic} style={{ width: 38, height: 38, minHeight: 38 }} />

        {/* Sized up from 32px/9px: it sat below the 44px minimum tap target
            MiniPay asks for, and read as an afterthought next to the help
            button it shares a corner with. */}
        <button
          onClick={() => { playUiSound('panel'); setMenuOpen(true) }}
          className="font-mono uppercase"
          style={{
            height: 38, minHeight: 38, padding: '0 14px', fontSize: 11, letterSpacing: '1.5px',
            display: 'inline-flex', alignItems: 'center',
            color: '#cfe0d8', background: 'rgba(6,12,9,.78)', border: '1px solid rgba(255,255,255,.18)',
            clipPath: 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)',
          }}
        >
          ≡ MENU
        </button>
      </div>

      {/* ── Side rails ──
          VERTICALLY CENTRED, not pinned under the header. They used to start at
          a fixed top:92, which on a tall phone parked every button up by the
          status bar — the far end of a one-handed reach, on a screen the player
          taps constantly. Centring with translateY puts them beside the thumb
          instead, and keeps both rails balanced whatever the screen height.
          Nudged slightly above true centre (46%) so the bottom bar's ENTER
          button keeps its own clear space. */}

      {/* LEFT: things that pay you back */}
      <div
        className="absolute flex flex-col gap-2"
        style={{ top: '46%', transform: 'translateY(-50%)', left: 6, zIndex: 6 }}
      >
        {/* Was a "SOON" placeholder promising a Daily Run that did not exist.
            Daily Contracts (GAME-DESIGN.md §5.2) are that feature, and they
            shipped — so the badge is gone and the button opens the list in the
            status bar rather than apologising. A map that advertises SOON for
            something already live is the same class of lie as a config block
            nothing reads. */}
        <RailBtn
          icon={IC('daily')} label="Daily" hot sound="reward"
          onClick={() => window.dispatchEvent(new CustomEvent('nullstate-open-contracts'))}
        />
        <RailBtn icon={IC('rewards')} label="Rewards" sound="reward" onClick={onRewards} />
        <RailBtn icon={IC('pass')} label="Pass" sound="reward" onClick={onMintPass} />
        <RailBtn icon={IC('invite')} label="Invite" sound="tick" onClick={onReferral} />
      </div>

      {/* RIGHT: your gear.
          BAG sits here rather than behind the plate because "where is my stuff"
          has to be findable without reading anything. A portrait opens who you
          are, a bag opens what you carry — the split every mobile game already
          taught this audience. SETTINGS closes the set at four a side. */}
      <div
        className="absolute flex flex-col gap-2"
        style={{ top: '46%', transform: 'translateY(-50%)', right: 6, zIndex: 6 }}
      >
        <RailBtn icon={IC('bag')} label="Bag" sound="gear" onClick={() => onCharacter('items')} />
        <RailBtn icon={IC('shop')} label="Shop" sound="tick" onClick={onMarketplace} />
        <RailBtn icon={IC('craft')} label="Craft" sound="gear" onClick={onCrafting} />
        <RailBtn icon={IC('gear')} label="Settings" sound="panel" onClick={onSettings} />
      </div>

      {isLoadingProfile && (
        <p
          className="absolute font-mono animate-pulse"
          style={{ left: '50%', bottom: 108, transform: 'translateX(-50%)', zIndex: 6, fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.6)' }}
        >
          loading player profile…
        </p>
      )}

      {/* ── Bottom bar: today's status, the selected bunker, and ENTER ──
          The status bar shares this container rather than floating on its own
          so it can never overlap the map's nodes on a short screen — it sits in
          the same gradient, directly above the button it is meant to be read on
          the way to. See GAME-DESIGN.md §5.5. */}
      <div
        className="absolute left-0 right-0"
        style={{ bottom: 0, zIndex: 7, padding: '14px 14px 20px', background: 'linear-gradient(0deg,#060d0a 38%,rgba(6,13,10,.55) 80%,transparent)' }}
      >
        <DailyStatusBar address={address} onCrafting={onCrafting} />
        <div className="flex items-end gap-3">
        <div className="flex-1 font-mono min-w-0">
          <span style={{ display: 'block', fontSize: 12.5, color: '#fff', letterSpacing: '.5px', fontWeight: 700, textShadow: '0 1px 3px #000' }}>
            {sel.name}
          </span>
          <span style={{ fontSize: 9, color: selState === 'locked' ? '#c9a24a' : '#8ea89d' }}>{subline}</span>
          {/* What this bunker is FOR (GAME-DESIGN.md §7). With all five open,
              "which one?" needs an answer, and until the time-vs-risk axis
              existed there was none to give — every bunker was the same floor
              with a different palette. Shown for locked ones too: knowing that
              Bunker 5 is the only T3 source is a reason to keep going. */}
          {profile && (
            <span className="ns-hub-profile" title={`Risk ${profile.risk}/5 · enemies ${profile.hpMul}× HP, ${profile.dmgMul}× damage · Glitch Shards T${profile.shardTier}`}>
              <span className="ns-hub-risk" aria-label={`Risk ${profile.risk} of 5`}>{riskPips(profile.risk)}</span>
              <span className="ns-hub-dot">·</span>
              <span className="ns-hub-tier">SHARD T{profile.shardTier}</span>
              {lengthNote(profile) && (<><span className="ns-hub-dot">·</span><span>{lengthNote(profile)}</span></>)}
            </span>
          )}
          {profile && selState !== 'locked' && (
            <span className="ns-hub-pitch">{profile.pitch}</span>
          )}
        </div>
        <button
          onClick={startRun}
          disabled={!canEnter}
          className="font-mono font-bold uppercase"
          style={{
            minHeight: 44, fontSize: 14, letterSpacing: '2px',
            color: canEnter ? '#04140c' : 'rgba(255,255,255,.45)',
            background: canEnter ? '#39ff9a' : 'rgba(20,32,26,.9)',
            padding: '12px 22px',
            border: canEnter ? '3px solid #0a3d24' : '3px solid rgba(255,255,255,.12)',
            boxShadow: canEnter ? 'inset 2px 2px 0 rgba(255,255,255,.4), 0 0 18px rgba(57,255,154,.5)' : 'none',
            cursor: canEnter ? 'pointer' : 'not-allowed',
          }}
        >
          {enterLabel}
        </button>
        </div>
      </div>

      {toast && (
        <div
          className="absolute font-mono"
          style={{
            left: '50%', bottom: 100, transform: 'translateX(-50%)', zIndex: 9, fontSize: 11, letterSpacing: '.5px',
            color: '#04140c', background: '#ffcf4d', padding: '8px 14px', borderRadius: 4, whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(0,0,0,.5)',
          }}
        >
          {toast}
        </div>
      )}

      {/* ── PROTOCOL ZERO: what finishing the campaign just unlocked ──
          Shown once, on the first visit to the map after the ending. The old
          behaviour was to drop the player onto a title screen with two new
          buttons on it and no explanation of either — and no way back to the
          map. This says what they are, offers them, and closes. */}
      {reveal && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 30, background: 'rgba(3,7,5,.9)', padding: 20 }}
          onClick={() => setReveal(false)}
        >
          <div className="ns-hub-reveal" onClick={(e) => e.stopPropagation()}>
            <span className="ns-hub-reveal-burst" aria-hidden="true" />
            <p className="ns-hub-reveal-kicker">CAMPAIGN COMPLETE</p>
            <p className="ns-hub-reveal-title">PROTOCOL ZERO</p>
            <p className="ns-hub-reveal-body">
              All five bunkers are yours. Every one of them stays open — tap any of them
              and the button reads <b>RAID</b>. <b>Bunker 5 is how you reach the vault
              each week</b>, so that is where the money is.
            </p>
            <p className="ns-hub-reveal-body">Two new ways down have opened:</p>
            <button type="button" className="ns-hub-endgame-btn" onClick={() => { playUiSound('reward'); setReveal(false); onAbyss() }}>
              <span className="ns-hub-endgame-name">THE NULL ABYSS</span>
              <span className="ns-hub-endgame-sub">No bottom. Your deepest fall is your rank this season — death ends the descent.</span>
            </button>
            <button type="button" className="ns-hub-endgame-btn" onClick={() => { playUiSound('reward'); setReveal(false); onCycle() }}>
              <span className="ns-hub-endgame-name">NEW GAME+</span>
              <span className="ns-hub-endgame-sub">Replay the campaign harder. Enemies +35% per cycle, shards +25%. You keep your level and your gear.</span>
            </button>
            <p className="ns-hub-reveal-foot">Both live under <b>≡ MENU</b> from now on.</p>
            <button
              type="button" className="ns-hub-reveal-close"
              onClick={() => { playUiSound('panel'); setReveal(false) }}
            >
              BACK TO THE MAP
            </button>
          </div>
        </div>
      )}

      {/* ── ≡ MENU overlay ── */}
      {menuOpen && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 20, background: 'rgba(4,8,6,.88)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div className="w-full flex flex-col items-center" style={{ maxWidth: 320, padding: '0 24px' }} onClick={(e) => e.stopPropagation()}>
            <nav className="w-full text-center" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: hasSave ? 'New Game (reset)' : 'New Game', fn: onNewGame, danger: hasSave },
                { label: 'Leaderboard', fn: onLeaderboard },
                { label: 'How to Play', fn: openHowToPlay },
              ].map((it) => (
                <button
                  key={it.label}
                  onClick={() => { setMenuOpen(false); it.fn() }}
                  className="block w-full font-mono uppercase"
                  style={{
                    minHeight: 44, padding: '8px', fontSize: 16, letterSpacing: '3px',
                    color: it.danger ? '#ff8a3d' : 'rgba(255,255,255,.86)', background: 'transparent', border: '1px solid transparent',
                  }}
                >
                  {it.label}
                </button>
              ))}
            </nav>

            {/* ENDGAME. Hidden entirely until the campaign is finished, and
                permanent afterwards — this is the door the engine's title
                screen used to be, and the reason the player is no longer sent
                to that screen at all. */}
            {campaignDone && (
              <div className="ns-hub-endgame w-full">
                <p className="ns-hub-endgame-h">PROTOCOL ZERO · ENDGAME</p>
                <button type="button" className="ns-hub-endgame-btn" onClick={() => { playUiSound('reward'); setMenuOpen(false); onAbyss() }}>
                  <span className="ns-hub-endgame-name">THE NULL ABYSS</span>
                  <span className="ns-hub-endgame-sub">No bottom. Your deepest fall is your rank this season — death ends the descent.</span>
                </button>
                <button type="button" className="ns-hub-endgame-btn" onClick={() => { playUiSound('reward'); setMenuOpen(false); onCycle() }}>
                  <span className="ns-hub-endgame-name">NEW GAME+</span>
                  <span className="ns-hub-endgame-sub">Replay the campaign harder. Enemies +35% per cycle, shards +25%. You keep your level and your gear.</span>
                </button>
              </div>
            )}

            {/* MiniPay requirement: Support / Terms / Privacy reachable here */}
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <a href="https://t.me/nullstate_id" rel="noopener noreferrer" className="inline-flex items-center font-mono uppercase no-underline" style={{ minHeight: 44, padding: '0 8px', fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.5)' }}>Support</a>
              <span style={{ color: 'rgba(255,255,255,.3)' }} aria-hidden="true">·</span>
              <a href="/terms" className="inline-flex items-center font-mono uppercase no-underline" style={{ minHeight: 44, padding: '0 8px', fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.5)' }}>Terms</a>
              <span style={{ color: 'rgba(255,255,255,.3)' }} aria-hidden="true">·</span>
              <a href="/privacy" className="inline-flex items-center font-mono uppercase no-underline" style={{ minHeight: 44, padding: '0 8px', fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,.5)' }}>Privacy</a>
            </div>

            <p className="mt-5 font-mono" style={{ fontSize: 9, letterSpacing: '2px', color: 'rgba(255,255,255,.4)' }}>
              {realAddress ? maskAddress(realAddress) : 'Guest Mode'}
            </p>

            <button
              onClick={() => setMenuOpen(false)}
              className="mt-6 font-mono uppercase"
              style={{ minHeight: 44, padding: '8px 18px', fontSize: 11, letterSpacing: '2px', color: '#8ea89d', border: '1px solid rgba(255,255,255,.14)', borderRadius: 3, background: 'transparent' }}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
