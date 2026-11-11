'use client'

import { useEffect } from 'react'
import { MusicButton, useMusic } from '@/components/MusicController'

// ─── Landing hero ────────────────────────────────────────────────────────────
// Rebuilt 2026-07: the previous version read as a token/trading landing page —
// a neon glow orb over a data grid, a wordmark in a geometric sans, and a row of
// badges saying EARN REAL USDT / CELO MAINNET / MINIPAY NATIVE. Every one of
// those is a fintech signal. Someone arriving from a share link had no way to
// tell this was a pixel dungeon crawler until they pressed a button.
//
// What it is now: an outdoor scene from the game as the backdrop, dimmed and
// softened so it reads as atmosphere rather than a screenshot, the real logo,
// and two buttons. The game shows itself instead of describing itself.
//
// The 851KB background video is gone entirely — visuals AND audio. Music now
// comes from the engine's own synthesised bed (see components/MusicController),
// which is 21KB of code instead of most of a megabyte of stream, and is the
// same music the game plays, so the landing page and the dungeon no longer
// sound like two different products.

// An outdoor scene from the game rather than the world map: the map is the
// screen a player lands on AFTER pressing PLAY, so using it here spent the
// reveal before they had started. The treeline is also simply a better
// backdrop — depth, a horizon, and room for type to sit in the dark.
const BACKDROP = '/backgrounds/forest.webp'
const LOGO = '/logo-hero.webp'

export default function HeroSection() {
  // Shared with the world map and the dungeon: one music preference for the
  // whole product, stored in lib/gameSettings.
  const { muted, toggle } = useMusic()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <section className="relative h-[100dvh] w-full flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Backdrop: a real outdoor scene from the game, pushed back with
          brightness + blur so the type on top of it stays readable and it never
          competes for attention. */}
      {/* The filter and transform moved to .ns-hero-bg so the push-in can own
          the transform — a CSS animation and an inline transform on the same
          element is a fight the animation wins, but only confusingly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BACKDROP} alt="" aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover ns-hero-bg"
      />

      {/* Drifting cloud banks. Two layers at different sizes and speeds moving
          in opposite directions, which is what stops a loop from reading as one
          repeating texture sliding past. Pure CSS gradients — no image, no JS,
          nothing extra to download — and they stop entirely under
          prefers-reduced-motion. */}
      <span className="ns-hero-cloud" aria-hidden="true" />
      <span className="ns-hero-cloud ns-hero-cloud-b" aria-hidden="true" />

      {/* Embers rising off the treeline. The clouds move too slowly to register
          as motion on their own — this is the layer the eye actually catches,
          and it is the same effect the world map uses, so the two screens read
          as one world. */}
      <span className="ns-hero-motes" aria-hidden="true" />

      {/* Vignette — same treatment as the in-game map, so arriving at the game
          feels like the same place rather than a different product. Sits ABOVE
          the clouds so they stay a suggestion at the edges rather than
          something competing with the logo. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(120% 70% at 50% 42%, transparent 42%, rgba(3,7,5,.86) 100%),' +
            'linear-gradient(0deg, #050b08 4%, transparent 34%),' +
            'linear-gradient(180deg, rgba(4,8,6,.8), transparent 22%)',
        }}
      />

      <MusicButton muted={muted} onToggle={toggle} style={{ position: 'fixed', top: 68, right: 16, zIndex: 60 }} />

      <div className="relative z-[2] flex w-full flex-col items-center">

        <p
          className="font-mono uppercase mb-5"
          style={{ fontSize: 10, letterSpacing: '5px', color: '#4e8f74', animation: 'fadeUp .6s .1s both' }}
        >
          {'// PIXEL DUNGEON CRAWLER'}
        </p>

        {/* Was min(78vw,420px), which on a 393px phone is 307px — the logo ran
            nearly edge to edge and took the whole middle of the screen, so the
            scene behind it had nowhere to be seen and the buttons read as an
            afterthought below it. min(58vw,280px) gives 228px there: still the
            largest thing on the page, no longer the only thing.
            280 is also 840/3 exactly, so the desktop cap stays an integer
            downscale of the source — the reason this file is 840px wide and
            not 640 is that a resampled resample softens the pixel edges. */}
        {/* Three copies of one file. The two ghosts are aria-hidden and carry
            no alt, so a screen reader still hears exactly one logo — see
            .ns-logo-glitch in globals.css for what they do and why the burst
            is intermittent. Same src means one cache hit, no extra download. */}
        <div className="ns-logo-glitch w-[min(58vw,280px)]" style={{ animation: 'fadeUp .6s .25s both' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO}
            alt="NullState"
            width={840} height={318}
            className="ns-logo-base"
            style={{ filter: 'drop-shadow(0 4px 22px rgba(0,0,0,.85))' }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="" aria-hidden="true" width={840} height={318} className="ns-logo-g ns-logo-g-a" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="" aria-hidden="true" width={840} height={318} className="ns-logo-g ns-logo-g-b" />
        </div>

        <p
          className="font-mono uppercase mt-2 max-w-[320px] sm:max-w-none"
          style={{ fontSize: 11, letterSpacing: '2.5px', color: '#8ea89d', animation: 'fadeUp .6s .45s both' }}
        >
          Crawl the bunkers. Crack the vault. Earn real USDT.
        </p>

        <div
          className="flex gap-3 items-center justify-center flex-wrap mt-9"
          style={{ animation: 'fadeUp .6s .8s both' }}
        >
          {/* Sized down from 168x52. Two 168px buttons plus the gap came to
              348px against 345px of usable width on a 393px phone — they filled
              the row wall to wall, which is what made them read as heavy slabs
              rather than a choice.
              The HEIGHT stays at 48 and does not go lower: that is the tap
              target floor (WCAG 2.5.5, and MiniPay's own guidance), and this is
              a game whose audience plays one-handed on cheap Android hardware.
              Making a button look lighter by making it harder to hit is not a
              trade worth taking — the width and the border weight carry it. */}
          <a
            href="/game"
            className="font-mono font-bold uppercase no-underline inline-flex items-center justify-center"
            style={{
              minHeight: 48, minWidth: 132, fontSize: 14, letterSpacing: '2.5px',
              color: '#04140c', background: '#39ff9a',
              border: '2px solid #0a3d24',
              boxShadow: 'inset 2px 2px 0 rgba(255,255,255,.4), 0 0 18px rgba(57,255,154,.4)',
            }}
          >
            PLAY
          </a>
          {/* aria-label, not a relabel. "LEARN MORE" on its own is the exact
              phrase Lighthouse's link-text audit treats as non-descriptive —
              it was the single failing SEO audit on this page (92/100), and a
              crawler reading the link out of context learns nothing about
              where it goes. The visible text stays, because the button pairs
              with PLAY and the shorter word is what makes that pair read.
              The label opens with the visible text on purpose: WCAG 2.5.3
              wants the accessible name to contain the visible one, so voice
              control still activates it by what is written on screen. */}
          <a
            href="/docs"
            aria-label="Learn more about how NULL_STATE works"
            className="font-mono uppercase no-underline inline-flex items-center justify-center"
            style={{
              minHeight: 48, minWidth: 132, fontSize: 11, letterSpacing: '2px',
              color: '#8ea89d', background: 'rgba(6,12,9,.72)',
              border: '2px solid rgba(255,255,255,.16)',
            }}
          >
            LEARN MORE
          </a>
        </div>

        <p
          className="font-mono uppercase mt-7"
          style={{ fontSize: 9, letterSpacing: '2px', color: '#4e6b5e', animation: 'fadeUp .6s 1s both' }}
        >
          Free to play · Built for MiniPay
        </p>
      </div>
    </section>
  )
}
