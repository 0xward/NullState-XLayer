'use client'

import { sfxAudible } from '@/lib/audioControl'

// ─── UI sound ────────────────────────────────────────────────────────────────
// Taps on the world map make a sound, and different things sound different —
// which is how a menu stops feeling like a web page.
//
// No new audio files. public/game-engine/audio.js already synthesises a full
// SFX set with Web Audio, and MusicController has it loaded on every screen
// that needs it, so this is a mapping layer over sounds that already exist and
// already cost nothing to ship.
//
// The mapping is by CHARACTER, chosen from what each generator actually does
// rather than by name:
//   pickup     two sine blips 880 -> 1320Hz, short and bright   -> ticks
//   levelup    a four-note rising arpeggio, triumphant          -> rewards
//   descend    a sine sweep 440 -> 110Hz over a second, falling -> going down
//   breakProp  filtered noise crack plus two falling triangles  -> physical
//   attack     a bandpass noise whoosh                          -> panels
//   hit        a dull low thud                                  -> refusal
//
// Gated on lib/audioControl.sfxAudible(), so the master Sound switch actually
// silences these. It would be silent anyway once audioControl has zeroed the
// engine's SFX gain — but building oscillator nodes to play nothing on every
// tap is waste, and checking makes the intent explicit rather than incidental.
//
// Everything is wrapped in a try/catch and a null check: the audio module may
// not have loaded yet, and no UI interaction should ever be blocked by sound.

export type UiSound =
  | 'tick'      // selecting something
  | 'confirm'   // entering a bunker
  | 'reward'    // the earn-side rail
  | 'gear'      // bag / crafting — physical, material
  | 'panel'     // opening a screen
  | 'denied'    // tapping something locked

interface Audio2Api {
  start: () => void
  pickup: () => void
  levelup: () => void
  descend: () => void
  breakProp: () => void
  attack: () => void
  hit: () => void
}

const METHOD: Record<UiSound, keyof Omit<Audio2Api, 'start'>> = {
  tick: 'pickup',
  confirm: 'descend',
  reward: 'levelup',
  gear: 'breakProp',
  panel: 'attack',
  denied: 'hit',
}

export function playUiSound(kind: UiSound): void {
  if (typeof window === 'undefined') return
  if (!sfxAudible()) return
  const A = (window as unknown as { Audio2?: Audio2Api }).Audio2
  if (!A) return
  try {
    // A tap IS a user gesture, so this is the right moment to unlock the
    // AudioContext if it is still suspended — start() is idempotent.
    A.start()
    A[METHOD[kind]]?.()
  } catch { /* audio unavailable — never let it break the interaction */ }
}

/** Wraps a click handler so it plays its sound first. Keeps the sound next to
 *  the button in the JSX instead of repeated inside every handler body. */
export function withSound<T extends unknown[]>(kind: UiSound, fn: (...args: T) => void) {
  return (...args: T) => { playUiSound(kind); fn(...args) }
}
