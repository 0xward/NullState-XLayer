'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadGameSettings } from '@/lib/gameSettings'
import { applyAudioSettings, startAudio, toggleSoundMuted } from '@/lib/audioControl'
import { loadEngineScript } from '@/lib/engineScript'

// ─── Music, everywhere ───────────────────────────────────────────────────────
// The landing page used to get its music from the audio track of an 851KB
// background video. That is a lot of someone's data plan for a few seconds of
// ambience in the markets this game targets — and it was a DIFFERENT piece of
// music from the one the game plays, so the landing page and the game sounded
// like two products.
//
// The engine already synthesises its ambient bed with Web Audio:
// public/game-engine/audio.js is a standalone 21KB module with no dependencies
// that exposes window.Audio2. Loading that instead means the landing page, the
// world map and the dungeon all play the SAME music, it costs 21KB instead of
// 851KB, and there is no audio file to stream at all.
//
// AUTOPLAY: browsers refuse to start audio before the user has interacted with
// the page, and a MiniPay webview is no different. So this tries immediately
// (which works on a repeat visit where the context is already unlocked) and
// otherwise arms a one-shot listener for the first tap anywhere — the same
// pattern game.js already uses in-run. Nothing is ever forced on someone who
// turned music off.

interface Audio2Api {
  start: () => void
  toggleMute: () => boolean
  setMusicVolume: (v: number) => number
  readonly muted: boolean
}

function getAudio(): Audio2Api | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Audio2?: Audio2Api }).Audio2 ?? null
}

// lib/engineScript.ts owns the URL and the dedupe. This used to build its own
// `/game-engine/audio.js` and look for an existing tag by exact src, while
// DungeonGame injected `/game-engine/audio.js?v=<build>` — the two never
// matched, so entering a run fetched and ran the audio engine a second time.
function ensureLoaded(): Promise<void> {
  if (getAudio()) return Promise.resolve()
  return loadEngineScript('audio.js')
}

/**
 * Starts the ambient bed and keeps it in step with the stored preference.
 * Renders nothing. Safe to mount on more than one screen — the underlying
 * audio module is a singleton.
 */
export function useMusic() {
  const [muted, setMuted] = useState(true) // assume off until storage is read
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setMuted(loadGameSettings().soundMuted)

    ensureLoaded().then(() => {
      if (cancelled) return
      setReady(true)

      // applyAudioSettings owns the whole picture — music mute, volume, and
      // whether effects are audible — so this screen never sets one of those
      // and forgets another.
      const begin = () => { startAudio(); applyAudioSettings() }

      begin()
      // Retry on the first real interaction, since the AudioContext may still
      // be locked. Harmless if begin() already worked: start() is idempotent
      // and applyAudioSettings only toggles what is actually wrong.
      const onGesture = () => begin()
      window.addEventListener('pointerdown', onGesture, { once: true })
      window.addEventListener('keydown', onGesture, { once: true })
      return () => {
        window.removeEventListener('pointerdown', onGesture)
        window.removeEventListener('keydown', onGesture)
      }
    }).catch(() => { /* no audio module — the toggle just won't appear to do anything */ })

    return () => { cancelled = true }
  }, [])

  const toggle = useCallback(() => {
    // This tap may be the gesture that unlocks audio in the first place.
    startAudio()
    setMuted(toggleSoundMuted().soundMuted)
  }, [])

  return { muted, ready, toggle }
}

/** The speaker button. Shared by the landing page and the world map so the two
 *  can never drift into different icons or different behaviour.
 *
 *  It is a MASTER switch, not a music switch: it silences effects too. The
 *  label says so, because a speaker icon that leaves every click still beeping
 *  is exactly the bug this replaced. */
export function MusicButton({ muted, onToggle, style }: {
  muted: boolean
  onToggle: () => void
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
      aria-pressed={!muted}
      className="flex items-center justify-center"
      style={{
        width: 40, height: 40, minHeight: 40,
        border: '1px solid rgba(57,255,154,0.35)',
        background: 'rgba(4,8,6,0.78)',
        color: muted ? 'rgba(255,255,255,0.5)' : '#4dffa6',
        clipPath: 'polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)',
        ...style,
      }}
    >
      {muted ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  )
}
