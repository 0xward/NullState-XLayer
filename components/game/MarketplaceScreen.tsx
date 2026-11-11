'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWallet, CELO_CHAIN_ID } from '@/lib/WalletProvider'
import WrongNetworkBar from './WrongNetworkBar'
import { GiCrossedSwords, GiCheckedShield, GiMagnifyingGlass } from 'react-icons/gi'
import { pickBestPaymentToken, readStablecoinBalances } from '@/lib/constants/tokens'
import { MARKETPLACE_ITEMS, ACCEPTED_TOKENS, getMarketplaceItem, resolveItemId, tokenLabel, TOKEN_LOGOS, type MarketplaceItem, type MarketplaceTokenSymbol } from '@/lib/constants/marketplace'

interface MarketplaceScreenProps {
  onBack: () => void
  address?: string
}

function ownedKey(addr?: string) {
  return `nullstate-owned-${(addr || '').toLowerCase()}`
}

export default function MarketplaceScreen({ onBack, address }: MarketplaceScreenProps) {
  const wallet = useWallet()
  const { buyMarketplaceItem, insufficientFunds, addCashUrl, isGuest } = wallet
  // From the wallet bridge, not wagmi's usePublicClient(): wagmi now mounts
  // beside the app rather than around it (lib/walletBridge.tsx), so this
  // screen is not inside WagmiProvider and calling its hooks here would throw.
  // Null until wagmi has loaded; the effect below already handles that.
  const publicClient = wallet.publicClient
  const [token, setToken] = useState<MarketplaceTokenSymbol>('USDm')
  // The same three balances pickBestPaymentToken reads, kept rather than
  // discarded — so the selector can show what the player holds instead of
  // making them discover it by failing a purchase.
  const [stableBalances, setStableBalances] = useState<Record<MarketplaceTokenSymbol, number | null>>(
    { USDm: null, USDC: null, USDT: null },
  )
  // Flexible stablecoin (Phase 2): default the "Pay with" token to whichever of
  // USDm/USDC/USDT the wallet holds the most of, so a player isn't forced to
  // top up a specific coin. The manual selector below still lets them switch;
  // once they do, we stop auto-overriding their choice.
  const manualTokenRef = useRef(false)
  useEffect(() => {
    if (isGuest || !address || !publicClient) return
    let cancelled = false
    pickBestPaymentToken(publicClient, address as `0x${string}`).then(best => {
      if (!cancelled && !manualTokenRef.current) setToken(best)
    })
    readStablecoinBalances(publicClient, address as `0x${string}`).then(b => {
      if (!cancelled) setStableBalances(b)
    })
    return () => { cancelled = true }
  }, [address, publicClient, isGuest])
  const [owned, setOwned] = useState<string[]>([])
  // v76 Task #7: four weapons were re-skinned with new ids, four items removed.
  // Normalise any pre-v76 id coming from cache/server so a wallet that already
  // bought the old version still sees it as owned, and so ids that no longer
  // exist stop rendering as ghost entries. Mirrors the same mapping applied by
  // loadPersistedEquipment() in game.js.
  const normalizeOwned = useCallback((list: string[]) => {
    const mapped = list.map(resolveItemId).filter(id => !!getMarketplaceItem(id))
    return mapped.filter((id, i) => mapped.indexOf(id) === i)
  }, [])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; kind: 'info' | 'ok' | 'err' } | null>(null)
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [swapConfirmId, setSwapConfirmId] = useState<string | null>(null)
  // Issue #5: tap any item's icon/name to open a larger preview popup.
  const [previewItem, setPreviewItem] = useState<MarketplaceItem | null>(null)

  // ── ARMORY TRIAL (growth blueprint 1B) ──────────────────────────────────
  // One-time: after clearing Act 1 (per-wallet localStorage flag set by the
  // engine), pick 2 premium weapons to try free. The 48h clock per weapon
  // starts on its FIRST EQUIP (server-side, /api/marketplace/equip), not at
  // grant time. Active trials come back merged into `owned` by the server;
  // `trials` here carries the countdown metadata for badges.
  const [trialEligible, setTrialEligible] = useState(false)
  const [trials, setTrials] = useState<{ itemId: string; activatedAt: number | null; expiresAt: number | null }[]>([])
  const [trialPick, setTrialPick] = useState<string[]>([])
  const [trialNow, setTrialNow] = useState(Date.now())
  const act1Cleared = (() => {
    if (typeof window === 'undefined' || !address) return false
    try { return localStorage.getItem('nullstate-act1clear-' + address.toLowerCase()) === '1' } catch { return false }
  })()

  const loadTrials = useCallback(() => {
    if (!address) return
    fetch(`/api/trials?wallet=${address}`)
      .then(r => r.json())
      .then(d => {
        setTrialEligible(!!d?.eligible)
        setTrials(Array.isArray(d?.trials) ? d.trials : [])
      })
      .catch(() => { /* offline — no trial UI */ })
  }, [address])
  useEffect(() => { loadTrials() }, [loadTrials])

  // 1-minute tick keeps the countdown labels honest while the screen is open.
  useEffect(() => {
    if (trials.length === 0) return
    const id = setInterval(() => setTrialNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [trials.length])

  const trialMap = Object.fromEntries(trials.map(t => [t.itemId, t]))
  const fmtTrialLeft = (expiresAt: number) => {
    const ms = Math.max(0, expiresAt - trialNow)
    const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000)
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`
  }

  // NullState Point balance — off-chain, credited from burning items
  // (see /api/burn/record). Used to gate the "Swap" option below.
  const loadTokenBalance = useCallback(() => {
    if (!address) return
    fetch(`/api/player/profile?walletAddress=${address}`)
      .then(r => r.json())
      .then(d => {
        const bal = d?.summary?.nullstateTokenBalance
        setTokenBalance(typeof bal === 'number' ? bal : 0)
      })
      .catch(() => { /* offline — leave as-is */ })
  }, [address])

  useEffect(() => { loadTokenBalance() }, [loadTokenBalance])

  const persist = useCallback((list: string[]) => {
    list = normalizeOwned(list)
    setOwned(list)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(ownedKey(address), JSON.stringify(list))
        const NS = (window as unknown as { NS_EQUIP?: { setOwned?: (l: string[]) => void } }).NS_EQUIP
        NS?.setOwned?.(list)
      }
    } catch { /* non-critical */ }
  }, [address, normalizeOwned])

  // Load owned on mount: localStorage first (instant), then server (source of truth)
  useEffect(() => {
    if (!address) return
    try {
      const cached = localStorage.getItem(ownedKey(address))
      if (cached) setOwned(normalizeOwned(JSON.parse(cached)))
    } catch { /* ignore */ }
    fetch(`/api/marketplace/owned?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.owned)) persist(d.owned) })
      .catch(() => { /* offline — keep cache */ })
  }, [address, persist, normalizeOwned])

  // v72 dev bypass (frontend half): if this wallet is listed in
  // NEXT_PUBLIC_DEV_TEST_WALLETS (comma-separated), BUY skips the real
  // payment tx and asks the verify API for a dev grant instead. The server
  // independently re-checks its own DEV_TEST_WALLETS env var, so this public env
  // var alone grants nothing — it only changes which request the UI sends.
  const isDevWallet =
    !!address &&
    (process.env.NEXT_PUBLIC_DEV_TEST_WALLETS || '')
      .split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
      .includes(address.toLowerCase())

  const handleBuy = useCallback(async (item: MarketplaceItem) => {
    if (busy) return
    if (isGuest) { setMsg({ text: 'Connect a wallet to buy — you’re playing as a guest.', kind: 'err' }); return }
    setBusy(item.id)
    setMsg({ text: isDevWallet ? 'DEV: requesting free unlock…' : `Sending ${item.price} ${tokenLabel(token)}…`, kind: 'info' })
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await buyMarketplaceItem(item.price, token)
        setMsg({ text: 'Payment sent — verifying on-chain…', kind: 'info' })
      }
      const res = await fetch('/api/marketplace/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet
            ? { wallet: address, itemId: item.id, token, devBypass: true }
            : { wallet: address, txHash, itemId: item.id, token },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      persist(Array.isArray(data.owned) ? data.owned : [...owned, item.id])
      // Points at the BAG on the world map, which now actually exists. This
      // line used to say "equip it in your inventory" when the only inventory
      // was inside a run — so the reward for paying was being sent to look for
      // a screen that wasn't there.
      setMsg({ text: `✓ ${item.name} unlocked! Open BAG on the map to equip it.`, kind: 'ok' })
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Purchase failed'
      setMsg({ text: m, kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, token, address, owned, buyMarketplaceItem, persist, isDevWallet, isGuest])

  const handleSwap = useCallback(async (item: MarketplaceItem) => {
    if (busy || !item.tokenPrice) return
    setBusy(item.id)
    setSwapConfirmId(null)
    setMsg({ text: `Swapping ${item.tokenPrice} NullState Point…`, kind: 'info' })
    try {
      const res = await fetch('/api/marketplace/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, itemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Swap failed')
      persist(Array.isArray(data.owned) ? data.owned : [...owned, item.id])
      if (typeof data.newBalance === 'number') setTokenBalance(data.newBalance)
      setMsg({ text: `✓ ${item.name} unlocked via NullState Point! Open BAG on the map to equip it.`, kind: 'ok' })
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : 'Swap failed'
      setMsg({ text: m, kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, address, owned, persist])

  // Issue 4a: expensive-first within each category section. TASK B: `hidden`
  // items (the free default weapon rusty_blade) are never listed in the shop —
  // they still resolve via getMarketplaceItem for rendering, just can't be bought.
  const armor = MARKETPLACE_ITEMS.filter(i => i.type === 'armor' && !i.hidden).sort((a, b) => b.price - a.price)
  const weapons = MARKETPLACE_ITEMS.filter(i => i.type === 'weapon' && !i.hidden).sort((a, b) => b.price - a.price)
  // Phase 9 — cosmetic skins, pure visuals with no stats. Prices live in
  // lib/constants/marketplace.ts; don't restate them here, they drift.
  const outfits = MARKETPLACE_ITEMS.filter(i => i.type === 'outfit' && !i.hidden).sort((a, b) => b.price - a.price)

  const startTrial = useCallback(async () => {
    if (!address || trialPick.length !== 2 || busy) return
    setBusy('__trial__')
    setMsg({ text: 'Unlocking your Armory Trial…', kind: 'info' })
    try {
      const res = await fetch('/api/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, itemIds: trialPick }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Trial claim failed')
      setTrialEligible(false)
      setTrials(Array.isArray(data?.trials) ? data.trials : [])
      setTrialPick([])
      // Refresh owned so the trial weapons appear equippable immediately.
      const od = await fetch(`/api/marketplace/owned?wallet=${address}`).then(r => r.json()).catch(() => null)
      if (od && Array.isArray(od.owned)) persist(od.owned)
      setMsg({ text: 'Armory Trial active — equip a weapon to start its 48h clock.', kind: 'ok' })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Trial claim failed', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [address, trialPick, busy, persist])

  const renderItem = (item: MarketplaceItem) => {
    const trial = trialMap[item.id]
    const isOwned = owned.includes(item.id) && !trial
    // Skins (outfits) intentionally show NO stat/type descriptor line (owner:
    // don't spell out that they're cosmetic). Only weapons/armor get a stat line.
    const stat = item.type === 'armor'
      ? `+${Math.round((item.effect.hpBonus || 0) * 100)}% HP`
      : item.type === 'weapon'
      ? `+${item.effect.atkBonus || 0} ATK`
      : null
    const tierGlow = ['', 'shadow-[0_0_0_1px_rgba(180,130,70,.4)]', 'shadow-[0_0_14px_rgba(180,130,70,.4)]', 'shadow-[0_0_22px_rgba(255,180,90,.55)]'][item.fxTier]
    return (
      <div key={item.id}>
      <div
        className={`flex items-center gap-3 rounded-lg border border-[#7a4f24]/60 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3 ${tierGlow}`}>
        <button
          type="button"
          onClick={() => setPreviewItem(item)}
          aria-label={`Preview ${item.name}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
        >
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-black/40 border border-[#7a4f24]/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.sprite} alt={item.name} className="h-9 w-9 [image-rendering:pixelated]"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm font-bold text-[#f0dcb8]">{item.name}</span>
              <span className="rounded bg-[#e8bd6f] px-1.5 text-[9px] font-bold text-[#2a1705]">T{item.fxTier}</span>
              <GiMagnifyingGlass aria-hidden className="shrink-0 text-[#9c7a4f]" size={12} />
            </div>
            {stat && (
              <div className="font-mono text-[10px] uppercase tracking-wide text-[#c39a5f]">{stat} · {item.type}</div>
            )}
            <div className="mt-0.5 truncate font-mono text-[10px] text-[#9c7a4f]">{item.desc}</div>
          </div>
        </button>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-sm font-bold text-[#f2cd82]">${item.price.toFixed(2)}</span>
          {trial && (
            <span className="rounded border border-[#e8bd6f]/70 bg-[#e8bd6f]/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#f2cd82]">
              Trial · {trial.expiresAt == null ? 'starts on equip' : fmtTrialLeft(trial.expiresAt)}
            </span>
          )}
          {isOwned ? (
            <span className="rounded border border-[#8a5a2b] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c39a5f]">Owned</span>
          ) : (
            <div className="flex flex-col items-stretch gap-1">
              <button
                onClick={() => handleBuy(item)}
                disabled={busy !== null}
                className="rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-50"
              >
                {busy === item.id ? '…' : 'Buy'}
              </button>
              {/* Swap (with NullState Point) sits directly under Buy. It
                  AUTO-EXPANDS the confirm panel below the moment the player has
                  enough Point (owner spec), so an affordable swap is one tap,
                  not two; otherwise it toggles a "need more Point" hint. */}
              {item.tokenPrice ? (
                <button
                  onClick={() => setSwapConfirmId(swapConfirmId === item.id ? null : item.id)}
                  disabled={busy !== null}
                  className="rounded border border-[#4ade80]/50 px-4 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#7ef0a6] transition hover:bg-[#4ade80]/10 disabled:opacity-50"
                >
                  Swap ⇄ Point
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {(swapConfirmId === item.id || (item.tokenPrice != null && tokenBalance !== null && tokenBalance >= item.tokenPrice)) && item.tokenPrice && !isOwned && (
        <div className="mt-2 -mb-1 rounded-lg border border-[#4ade80]/40 bg-[#4ade80]/5 p-3 font-mono text-[10px]">
          <div className="flex items-center justify-between text-[#c9e8d4]">
            <span>Your NullState Point</span>
            <span className="font-bold text-[#7ef0a6]">{tokenBalance ?? '…'}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[#c9e8d4]">
            <span>Required</span>
            <span className="font-bold text-[#e8c37a]">{item.tokenPrice}</span>
          </div>
          {tokenBalance !== null && tokenBalance < item.tokenPrice ? (
            <p className="mt-2 text-[#f0a878]">Not enough NullState Point yet — burn more items in your inventory to earn some.</p>
          ) : (
            <button
              onClick={() => handleSwap(item)}
              disabled={busy !== null || tokenBalance === null}
              className="mt-2 w-full rounded bg-gradient-to-b from-[#4ade80] to-[#22b862] px-3 py-1.5 font-bold uppercase tracking-wider text-[#062b13] transition hover:brightness-110 disabled:opacity-50"
            >
              {busy === item.id ? 'Swapping…' : 'Confirm Swap'}
            </button>
          )}
        </div>
      )}
    </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(10,7,4,0.97)] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-lg pb-16">
        <header className="mb-4 flex items-center justify-between border-b border-[#7a4f24]/40 pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[4px] text-[#c39a5f]">// NullState</p>
            <h1 className="font-mono text-2xl font-bold text-[#f2cd82]">MARKETPLACE</h1>
          </div>
          <button onClick={onBack}
            className="rounded border border-[#7a4f24] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#c39a5f] hover:bg-[#7a4f24]/20">
            ◂ Back
          </button>
        </header>

        {/* Connected but on the wrong chain — see WrongNetworkBar. Renders
            nothing at all on Celo, and cannot appear inside MiniPay. */}
        <WrongNetworkBar />

        {/* ARMORY TRIAL picker — shows once: Act 1 cleared + never granted.
            Icon-first, two taps + one button, no paragraphs to read. */}
        {act1Cleared && trialEligible && !isGuest && (
          <div className="mb-4 rounded-lg border border-[#e8bd6f]/60 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#f2cd82]">
              <GiCrossedSwords aria-hidden size={15} /> Armory Trial
            </div>
            <p className="mb-2 font-mono text-[10px] leading-relaxed text-[#c39a5f]">
              Act 1 cleared — pick <span className="font-bold text-[#f2cd82]">2</span> premium weapons to try
              <span className="font-bold text-[#7ef0a6]"> FREE for 48h</span> each. The clock starts when you first equip one.
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {weapons.map(w => {
                const on = trialPick.includes(w.id)
                return (
                  <button
                    key={w.id}
                    onClick={() => setTrialPick(prev => on ? prev.filter(x => x !== w.id) : prev.length >= 2 ? prev : [...prev, w.id])}
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition ${
                      on ? 'border-[#e8bd6f] bg-[#e8bd6f]/15 text-[#f2cd82]' : 'border-[#7a4f24]/60 text-[#c39a5f] hover:border-[#8a5a2b]'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.sprite} alt="" className="h-4 w-4 [image-rendering:pixelated]" />
                    {w.name}
                  </button>
                )
              })}
            </div>
            <button
              onClick={startTrial}
              disabled={trialPick.length !== 2 || busy !== null}
              className="w-full rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-40"
            >
              {busy === '__trial__' ? '…' : trialPick.length === 2 ? 'Start Trial' : `Pick ${2 - trialPick.length} more`}
            </button>
          </div>
        )}

        {/* Guest note — buying with real currency needs a wallet, but swapping
            earned NullState Point for basic gear still works while playing. */}
        {isGuest && (
          <div className="mb-4 rounded-lg border border-[#7a4f24]/50 bg-[#7a4f24]/10 p-3 font-mono text-[10px] leading-relaxed text-[#e8c37a]">
            You’re playing as a guest. Buying with USDM/USDC/USDT needs a connected wallet — but you can still <span className="text-[#7ef0a6]">Swap ⇄ Point</span> for basic gear using Point you earn by burning loot.
          </div>
        )}

        {/* token selector */}
        <div className="mb-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-[#9c7a4f]">Pay with</p>
          <div className="flex gap-2">
            {ACCEPTED_TOKENS.map(t => (
              <button key={t} onClick={() => { manualTokenRef.current = true; setToken(t) }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition ${
                  token === t
                    ? 'border-[#e8bd6f] bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] text-[#2a1705]'
                    : 'border-[#7a4f24]/60 bg-[#2b1a0d] text-[#c39a5f] hover:border-[#8a5a2b]'
                }`}>
                {TOKEN_LOGOS[t] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={TOKEN_LOGOS[t]} alt="" className="h-4 w-4 shrink-0 rounded-full" draggable={false} />
                )}
                <span className="flex flex-col items-start leading-tight">
                  <span>{tokenLabel(t)}</span>
                  {/* Only when the balance was actually read. `null` means the
                      call failed, and printing 0.00 for that would be a lie
                      that pushes the player toward the wrong token. */}
                  {stableBalances[t] !== null && (
                    <span className={`text-[9px] font-normal normal-case tracking-normal ${
                      token === t ? 'text-[#5a3a10]' : 'text-[#8a6a3f]'
                    }`}>
                      {stableBalances[t]!.toFixed(2)}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
            Paid on Celo · MiniPay covers the network fee automatically. Purchases are permanent and equippable in-game.
          </p>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg border p-3 font-mono text-xs ${
            msg.kind === 'ok' ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#7ef0a6]'
            : msg.kind === 'err' ? 'border-[#e07a3a]/50 bg-[#e07a3a]/10 text-[#f0a878]'
            : 'border-[#7a4f24]/50 bg-[#7a4f24]/10 text-[#e8c37a]'
          }`}>
            <div>{msg.text}</div>
            {msg.kind === 'err' && insufficientFunds && addCashUrl && (
              <a
                href={addCashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[#f2cd82] underline underline-offset-2"
              >
                Deposit in MiniPay →
              </a>
            )}
          </div>
        )}

        <section className="mb-5">
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]"><GiCheckedShield aria-hidden size={15} /> Armor</h2>
          <div className="flex flex-col gap-2">{armor.map(renderItem)}</div>
        </section>
        <section className="mb-5">
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]"><GiCrossedSwords aria-hidden size={15} /> Weapons</h2>
          <div className="flex flex-col gap-2">{weapons.map(renderItem)}</div>
        </section>
        <section>
          <h2 className="mb-2 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]">✦ Skins</h2>
          <div className="flex flex-col gap-2">{outfits.map(renderItem)}</div>
        </section>
      </div>

      {/* Issue #5 — item preview popup. Opened by tapping any item's icon/name. */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative w-full max-w-xs rounded-xl border border-[#7a4f24] bg-gradient-to-b from-[#2b1a0d] to-[#140b04] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewItem(null)}
              aria-label="Close preview"
              className="absolute right-3 top-3 font-mono text-sm text-[#c39a5f] transition hover:text-[#f0dcb8]"
            >
              ✕
            </button>
            <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-lg border border-[#7a4f24]/60 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewItem.sprite}
                alt={previewItem.name}
                className="h-24 w-24 [image-rendering:pixelated]"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h3 className="font-mono text-base font-bold text-[#f0dcb8]">{previewItem.name}</h3>
              <span className="rounded bg-[#e8bd6f] px-1.5 text-[9px] font-bold text-[#2a1705]">T{previewItem.fxTier}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-[#c39a5f]">
              {previewItem.type === 'armor'
                ? `+${Math.round((previewItem.effect.hpBonus || 0) * 100)}% HP`
                : previewItem.type === 'weapon'
                ? `+${previewItem.effect.atkBonus || 0} ATK`
                : 'Cosmetic'} · {previewItem.type}
            </div>
            {previewItem.desc && (
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#9c7a4f]">{previewItem.desc}</p>
            )}
            <div className="mt-4 font-mono text-lg font-bold text-[#f2cd82]">${previewItem.price.toFixed(2)}</div>
            {owned.includes(previewItem.id) ? (
              <div className="mt-3 rounded border border-[#8a5a2b] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#c39a5f]">
                Owned — equip it from BAG on the map
              </div>
            ) : (
              <button
                onClick={() => { const it = previewItem; setPreviewItem(null); handleBuy(it) }}
                disabled={busy !== null || isGuest}
                className="mt-3 w-full rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-50"
              >
                Buy — ${previewItem.price.toFixed(2)} {tokenLabel(token)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
