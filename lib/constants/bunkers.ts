// What each bunker is FOR — the player-facing half of GAME-DESIGN.md §7's
// time-vs-risk axis.
//
// WHY THIS FILE EXISTS AND WHY IT IS DANGEROUS. `lib/constants/game-config.ts`
// once carried a `bunkers` block claiming six bunkers of three floors and a
// Golden Key on "bunker 1, floor 3". None of it was true, none of it was read
// by a single line of source, and it reached the player-facing docs anyway.
// Nine such blocks were deleted. This file describes bunkers again, so it has
// to earn its place differently:
//
//   1. It is READ — WorldMapHub renders every field below. Rule 2 in §10:
//      config that nothing reads is a lie.
//   2. It is CHECKED against the engine. `npm run test:bunkers` mounts the real
//      engine, reads its own actHardMode and shard-tier rule, measures floor
//      size per act, and fails if any number here disagrees. The engine remains
//      the source of truth; this is a view of it that the map can import,
//      because the engine is a static <script> the React shell cannot import
//      from (rule 1).
//
// If you change ACT_SIZE in dungeon.js or actHardMode in monster-config.js,
// this file is wrong until you update it — and the test will say so.

export interface BunkerProfile {
  /** campaignActIndex — 0-based, as the engine counts it. */
  act: number
  name: string
  /** 1-5 pips on the map. Derived from the act's HP multiplier below. */
  risk: number
  /** Enemy HP / damage multipliers — monster-config.js `actHardMode`. */
  hpMul: number
  dmgMul: number
  /** Which Glitch Shard tier drops here — game.js `_shardTierForAct()`. */
  shardTier: 1 | 2 | 3
  /** Walkable floor area relative to bunker 1. Measured, not estimated. */
  lengthMul: number
  /** One line answering "why would I pick this one today?" */
  pitch: string
}

// lengthMul is the MEAN of two independent measurement runs (`npm run
// measure:acts` at 10 samples and `npm run test:bunkers` at 8), because floor
// generation is random and a single run puts bunker 3 anywhere between 1.27x
// and 1.35x. The test allows a 10% band around these for the same reason: the
// claim has to be honest, not exact to three decimals. Re-run both after
// touching ACT_SIZE in dungeon.js.
export const BUNKERS: BunkerProfile[] = [
  { act: 0, name: 'THE TREELINE BUNKER', risk: 1, hpMul: 1.00, dmgMul: 1.00, shardTier: 1, lengthMul: 1.00,
    pitch: 'The short run. Safest shards, fastest contracts.' },
  { act: 1, name: 'THE SUNKEN FIELD', risk: 2, hpMul: 1.20, dmgMul: 1.05, shardTier: 1, lengthMul: 1.15,
    pitch: 'A little longer, a little meaner. Still T1 shards.' },
  { act: 2, name: 'THE FROSTLINE BUNKER', risk: 3, hpMul: 1.45, dmgMul: 1.12, shardTier: 2, lengthMul: 1.30,
    pitch: 'Where T2 shards start. Worth the extra minutes.' },
  { act: 3, name: 'THE HOLLOW MARKET', risk: 4, hpMul: 1.70, dmgMul: 1.20, shardTier: 2, lengthMul: 1.55,
    pitch: 'Long and dangerous. More rooms, more containers.' },
  { act: 4, name: 'THE LAST LIGHT', risk: 5, hpMul: 2.00, dmgMul: 1.30, shardTier: 3, lengthMul: 1.65,
    pitch: 'The deepest. Only source of T3 shards — and the Vault.' },
]

export function bunkerProfile(act: number): BunkerProfile {
  return BUNKERS[Math.max(0, Math.min(BUNKERS.length - 1, act))]
}

/** "▰▰▰▱▱" — risk at a glance, in a font every phone has. */
export function riskPips(risk: number): string {
  return '▰'.repeat(risk) + '▱'.repeat(Math.max(0, 5 - risk))
}

/**
 * "+55% LONGER", or null for bunker 1 — it is the yardstick.
 *
 * A percentage rather than "1.6×": at one decimal place, bunker 4 (1.55) and
 * bunker 5 (1.65) both rendered "~1.6× longer", so two rungs of the ladder
 * looked identical on the one line meant to tell them apart.
 */
export function lengthNote(p: BunkerProfile): string | null {
  const pct = Math.round((p.lengthMul - 1) * 100)
  if (pct < 5) return null
  return `+${pct}% LONGER`
}
