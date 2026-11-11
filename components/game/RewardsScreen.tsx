'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  GiTwoCoins,
  GiCutDiamond,
  GiFlame,
  GiOpenTreasureChest,
  GiTrophyCup,
  GiReceiveMoney,
  GiPayMoney,
  GiBattleGear,
} from 'react-icons/gi'
import type { IconType } from 'react-icons'
import { PlayerProfile } from '@/lib/contract'
import { tokenLabel } from '@/lib/constants/tokens'
import { useReward } from '@/hooks/useReward'
import { useWallet } from '@/lib/WalletProvider'

interface BurnItem {
  id: string
  name: string
  rarity?: string
  qty: number
  burnValue: number
  icon?: string
  color?: string
}

interface BurnRecord {
  burnId: string
  wallet: string
  items: BurnItem[]
  itemCount: number
  totalValue: number
  txHash: string | null
  timestamp: number
  recordedAt: number
}

interface ProfileResponse {
  profile: { walletAddress: string; nickname?: string }
  summary?: {
    totalBurnEvents: number
    totalBurnedValue: number
    nullstateTokenBalance?: number
  }
  burns?: BurnRecord[]
  /** How many days of history the list holds. See BURN_HISTORY_DAYS. */
  burnHistoryDays?: number
  /** Burns this season the list is NOT showing, because they fell outside it. */
  burnsHidden?: number
}

interface StashItem {
  id: string
  name: string
  rarity?: string
  color?: string
  icon?: string
  qty: number
  burnValue: number
}

interface StablecoinEntry {
  kind: 'vault' | 'season' | 'weekly'
  weekId?: number
  seasonId?: number
  amount?: number
  token?: string
  txHash?: string | null
  at: number
}

// The raw ids are machine formats — weekId is ISO YYYYWW (e.g. 202630 = the
// 30th week of 2026) and seasonId is YYYYMM (e.g. 202607 = July 2026). Showing
// "wk 202630" reads as a random number to players, so humanize them.
function formatWeekId(weekId?: number): string {
  if (!weekId) return ''
  const year = Math.floor(weekId / 100)
  const week = weekId % 100
  if (year < 2024 || week < 1 || week > 53) return `wk ${weekId}`
  // Owner: drop the year — "Treasure Vault · Week 30" reads cleaner and the
  // year is redundant next to the timestamp shown on the same row.
  return `Week ${week}`
}
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatSeasonId(seasonId?: number): string {
  if (!seasonId) return ''
  const year = Math.floor(seasonId / 100)
  const month = seasonId % 100
  if (year < 2024 || month < 1 || month > 12) return `S${seasonId}`
  return `${MONTH_ABBR[month - 1]} ${year}`
}

interface RewardsScreenProps {
  onBack: () => void
  address?: string
  playerProfile: PlayerProfile | null
}

type Tab = 'claim' | 'points'

// Contract defaults for the seasonal top-3 leaderboard bonus
// (NullStateRewardV2 rank1/2/3Reward — owner-settable via setRankRewards,
// so this is indicative; the exact payout is enforced on-chain). Shown in
// USD since every supported reward token (USDm/USDT/USDC) is USD-pegged.
const RANK_BONUS_USD = [20, 5, 3]
const CELOSCAN_TX = 'https://celoscan.io/tx/'

// The core play-to-earn loop, shown as a banner so a new player sees at a
// glance how a run turns into real USDT. Game-icons only (react-icons/gi) —
// owner: "jangan pake emoticon2 murahan".
const LOOP_STEPS: { Icon: IconType; label: string; color: string }[] = [
  { Icon: GiOpenTreasureChest, label: 'Loot', color: '#e6c07a' },
  { Icon: GiFlame, label: 'Burn', color: '#f0a878' },
  { Icon: GiCutDiamond, label: 'Points', color: '#9fd8ff' },
  { Icon: GiBattleGear, label: 'Gear', color: '#c9a0ff' },
  { Icon: GiReceiveMoney, label: 'USDT', color: '#7ef0a6' },
]

export default function RewardsScreen({ onBack, address }: RewardsScreenProps) {
  const [tab, setTab] = useState<Tab>('claim')

  const [data, setData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stash, setStash] = useState<StashItem[]>([])

  // Stablecoin (Claim tab) — received history + live claimable
  const [scHistory, setScHistory] = useState<StablecoinEntry[]>([])
  const [scLoading, setScLoading] = useState(false)
  const {
    seasonLeaderboard,
    hasClaimedSeasonBonus,
    currentSeason,
    isLoading: rewardBusy,
    claimSeasonBonus,
  } = useReward(address)

  // Burn (Reward Point tab) — multi-select
  const [sel, setSel] = useState<Record<string, number>>({})
  const [burning, setBurning] = useState(false)
  const [burnMsg, setBurnMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const [claimBusy, setClaimBusy] = useState<'season' | null>(null)
  const [claimMsg, setClaimMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const loadProfile = useCallback(async () => {
    if (!address) {
      setData(null)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/player/profile?walletAddress=${address}`)
      // The API always responds with JSON, but a bad deploy / proxy error
      // page / auth redirect can return HTML — read as text first so a
      // non-JSON response surfaces a real message, not "Unexpected token '<'".
      const raw = await res.text()
      let payload: any
      try {
        payload = JSON.parse(raw)
      } catch {
        throw new Error(
          res.ok
            ? 'Rewards service returned an unexpected response — try again shortly.'
            : `Rewards service error (HTTP ${res.status})`
        )
      }
      if (!res.ok) throw new Error(payload.error ?? 'Failed to load rewards')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load rewards')
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Stablecoin received-history (Firebase-only ledger — see
  // app/api/rewards/stablecoin/route.ts).
  useEffect(() => {
    if (!address) {
      setScHistory([])
      return
    }
    let cancelled = false
    const load = async () => {
      setScLoading(true)
      try {
        const res = await fetch(`/api/rewards/stablecoin?walletAddress=${address}`)
        const payload = await res.json()
        if (!cancelled && res.ok) setScHistory(Array.isArray(payload.history) ? payload.history : [])
      } catch {
        if (!cancelled) setScHistory([])
      } finally {
        if (!cancelled) setScLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [address])

  // The unburned stash only lives in the live dungeon canvas (game.js
  // G.inventory), which isn't running on this screen — read the last
  // snapshot game.js mirrored to localStorage instead.
  useEffect(() => {
    if (!address || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('nullstate-stash-' + address.toLowerCase())
      const parsed = raw ? JSON.parse(raw) : null
      setStash(Array.isArray(parsed?.items) ? parsed.items : [])
    } catch {
      setStash([])
    }
  }, [address])

  const unburnedTotal = useMemo(
    () => stash.reduce((sum, it) => sum + it.burnValue * it.qty, 0),
    [stash]
  )

  const burns = data?.burns ?? []
  const historyDays = data?.burnHistoryDays ?? 7
  const hiddenBurns = data?.burnsHidden ?? 0
  const tokenBalance = data?.summary?.nullstateTokenBalance ?? 0

  // --- Stablecoin claimable (live, on-chain) ---
  const myRank = useMemo(() => {
    if (!seasonLeaderboard || !address) return -1
    return seasonLeaderboard.topPlayers.findIndex((a) => a?.toLowerCase() === address.toLowerCase())
  }, [seasonLeaderboard, address])

  // Gate on `deposited` (not `finalized`): the contract's claimSeasonBonus
  // requires only `lb.deposited` — `finalized` exists in the struct but is
  // never set true on-chain, so gating on it would hide a valid claim.
  const seasonClaimable = myRank >= 0 && !!seasonLeaderboard?.deposited && !hasClaimedSeasonBonus
  // The weekly Treasure-Vault reward is paid instantly on a correct code (no
  // claim step); the old on-chain weekly-burn claim was retired (see
  // useReward.ts). So the only thing claimable here is the season bonus.
  const hasClaimable = seasonClaimable

  const onClaimSeason = async () => {
    if (!seasonClaimable || claimBusy) return
    setClaimBusy('season')
    setClaimMsg(null)
    try {
      const { hash } = await claimSeasonBonus(currentSeason)
      setClaimMsg({ text: `Season bonus claimed — ${hash.slice(0, 10)}…`, kind: 'ok' })
    } catch (e) {
      setClaimMsg({ text: e instanceof Error ? e.message : 'Claim failed', kind: 'err' })
    } finally {
      setClaimBusy(null)
    }
  }

  // --- Points burn (multi-select) ---
  const selectedEntries = stash.filter((it) => (sel[it.id] || 0) > 0)
  const selectedCount = selectedEntries.reduce((s, it) => s + (sel[it.id] || 0), 0)
  const selectedValue = selectedEntries.reduce((s, it) => s + it.burnValue * (sel[it.id] || 0), 0)
  const allSelected = stash.length > 0 && stash.every((it) => (sel[it.id] || 0) >= it.qty)

  const setQty = (id: string, qty: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, qty))
    setSel((prev) => {
      const next = { ...prev }
      if (clamped <= 0) delete next[id]
      else next[id] = clamped
      return next
    })
  }

  // Persist an out-of-game burn so the engine reconciles it on next run
  // (nullstate-extburn-<wallet>) and keep the stash mirror consistent.
  const recordExternalBurn = (addr: string, burned: Record<string, number>) => {
    if (typeof window === 'undefined') return
    const lower = addr.toLowerCase()
    try {
      const k = 'nullstate-extburn-' + lower
      let q: Record<string, number> = {}
      const raw = localStorage.getItem(k)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') q = parsed
      }
      for (const [id, qty] of Object.entries(burned)) q[id] = (q[id] || 0) + qty
      localStorage.setItem(k, JSON.stringify(q))
    } catch {
      /* storage unavailable — engine simply won't reconcile; non-fatal */
    }
    try {
      const k = 'nullstate-stash-' + lower
      const raw = localStorage.getItem(k)
      if (raw) {
        const snap = JSON.parse(raw)
        if (snap && Array.isArray(snap.items)) {
          snap.items = snap.items
            .map((it: any) => (burned[it.id] ? { ...it, qty: it.qty - burned[it.id] } : it))
            .filter((it: any) => it.qty > 0)
          snap.updatedAt = Date.now()
          localStorage.setItem(k, JSON.stringify(snap))
        }
      }
    } catch {
      /* ignore */
    }
  }

  const doBurn = async () => {
    if (!address || selectedEntries.length === 0 || burning) return
    setBurning(true)
    setBurnMsg(null)
    try {
      const items = selectedEntries.map((it) => ({
        id: it.id,
        name: it.name,
        rarity: it.rarity,
        qty: sel[it.id],
        burnValue: it.burnValue,
        icon: it.icon,
        color: it.color,
      }))
      const res = await fetch('/api/burn/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, items, totalValue: selectedValue, timestamp: Date.now() }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Burn failed')

      const burnedMap: Record<string, number> = {}
      for (const it of selectedEntries) burnedMap[it.id] = sel[it.id]
      recordExternalBurn(address, burnedMap)

      setStash((prev) =>
        prev.map((it) => (burnedMap[it.id] ? { ...it, qty: it.qty - burnedMap[it.id] } : it)).filter((it) => it.qty > 0)
      )
      setData((prev) =>
        prev
          ? {
              ...prev,
              summary: {
                totalBurnEvents: (prev.summary?.totalBurnEvents ?? 0) + 1,
                totalBurnedValue: (prev.summary?.totalBurnedValue ?? 0) + (payload.totalValue ?? selectedValue),
                nullstateTokenBalance: payload.newBalance ?? tokenBalance + selectedValue,
              },
              // Put it at the top of the list too. The totals moved and the list
              // did not, which since the list gained a "N earlier burns are not
              // shown" line reads as the burn having been filed away
              // immediately — the one thing that note promises does not happen
              // for seven days.
              burns: [
                {
                  burnId: payload.burnId ?? `local_${Date.now()}`,
                  wallet: address,
                  items,
                  itemCount: selectedCount,
                  totalValue: payload.totalValue ?? selectedValue,
                  txHash: null,
                  timestamp: Date.now(),
                  recordedAt: Date.now(),
                },
                ...(prev.burns ?? []),
              ],
            }
          : prev
      )
      setSel({})
      // Burning here counts toward the Daily Missions exactly as burning
      // in-run does — /api/burn/record credits both paths. Say so when one
      // finishes, or the player has no way to know it happened off this screen.
      const done: string[] = Array.isArray(payload.contracts?.labels) ? payload.contracts.labels : []
      setBurnMsg({
        text: `Burned ${selectedCount} item(s) — +${Math.round(payload.totalValue ?? selectedValue)} Point`
          + (done.length ? ` · ◆ Mission complete: ${done.join(', ')}` : ''),
        kind: 'ok',
      })
      loadProfile()
    } catch (e) {
      setBurnMsg({ text: e instanceof Error ? e.message : 'Burn failed', kind: 'err' })
    } finally {
      setBurning(false)
    }
  }

  // A guest's `address` is a locally generated id, not a wallet — see
  // getGuestAddress() in lib/WalletProvider.tsx. Labelling it "Wallet" was
  // actively misleading: opening the game in a plain browser showed a
  // wallet-shaped string under the word WALLET, which reads as "my wallet is
  // connected here" even to someone who knows the codebase. If it can fool the
  // developer, it will fool a player — and a player who believes a wallet is
  // attached will expect rewards to reach it.
  const { isGuest } = useWallet()
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'NOT CONNECTED'
  const idLabel = isGuest ? 'Guest ID' : 'Wallet'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(10,7,4,0.97)] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-lg pb-16">
        <header className="mb-4 flex items-center justify-between border-b border-[#7a4f24]/40 pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[4px] text-[#c39a5f]">// NullState</p>
            <h1 className="font-mono text-2xl font-bold text-[#f2cd82]">REWARDS</h1>
          </div>
          <button
            onClick={onBack}
            className="rounded border border-[#7a4f24] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#c39a5f] hover:bg-[#7a4f24]/20"
          >
            ◂ Back
          </button>
        </header>

        <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-[#9c7a4f]">
          {idLabel} <span className="normal-case tracking-normal text-[#c39a5f]">{shortAddr}</span>
        </p>

        {/* Reward loop — one glance at how a run becomes real USDT */}
        <div className="mb-5 rounded-xl border border-[#7a4f24]/50 bg-gradient-to-b from-[#2b1a0d] to-[#160c05] p-3.5">
          <p className="mb-3 text-center font-mono text-[9px] font-bold uppercase tracking-[4px] text-[#c39a5f]">
            The Reward Loop
          </p>
          <div className="flex items-start justify-between gap-0.5">
            {LOOP_STEPS.map((step, i) => (
              <Fragment key={step.label}>
                <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#7a4f24]/60 bg-black/40"
                    style={{ color: step.color }}
                  >
                    <step.Icon aria-hidden size={19} />
                  </span>
                  <span className="font-mono text-[8px] font-bold uppercase tracking-wide text-[#b58f5b]">
                    {step.label}
                  </span>
                </div>
                {i < LOOP_STEPS.length - 1 && (
                  <span aria-hidden className="mt-2 select-none font-mono text-sm text-[#7a4f24]">
                    ›
                  </span>
                )}
              </Fragment>
            ))}
          </div>
          <p className="mt-3 text-center font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
            Loot gear in runs, burn it into NullState Points, forge stronger gear — then crack the Vault and climb the
            Season for real USDT.
          </p>
        </div>

        {/* Two-reward tab switch — same pill style as the token selectors */}
        <div className="mb-5 flex gap-2">
          {([
            ['claim', 'Claim Rewards'],
            ['points', 'Reward Point'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg border px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                tab === id
                  ? 'border-[#e8bd6f] bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] text-[#2a1705]'
                  : 'border-[#7a4f24]/60 bg-[#2b1a0d] text-[#c39a5f] hover:border-[#8a5a2b]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ================= CLAIM (STABLECOIN) TAB ================= */}
        {tab === 'claim' && (
          <div>
            <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">
              <GiPayMoney aria-hidden size={15} /> Claimable now
            </h2>
            {claimMsg && (
              <div
                className={`mb-3 rounded-lg border p-3 font-mono text-xs ${
                  claimMsg.kind === 'ok'
                    ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#7ef0a6]'
                    : 'border-[#e07a3a]/50 bg-[#e07a3a]/10 text-[#f0a878]'
                }`}
              >
                {claimMsg.text}
              </div>
            )}
            {!hasClaimable ? (
              <div className="mb-6 rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#9c7a4f]">
                No rewards
              </div>
            ) : (
              <div className="mb-6 flex flex-col gap-2">
                {seasonClaimable && (
                  <div className="flex items-center gap-3 rounded-lg border border-[#7a4f24]/60 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-[#7a4f24]/50 bg-black/40 text-[#f2cd82]">
                      <GiTrophyCup aria-hidden size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-bold text-[#f0dcb8]">
                        Season {String(currentSeason)} · Rank {myRank + 1}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-wide text-[#c39a5f]">
                        ≈ {RANK_BONUS_USD[myRank] ?? '?'} USDT · top-3 bonus
                      </div>
                    </div>
                    <button
                      onClick={onClaimSeason}
                      disabled={claimBusy !== null || rewardBusy}
                      className="flex-shrink-0 rounded bg-gradient-to-b from-[#4ade80] to-[#22b862] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#062b13] transition hover:brightness-110 disabled:opacity-40"
                    >
                      {claimBusy === 'season' ? '…' : 'Claim'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">
              <GiReceiveMoney aria-hidden size={15} /> Received{scHistory.length ? ` (${scHistory.length})` : ''}
            </h2>
            {scLoading ? (
              <div className="rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#c39a5f]">
                Loading…
              </div>
            ) : scHistory.length === 0 ? (
              <div className="rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#9c7a4f]">
                No rewards
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {scHistory.map((e, i) => {
                  const Icon = e.kind === 'season' ? GiTrophyCup : e.kind === 'weekly' ? GiTwoCoins : GiOpenTreasureChest
                  const label =
                    e.kind === 'vault'
                      ? `Treasure Vault${e.weekId ? ` · ${formatWeekId(e.weekId)}` : ''}`
                      : e.kind === 'season'
                        ? `Season bonus${e.seasonId ? ` · ${formatSeasonId(e.seasonId)}` : ''}`
                        : `Weekly reward${e.weekId ? ` · ${formatWeekId(e.weekId)}` : ''}`
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-[#7a4f24]/50 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-[#7a4f24]/40 bg-black/40 text-[#c39a5f]">
                        <Icon aria-hidden size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-xs font-bold text-[#f0dcb8]">{label}</div>
                        <div className="font-mono text-[10px] text-[#9c7a4f]">{e.at ? new Date(e.at).toLocaleString() : ''}</div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        {typeof e.amount === 'number' && (
                          <span className="font-mono text-sm font-bold text-[#7ef0a6]">+{e.amount} {tokenLabel(e.token) || 'USD'}</span>
                        )}
                        {e.txHash && (
                          <a
                            href={CELOSCAN_TX + e.txHash}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[10px] text-[#c39a5f] underline underline-offset-2 hover:text-[#f2cd82]"
                          >
                            View tx →
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="mt-4 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
              Real USDT comes from the Treasure Vault weekly code (paid instantly on a correct code) and the
              seasonal top-3 leaderboard bonus, claimed here.
            </p>
          </div>
        )}

        {/* ================= REWARD POINT TAB ================= */}
        {tab === 'points' && (
          <div>
            {/* Totals */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[#7a4f24]/50 bg-[#2b1a0d] px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1 font-mono text-[9px] uppercase tracking-wider text-[#9c7a4f]">
                  <GiCutDiamond aria-hidden size={11} /> NullState Point
                </div>
                <div className="font-mono text-xl font-bold text-[#f2cd82]">{Math.round(tokenBalance)}</div>
              </div>
              <div className="rounded-lg border border-[#7a4f24]/50 bg-[#2b1a0d] px-3 py-3 text-center">
                <div className="flex items-center justify-center gap-1 font-mono text-[9px] uppercase tracking-wider text-[#9c7a4f]">
                  <GiFlame aria-hidden size={11} /> Unburned Stash
                </div>
                <div className="font-mono text-xl font-bold text-[#f2cd82]">{Math.round(unburnedTotal)}</div>
              </div>
            </div>
            <p className="mb-4 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
              Spend NullState Point on Marketplace gear ($0.5–$2 items) via the Swap button.
            </p>

            {isLoading && (
              <div className="mb-4 rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#c39a5f]">
                Loading…
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-lg border border-[#e07a3a]/50 bg-[#e07a3a]/10 p-3 font-mono text-xs text-[#f0a878]">
                {error}
              </div>
            )}

            {/* Burnable stash — multi-select */}
            {!isLoading && (
              <section className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">
                    <GiFlame aria-hidden size={15} /> Burn for Points{stash.length ? ` (${stash.length})` : ''}
                  </h2>
                  {stash.length > 0 && (
                    <button
                      onClick={() =>
                        setSel(() => {
                          if (allSelected) return {}
                          const next: Record<string, number> = {}
                          for (const it of stash) next[it.id] = it.qty
                          return next
                        })
                      }
                      className="rounded border border-[#7a4f24] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#c39a5f] hover:bg-[#7a4f24]/20"
                    >
                      {allSelected ? 'Clear' : 'Select all'}
                    </button>
                  )}
                </div>

                {burnMsg && (
                  <div
                    className={`mb-3 rounded-lg border p-3 font-mono text-xs ${
                      burnMsg.kind === 'ok'
                        ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#7ef0a6]'
                        : 'border-[#e07a3a]/50 bg-[#e07a3a]/10 text-[#f0a878]'
                    }`}
                  >
                    {burnMsg.text}
                  </div>
                )}

                {stash.length === 0 ? (
                  <div className="rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#9c7a4f]">
                    Nothing to burn yet. Loot items in a run, then open your in-game inventory once so it syncs here.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      {stash.map((it) => {
                        const q = sel[it.id] || 0
                        const active = q > 0
                        return (
                          <div
                            key={it.id}
                            className={`flex items-center gap-3 rounded-lg border bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-2.5 ${
                              active ? 'border-[#e8bd6f]' : 'border-[#7a4f24]/50'
                            }`}
                          >
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-[#7a4f24]/40 bg-black/40">
                              {it.icon ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.icon} alt={it.name} className="h-8 w-8 [image-rendering:pixelated]" draggable={false} />
                              ) : (
                                <GiTwoCoins aria-hidden size={18} className="text-[#7a4f24]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-mono text-xs font-bold text-[#f0dcb8]">{it.name}</div>
                              <div className="font-mono text-[10px] uppercase tracking-wide text-[#c39a5f]">
                                {Math.round(it.burnValue)} pt · have ×{it.qty}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1">
                              <button
                                onClick={() => setQty(it.id, q - 1, it.qty)}
                                disabled={q <= 0}
                                className="h-7 w-7 rounded border border-[#7a4f24]/60 font-mono text-[#c39a5f] disabled:opacity-30 hover:bg-[#7a4f24]/20"
                              >
                                −
                              </button>
                              <span className="w-6 text-center font-mono text-xs text-[#f0dcb8]">{q}</span>
                              <button
                                onClick={() => setQty(it.id, q + 1, it.qty)}
                                disabled={q >= it.qty}
                                className="h-7 w-7 rounded border border-[#7a4f24]/60 font-mono text-[#c39a5f] disabled:opacity-30 hover:bg-[#7a4f24]/20"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Burn action bar */}
                    <div className="sticky bottom-0 mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#7a4f24]/60 bg-[rgba(10,7,4,0.96)] p-3">
                      <div className="font-mono text-xs">
                        <span className="font-bold text-[#f0dcb8]">{selectedCount}</span>
                        <span className="text-[#9c7a4f]"> selected → </span>
                        <span className="font-bold text-[#7ef0a6]">+{Math.round(selectedValue)} pt</span>
                      </div>
                      <button
                        onClick={doBurn}
                        disabled={selectedCount === 0 || burning || !address}
                        className="inline-flex items-center gap-1.5 rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-40"
                      >
                        <GiFlame aria-hidden size={14} /> {burning ? 'Burning…' : 'Burn'}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Burn history */}
            {!isLoading && (
              <section>
                {/* Owner: "history burn yang menumpuk, lebih baik tunjukan burn
                    7 hari terakhir, lalu hilangkan sisanya, dan jelaskan di
                    bawahnya." The window is the server's (see BURN_HISTORY_DAYS)
                    and is named in the heading rather than left as a surprise —
                    a list that quietly stops at an unexplained point reads as
                    data loss. */}
                <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">
                  <GiReceiveMoney aria-hidden size={15} /> Burn History
                  <span className="font-normal tracking-[1.5px] text-[#9c7a4f]">
                    · last {historyDays} days{burns.length ? ` (${burns.length})` : ''}
                  </span>
                </h2>
                {burns.length === 0 ? (
                  <div className="rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#9c7a4f]">
                    {hiddenBurns > 0
                      ? `Nothing burned in the last ${historyDays} days. Earlier burns this season are counted in the totals above.`
                      : 'No burns recorded yet this season.'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {burns.map((b) => (
                      <div key={b.burnId} className="rounded-lg border border-[#7a4f24]/50 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3 font-mono text-xs">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-[#9c7a4f]">{new Date(b.recordedAt || b.timestamp).toLocaleString()}</span>
                          <span className="font-bold text-[#7ef0a6]">+{Math.round(b.totalValue)} pt</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[#f0dcb8]/90">
                          {b.items.map((it, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5">
                              {it.icon && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.icon} alt={it.name} className="h-4 w-4 [image-rendering:pixelated]" draggable={false} />
                              )}
                              <span style={{ color: it.color }}>{it.name}</span> ×{it.qty}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* The explanation the owner asked for, underneath. It has one
                    job: make it obvious that nothing was taken. The Point from
                    every burn was credited the instant it happened and lives in
                    the balance — these rows were only ever the receipt. */}
                <p className="mt-2.5 rounded-lg border border-[#7a4f24]/30 bg-[#2b1a0d]/40 px-3 py-2.5 font-mono text-[10px] leading-relaxed text-[#9c7a4f]">
                  Only the last {historyDays} days are listed — older receipts are cleared so this
                  screen stays readable.{' '}
                  {hiddenBurns > 0 && (
                    <>
                      <span className="text-[#c9a76a]">{hiddenBurns} earlier burn{hiddenBurns === 1 ? '' : 's'}</span>{' '}
                      this season {hiddenBurns === 1 ? 'is' : 'are'} not shown.{' '}
                    </>
                  )}
                  <span className="text-[#c9a76a]">Nothing is lost:</span> every burn was paid into your
                  NullState Point balance the moment you made it, and the season totals above still count
                  all of them.
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
