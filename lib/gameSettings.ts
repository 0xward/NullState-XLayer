'use client'

// ─── Player preferences ──────────────────────────────────────────────────────
// Sound, music volume, SFX and screen shake used to live as plain useState
// inside DungeonGame, seeded from hardcoded defaults on every mount. That meant
// they were RUN-SCOPED: mute the game, leave the bunker, come back — and it is
// loud again. Nothing ever wrote them down.
//
// They are preferences, not run state, so they belong out here where both the
// in-run Settings modal and the map's Settings screen can read and write the
// same values.
//
// Stored per-device rather than per-wallet on purpose: "how loud is this game"
// is a property of the phone you are holding, and a guest who later connects a
// wallet should not have their sound reset.

const KEY = 'ns-settings-v1'

export interface GameSettings {
  soundMuted: boolean
  musicVolume: number      // 0..1
  sfxEnabled: boolean
  screenShakeEnabled: boolean
}

// Matches the engine's own defaults (audio module starts musicVolume at 0.75
// with SFX on), so a first-time player's experience is unchanged.
export const DEFAULT_SETTINGS: GameSettings = {
  soundMuted: false,
  musicVolume: 0.75,
  sfxEnabled: true,
  screenShakeEnabled: true,
}

export function loadGameSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      soundMuted: typeof parsed.soundMuted === 'boolean' ? parsed.soundMuted : DEFAULT_SETTINGS.soundMuted,
      // Clamped rather than trusted: a hand-edited or half-written value must
      // not be able to hand the audio engine a NaN.
      musicVolume: typeof parsed.musicVolume === 'number' && isFinite(parsed.musicVolume)
        ? Math.min(1, Math.max(0, parsed.musicVolume))
        : DEFAULT_SETTINGS.musicVolume,
      sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : DEFAULT_SETTINGS.sfxEnabled,
      screenShakeEnabled: typeof parsed.screenShakeEnabled === 'boolean' ? parsed.screenShakeEnabled : DEFAULT_SETTINGS.screenShakeEnabled,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveGameSettings(next: Partial<GameSettings>): GameSettings {
  const merged = { ...loadGameSettings(), ...next }
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(KEY, JSON.stringify(merged)) } catch { /* storage off — settings just won't survive the session */ }
  }
  return merged
}
