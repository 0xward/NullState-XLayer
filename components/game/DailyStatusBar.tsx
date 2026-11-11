'use client'

import { useEffect, useState } from 'react'
import { playUiSound } from '@/lib/uiSound'

// ─── The five-second answer to "why am I here today?" ────────────────────────
//
// GAME-DESIGN.md §5.5. Opening the app has to show, immediately and without a
// tap, what is worth doing right now. Until this existed the map showed where
// the player had BEEN — bunkers, ✓ marks, a level — and nothing about what the
// day was offering. A player who has to go looking for a reason to play does
// not go looking.
//
// It sits directly above the ENTER button on purpose: that is the path the eye
// already takes on the way to the only action on the screen, so it is read
// rather than discovered.
//
// Every chip here is backed by a system that actually tracks the number it
// shows — rule 2 in GAME-DESIGN.md §10, and the reason each one arrived on the
// day its feature did rather than as a placeholder.
//
// Each chip hides itself when it has nothing true to say: no craft running, no
// fragments left to earn, energy not yet loaded. With all three quiet the bar
// renders nothing at all rather than an empty frame.

interface DailyStatusBarProps {
  /** Wallet or guest id. Nothing is fetched without one. */
  address: string | null | undefined
  /** Tapping the craft chip is how a finished weapon gets collected. */
  onCrafting: () => void
}

interface Chip {
  key: string
  icon: string
  label: string
  tone: 'green' | 'amber' | 'ready'
  onClick?: () => void
  title: string
}

function formatLeft(ms: number): string {
  if (ms <= 0) return 'READY'
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ─── The seven-day ladder, drawn ─────────────────────────────────────────────
//
// OWNER: "pop up daily nya jelek banget, kaya bukan game banget, streak nya
// juga ga kaya game2 lain."
//
// He is describing a real and specific absence. Every shipped version of this
// mechanic — and the write-ups of why it works say the same — puts all seven
// rungs on screen AT ONCE, with what each one pays, so the player can see how
// far they are from the big one. That visible distance is the mechanic. What we
// had instead was a sentence ("day 3 of 7") and a number in a chip: the reward
// existed, the progress existed, and neither was ever SHOWN. Nothing to look
// at, nothing to want, nothing that reads as a game.
//
// So the panel opens on the ladder. Days already banked are stamped, today
// glows, day 7 is visibly the prize, and the tile for every future day names
// what it pays rather than making the player find out by waiting.

type Reward = { kind: 'point'; amount: number } | { kind: 'shard'; tier: string; amount: number } | { kind: 'energy'; amount: number }

// One glyph per currency, matching the chips the map already uses so the same
// thing is never two symbols: ◆ Point, ◈ Glitch Shard, ⚡ energy.
function rewardIcon(r: Reward): string {
  return r.kind === 'point' ? '◆' : r.kind === 'shard' ? '◈' : '⚡'
}
function rewardAmount(r: Reward): string {
  return r.kind === 'energy' ? `+${r.amount}` : String(r.amount)
}
function rewardWord(r: Reward): string {
  return r.kind === 'point' ? 'Point' : r.kind === 'shard' ? `Shard ${String(r.tier || '').toUpperCase()}` : 'energy'
}
function describe(r: Reward | null | undefined): string {
  return r ? `+${r.amount} ${rewardWord(r)}` : ''
}

export default function DailyStatusBar({ address, onCrafting }: DailyStatusBarProps) {
  const [energy, setEnergy] = useState<{ total: number; free: number } | null>(null)
  const [frag, setFrag] = useState<{ have: number; goal: number; label: string } | null>(null)
  const [craftDoneAt, setCraftDoneAt] = useState<number | null>(null)
  const [contracts, setContracts] = useState<{ done: number; total: number } | null>(null)
  const [contractList, setContractList] = useState<
    { id: string; label: string; progress: number; target: number; done: boolean }[]
  >([])
  const [streak, setStreak] = useState<{
    streak: number; day: number; best: number; tomorrow: Reward | null
    claimedToday: boolean; ladder: Reward[]; shield: number; shieldIn: number
  } | null>(null)
  // Shown once, on the visit that actually earned it. A reward the player is
  // never told about is a reward that does not retain anyone.
  const [streakGrant, setStreakGrant] = useState<string | null>(null)
  // True only on the visit that spent it, so the panel can say the streak was
  // SAVED rather than letting the player think they never missed a day.
  const [shieldUsed, setShieldUsed] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  // One instant everything daily rolls over. True since the audit put energy on
  // the same 00:00 UTC boundary as contracts and the streak — before that the
  // panel could not have shown a single countdown honestly.
  const [resetAt, setResetAt] = useState<number | null>(null)
  // Drives the countdown. Cheap: one re-render every 30s, and only while a
  // craft is actually running (see the effect's guard).
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!address) return
    let alive = true
    const j = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)

    // All three in parallel, all after first paint, none blocking the map.
    // Every one of them degrades to "chip hidden" rather than an error state —
    // a status bar that can show an error is a status bar that can make the
    // home screen look broken.
    // The streak is a POST because opening the app IS the event it records —
    // there is nothing to tap and no claim step, matching the decision Daily
    // Contracts already made. It is idempotent per UTC day, so a remount or a
    // second tab costs nothing.
    const streakReq = fetch('/api/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: address }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null)

    Promise.all([
      j(`/api/energy?wallet=${encodeURIComponent(address)}`),
      j(`/api/vault/fragments?wallet=${encodeURIComponent(address)}`),
      j(`/api/weapons/craft?wallet=${encodeURIComponent(address)}`),
      j(`/api/contracts?wallet=${encodeURIComponent(address)}`),
      streakReq,
    ]).then(([e, f, c, d, s]) => {
      if (!alive) return
      if (e && typeof e.total === 'number') setEnergy({ total: e.total, free: e.freeRemaining ?? 0 })
      if (f && typeof f.fragments === 'number' && f.nextGoal) {
        setFrag({ have: Math.min(f.fragments, f.nextGoal.threshold), goal: f.nextGoal.threshold, label: f.nextGoal.label })
      }
      if (d && Array.isArray(d.contracts) && d.contracts.length) {
        setContracts({ done: d.completed ?? 0, total: d.contracts.length })
        setContractList(d.contracts)
      }
      // Either source is the same midnight; contracts answers it directly and
      // energy carries it too, so whichever arrives is enough.
      const reset = (typeof d?.nextResetAt === 'number' && d.nextResetAt)
        || (typeof e?.resetAt === 'number' && e.resetAt) || null
      if (reset) setResetAt(reset)
      if (s && typeof s.streak === 'number' && s.streak > 0) {
        setStreak({
          streak: s.streak,
          day: s.day ?? 1,
          best: s.best ?? s.streak,
          tomorrow: (s.tomorrow as Reward) ?? null,
          claimedToday: !!s.claimedToday,
          // The route has always sent the whole ladder; nothing rendered it.
          ladder: Array.isArray(s.ladder) ? (s.ladder as Reward[]) : [],
          shield: typeof s.shield === 'number' ? s.shield : 0,
          shieldIn: typeof s.shieldIn === 'number' ? s.shieldIn : 0,
        })
        // The energy chip is fetched in the same breath as this, so a streak
        // that just paid energy would otherwise show yesterday's number until
        // the next mount.
        if (s.granted?.kind === 'energy' && e && typeof e.total === 'number') {
          setEnergy({ total: e.total + (s.granted.amount || 0), free: e.freeRemaining ?? 0 })
        }
        if (s.shieldUsed) setShieldUsed(true)
        if (s.grantedLabel) {
          setStreakGrant(s.grantedLabel)
          // OPEN IT. This is the visit that just paid the player something, and
          // every game that runs this mechanic shows the reward rather than
          // parking a note beside it — the note was there before and the owner
          // still had no idea the ladder existed. Once per UTC day by
          // construction: `grantedLabel` is non-null only on the single request
          // that actually advanced the day, so a remount or a second tab
          // reopens nothing.
          setShowPanel(true)
        }
      }
      if (c?.craft?.completesAt) {
        // Correct for client clock skew — the server's own clock is the one the
        // craft timer is measured against.
        const skew = typeof c.serverNow === 'number' ? Date.now() - c.serverNow : 0
        setCraftDoneAt(c.craft.completesAt + skew)
      }
    })

    return () => { alive = false }
  }, [address])

  // The map's DAILY rail button opens this panel — see the note above the
  // panel's markup for why it is a panel now and not a strip.
  useEffect(() => {
    const open = () => setShowPanel(true)
    window.addEventListener('nullstate-open-contracts', open)
    return () => window.removeEventListener('nullstate-open-contracts', open)
  }, [])

  useEffect(() => {
    if (craftDoneAt === null && !showPanel) return
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [craftDoneAt, showPanel])

  const chips: Chip[] = []

  // First, and always visible once it exists. This is the one number on the bar
  // the player can LOSE, and loss aversion only works if the thing at risk is
  // in front of them — a streak they have to go looking for is not at stake.
  if (streak) {
    const last = streak.day === 7
    chips.push({
      key: 'streak',
      icon: last ? '★' : '🔥',
      label: `${streak.streak}`,
      tone: last ? 'ready' : 'amber',
      // Every chip opens the panel. A bar where some chips are buttons and
      // others are not is a bar the player has to learn.
      onClick: () => { playUiSound('panel'); setShowPanel(true) },
      // What is at stake depends on whether a shield is held, and saying "it
      // goes back to 1" to a player who is protected would be a lie in the one
      // place the mechanic is explained without opening anything.
      title: (last
        ? `Day 7 — the big one. Come back tomorrow and the ladder starts again.`
        : `${streak.streak}-day streak · tomorrow: ${describe(streak.tomorrow)}.`)
        + (streak.shield > 0
          ? ' Your Streak Shield covers one missed day.'
          : ' Miss a day and it goes back to 1.')
        + ` Best: ${streak.best} days`,
    })
  }

  if (craftDoneAt !== null) {
    const left = craftDoneAt - now
    chips.push({
      key: 'craft',
      icon: left <= 0 ? '✦' : '⏳',
      label: left <= 0 ? 'WEAPON READY' : formatLeft(left),
      tone: left <= 0 ? 'ready' : 'amber',
      onClick: () => { playUiSound('panel'); onCrafting() },
      title: left <= 0 ? 'Your weapon has finished evolving — tap to collect it' : 'Weapon evolving — tap to see the craft',
    })
  }

  // Ahead of fragments, because it is the one that resets tonight. A player
  // with an hour to spare should see the perishable thing first.
  if (contracts) {
    const all = contracts.done >= contracts.total
    chips.push({
      key: 'contracts',
      icon: all ? '✓' : '◇',
      label: `${contracts.done}/${contracts.total}`,
      tone: all ? 'ready' : 'green',
      // A count with no way to see what is being counted is a tease. Tapping
      // opens the list right here rather than sending the player to a screen —
      // three lines of text do not need a route.
      onClick: () => { playUiSound('panel'); setShowPanel(true) },
      title: all
        ? "Today's missions are all done — new ones at 00:00 UTC"
        : `${contracts.total - contracts.done} of today's missions still open`,
    })
  }

  if (frag) {
    chips.push({
      key: 'frag',
      icon: '◈',
      label: `${frag.have}/${frag.goal}`,
      tone: 'green',
      onClick: () => { playUiSound('panel'); setShowPanel(true) },
      title: `Vault fragments toward the ${frag.label}. Open lockable containers to earn them.`,
    })
  }

  if (energy) {
    chips.push({
      key: 'energy',
      icon: '⚡',
      label: `${energy.total}`,
      tone: energy.total > 0 ? 'green' : 'amber',
      title: energy.total > 0
        ? `${energy.total} run${energy.total === 1 ? '' : 's'} left (${energy.free} free today)`
        : 'Out of runs — the free allowance refills at 00:00 UTC',
      onClick: () => { playUiSound('panel'); setShowPanel(true) },
    })
  }

  if (!chips.length) return null

  return (
    <>
      {streakGrant && streak && (
        <button
          type="button"
          className="ns-hub-streak-note"
          onClick={() => { playUiSound('panel'); setStreakGrant(null) }}
          aria-label={`Day ${streak.day} streak reward: ${streakGrant}. Tap to dismiss.`}
        >
          <span aria-hidden="true">🔥</span> Day {streak.day} · {streakGrant}
        </button>
      )}
      {/* THE DAILY PANEL.
          Owner, watching someone use it: tapping the DAILY rail button made
          something appear at the BOTTOM of the map, nowhere near the icon that
          was pressed — "yang muncul malah di luar, bukan di dalam menu daily
          itu sendiri". Every other rail button (Rewards, Pass, Bag, Shop,
          Craft, Settings) opens a screen; DAILY poked a strip. It also showed
          only the contracts, while the streak, fragments and energy — equally
          daily — stayed as chips somewhere else. "Daily" was three places.

          It is one place now. The chips stay on the bar because they are the
          glance, and the thing at risk has to be visible without a tap; both
          they and the rail button open THIS. */}
      {showPanel && (
        <div
          className="ns-daily-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Daily"
          onClick={() => { playUiSound('panel'); setShowPanel(false) }}
        >
          <div className="ns-daily-panel" onClick={(e) => e.stopPropagation()}>
            <div className="ns-daily-head">
              <span className="ns-daily-title">DAILY</span>
              {/* ONE countdown for everything, which only became honest when
                  energy moved onto the same 00:00 UTC boundary as the rest. */}
              {resetAt !== null && (
                <span className="ns-daily-reset">resets in {formatLeft(resetAt - now)}</span>
              )}
              <button
                type="button" className="ns-daily-close" aria-label="Close"
                onClick={() => { playUiSound('panel'); setShowPanel(false) }}
              >✕</button>
            </div>

            {/* The one thing that happened the moment this opened. It goes at
                the top, above the ladder, because "you just got paid" is the
                reason the panel is on screen at all. */}
            {streakGrant && (
              <div className="ns-daily-claim">
                <span className="ns-daily-claim-burst" aria-hidden="true" />
                <span className="ns-daily-claim-day">DAY {streak?.day ?? 1} CLAIMED</span>
                <span className="ns-daily-claim-amt">{streakGrant}</span>
                <span className="ns-daily-claim-note">Already in your account — nothing to press.</span>
              </div>
            )}

            {streak && streak.ladder.length > 0 && (
              <section className="ns-daily-sec">
                <h3 className="ns-daily-sech">
                  <span className="ns-streak-flame" aria-hidden="true">🔥</span>
                  Streak
                  <span className="ns-daily-sech-val">{streak.streak} day{streak.streak === 1 ? '' : 's'}</span>
                  <span className="ns-daily-sech-sub">best {streak.best}</span>
                </h3>

                {/* THE LADDER. All seven at once — see the note above rewardIcon. */}
                <ol className="ns-streak-ladder">
                  {streak.ladder.map((r, i) => {
                    const dayNo = i + 1
                    // Today is `streak.day`. Everything below it this cycle is
                    // banked; today itself is only banked once the visit has
                    // been registered, which on the very first render of the
                    // day it has (the POST is what opened this panel).
                    const banked = dayNo < streak.day || (dayNo === streak.day && streak.claimedToday)
                    const isToday = dayNo === streak.day
                    const jackpot = dayNo === streak.ladder.length
                    return (
                      <li
                        key={dayNo}
                        className={`ns-streak-day${banked ? ' is-done' : ''}${isToday ? ' is-today' : ''}${jackpot ? ' is-jackpot' : ''}`}
                        aria-label={`Day ${dayNo}: ${describe(r)}${banked ? ' — collected' : isToday ? ' — today' : ''}`}
                      >
                        <span className="ns-streak-daynum">{jackpot ? '★7' : dayNo}</span>
                        <span className={`ns-streak-ico is-${r.kind}`} aria-hidden="true">{rewardIcon(r)}</span>
                        <span className="ns-streak-amt">{rewardAmount(r)}</span>
                        {banked && <span className="ns-streak-tick" aria-hidden="true">✓</span>}
                      </li>
                    )
                  })}
                </ol>

                <p className="ns-daily-note">
                  {streak.day === streak.ladder.length && !streak.claimedToday
                    ? <>Today is the big one — <b>{describe(streak.ladder[streak.ladder.length - 1])}</b>, exactly one weapon evolution.</>
                    : streak.tomorrow
                      ? <>Tomorrow pays <b>{describe(streak.tomorrow)}</b>. Day 7 pays {describe(streak.ladder[streak.ladder.length - 1])} — one full weapon evolution.</>
                      : <>Day 7 pays {describe(streak.ladder[streak.ladder.length - 1])} — one full weapon evolution.</>}
                </p>

                {/* The shield. Said out loud, because a safety net nobody knows
                    about protects the streak but not the player's nerve. */}
                <div className={`ns-streak-shield${streak.shield > 0 ? ' is-ready' : ''}`}>
                  <span className="ns-streak-shield-ico" aria-hidden="true">🛡</span>
                  <span className="ns-streak-shield-txt">
                    {shieldUsed
                      ? <><b>Shield spent — your streak survived.</b> You missed a day and it held. Three days in a row earns the next one.</>
                      : streak.shield > 0
                        ? <><b>Streak Shield ready.</b> Miss one day and your streak survives it. Miss two and it is gone.</>
                        : <><b>Streak Shield in {streak.shieldIn} day{streak.shieldIn === 1 ? '' : 's'}.</b> Three days in a row earns one — it covers a single missed day.</>}
                  </span>
                </div>
              </section>
            )}

            {contractList.length > 0 && (
              <section className="ns-daily-sec">
                <h3 className="ns-daily-sech">
                  <span aria-hidden="true">◇</span> Missions
                  <span className="ns-daily-sech-val">{contracts?.done ?? 0}/{contractList.length}</span>
                </h3>
                {contractList.map((c) => {
                  const pct = Math.max(0, Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100)))
                  return (
                    <div key={c.id} className={`ns-daily-task${c.done ? ' is-done' : ''}`}>
                      <div className="ns-daily-row">
                        <span className="ns-daily-label">{c.done ? '✓ ' : ''}{c.label}</span>
                        <span className="ns-daily-val">{Math.min(c.progress, c.target)}/{c.target}</span>
                      </div>
                      {/* A bar, not a fraction. "12/30" is a fact; a bar four
                          fifths of the way across is a reason to play. */}
                      <span className="ns-daily-bar" aria-hidden="true">
                        <span className="ns-daily-bar-fill" style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  )
                })}
              </section>
            )}

            {frag && (
              <section className="ns-daily-sec">
                <h3 className="ns-daily-sech">
                  <span aria-hidden="true">◈</span> Vault fragments
                  <span className="ns-daily-sech-val">{frag.have}/{frag.goal}</span>
                </h3>
                <div className="ns-daily-task">
                  <div className="ns-daily-row">
                    <span className="ns-daily-label">Toward the {frag.label}</span>
                    <span className="ns-daily-val">{frag.goal - frag.have} to go</span>
                  </div>
                  <span className="ns-daily-bar" aria-hidden="true">
                    <span className="ns-daily-bar-fill is-frag" style={{ width: `${Math.min(100, Math.round((frag.have / Math.max(1, frag.goal)) * 100))}%` }} />
                  </span>
                </div>
                <p className="ns-daily-note">Open any lockable container to earn one. Resets with the week, not the day.</p>
              </section>
            )}

            {energy && (
              <section className="ns-daily-sec">
                <h3 className="ns-daily-sech">
                  <span aria-hidden="true">⚡</span> Energy
                  <span className="ns-daily-sech-val">{energy.total}</span>
                </h3>
                <div className="ns-daily-row">
                  <span className="ns-daily-label">{energy.total} run{energy.total === 1 ? '' : 's'} left</span>
                  <span className="ns-daily-val">{energy.free} free</span>
                </div>
              </section>
            )}

            {craftDoneAt !== null && (
              <section className="ns-daily-sec">
                <h3 className="ns-daily-sech">⏳ Weapon craft</h3>
                <button
                  type="button" className="ns-daily-row ns-daily-tap"
                  onClick={() => { playUiSound('panel'); setShowPanel(false); onCrafting() }}
                >
                  <span className="ns-daily-label">
                    {craftDoneAt - now <= 0 ? 'Ready to collect' : 'Evolving'}
                  </span>
                  <span className="ns-daily-val">
                    {craftDoneAt - now <= 0 ? 'OPEN ▸' : formatLeft(craftDoneAt - now)}
                  </span>
                </button>
              </section>
            )}
          </div>
        </div>
      )}
    <div className="ns-hub-daily" role="status" aria-label="Today">
      {chips.map((c) => {
        const inner = (
          <>
            <span aria-hidden="true" className="ns-hub-daily-ico">{c.icon}</span>
            <span>{c.label}</span>
          </>
        )
        return c.onClick ? (
          <button key={c.key} type="button" onClick={c.onClick} title={c.title} aria-label={c.title}
            className={`ns-hub-chip is-${c.tone} is-tappable`}>{inner}</button>
        ) : (
          <span key={c.key} title={c.title} aria-label={c.title}
            className={`ns-hub-chip is-${c.tone}`}>{inner}</span>
        )
      })}
    </div>
    </>
  )
}
