'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Public analytics/operational-visibility page required for MiniPay listing
// (celopedia-skill → minipay-requirements.md §8). No wallet needed — it reads
// aggregated numbers from /api/stats (Firebase-backed) and renders them.

// GAME-DESIGN.md §9. The season bonus is paid by hand, on purpose — the owner
// signs it and no deployer key lives on the server. What is automated is the
// preparation, and this is the half that makes a FORGOTTEN payout visible:
// "closed, winners frozen, not yet paid" is a state a person can see, where
// before it was a claim button that silently did nothing.
interface SeasonStatus {
  currentSeasonId: number
  lastClosedSeasonId: number
  awaitingPayout: boolean
  snapshot: {
    seasonId: number
    preparedAt: number
    paidAt: number | null
    winners: { rank: number; wallet: string; username: string; xp: number; rewardUsd: number }[]
  } | null
}

interface StatsPayload {
  generatedAt: number
  players: {
    total: number; dau: number; wau: number; mau: number
    paying?: number; nonPaying?: number; conversionPct?: number | null
    guests?: number; wallets?: number; guestKnown?: number
  }
  onchain: {
    purchases: number
    purchasesByToken: { USDM: number; USDC: number; USDT: number }
    purchaseVolumeUsd: number
    uniqueBuyers?: number
    netUsd?: number
    rewardRatio?: number | null
    volumeEstimated: number
    revenueByKind: Record<string, { count: number; usd: number }>
    passMints: number
    rewardsPaidCount: number
    rewardsPaidUsd: number
    transactionsTotal: number
    purchasesPerDay: number[]
  }
  economy: {
    burnEvents: number
    pointsBurned: number
    vaultCompletions: number
    goldenKeys: number
    papers: number
  }
}

const fmt = (n: number | undefined) => (typeof n === 'number' ? Math.round(n).toLocaleString() : '—')
const fmtUsd = (n: number | undefined) =>
  typeof n === 'number' ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

function Stat({ label, value, hint, accent = '#00ff88' }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[2px] text-null-muted">{label}</div>
      <div className="mt-1 font-display font-black text-null-white" style={{ fontSize: 'clamp(22px,5vw,32px)', color: accent }}>
        {value}
      </div>
      {hint && <div className="mt-1 font-mono text-[10px] text-null-muted">{hint}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 font-mono text-[10px] tracking-[4px] uppercase text-null-green">// {title}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  )
}

// ─── Real-user load speed ────────────────────────────────────────────────────
// MiniPay's listing review grades load speed on the p75 of REAL users, so it is
// surfaced here rather than left in a PostHog tab: a reviewer (and we) can see
// it without leaving the page. Filled by /api/webvitals, which reads it back
// out of PostHog server-side — the key that query needs must never reach a
// browser.

type Vitals = {
  configured: boolean
  error?: string
  windowDays?: number
  samples?: number
  lowConfidence?: boolean
  lcp: number | null
  inp: number | null
  cls: number | null
  fcp: number | null
  thresholds?: Record<string, { good: number; poor: number }>
}

// Google's own colour language for Core Web Vitals: green good, amber needs
// improvement, red poor. Using the thresholds the API sends rather than a copy
// here means the two can never drift apart.
function rate(value: number | null, t?: { good: number; poor: number }) {
  if (value == null || !t) return { colour: '#8a9a91', word: '—' }
  if (value <= t.good) return { colour: '#7ef0a6', word: 'Good' }
  if (value <= t.poor) return { colour: '#f2cd82', word: 'Needs work' }
  return { colour: '#f0787a', word: 'Poor' }
}

const ms = (v: number | null) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)
const unitless = (v: number | null) => (v == null ? '—' : v.toFixed(3))

function VitalsSection({ v }: { v: Vitals }) {
  // Not configured is the normal state before a PostHog key exists — show
  // nothing rather than an empty card that looks broken.
  if (!v.configured) return null

  const rows = [
    { key: 'lcp', label: 'Largest Contentful Paint', short: 'LCP', value: v.lcp, fmt: ms, what: 'time until the main content appears' },
    { key: 'inp', label: 'Interaction to Next Paint', short: 'INP', value: v.inp, fmt: ms, what: 'how quickly taps respond' },
    { key: 'cls', label: 'Cumulative Layout Shift', short: 'CLS', value: v.cls, fmt: unitless, what: 'how much the layout jumps while loading' },
    { key: 'fcp', label: 'First Contentful Paint', short: 'FCP', value: v.fcp, fmt: ms, what: 'time until anything is drawn' },
  ]

  return (
    <section className="mb-8">
      <div className="mb-3 font-mono text-[10px] tracking-[4px] uppercase text-null-green">
        {'// REAL-USER LOAD SPEED'}
      </div>
      <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
        {v.error ? (
          <div className="font-mono text-xs text-[#f0a878]">Speed data unavailable: {v.error}</div>
        ) : (
          <>
            <div className="mb-3 font-mono text-[10px] leading-relaxed text-null-muted">
              75th percentile across {fmt(v.samples)} page load{v.samples === 1 ? '' : 's'} in the last{' '}
              {v.windowDays} days — measured on real players&apos; phones, not a lab test.
            </div>

            {v.lowConfidence && (
              <div className="mb-3 rounded border border-[rgba(242,205,130,0.35)] bg-[rgba(242,205,130,0.07)] px-3 py-2 font-mono text-[10px] text-[#f2cd82]">
                Too few samples yet to be reliable — one slow phone can swing these numbers.
              </div>
            )}

            <div className="space-y-2">
              {rows.map(r => {
                const { colour, word } = rate(r.value, v.thresholds?.[r.key])
                return (
                  <div key={r.key} className="flex items-baseline justify-between gap-3 border-b border-[rgba(255,255,255,0.05)] pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-null-white">
                        {r.short} <span className="text-null-muted">· {r.what}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm" style={{ color: colour }}>{r.fmt(r.value)}</div>
                      <div className="font-mono text-[9px] uppercase tracking-[1px]" style={{ color: colour }}>{word}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default function StatsPage() {
  const [data, setData] = useState<StatsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vitals, setVitals] = useState<Vitals | null>(null)
  const [season, setSeason] = useState<SeasonStatus | null>(null)

  // Season payout state (GAME-DESIGN.md §9). Independent of /api/stats for the
  // same reason as the vitals: one endpoint failing must cost one card.
  useEffect(() => {
    let cancelled = false
    fetch('/api/season/status')
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!cancelled && j && !j.error) setSeason(j) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetched independently of /api/stats: a PostHog outage must cost one card,
  // not the whole page. Failure here is swallowed on purpose.
  useEffect(() => {
    let cancelled = false
    fetch('/api/webvitals')
      .then(r => r.json())
      .then(j => { if (!cancelled) setVitals(j) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/stats')
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
        return j
      })
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
    return () => { cancelled = true }
  }, [])

  const t = data?.onchain
  const maxDay = Math.max(1, ...(t?.purchasesPerDay ?? [1]))

  return (
    <div className="min-h-[100dvh] bg-[rgba(0,0,0,0.96)] p-4 sm:p-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,255,136,0.06) 0%, transparent 55%)' }}
      />
      <div className="relative z-10 mx-auto w-full max-w-3xl">
        {/* Header */}
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-green uppercase mb-1">
              // NULLSTATE · LIVE STATS
            </div>
            <h1 className="font-display font-black text-null-white leading-none" style={{ fontSize: 'clamp(26px,7vw,44px)' }}>
              STATS
            </h1>
          </div>
          <Link
            href="/"
            className="shrink-0 font-mono text-[10px] sm:text-xs uppercase tracking-[2px] text-null-green border border-[rgba(0,255,136,0.4)] px-3 py-2 transition hover:bg-[rgba(0,255,136,0.06)]"
          >
            ◂ Home
          </Link>
        </header>

        {error && (
          <div className="mb-6 rounded-md border border-[rgba(224,122,58,0.5)] bg-[rgba(224,122,58,0.1)] p-4 font-mono text-xs text-[#f0a878]">
            Couldn’t load stats: {error}
          </div>
        )}
        {!data && !error && (
          <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-6 text-center font-mono text-xs text-null-muted">
            Loading live stats…
          </div>
        )}

        {/* Outside the `data &&` gate on purpose: load speed comes from a
            different source than the Firebase stats, so it should still show
            when those are unavailable. */}
        {vitals && <VitalsSection v={vitals} />}

        {data && (
          <>
            <Section title="Players">
              <Stat
                label="Total players"
                value={fmt(data.players.total)}
                hint="ids that played at least once — not visitors"
              />
              <Stat label="Active today (DAU)" value={fmt(data.players.dau)} accent="#4ad7ff" />
              <Stat label="Active 7d (WAU)" value={fmt(data.players.wau)} accent="#4ad7ff" />
              <Stat label="Active 30d (MAU)" value={fmt(data.players.mau)} accent="#4ad7ff" />
              {/* Owner asked to see who has paid and who has not. Paying is the
                  reliable half — it needs a real wallet and an on-chain
                  transaction, so a guest id can never land in it. */}
              <Stat
                label="Paid at least once"
                value={fmt(data.players.paying)}
                accent="#f2cd82"
                hint={data.players.conversionPct != null ? `${data.players.conversionPct}% of players` : undefined}
              />
              <Stat
                label="Never paid"
                value={fmt(data.players.nonPaying)}
                hint="includes duplicate guest ids"
              />
              {/* The "Wallet vs guest" card was removed (owner call). Only ids
                  recorded since /api/player/seen shipped carry the guest flag,
                  so it could only ever report a split over 44 of 71 players —
                  a partial number sitting in a row of totals, which reads as a
                  contradiction rather than as a caveat no matter how the hint
                  is worded. The API still returns guests/wallets/guestKnown, so
                  nothing is lost if it is ever wanted back once the flag covers
                  everybody. */}
            </Section>

            <Section title="On-chain activity">
              <Stat label="Total transactions" value={fmt(t?.transactionsTotal)} hint="all paid flows + reward payouts" />
              <Stat label="Purchases" value={fmt(t?.purchases)} accent="#f2cd82" />
              <Stat
                label="Purchase volume"
                value={fmtUsd(t?.purchaseVolumeUsd)}
                accent="#f2cd82"
                // "3 sale(s) valued at today's price" was read as "there were 3
                // sales" — sitting directly under a Purchases card reading 28,
                // which made the page look like it contradicted itself. It never
                // meant that: it counts the records old enough to predate the
                // `usd` field on a transaction, whose dollar value has to be
                // inferred from the current price list. Naming both numbers is
                // what makes it a caveat instead of a second, smaller total.
                hint={t?.volumeEstimated
                  ? `${t.volumeEstimated} of ${fmt(t?.purchases)} estimated — no amount was stored at the time`
                  : 'items + passes + elixir + shards + blueprints'}
              />
              <Stat label="Season Passes" value={fmt(t?.passMints)} accent="#c9a0ff" />
              <Stat label="USDT rewards paid" value={fmtUsd(t?.rewardsPaidUsd)} accent="#7ef0a6" hint={`${fmt(t?.rewardsPaidCount)} payouts`} />
              {/* Revenue minus rewards, and how many different people have ever
                  paid. Both numbers existed on this page already — one as two
                  figures nobody subtracted, the other not at all — and between
                  them they are the difference between "we sold twelve things"
                  and "one person bought twelve things while we paid out two and
                  a half times what came in". */}
              <Stat
                label="Net position"
                // fmtUsd already carries the $; the sign goes in front of it,
                // not instead of it. The first version sliced the $ off and
                // rendered "−18.05", which reads as a quantity rather than
                // money.
                value={t?.netUsd == null ? '—' : `${t.netUsd < 0 ? '−' : '+'}${fmtUsd(Math.abs(t.netUsd))}`}
                accent={t?.netUsd != null && t.netUsd < 0 ? '#f0787a' : '#7ef0a6'}
                hint={t?.rewardRatio != null ? `$${t.rewardRatio.toFixed(2)} paid out per $1 in` : 'revenue − rewards'}
              />
              <Stat
                label="Paying wallets"
                value={fmt(t?.uniqueBuyers)}
                accent="#f2cd82"
                hint={
                  t?.uniqueBuyers && t?.purchases
                    ? `${(t.purchases / t.uniqueBuyers).toFixed(1)} purchases each`
                    : 'distinct buyers, all time'
                }
              />
              <Stat
                label="Paid with"
                value={`${fmt(t?.purchasesByToken.USDM)}·${fmt(t?.purchasesByToken.USDC)}·${fmt(t?.purchasesByToken.USDT)}`}
                hint="USDM · USDC · USDT"
                accent="#f0dcb8"
              />
            </Section>

            {/* Where the money actually came from. Without this the single
                "purchase volume" figure gives no way to tell whether a revenue
                line is small or simply not being counted — which is exactly how
                passes, elixir, shard packs and blueprints went unnoticed while
                contributing $0 to the total. */}
            <section className="mb-8">
              <div className="mb-3 font-mono text-[10px] tracking-[4px] uppercase text-null-green">{'// REVENUE BY TYPE'}</div>
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                {([
                  ['items', 'Marketplace gear'],
                  ['passes', 'Season Passes'],
                  ['shards', 'Shard packs'],
                  ['elixir', 'Elixir'],
                  ['blueprints', 'Sector blueprints'],
                ] as const).map(([key, label]) => {
                  const r = t?.revenueByKind?.[key]
                  return (
                    <div key={key} className="flex items-baseline justify-between border-b border-[rgba(255,255,255,0.06)] py-2 last:border-b-0">
                      <span className="font-mono text-[11px] text-null-muted">{label}</span>
                      <span className="font-mono text-[11px]">
                        <span className="text-null-white">{fmt(r?.count)}</span>
                        <span className="text-null-muted"> · </span>
                        <span className="text-[#f2cd82]">{fmtUsd(r?.usd)}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 14-day purchases bar chart */}
            <section className="mb-8">
              <div className="mb-3 font-mono text-[10px] tracking-[4px] uppercase text-null-green">// PURCHASES · LAST 14 DAYS</div>
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex h-24 items-end justify-between gap-1">
                  {(t?.purchasesPerDay ?? []).map((v, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${v} purchase(s)`}>
                      <div
                        className="w-full rounded-sm bg-[rgba(0,255,136,0.55)]"
                        style={{ height: `${Math.max(3, (v / maxDay) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between font-mono text-[9px] text-null-muted">
                  <span>14d ago</span><span>today</span>
                </div>
              </div>
            </section>

            <Section title="Game economy">
              <Stat label="Items burned" value={fmt(data.economy.burnEvents)} hint="burn events" accent="#f0a878" />
              <Stat label="Points burned" value={fmt(data.economy.pointsBurned)} accent="#f0a878" />
              <Stat label="Vault cracks" value={fmt(data.economy.vaultCompletions)} accent="#7ef0a6" />
              <Stat label="Golden Keys" value={fmt(data.economy.goldenKeys)} accent="#f2cd82" />
              <Stat label="Old Papers" value={fmt(data.economy.papers)} accent="#d9b877" />
            </Section>

            {season?.snapshot && (
              <section className="mb-8">
                {/* The `//` prefix matches the other section headers. Written
                    as a string so it does not read as a JSX comment — the
                    literal form is what react/jsx-no-comment-textnodes flags,
                    and this section should not add to that count. */}
                <div className="mb-3 font-mono text-[10px] tracking-[4px] uppercase text-null-green">
                  {'// '}Season {season.snapshot.seasonId} · top 3
                </div>
                <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-[2px]"
                    style={{ color: season.awaitingPayout ? '#f2cd82' : '#7ef0a6' }}>
                    {season.awaitingPayout
                      ? '● Winners frozen — payout pending'
                      : `✓ Paid ${season.snapshot.paidAt ? new Date(season.snapshot.paidAt).toLocaleDateString() : ''}`}
                  </div>
                  {season.snapshot.winners.map((w) => (
                    <div key={w.rank} className="flex items-baseline justify-between gap-3 py-1 font-mono text-[11px]">
                      <span className="min-w-0 truncate text-null-white">
                        <span className="text-null-muted">#{w.rank}</span>{' '}
                        {w.username || `${w.wallet.slice(0, 6)}…${w.wallet.slice(-4)}`}
                      </span>
                      <span className="shrink-0 text-null-muted">{fmt(w.xp)} XP</span>
                      <span className="shrink-0" style={{ color: '#7ef0a6' }}>${w.rewardUsd}</span>
                    </div>
                  ))}
                  <p className="mt-3 font-mono text-[9px] leading-relaxed text-null-muted">
                    Ranked by XP — the same leaderboard players see. The ranking is frozen when the season closes,
                    because XP keeps accumulating afterwards. Payouts are signed by hand, so this shows whether one
                    is still owed.
                  </p>
                </div>
              </section>
            )}

            <p className="mt-2 font-mono text-[9px] leading-relaxed text-null-muted">
              Live figures aggregated from NullState’s off-chain database (game activity + recorded on-chain
              purchases, Season-Pass mints, and Treasure-Vault / Season reward payouts on Celo). Refreshed every
              few minutes. Last updated {new Date(data.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
