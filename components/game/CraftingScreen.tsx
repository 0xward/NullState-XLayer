'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { GiAnvil, GiCheckedShield, GiSandsOfTime } from 'react-icons/gi'
import { useWallet, CELO_CHAIN_ID } from '@/lib/WalletProvider'
import WrongNetworkBar from './WrongNetworkBar'
import { pickBestPaymentToken } from '@/lib/constants/tokens'
import {
  ACCEPTED_TOKENS, getMarketplaceItem, resolveItemId, maxWeaponTier, tokenLabel, TOKEN_LOGOS,
  type MarketplaceItem, type MarketplaceTokenSymbol,
} from '@/lib/constants/marketplace'
import { GAME_CONFIG } from '@/lib/constants/game-config'

// ─── Tier-accurate weapon icon ───────────────────────────────────────────────
// Owner: "belum buat preview level 2 dan 3". The card used to show the plain
// base sprite behind a box-shadow that grew slightly per tier, so a tier-3
// weapon looked like a tier-2 one with a wider shadow — nothing about the
// weapon itself changed, which is the thing the player just paid to change.
//
// This paints the SAME sprite the engine paints, with the SAME tier data the
// engine reads: spriteOverrideTint on the pixels, glowOverride around them.
// Deliberately derived rather than drawn as new art, because a hand-made
// preview and a procedural in-game look drift apart the first time either is
// touched — and a shop that promises something the dungeon does not deliver is
// worse than a plain icon.
//
// The tint is a mask fill, not a filter: filters shift the whole image
// including its dark outline, while masking to the sprite's own alpha tints
// exactly the lit pixels and leaves the silhouette intact.
function TierIcon({ item, tier, size = 36 }: { item: MarketplaceItem; tier: number; size?: number }) {
  const step = tier > 1 ? item.evolutionTiers?.[tier - 2] : undefined
  const tint = step?.spriteOverrideTint
  const glow = step?.glowOverride || item.fxColor
  const spread = tier > 1 ? 3 + 3 * (tier - 1) : 0
  return (
    <span className="relative inline-block" style={{ width: size, height: size }} aria-hidden={false}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.sprite}
        alt={item.name}
        className="absolute inset-0 h-full w-full [image-rendering:pixelated]"
        style={tier > 1 && glow ? { filter: `drop-shadow(0 0 ${spread}px ${glow})` } : undefined}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
      {tint && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: tint,
            opacity: tier >= 3 ? 0.55 : 0.35,
            mixBlendMode: 'screen',
            WebkitMaskImage: `url(${item.sprite})`,
            maskImage: `url(${item.sprite})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        />
      )}
    </span>
  )
}

interface CraftingScreenProps {
  onBack: () => void
  // Free path: send the player back to the menu to start a run and farm the
  // shard tier they're short on. Kept separate from onBack so the intent
  // ("go play") reads clearly even though both land on menu — a run must start
  // through the menu's New Game/Continue + energy flow, never straight here.
  onGoToRun?: () => void
  address?: string
}

type ShardBal = { t1: number; t2: number; t3: number }
type TierKey = 't1' | 't2' | 't3'
type CraftRecord = { itemId: string; targetTier: number; startedAt: number; completesAt: number }

const CRAFT_CFG = GAME_CONFIG.weaponEvolution.craft
const DURATIONS = CRAFT_CFG.durationHoursByTargetTier
const FINISH_PRICE = CRAFT_CFG.finishNowPriceUSDByTargetTier

// Which act drops each shard tier most (mirrors game.js _shardTierForAct:
// acts 1-2 = t1, 3-4 = t2, 5 = t3). Used for the free-path CTA label.
const ACT_FOR_TIER: Record<TierKey, string> = { t1: 'Act 1–2', t2: 'Act 3–4', t3: 'Act 5' }

function fmtDur(ms: number): string {
  if (ms <= 0) return 'Ready'
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

export default function CraftingScreen({ onBack, onGoToRun, address }: CraftingScreenProps) {
  const wallet = useWallet()
  const { buyMarketplaceItem, insufficientFunds, addCashUrl } = wallet
  // From the wallet bridge, not wagmi's usePublicClient(): wagmi now mounts
  // beside the app rather than around it (lib/walletBridge.tsx), so this
  // screen is not inside WagmiProvider and calling its hooks here would throw.
  // Null until wagmi has loaded; the effect below already handles that.
  const publicClient = wallet.publicClient
  const [token, setToken] = useState<MarketplaceTokenSymbol>('USDm')
  // Flexible stablecoin (Phase 2): default the pay-with token to the largest
  // balance the wallet holds; the manual selector still overrides.
  const manualTokenRef = useRef(false)
  useEffect(() => {
    if (!address || !publicClient) return
    let cancelled = false
    pickBestPaymentToken(publicClient, address as `0x${string}`).then(best => {
      if (!cancelled && !manualTokenRef.current) setToken(best)
    })
    return () => { cancelled = true }
  }, [address, publicClient])
  const [owned, setOwned] = useState<string[]>([])
  const [tiers, setTiers] = useState<Record<string, number>>({})
  const [shards, setShards] = useState<ShardBal>({ t1: 0, t2: 0, t3: 0 })
  const [craft, setCraft] = useState<CraftRecord | null>(null)
  // serverNow - localNow at fetch time, so the countdown reads true even if the
  // device clock is off.
  const [skew, setSkew] = useState(0)
  const [nowTick, setNowTick] = useState(Date.now())
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; kind: 'info' | 'ok' | 'err' } | null>(null)
  // Phase 8 — owned Premium Sector Blueprints (sectorIds).
  const [sectorsOwned, setSectorsOwned] = useState<string[]>([])

  const pack = GAME_CONFIG.weaponEvolution.shardPack
  const premiumSectors = GAME_CONFIG.premiumSectors
  const effectiveNow = nowTick + skew
  const remainingMs = craft ? craft.completesAt - effectiveNow : 0
  const craftReady = !!craft && remainingMs <= 0

  const isDevWallet =
    !!address &&
    (process.env.NEXT_PUBLIC_DEV_TEST_WALLETS || '')
      .split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
      .includes(address.toLowerCase())

  // 1Hz countdown tick while a craft is pending (stops once ready/claimed).
  useEffect(() => {
    if (!craft || craftReady) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [craft, craftReady])

  const refreshShards = useCallback(() => {
    if (!address) return
    fetch(`/api/materials?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (d && typeof d.t1 === 'number') setShards({ t1: d.t1, t2: d.t2 || 0, t3: d.t3 || 0 }) })
      .catch(() => { /* offline — leave as-is */ })
  }, [address])

  const refreshCraft = useCallback(() => {
    if (!address) return
    fetch(`/api/weapons/craft?wallet=${address}`)
      .then(r => r.json())
      .then(d => {
        if (d && typeof d.serverNow === 'number') setSkew(d.serverNow - Date.now())
        setCraft(d && d.craft ? d.craft : null)
      })
      .catch(() => { /* offline — no active craft shown */ })
  }, [address])

  // Load owned weapons + shards + tiers + any active craft on mount.
  useEffect(() => {
    if (!address) return
    fetch(`/api/marketplace/owned?wallet=${address}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.owned)) {
          // ARMORY TRIAL: trial weapons are merged into `owned` for equipping
          // but can NOT be evolved (the craft routes reject them server-side
          // anyway — marketplaceOwned only). Filter them out of the forge list
          // so the UI never offers a craft that would just fail.
          const trialIds: string[] = Array.isArray(d.trialIds) ? d.trialIds : []
          const weapons = d.owned
            .filter((id: string) => !trialIds.includes(id))
            .map(resolveItemId)
            .filter((id: string) => {
              const it = getMarketplaceItem(id)
              return !!it && it.type === 'weapon' && !!it.evolutionTiers?.length
            })
          setOwned(weapons.filter((id: string, i: number) => weapons.indexOf(id) === i))
        }
      })
      .catch(() => { /* offline — empty list */ })
    refreshShards()
    fetch(`/api/weapons?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (d && d.tiers && typeof d.tiers === 'object') setTiers(d.tiers) })
      .catch(() => { /* offline — base tiers */ })
    fetch(`/api/blueprints?wallet=${address}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.owned)) setSectorsOwned(d.owned) })
      .catch(() => { /* offline — none owned */ })
    refreshCraft()
  }, [address, refreshShards, refreshCraft])

  const handleBuySector = useCallback(async (sector: { id: string; name: string; priceUSD: number }) => {
    if (busy) return
    setBusy(sector.id)
    setMsg({ text: isDevWallet ? 'DEV: unlocking sector…' : `Sending $${sector.priceUSD} ${tokenLabel(token)}…`, kind: 'info' })
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await buyMarketplaceItem(sector.priceUSD, token)
        setMsg({ text: 'Payment sent — verifying on-chain…', kind: 'info' })
      }
      const res = await fetch('/api/blueprints/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet ? { wallet: address, sectorId: sector.id, devBypass: true } : { wallet: address, txHash, token, sectorId: sector.id },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')
      if (Array.isArray(data.owned)) setSectorsOwned(data.owned)
      setMsg({ text: `✓ ${sector.name} unlocked — a Glitch-Shard cache now spawns each run of that act.`, kind: 'ok' })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Purchase failed', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, isDevWallet, token, address, buyMarketplaceItem])

  const handleStart = useCallback(async (item: MarketplaceItem) => {
    if (busy) return
    setBusy(item.id)
    setMsg({ text: `Starting craft for ${item.name}…`, kind: 'info' })
    try {
      const res = await fetch('/api/weapons/craft/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, itemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start craft')
      if (data.materials) setShards({ t1: data.materials.t1 || 0, t2: data.materials.t2 || 0, t3: data.materials.t3 || 0 })
      if (data.completed) {
        // First-ever craft: instant, no timer.
        setTiers(prev => ({ ...prev, [item.id]: data.tier }))
        setMsg({ text: `✓ ${item.name} evolved instantly to Tier ${data.tier} — your first craft is on the house!`, kind: 'ok' })
      } else {
        setCraft(data.craft)
        setNowTick(Date.now())
        setMsg({ text: `Forging ${item.name} → Tier ${data.craft.targetTier}. Come back when it's ready, or Finish Now.`, kind: 'ok' })
      }
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Could not start craft', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, address])

  const handleClaim = useCallback(async () => {
    if (busy || !craft) return
    setBusy(craft.itemId)
    setMsg({ text: 'Claiming…', kind: 'info' })
    try {
      const res = await fetch('/api/weapons/craft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Claim failed')
      setTiers(prev => ({ ...prev, [data.itemId]: data.tier }))
      const name = getMarketplaceItem(data.itemId)?.name || 'Weapon'
      setCraft(null)
      setMsg({ text: `✓ ${name} evolved to Tier ${data.tier}!`, kind: 'ok' })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Claim failed', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, craft, address])

  const handleFinishNow = useCallback(async () => {
    if (busy || !craft) return
    const price = FINISH_PRICE[craft.targetTier] ?? Math.max(...Object.values(FINISH_PRICE))
    setBusy(craft.itemId)
    setMsg({ text: isDevWallet ? 'DEV: finishing instantly…' : `Sending $${price} ${tokenLabel(token)}…`, kind: 'info' })
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await buyMarketplaceItem(price, token)
        setMsg({ text: 'Payment sent — verifying on-chain…', kind: 'info' })
      }
      const res = await fetch('/api/weapons/craft/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet ? { wallet: address, devBypass: true } : { wallet: address, txHash, token },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Finish Now failed')
      setTiers(prev => ({ ...prev, [data.itemId]: data.tier }))
      const name = getMarketplaceItem(data.itemId)?.name || 'Weapon'
      setCraft(null)
      setMsg({ text: `${name} evolved to Tier ${data.tier} — timer skipped!`, kind: 'ok' })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Finish Now failed', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, craft, isDevWallet, token, address, buyMarketplaceItem])

  const handleBuyPack = useCallback(async (item: MarketplaceItem, tierKey: TierKey) => {
    if (busy) return
    setBusy(item.id)
    setMsg({ text: isDevWallet ? 'DEV: requesting free shards…' : `Sending $${pack.priceUSD} ${tokenLabel(token)}…`, kind: 'info' })
    try {
      let txHash = ''
      if (!isDevWallet) {
        txHash = await buyMarketplaceItem(pack.priceUSD, token)
        setMsg({ text: 'Payment sent — verifying on-chain…', kind: 'info' })
      }
      const res = await fetch('/api/materials/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDevWallet
            ? { wallet: address, tier: tierKey, devBypass: true }
            : { wallet: address, txHash, token, tier: tierKey },
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')
      setShards({ t1: data.t1 || 0, t2: data.t2 || 0, t3: data.t3 || 0 })
      setMsg({ text: `✓ +${pack.shards} ${tierKey.toUpperCase()} Glitch Shards added!`, kind: 'ok' })
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Purchase failed', kind: 'err' })
    } finally {
      setBusy(null)
    }
  }, [busy, isDevWallet, pack.priceUSD, pack.shards, token, address, buyMarketplaceItem])

  const weapons = owned
    .map(getMarketplaceItem)
    .filter((i): i is MarketplaceItem => !!i)
    .sort((a, b) => a.price - b.price)

  const renderCard = (item: MarketplaceItem) => {
    const curTier = Math.max(1, tiers[item.id] || 1)
    const cap = maxWeaponTier(item)
    const atMax = curTier >= cap
    const tierKey = (`t${item.fxTier}`) as TierKey
    const targetTier = curTier + 1
    const step = atMax ? null : item.evolutionTiers?.[curTier - 1]
    const cost = step ? (step.materialsRequired[tierKey] || 0) : 0
    const have = shards[tierKey]
    const shortBy = Math.max(0, cost - have)
    const enoughShards = !atMax && shortBy === 0

    const activeHere = !!craft && craft.itemId === item.id
    const busyElsewhere = !!craft && craft.itemId !== item.id
    const curAtk = (item.effect.atkBonus || 0) + (item.evolutionTiers?.slice(0, curTier - 1).reduce((s, t) => s + (t.atkBonusDelta || 0), 0) || 0)
    const craftDur = DURATIONS[targetTier] ?? Math.max(...Object.values(DURATIONS))
    const finishPrice = activeHere ? (FINISH_PRICE[craft!.targetTier] ?? Math.max(...Object.values(FINISH_PRICE))) : 0

    return (
      <div key={item.id}
        className={`rounded-lg border bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3 ${activeHere ? 'border-[#e8bd6f]' : 'border-[#7a4f24]/60'}`}>
        <div className="flex items-center gap-3">
          {/* Current tier, then what the next one actually looks like. Showing
              only the current icon meant the upgrade was described in numbers
              and never shown — the player paid shards for a change they could
              not see until after it happened. */}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded bg-black/40 border border-[#7a4f24]/50"
              style={curTier > 1 ? { boxShadow: `0 0 ${5 + 5 * (curTier - 1)}px ${item.evolutionTiers?.[curTier - 2]?.glowOverride || item.fxColor || '#e8bd6f'}`, borderColor: item.fxColor || undefined } : undefined}>
              <TierIcon item={item} tier={curTier} />
            </div>
            {!atMax && (
              <>
                <span className="font-mono text-[11px] leading-none text-[#8a5a2b]" aria-hidden="true">›</span>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#7a4f24]/70 bg-black/20 opacity-80"
                  title={`Tier ${curTier + 1} preview`}
                  style={{ boxShadow: `0 0 ${5 + 5 * curTier}px ${step?.glowOverride || item.fxColor || '#e8bd6f'}` }}>
                  <TierIcon item={item} tier={curTier + 1} />
                </div>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm font-bold text-[#f0dcb8]">{item.name}</span>
              <span className="rounded bg-[#e8bd6f] px-1.5 text-[9px] font-bold text-[#2a1705]">TIER {curTier}/{cap}</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-[#c39a5f]">
              +{curAtk} ATK{!atMax && step ? ` · next +${step.atkBonusDelta}` : ''}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            {atMax ? (
              <span className="rounded border border-[#8a5a2b] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c39a5f]">Max</span>
            ) : activeHere ? (
              <span className="font-mono text-[11px] font-bold text-[#f2cd82]">
                {craftReady ? 'Ready ✓' : <span className="inline-flex items-center gap-1"><GiSandsOfTime aria-hidden size={12} /> {fmtDur(remainingMs)}</span>}
              </span>
            ) : (
              <span className="font-mono text-[10px] text-[#9c7a4f]">
                <b className={enoughShards ? 'text-[#7ef0a6]' : 'text-[#f0a878]'}>{have}</b>/{cost} {tierKey.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Action zone */}
        {atMax ? null : activeHere ? (
          // Active craft on THIS weapon — claim when ready, or skip the timer.
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={handleClaim}
              disabled={busy !== null || !craftReady}
              className="rounded bg-gradient-to-b from-[#4ade80] to-[#22b862] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#062b13] transition hover:brightness-110 disabled:opacity-40"
            >
              {busy === item.id && craftReady ? '…' : craftReady ? 'Claim' : `Ready in ${fmtDur(remainingMs)}`}
            </button>
            <button
              onClick={handleFinishNow}
              disabled={busy !== null || craftReady}
              className="rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-40"
            >
              {busy === item.id && !craftReady ? '…' : <><span style={{ color: '#ffffff' }}>{'⚡︎'}</span> Finish Now — ${finishPrice}</>}
            </button>
          </div>
        ) : busyElsewhere ? (
          <div className="mt-3 rounded border border-[#7a4f24]/40 bg-black/20 px-3 py-2 text-center font-mono text-[10px] text-[#9c7a4f]">
            Forge busy — finish your current craft first
          </div>
        ) : enoughShards ? (
          // Enough shards, forge free — start the timed craft.
          <button
            onClick={() => handleStart(item)}
            disabled={busy !== null}
            className="mt-3 w-full rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-50"
          >
            {busy === item.id ? '…' : `Craft → Tier ${targetTier} · ${craftDur}h`}
          </button>
        ) : (
          // Shortfall — the blueprint's hard rule: FREE path shown with EQUAL
          // weight beside the paid path, never the paid button alone.
          <div className="mt-3 rounded-lg border border-[#7a4f24]/40 bg-black/30 p-3">
            <p className="mb-2 font-mono text-[10px] text-[#f0a878]">
              You need <b>{shortBy}</b> more {tierKey.toUpperCase()} Glitch Shard{shortBy > 1 ? 's' : ''} to craft.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => (onGoToRun || onBack)()}
                disabled={busy !== null}
                className="rounded border border-[#4ade80]/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#7ef0a6] transition hover:bg-[#4ade80]/10 disabled:opacity-50"
              >
                Farm in {ACT_FOR_TIER[tierKey]}
              </button>
              <button
                onClick={() => handleBuyPack(item, tierKey)}
                disabled={busy !== null}
                className="rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-50"
              >
                {busy === item.id ? '…' : `Buy ${pack.shards} — $${pack.priceUSD}`}
              </button>
            </div>
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
              Free: clear runs to loot shards. Or top up instantly — {pack.shards} {tierKey.toUpperCase()} shards for ${pack.priceUSD}.
            </p>
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
            <h1 className="font-mono text-2xl font-bold text-[#f2cd82]">CRAFTING</h1>
          </div>
          <button onClick={onBack}
            className="rounded border border-[#7a4f24] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#c39a5f] hover:bg-[#7a4f24]/20">
            ◂ Back
          </button>
        </header>

        {/* Connected but on the wrong chain — see WrongNetworkBar. Renders
            nothing at all on Celo, and cannot appear inside MiniPay. */}
        <WrongNetworkBar />

        {/* shard balance strip */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(['t1', 't2', 't3'] as TierKey[]).map(k => (
            <div key={k} className="rounded-lg border border-[#7a4f24]/50 bg-[#2b1a0d] px-3 py-2 text-center">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#9c7a4f]">{k.toUpperCase()} Shards</div>
              <div className="font-mono text-lg font-bold text-[#f2cd82]">{shards[k]}</div>
            </div>
          ))}
        </div>

        {/* token selector (used for the $1 top-up and Finish Now) */}
        <div className="mb-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-[#9c7a4f]">Payments use</p>
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
                {tokenLabel(t)}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg border p-3 font-mono text-xs ${
            msg.kind === 'ok' ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#7ef0a6]'
            : msg.kind === 'err' ? 'border-[#e07a3a]/50 bg-[#e07a3a]/10 text-[#f0a878]'
            : 'border-[#7a4f24]/50 bg-[#7a4f24]/10 text-[#e8c37a]'
          }`}>
            <div>{msg.text}</div>
            {msg.kind === 'err' && insufficientFunds && addCashUrl && (
              <a href={addCashUrl} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-block text-[#f2cd82] underline underline-offset-2">
                Deposit in MiniPay →
              </a>
            )}
          </div>
        )}

        <section>
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]"><GiAnvil aria-hidden size={15} /> Your Weapons</h2>
          {weapons.length === 0 ? (
            <div className="rounded-lg border border-[#7a4f24]/40 bg-[#2b1a0d]/60 p-4 text-center font-mono text-[11px] text-[#9c7a4f]">
              No weapons to evolve yet. Buy one in the Marketplace, then level it here with Glitch Shards.
            </div>
          ) : (
            <div className="flex flex-col gap-2">{weapons.map(renderCard)}</div>
          )}
          <p className="mt-3 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
            Crafting takes time — one forge at a time. Your very first evolution completes instantly. Clear runs to loot shards for free, or Finish Now to skip a timer.
          </p>
        </section>

        {/* Phase 8 — Premium Sector Blueprints. Optional paid bonus content:
            owning an act's sector spawns a guaranteed Glitch-Shard cache each
            run of that act. Never gates or alters the 5 core story acts. */}
        <section className="mt-6">
          <h2 className="mb-1 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[3px] text-[#e6c07a]"><GiCheckedShield aria-hidden size={15} /> Premium Sectors</h2>
          <p className="mb-2 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
            Optional bonus sectors. Each unlocks a guaranteed Glitch-Shard cache on that act&apos;s first floor — a faster, free-to-farm path to evolution shards. Purely optional; the core story is unaffected.
          </p>
          <div className="flex flex-col gap-2">
            {premiumSectors.map(sector => {
              const isOwned = sectorsOwned.includes(sector.id)
              return (
                <div key={sector.id}
                  className={`flex items-center gap-3 rounded-lg border bg-gradient-to-b from-[#241a2e] to-[#140d1c] p-3 ${isOwned ? 'border-[#a970ff]/70' : 'border-[#7a4f24]/50'}`}>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-black/40 border border-[#7a4f24]/40 font-mono text-lg">✦</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-bold text-[#e6d8ff]">{sector.name} <span className="text-[#9c7a4f]">· Act {sector.act}</span></div>
                    <div className="truncate font-mono text-[10px] text-[#9c7a4f]">{sector.desc}</div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-sm font-bold text-[#c9a6ff]">${sector.priceUSD.toFixed(2)}</span>
                    {isOwned ? (
                      <span className="rounded border border-[#a970ff]/60 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c9a6ff]">Owned</span>
                    ) : (
                      <button
                        onClick={() => handleBuySector(sector)}
                        disabled={busy !== null}
                        className="rounded bg-gradient-to-b from-[#a970ff] to-[#7b3fe4] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#150a24] transition hover:brightness-110 disabled:opacity-50"
                      >
                        {busy === sector.id ? '…' : 'Unlock'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
