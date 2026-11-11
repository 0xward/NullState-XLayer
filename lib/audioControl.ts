'use client'

import { loadGameSettings, saveGameSettings, type GameSettings } from '@/lib/gameSettings'

// ─── The one place that decides what the player hears ────────────────────────
//
// THE BUG THIS EXISTS TO KILL: the engine's `muted` flag controls ONLY the
// ambient music bed. That is deliberate and documented in audio.js — an earlier
// fix separated it from SFX so you could have music off with effects on. But
// every UI switch labelled "Sound" was wired straight to it, so turning sound
// off silenced the music and left every effect playing. The label promised a
// master switch and delivered a music switch.
//
// Rather than change the engine (its split is correct and useful), the UI now
// has a real master switch layered on top:
//
//     music audible  =  !soundMuted
//     SFX audible    =  !soundMuted && sfxEnabled
//
// `sfxEnabled` stays the player's own preference for effects and is remembered
// across a master mute — muting and unmuting must not silently switch effects
// back on for someone who turned them off.
//
// EVERY surface goes through here: the landing page button, the world-map
// button, the map's Settings screen, the in-run Settings modal, and the in-run
// mute button. There is exactly one function that computes the desired state
// and exactly one that pushes it into the engine, so two controls cannot
// disagree about what is on.

interface Audio2Api {
  start: () => void
  toggleMute: () => boolean
  toggleSfx: () => boolean
  setMusicVolume: (v: number) => number
  readonly muted: boolean
  readonly sfxEnabled: boolean
  readonly musicVolume: number
}

function engine(): Audio2Api | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Audio2?: Audio2Api }).Audio2 ?? null
}

/** True when effects should be heard right now. */
export function sfxAudible(s: GameSettings = loadGameSettings()): boolean {
  return !s.soundMuted && s.sfxEnabled
}

/**
 * Push the full desired audio state into the engine.
 *
 * Written as "compare, then toggle if wrong" because the engine only exposes
 * flip-flops (toggleMute/toggleSfx), not setters. Reading its getters first is
 * what stops a second call from undoing the first.
 *
 * Order matters: setMusicVolume() recomputes the SFX gain from the CURRENT
 * sfxEnabled flag, so volume is applied before the SFX decision, never after.
 */
export function applyAudioSettings(s: GameSettings = loadGameSettings()): void {
  const A = engine()
  if (!A) return
  try {
    if (A.muted !== s.soundMuted) A.toggleMute()
    A.setMusicVolume(s.musicVolume)
    const wantSfx = sfxAudible(s)
    if (A.sfxEnabled !== wantSfx) A.toggleSfx()
  } catch { /* audio unavailable — settings stay stored for the next attempt */ }
}

/** Unlock the AudioContext. Safe to call on any user gesture; idempotent. */
export function startAudio(): void {
  try { engine()?.start() } catch { /* not loaded yet */ }
}

// ── Setters. Each stores the preference AND applies it immediately, so a
// control never leaves the stored value and what you can hear out of step.

export function setSoundMuted(muted: boolean): GameSettings {
  const next = saveGameSettings({ soundMuted: muted })
  applyAudioSettings(next)
  return next
}

export function setSfxEnabled(enabled: boolean): GameSettings {
  const next = saveGameSettings({ sfxEnabled: enabled })
  applyAudioSettings(next)
  return next
}

export function setMusicVolume(v: number): GameSettings {
  const next = saveGameSettings({ musicVolume: Math.min(1, Math.max(0, v)) })
  applyAudioSettings(next)
  return next
}

/** Convenience for the speaker buttons: flip the master switch. */
export function toggleSoundMuted(): GameSettings {
  return setSoundMuted(!loadGameSettings().soundMuted)
}
