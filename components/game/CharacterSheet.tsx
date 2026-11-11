'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { PlayerProfile } from '@/lib/contract'
import {
  getMarketplaceItem, resolveItemId,
  type MarketplaceItem, type EquipmentSlot,
} from '@/lib/constants/marketplace'
import { portraitFor } from '@/lib/heroPortrait'
import { usePassSBT } from '@/hooks/usePassSBT'
import { isPassCurrent, seasonNumberOf, seasonLabel, currentSeasonId } from '@/lib/season'

// ─── Character Sheet ─────────────────────────────────────────────────────────
// The screen that answers "who am I and what do I own", opened from the world
// map two ways: the player plate (top-left) lands on CHARACTER, the BAG button
// on the right rail lands on ITEMS. One component with two tabs rather than two
// screens — the data behind them is identical, and two screens listing the same
// gear would drift.
//
// WHY THIS EXISTS: until now there was no inventory anywhere outside a run.
// Buying a weapon in the Marketplace told the player "Equip it in your
// inventory" — an inventory that only existed inside a bunker. So the reward
// for spending money was homework: start a run before you can use the thing you
// just paid for. For a first purchase on MiniPay that is the easiest possible
// moment to lose someone.
//
// No new backend. GET /api/marketplace/owned already returns owned + equipped +
// active trials, and POST /api/marketplace/equip already persists the three
// slots server-side (it exists precisely so a reinstall doesn't unequip you).

interface CharacterSheetProps {
  onBack: () => void
  onMarketplace: () => void
  playerProfile: PlayerProfile | null
  initialTab?: 'character' | 'items'
}

type Tab = 'character' | 'items'
type Equipped = { mainhand: string | null; body: string | null; outfit: string | null }

const EMPTY: Equipped = { mainhand: null, body: null, outfit: null }

// The portrait follows what is equipped — see lib/heroPortrait. It is derived
// from THIS screen's own state rather than re-fetched, so tapping an item
// repaints the face on the same frame the item lights up.

const SLOTS: { slot: EquipmentSlot; label: string; hint: string }[] = [
  { slot: 'mainhand', label: 'WEAPON', hint: 'Sets your damage and how you attack' },
  { slot: 'body', label: 'ARMOR', hint: 'Raises your maximum HP' },
  { slot: 'outfit', label: 'OUTFIT', hint: 'Looks only — never affects combat' },
]

function slotOf(item: MarketplaceItem): EquipmentSlot {
  return item.slot
}

function Portrait({ src, size = 64 }: { src: string; size?: number }) {
  // A single 64x64 frame — no sprite-sheet offsets to get wrong. Kept at whole
  // multiples of 64 by every caller so the pixels stay square.
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, display: 'block', flexShrink: 0,
        backgroundImage: `url(${src})`,
        backgroundSize: `${size}px ${size}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  )
}

export default function CharacterSheet({
  onBack, onMarketplace, playerProfile, initialTab = 'character',
}: CharacterSheetProps) {
  const { address, realAddress, isGuest } = useWallet()
  // Pass status lives here because the plate on the map is what players tap to
  // check it. A pass is MONTHLY, so "held" and "active right now" are different
  // questions and the screen answers both.
  const { hasPass, passSeasonId } = usePassSBT(realAddress || undefined)
  const passLive = hasPass && isPassCurrent(passSeasonId)
  const passNo = seasonNumberOf(passSeasonId)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [owned, setOwned] = useState<string[]>([])
  const [equipped, setEquipped] = useState<Equipped>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    let alive = true
    fetch(`/api/marketplace/owned?wallet=${address}`)
      .then(r => r.json())
      .then((d) => {
        if (!alive) return
        // Trial items are playable but not bought — they belong in the list or
        // a player mid-trial would see an empty bag and think the trial failed.
        const ids: string[] = [
          ...(Array.isArray(d.owned) ? d.owned : []),
          ...(Array.isArray(d.trialIds) ? d.trialIds : []),
        ]
        setOwned(Array.from(new Set(ids.map(resolveItemId))))
        if (d.equipped) setEquipped({ ...EMPTY, ...d.equipped })
      })
      .catch(() => { /* offline — the sheet still renders, just empty */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [address])

  // Pass-only items (the Season Pass warden skin) are granted, never bought, so
  // they never appear in `owned`. They are also `hidden`, so the shop can't
  // show them — which left them invisible everywhere. Surface them here.
  const ownedItems = useMemo(() => {
    const list = owned
      .map(getMarketplaceItem)
      .filter((i): i is MarketplaceItem => !!i)
    return list.sort((a, b) => a.slot.localeCompare(b.slot) || a.price - b.price)
  }, [owned])

  const stats = useMemo(() => {
    let atk = 0, hpPct = 0
    for (const id of [equipped.mainhand, equipped.body]) {
      if (!id) continue
      const it = getMarketplaceItem(id)
      if (!it || it.type === 'outfit') continue
      atk += it.effect.atkBonus || 0
      hpPct += it.effect.hpBonus || 0
    }
    return { atk, hpPct: Math.round(hpPct * 100) }
  }, [equipped])

  const save = useCallback(async (next: Equipped) => {
    setEquipped(next) // optimistic — the sheet should never feel laggy
    if (!address) return
    try {
      await fetch('/api/marketplace/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, ...next }),
      })
    } catch {
      setMsg('Saved on this device — could not reach the server')
    }
  }, [address])

  const toggle = useCallback(async (item: MarketplaceItem) => {
    if (busy) return
    setBusy(item.id)
    setMsg(null)
    const slot = slotOf(item)
    const key = slot === 'mainhand' ? 'mainhand' : slot === 'body' ? 'body' : 'outfit'
    const isOn = equipped[key] === item.id
    await save({ ...equipped, [key]: isOn ? null : item.id })
    setMsg(isOn ? `${item.name} unequipped` : `${item.name} equipped`)
    setBusy(null)
  }, [busy, equipped, save])

  const lv = playerProfile?.level ?? 1
  const xp = playerProfile?.xp ?? 0
  // entities.js: xpForNext() === level * 200, and `xp` is what has been earned
  // WITHIN the current level (gainXp subtracts on each level-up), so this is a
  // true progress fraction rather than a running career total.
  const xpNeed = lv * 200
  const xpPct = Math.max(0, Math.min(100, (xp / xpNeed) * 100))
  // Level's only combat effect: +0.4% crit per level, capped at 25%. Shown
  // because otherwise "LV 44" is a number with no stated meaning.
  const crit = Math.min(25, 0.4 * (lv - 1))

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(5,10,8,.975)' }}>
      <div className="mx-auto w-full max-w-lg p-4 pb-16">

        <header className="mb-4 flex items-center justify-between border-b pb-3" style={{ borderColor: 'rgba(57,255,154,.22)' }}>
          <div>
            {/* Braced so ESLint doesn't read the literal slashes as a stray JSX
                comment — the other screens all trip react/jsx-no-comment-textnodes
                on this exact line. */}
            <p className="font-mono text-[10px] uppercase tracking-[4px]" style={{ color: '#4e8f74' }}>{'// NullState'}</p>
            <h1 className="font-mono text-2xl font-bold" style={{ color: '#8ef5bd' }}>
              {tab === 'character' ? 'CHARACTER' : 'YOUR ITEMS'}
            </h1>
          </div>
          <button
            onClick={onBack}
            className="rounded border px-3 py-2 font-mono text-xs uppercase tracking-wider"
            style={{ minHeight: 44, borderColor: '#2f6b50', color: '#8ea89d' }}
          >
            ◂ Map
          </button>
        </header>

        {/* Identity block — shared by both tabs so the header never feels like
            it belongs to only one of them. */}
        <div className="mb-4 flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'rgba(57,255,154,.18)', background: 'rgba(10,24,18,.7)' }}>
          <div className="rounded" style={{ background: 'rgba(0,0,0,.35)', border: '1px solid rgba(57,255,154,.2)', padding: 4 }}>
            <Portrait src={portraitFor(equipped)} size={64} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-base font-bold" style={{ color: '#e8fff4' }}>
              {playerProfile?.username?.toUpperCase() || 'WALKER'}
            </p>
            <p className="font-mono text-[10px]" style={{ color: '#7fd7ab' }}>
              LV {lv} · {crit.toFixed(1)}% CRIT
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm" style={{ background: 'rgba(255,255,255,.09)' }}>
              <div style={{ width: `${xpPct}%`, height: '100%', background: 'linear-gradient(90deg,#2f9c67,#39ff9a)' }} />
            </div>
            <p className="mt-1 font-mono text-[9px]" style={{ color: '#5f8d78' }}>
              {xp} / {xpNeed} XP to LV {lv + 1}
            </p>
          </div>
        </div>

        {/* Season Pass status. Shown to holders AND to non-holders, because the
            useful question on this screen is "what have I got", and an absent
            row reads as a broken feature rather than as "you don't have one".
            A pass that has rolled over is called out explicitly — silently
            treating it as "no pass" is how someone concludes they were charged
            for nothing. */}
        {realAddress && (hasPass || passLive) && (
          <div
            className="mb-4 flex items-center gap-3 rounded-lg border p-3"
            style={{
              borderColor: passLive ? 'rgba(255,224,102,.55)' : 'rgba(255,255,255,.12)',
              background: passLive ? 'rgba(255,207,77,.09)' : 'rgba(10,24,18,.5)',
            }}
          >
            <span
              aria-hidden="true"
              className="flex items-center justify-center font-mono font-bold"
              style={{
                width: 34, height: 34, flexShrink: 0, fontSize: 12,
                color: passLive ? '#04140c' : '#5f8d78',
                background: passLive ? '#ffcf4d' : 'rgba(255,255,255,.08)',
                clipPath: 'polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)',
              }}
            >
              S{passNo ?? '?'}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[12px] font-bold" style={{ color: passLive ? '#ffe9a3' : '#cfe9dc' }}>
                {passLive ? `Season ${passNo ?? '?'} Pass — Active` : `Season ${passNo ?? '?'} Pass — Expired`}
              </span>
              <span className="block font-mono text-[9px] leading-relaxed" style={{ color: '#5f8d78' }}>
                {passLive
                  ? `Runs through ${seasonLabel(passSeasonId) ?? 'this season'}. Daily bonus runs, a shard stipend, and the Warden skin.`
                  : `That pass covered ${seasonLabel(passSeasonId) ?? 'an earlier season'}. ${seasonLabel(currentSeasonId()) ?? 'This season'} needs a new one.`}
              </span>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          {(['character', 'items'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded font-mono text-[11px] font-bold uppercase tracking-[2px]"
              style={{
                minHeight: 44,
                color: tab === t ? '#04140c' : '#8ea89d',
                background: tab === t ? '#39ff9a' : 'transparent',
                border: `1px solid ${tab === t ? '#39ff9a' : '#2f6b50'}`,
              }}
            >
              {t === 'character' ? 'Character' : `Items${ownedItems.length ? ` (${ownedItems.length})` : ''}`}
            </button>
          ))}
        </div>

        {msg && (
          <p className="mb-3 rounded border px-3 py-2 font-mono text-[10px]" style={{ borderColor: 'rgba(57,255,154,.3)', color: '#7ef0a6', background: 'rgba(57,255,154,.07)' }}>
            {msg}
          </p>
        )}

        {tab === 'character' && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {SLOTS.map(({ slot, label, hint }) => {
                const key = slot === 'mainhand' ? 'mainhand' : slot === 'body' ? 'body' : 'outfit'
                const item = equipped[key] ? getMarketplaceItem(equipped[key]!) : undefined
                return (
                  <div key={slot} className="rounded-lg border p-2 text-center" style={{ borderColor: item ? 'rgba(57,255,154,.35)' : 'rgba(255,255,255,.12)', background: 'rgba(10,24,18,.6)' }} title={hint}>
                    <p className="mb-1 font-mono text-[8px] uppercase tracking-[1.5px]" style={{ color: '#5f8d78' }}>{label}</p>
                    {item ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.sprite} alt="" className="mx-auto h-10 w-10 [image-rendering:pixelated]" />
                        <p className="mt-1 truncate font-mono text-[9px]" style={{ color: '#cfe9dc' }}>{item.name}</p>
                      </>
                    ) : (
                      <>
                        <span className="mx-auto flex h-10 w-10 items-center justify-center font-mono text-lg" style={{ color: 'rgba(255,255,255,.18)' }}>—</span>
                        <p className="mt-1 font-mono text-[9px]" style={{ color: '#4e6b5e' }}>Empty</p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mb-4 rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,.1)', background: 'rgba(10,24,18,.5)' }}>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px]" style={{ color: '#5f8d78' }}>From your gear</p>
              <div className="flex gap-4 font-mono text-sm">
                <span style={{ color: '#ffcf4d' }}>+{stats.atk} ATK</span>
                <span style={{ color: '#7ec8ff' }}>+{stats.hpPct}% MAX HP</span>
              </div>
              <p className="mt-2 font-mono text-[9px] leading-relaxed" style={{ color: '#4e6b5e' }}>
                Outfits are cosmetic only — they never change these numbers.
              </p>
            </div>

            <button
              onClick={() => setTab('items')}
              className="w-full rounded font-mono text-[11px] font-bold uppercase tracking-[2px]"
              style={{ minHeight: 44, color: '#04140c', background: '#39ff9a', border: '2px solid #0a3d24' }}
            >
              Change gear ▸
            </button>
          </>
        )}

        {tab === 'items' && (
          <>
            {loading && <p className="py-8 text-center font-mono text-[11px] animate-pulse" style={{ color: '#5f8d78' }}>loading your items…</p>}

            {!loading && ownedItems.length === 0 && (
              <div className="rounded-lg border p-5 text-center" style={{ borderColor: 'rgba(255,255,255,.12)', background: 'rgba(10,24,18,.5)' }}>
                <p className="mb-1 font-mono text-sm" style={{ color: '#cfe9dc' }}>Your bag is empty</p>
                <p className="mb-4 font-mono text-[10px] leading-relaxed" style={{ color: '#5f8d78' }}>
                  You always carry the Rusty Blade, so you are never unarmed. Better gear comes from the Shop — or from Point you earn by burning loot.
                </p>
                <button
                  onClick={onMarketplace}
                  className="rounded font-mono text-[11px] font-bold uppercase tracking-[2px]"
                  style={{ minHeight: 44, padding: '0 20px', color: '#04140c', background: '#39ff9a', border: '2px solid #0a3d24' }}
                >
                  Open Shop ▸
                </button>
              </div>
            )}

            {!loading && ownedItems.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {ownedItems.map(item => {
                    const key = item.slot === 'mainhand' ? 'mainhand' : item.slot === 'body' ? 'body' : 'outfit'
                    const on = equipped[key] === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggle(item)}
                        disabled={busy !== null}
                        className="flex items-center gap-2 rounded-lg border p-2 text-left disabled:opacity-50"
                        style={{
                          minHeight: 60,
                          borderColor: on ? '#39ff9a' : 'rgba(255,255,255,.12)',
                          background: on ? 'rgba(57,255,154,.1)' : 'rgba(10,24,18,.6)',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.sprite} alt="" className="h-9 w-9 flex-shrink-0 [image-rendering:pixelated]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[10px] font-bold" style={{ color: '#e8fff4' }}>{item.name}</span>
                          <span className="block font-mono text-[9px]" style={{ color: on ? '#39ff9a' : '#5f8d78' }}>
                            {on ? '✓ Equipped' : busy === item.id ? '…' : 'Tap to equip'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={onMarketplace}
                  className="mt-3 w-full rounded border font-mono text-[11px] uppercase tracking-[2px]"
                  style={{ minHeight: 44, borderColor: '#2f6b50', color: '#8ea89d' }}
                >
                  Get more in the Shop ▸
                </button>
              </>
            )}

            {isGuest && !loading && (
              <p className="mt-3 font-mono text-[9px] leading-relaxed" style={{ color: '#5f8d78' }}>
                You are playing as a guest. Your gear is saved to this device — open NullState in MiniPay to keep it if you reinstall.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
