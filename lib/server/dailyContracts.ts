// ─── ON THE NAME ─────────────────────────────────────────────────────────────
//
// OWNER: *"ko contract sih namanya? kenapa engga mission aja? bahasanya bukan
// game banget kalo contracts."*
//
// The player-facing word is **MISSIONS**. This file, the route (`/api/contracts`),
// the RTDB paths (`dailyContracts`, `dailyContractClaims`) and the engine's
// `reportContract()` all still say "contract", and that is DELIBERATE — renaming
// stored keys is a live-data migration, and it would buy the player nothing.
//
// He is right, though the reason is not the one he gave. In English game
// vocabulary "Contracts" is perfectly at home — Warzone, Hunt: Showdown and
// Cyberpunk all use it for exactly this. It fails on the audience: this game's
// community is Indonesian, and *kontrak* there means an employment or rental
// agreement — paperwork, not a job from an underworld broker. *Misi* is a
// direct cognate, understood instantly, and is game vocabulary worldwide.
//
// So do NOT "fix" the inconsistency by renaming these keys. The divergence is
// the decision. Same shape as `nullstateTokenBalance` holding "NullState Point".

// Daily Contracts — the reason to open the app on a Tuesday.
//
// GAME-DESIGN.md §5.2, layer 2 of the four time layers. Vault Fragments answer
// "why play this week"; the weekly payout answers "why care at all". Nothing
// answered "why today", and a daily energy allowance is a limiter, not a
// reason — you cap what people want more of.
//
// Three objectives, reset 00:00 UTC, paying Glitch Shards and NullState Point.
// Deliberately NOT paying USDT: money stays weekly (owner decision, and the
// same call already recorded against the cancelled daily drip in
// GROWTH-BLUEPRINT.md §1A). Every currency here is off-chain and already
// exists, so the whole feature costs the operator nothing.
//
// ── ON TRUST ────────────────────────────────────────────────────────────────
// TWO of the four metrics are credited server-side, off requests the server was
// already handling, so they cannot be inflated from the client:
//
//   containers -> /api/vault/fragments, off the same POST that awards the
//                 fragment (one per container, first open only)
//   burns      -> /api/burn/record, off the quantity that route has already
//                 validated
//
// (This paragraph used to claim the container credit and was wrong: the engine
// was posting the count itself. Fixing the burn path — the owner burned from
// the Rewards screen, which never runs the engine, and nothing moved — was what
// surfaced it, since both are the same mistake.)
//
// Kills and floors cannot be: the server has no view of combat, so the client
// reports them. That is a real limitation and worth naming rather than dressing
// up. It is bounded three ways — a hard cap on the amount any single request
// may claim, a per-day ceiling that is the contract's own target, and the fact
// that the rewards are Glitch Shards and NullState Point, both of which are
// off-chain, non-withdrawable, and already client-authoritative everywhere else
// in this game. Nothing here touches USDT.

import { getAdminDb } from '@/firebase-config'
import { getCurrentDayIdString, getNextUtcMidnightMs } from '@/lib/vault-utils'

type AdminDb = NonNullable<ReturnType<typeof getAdminDb>>

/** What a contract pays. Only currencies that already exist and are free. */
export type ContractReward =
  | { kind: 'point'; amount: number }
  | { kind: 'shard'; tier: 't1' | 't2' | 't3'; amount: number }

export interface ContractDef {
  id: string
  /** The engine event that advances it. */
  metric: 'kills' | 'floors' | 'containers' | 'burns'
  target: number
  label: string
  reward: ContractReward
}

// The pool, sized against a MEASURED bunker rather than a guessed one — run
// `npm run measure:bunker` and it prints exactly this arithmetic.
//
// A full five-floor clear yields roughly 7.5 lockable containers and 30
// enemies. That second figure is the one that caught me out: floor 5 is the
// boss floor and holds exactly ONE enemy, so almost every kill comes from
// floors 1-4. The first version of this pool asked for 40 and 80 kills, which
// is 1.3 and 2.7 bunkers — a day rolling the 80 would have had the player
// clear a whole bunker and finish one contract out of three, which reads as
// punishment rather than a nudge.
//
// Targets now, in bunkers of effort:
//   floors3  0.6    cont5  0.7    kills30  1.0
//   cont8    1.1    kills60  2.0   (the deliberate stretch)
//
// Three metrics are picked per day and never repeat, so at most ONE kills
// contract can appear. On most days a thorough bunker finishes two of the
// three. On the day that rolls the 60-kill stretch alongside cont8 it takes
// two bunkers to clear everything — stated plainly rather than claimed away,
// because two of five daily runs for a full sweep is a fair price and
// pretending otherwise is how a target ends up wrong.
export const CONTRACT_POOL: ContractDef[] = [
  { id: 'kills30', metric: 'kills', target: 30, label: 'Put down 30 of them', reward: { kind: 'point', amount: 250 } },
  { id: 'floors3', metric: 'floors', target: 3, label: 'Secure 3 floors', reward: { kind: 'shard', tier: 't1', amount: 3 } },
  { id: 'cont5', metric: 'containers', target: 5, label: 'Crack 5 lockable containers', reward: { kind: 'point', amount: 200 } },
  { id: 'burn8', metric: 'burns', target: 8, label: 'Burn 8 items', reward: { kind: 'shard', tier: 't1', amount: 2 } },
  { id: 'kills60', metric: 'kills', target: 60, label: 'Put down 60 of them', reward: { kind: 'shard', tier: 't1', amount: 4 } },
  { id: 'cont8', metric: 'containers', target: 8, label: 'Crack 8 lockable containers', reward: { kind: 'point', amount: 400 } },
]

export const CONTRACTS_PER_DAY = 3

/** Largest step one request may claim. A generous run of kills still fits. */
const MAX_STEP: Record<ContractDef['metric'], number> = {
  kills: 20, floors: 1, containers: 1, burns: 20,
}

// Everyone gets the same three on the same day. Deterministic from the day id
// so no state is needed to remember what was rolled, and two players can
// compare notes — which is worth more than per-player variety at this size.
function hashDay(dayId: string): number {
  let h = 2166136261
  for (let i = 0; i < dayId.length; i++) {
    h ^= dayId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function contractsForDay(dayId: string): ContractDef[] {
  const pool = [...CONTRACT_POOL]
  const picked: ContractDef[] = []
  let h = hashDay(dayId)
  const usedMetrics = new Set<string>()
  // Prefer three DIFFERENT metrics, so a day never asks for kills twice and
  // leaves the player with one thing to do wearing three hats.
  while (picked.length < CONTRACTS_PER_DAY && pool.length) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const i = h % pool.length
    const cand = pool.splice(i, 1)[0]
    if (usedMetrics.has(cand.metric) && picked.length + pool.length >= CONTRACTS_PER_DAY) continue
    usedMetrics.add(cand.metric)
    picked.push(cand)
  }
  return picked
}

export interface ContractState {
  id: string
  metric: ContractDef['metric']
  label: string
  target: number
  progress: number
  done: boolean
  reward: ContractReward
}

export interface DayState {
  dayId: string
  nextResetAt: number
  contracts: ContractState[]
  /** How many of today's three are finished — what the map's chip shows. */
  completed: number
}

function progressRef(db: AdminDb, dayId: string, wallet: string) {
  return db.ref(`dailyContracts/${dayId}/${wallet}`)
}

function build(dayId: string, raw: Record<string, unknown> | null): DayState {
  const defs = contractsForDay(dayId)
  const contracts = defs.map((d) => {
    const v = raw?.[d.id]
    const progress = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(d.target, Math.floor(v))) : 0
    return { id: d.id, metric: d.metric, label: d.label, target: d.target, progress, done: progress >= d.target, reward: d.reward }
  })
  return {
    dayId,
    nextResetAt: getNextUtcMidnightMs(),
    contracts,
    completed: contracts.filter((c) => c.done).length,
  }
}

export async function readDayState(db: AdminDb, wallet: string, dayId = getCurrentDayIdString()): Promise<DayState> {
  const snap = await progressRef(db, dayId, wallet).get()
  return build(dayId, snap.exists() ? (snap.val() as Record<string, unknown>) : null)
}

/**
 * Advance every contract watching this metric, and pay for any that finish.
 *
 * The reward is granted the moment the bar fills — no claim step, matching how
 * burning already credits Point instantly. A claim button is one more tap
 * between the player and the thing they earned, on a screen they opened to
 * play a game.
 */
export async function reportMetric(
  db: AdminDb,
  wallet: string,
  metric: ContractDef['metric'],
  amount: number,
  dayId = getCurrentDayIdString(),
): Promise<DayState & { granted: string[] }> {
  const step = Math.max(1, Math.min(MAX_STEP[metric] ?? 1, Math.floor(amount)))
  const defs = contractsForDay(dayId).filter((d) => d.metric === metric)

  const granted: string[] = []

  for (const def of defs) {
    // Clamp inside the transaction so concurrent reports cannot overshoot the
    // target and hand out a second reward on the way past it.
    let crossed = false
    await progressRef(db, dayId, wallet).child(def.id).transaction((cur: unknown) => {
      const n = typeof cur === 'number' && Number.isFinite(cur) ? Math.max(0, Math.floor(cur)) : 0
      if (n >= def.target) return n
      const next = Math.min(def.target, n + step)
      if (next >= def.target) crossed = true
      return next
    })
    if (!crossed) continue

    // First-writer-wins gate, same shape as the Golden Key claim and the pass
    // daily perks: only the request that commits it pays out.
    const gate = await db.ref(`dailyContractClaims/${dayId}/${wallet}/${def.id}`).transaction((cur: unknown) => {
      if (cur !== null) return undefined
      return { claimedAt: Date.now() }
    })
    if (!gate.committed) continue

    try {
      await grantReward(db, wallet, def.reward)
      granted.push(def.id)
    } catch (err) {
      // Roll the gate back so the contract is not silently burned without its
      // reward — the next report re-attempts it. Same rollback the pass perks
      // claim does for the same reason.
      await db.ref(`dailyContractClaims/${dayId}/${wallet}/${def.id}`).remove().catch(() => {})
      throw err
    }
  }

  const state = await readDayState(db, wallet, dayId)
  return { ...state, granted }
}

async function grantReward(db: AdminDb, wallet: string, reward: ContractReward): Promise<void> {
  if (reward.kind === 'point') {
    // Same path /api/burn/record credits, so the balance has one owner.
    await db.ref(`playerProfiles/${wallet}/nullstateTokenBalance`)
      .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
    return
  }
  await db.ref(`materials/${wallet}/${reward.tier}`)
    .transaction((cur: unknown) => (typeof cur === 'number' ? cur : 0) + reward.amount)
}
