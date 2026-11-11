// Login streak — the reason to open the app on a day you have no time to play.
//
// GAME-DESIGN.md §5.3, the last empty slot in layer 2. Daily Contracts answer
// "why play today"; they do not answer "why open this at all today", and those
// are different questions. A player with ten spare minutes plays. A player with
// one spare minute opens the app or does not — and if they do not, the habit is
// what breaks, not the session.
//
// Loss aversion is the strongest retention force available and it costs the
// operator nothing: seven escalating days, and breaking it drops you to day 1.
// Half of this already existed as the Season Pass daily claim (+1 energy, +3 t1
// shards per UTC day) — a login reward that was never framed as one, and only
// for pass holders. This is the version everyone gets.
//
// ── ON TRUST ────────────────────────────────────────────────────────────────
// Nothing here takes the client's word for anything. The day is the server's
// UTC day, the streak is derived from the stored last day rather than sent, and
// the grant is gated by a first-writer-wins transaction on the day itself — so
// a wallet hammering the endpoint gets exactly one grant per UTC day. Every
// currency it pays is off-chain and already exists. Nothing touches USDT.

import { getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'
import { normalizeRecord, toState, type EnergyRecord } from '@/lib/server/energy'

type AdminDb = NonNullable<ReturnType<typeof import('@/firebase-config').getAdminDb>>

export type StreakReward =
  | { kind: 'point'; amount: number }
  | { kind: 'shard'; tier: 't1' | 't2' | 't3'; amount: number }
  | { kind: 'energy'; amount: number }

// THE LADDER, AND WHY IT IS SHAPED LIKE THIS.
//
// Everything here is t1 shards, energy and NullState Point, on purpose.
// Shard TIER is gated by act — `_shardTierForAct()` in game.js drops t1 on acts
// 1-2, t2 on 3-4, t3 on act 5 — so paying a t2 shard would hand a new player a
// currency they cannot spend and did not earn. t1 is useful to everyone from
// the first bunker.
//
// Day 7 is 8 t1 shards because `EVOLUTION_SHARD_COSTS[0]` is 8: a full week is
// worth exactly ONE weapon evolution. That is the ratchet §4 asks for in so
// many words — "the weapon is tier 3, so next week is faster" — and it is a
// prize a player can name, which a scattering of shards is not.
//
// Sized against Daily Contracts (200-400 Point or 2-4 t1 for real work): a
// whole week of merely opening the app is worth roughly one day of playing it.
// That ordering is deliberate. Showing up should be rewarded; it should never
// out-earn showing up and playing.
export const STREAK_LADDER: StreakReward[] = [
  { kind: 'point', amount: 80 },              // day 1
  { kind: 'shard', tier: 't1', amount: 2 },   // day 2
  { kind: 'energy', amount: 1 },              // day 3
  { kind: 'shard', tier: 't1', amount: 3 },   // day 4
  { kind: 'point', amount: 150 },             // day 5
  { kind: 'shard', tier: 't1', amount: 4 },   // day 6
  { kind: 'shard', tier: 't1', amount: 8 },   // day 7 — one full evolution
]

export const STREAK_LENGTH = STREAK_LADDER.length

// ── THE STREAK SHIELD, AND WHY A PUNISHING STREAK IS THE WRONG STREAK ────────
//
// OWNER: "streak nya juga ga kaya game2 lain."
//
// He was right, and the difference is not decoration. Until now this ladder had
// exactly one rule for a missed day — back to 1 — which is the harshest version
// of the mechanic that shipped anywhere. Every study of the format says the same
// thing: the games and apps that keep people are the ones that forgive a day.
// Duolingo ran 600+ experiments on this single feature and landed on a freeze;
// letting learners hold two of them raised daily actives, and the players who
// were offered one were measurably MORE likely to still be there a week later
// and LESS likely to lose the streak at all. A streak with no safety net does
// not create discipline, it creates the moment a player decides the thing they
// were building is gone and there is no reason to open it tomorrow either.
//
// So: ONE shield, and ONE rule for earning it — three days in a row.
//
//   • It covers exactly ONE missed day. Two and the streak is genuinely broken;
//     the tension the mechanic runs on has to still be real.
//   • It costs the operator NOTHING. The missed day's rung is never paid — the
//     ladder is not advanced through, it is stepped over. A shielded week pays
//     six rungs, not seven.
//   • Spending it sets the next earn three days out, so protection is always
//     something the player is currently working for rather than a permanent
//     licence to skip every other day.
//
// A new player is unprotected for their first two days on purpose: the shield is
// a thing you EARN by showing the habit, which is also what makes it worth
// telling them about on day one.
export const SHIELD_EARN_AFTER = 3

/** Where in the ladder a streak of `n` days sits (1-indexed day 1..7). */
export function ladderDay(streak: number): number {
  if (streak < 1) return 1
  return ((streak - 1) % STREAK_LENGTH) + 1
}

export function rewardFor(streak: number): StreakReward {
  return STREAK_LADDER[ladderDay(streak) - 1]
}

export interface StreakState {
  dayId: string
  nextResetAt: number
  /** Consecutive UTC days, 1 on the first. */
  streak: number
  /** Longest run this wallet has managed. Never resets — it is the trophy. */
  best: number
  /** Where in the seven-day ladder today sits. */
  day: number
  /** True once today's reward has been granted. */
  claimedToday: boolean
  /** What today pays (or paid). */
  today: StreakReward
  /** What tomorrow pays, so the bar can say what is at stake. */
  tomorrow: StreakReward
  /** 1 while a missed day is covered, 0 while it is not. Never above 1. */
  shield: number
  /**
   * Days of streak still to build before the shield comes back, 0 while it is
   * held. The panel says "ready" or "in 2 days" straight off this.
   */
  shieldIn: number
}

interface StreakRecord {
  streak: number
  best: number
  lastDayId: string
  /** 0 or 1. See SHIELD_EARN_AFTER. */
  shield: number
  /** The streak value at which an absent shield returns. */
  shieldAt: number
}

function streakRef(db: AdminDb, wallet: string) {
  return db.ref(`loginStreak/${wallet}`)
}

function dayIdAgo(now: number, days: number): string {
  return getCurrentDayIdString(now - days * 86400000)
}

function yesterdayId(now: number): string {
  return dayIdAgo(now, 1)
}

function normalize(raw: unknown): StreakRecord {
  const v = (raw || {}) as Partial<StreakRecord>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0)
  return {
    streak: n(v.streak),
    best: n(v.best),
    lastDayId: typeof v.lastDayId === 'string' ? v.lastDayId : '',
    // Every record written before the shield existed normalizes to "none held,
    // earned at 3" — so a returning veteran gets one on their very next visit
    // rather than having to rebuild a streak from scratch to qualify.
    shield: Math.min(1, n(v.shield)),
    shieldAt: n(v.shieldAt) || SHIELD_EARN_AFTER,
  }
}

/**
 * Is a streak that last ticked on `rec.lastDayId` still alive right now?
 *
 * Three ways to be alive: it ticked today, it ticked yesterday, or it ticked the
 * day before yesterday and a shield is held to cover the gap. The shielded case
 * is the one that had to be added here as well as in the transaction — a state
 * the writer would honour but the reader calls broken shows the player a dead
 * streak they have not actually lost.
 */
function aliveOn(rec: StreakRecord, now: number): 'today' | 'yesterday' | 'shielded' | 'broken' {
  if (rec.streak < 1) return 'broken'
  if (rec.lastDayId === getCurrentDayIdString(now)) return 'today'
  if (rec.lastDayId === yesterdayId(now)) return 'yesterday'
  if (rec.lastDayId === dayIdAgo(now, 2) && rec.shield > 0) return 'shielded'
  return 'broken'
}

function build(rec: StreakRecord, now: number): StreakState {
  const dayId = getCurrentDayIdString(now)
  const how = aliveOn(rec, now)
  const live = how === 'today'
  // A streak whose last tick is out of reach of both yesterday and the shield is
  // already broken; report it as such rather than showing a number the next tick
  // will erase.
  const streak = how === 'broken' ? 0 : rec.streak
  const shown = Math.max(1, live ? streak : streak + 1)
  return {
    dayId,
    nextResetAt: getNextUtcMidnightMs(now),
    streak,
    best: rec.best,
    day: ladderDay(shown),
    claimedToday: live,
    today: rewardFor(shown),
    tomorrow: rewardFor(shown + 1),
    shield: how === 'broken' ? 0 : rec.shield,
    // Measured against the streak the player is standing on, so it reads as
    // "two more days" rather than an absolute the UI would have to subtract.
    shieldIn: rec.shield > 0 && how !== 'broken' ? 0 : Math.max(0, rec.shieldAt - streak),
  }
}

/** Read-only: what the bar shows without touching anything. */
export async function readStreak(db: AdminDb, wallet: string, now = Date.now()): Promise<StreakState> {
  const snap = await streakRef(db, wallet).get()
  return build(normalize(snap.val()), now)
}

/**
 * Register today's visit and pay for it — at most once per UTC day.
 *
 * The whole decision (is this a continuation, a restart, or a repeat?) happens
 * INSIDE one transaction, so two tabs opening at the same second cannot both
 * advance the streak or both be handed the reward. The transaction is also what
 * decides whether a grant is owed: only the writer that actually moved
 * `lastDayId` forward proceeds to credit.
 */
export async function touchStreak(
  db: AdminDb,
  wallet: string,
  now = Date.now(),
): Promise<StreakState & { granted: StreakReward | null; shieldUsed: boolean }> {
  const dayId = getCurrentDayIdString(now)
  const yday = yesterdayId(now)
  const dayBefore = dayIdAgo(now, 2)

  let owed: StreakReward | null = null
  let usedShield = false
  const tx = await streakRef(db, wallet).transaction((cur: unknown) => {
    const rec = normalize(cur)
    if (rec.lastDayId === dayId) { owed = null; usedShield = false; return rec }   // already counted today

    let streak: number
    let shield = rec.shield
    let shieldAt = rec.shieldAt
    usedShield = false

    if (rec.lastDayId === yday && rec.streak > 0) {
      streak = rec.streak + 1
    } else if (rec.lastDayId === dayBefore && rec.shield > 0 && rec.streak > 0) {
      // ONE missed day, and a shield to cover it. The streak steps OVER the gap
      // rather than through it: the day count advances by one, and the rung the
      // player was absent for is never paid. Nothing is credited for a day
      // nobody showed up.
      streak = rec.streak + 1
      shield = 0
      shieldAt = streak + SHIELD_EARN_AFTER
      usedShield = true
    } else {
      // Two days gone, or one with nothing to spend. This is a real break.
      streak = 1
      shield = 0
      shieldAt = SHIELD_EARN_AFTER
    }

    // Earned by the streak itself, checked after the advance so the day that
    // reaches the threshold is the day it arrives. Never above one.
    if (!shield && streak >= shieldAt) shield = 1

    owed = rewardFor(streak)
    return { streak, best: Math.max(rec.best, streak), lastDayId: dayId, shield, shieldAt }
  })

  const rec = normalize(tx.snapshot?.val())
  // `committed` is false when the transaction aborted; it is also false on a
  // no-op in some SDK versions, so the grant is gated on `owed` — which is only
  // set on the path that actually advanced the day.
  if (!tx.committed || !owed) return { ...build(rec, now), granted: null, shieldUsed: false }

  try {
    await grant(db, wallet, owed, now)
  } catch (err) {
    // The day is spent either way — rolling `lastDayId` back would let the
    // streak be re-claimed, which is worse than one missed grant. Logged loudly
    // because it is the only outcome here that loses the player something.
    console.error('[loginStreak] grant failed for', wallet, err)
    return { ...build(rec, now), granted: null, shieldUsed: usedShield }
  }
  return { ...build(rec, now), granted: owed, shieldUsed: usedShield }
}

async function grant(db: AdminDb, wallet: string, reward: StreakReward, now: number): Promise<void> {
  if (reward.kind === 'point') {
    // Same path /api/burn/record credits, so the balance has one owner.
    await db.ref(`playerProfiles/${wallet}/nullstateTokenBalance`)
      .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
    return
  }
  if (reward.kind === 'shard') {
    await db.ref(`materials/${wallet}/${reward.tier}`)
      .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
    return
  }
  // Energy is a record, not a counter — credited exactly as the Season Pass
  // daily perk does it, through normalizeRecord so a first-ever grant creates a
  // well-formed row instead of a bare number.
  await db.ref(`energy/${wallet}`).transaction((cur: unknown) => {
    const rec = normalizeRecord(cur as Partial<EnergyRecord> | null, now)
    rec.bonus += reward.amount
    return rec
  })
}

/** Human-readable, for the log line and the chip's tooltip. */
export function describeReward(r: StreakReward): string {
  if (r.kind === 'point') return `+${r.amount} NullState Point`
  if (r.kind === 'shard') return `+${r.amount} Glitch Shard ${r.tier.toUpperCase()}`
  return `+${r.amount} energy`
}

export { toState as energyToState }
