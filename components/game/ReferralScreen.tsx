'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GiPresent, GiCrossedSwords, GiGemNecklace, GiTicket } from 'react-icons/gi'
import { MARKETPLACE_ITEMS, type MarketplaceItem } from '@/lib/constants/marketplace'

// =============================================
// REFERRAL screen (growth blueprint 2A) — icon-first, zero-reading design:
// your code + share buttons up top, a progress ladder of tier cards below.
// Tier claims open a chip picker (same pattern as the Armory Trial picker).
//
// Tiers (server-enforced, one-time each — see /api/referrals):
//   1 ref   -> 1 weapon, 3-day trial
//   3 refs  -> 1 permanent skin + 3 weapons, 48h trials
//   10 refs -> 2 weapons, 7-day trials each
//   bonus   -> invitee's first buy/mint gifts the referrer a Season Pass
//              (handled automatically server-side)
// =============================================

interface ReferralScreenProps {
  onBack: () => void
  address?: string
}

interface TierState { at?: number }

const TIERS: { key: 't1' | 't3' | 't10'; refs: number; weapons: number; hours: number; skin: boolean; label: string }[] = [
  { key: 't1', refs: 1, weapons: 1, hours: 72, skin: false, label: '1 friend' },
  { key: 't3', refs: 3, weapons: 3, hours: 48, skin: true, label: '3 friends' },
  { key: 't10', refs: 10, weapons: 2, hours: 168, skin: false, label: '10 friends' },
]

export default function ReferralScreen({ onBack, address }: ReferralScreenProps) {
  const [code, setCode] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [claims, setClaims] = useState<Record<string, TierState>>({})
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  // chip-picker state for the tier currently being claimed
  const [claiming, setClaiming] = useState<'t1' | 't3' | 't10' | null>(null)
  const [pickWeapons, setPickWeapons] = useState<string[]>([])
  const [pickSkin, setPickSkin] = useState<string | null>(null)

  const weapons = useMemo(
    () => MARKETPLACE_ITEMS.filter(i => i.type === 'weapon' && !i.hidden) as MarketplaceItem[],
    []
  )
  const skins = useMemo(
    () => MARKETPLACE_ITEMS.filter(i => i.type === 'outfit' && !i.hidden && !('passOnly' in i && (i as { passOnly?: boolean }).passOnly)) as MarketplaceItem[],
    []
  )

  const load = useCallback(() => {
    if (!address) return
    fetch(`/api/referrals?wallet=${address}`)
      .then(r => r.json())
      .then(d => {
        if (d?.code) setCode(d.code)
        setCount(typeof d?.count === 'number' ? d.count : 0)
        setClaims(d?.claims ?? {})
      })
      .catch(() => { /* offline */ })
  }, [address])
  useEffect(() => { load() }, [load])

  const shareUrl = code && typeof window !== 'undefined' ? `${window.location.origin}/game?ref=${code}` : ''
  const shareText = `Join me in NULL_STATE — a dungeon crawler on MiniPay. Use my link and we both earn: ${shareUrl}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard unavailable */ }
  }

  const startClaim = (tier: 't1' | 't3' | 't10') => {
    setClaiming(tier)
    setPickWeapons([])
    setPickSkin(null)
    setMsg(null)
  }

  const submitClaim = async () => {
    if (!address || !claiming || busy) return
    const cfg = TIERS.find(t => t.key === claiming)!
    if (pickWeapons.length !== cfg.weapons || (cfg.skin && !pickSkin)) return
    setBusy(true)
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', wallet: address, tier: claiming, weaponIds: pickWeapons, skinId: pickSkin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Claim failed')
      setMsg({ text: 'Reward claimed — check the Marketplace for your gear.', kind: 'ok' })
      setClaiming(null)
      load()
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Claim failed', kind: 'err' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(10,7,4,0.97)] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-lg pb-16">
        <header className="mb-4 flex items-center justify-between border-b border-[#7a4f24]/40 pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[4px] text-[#c39a5f]">// NullState</p>
            <h1 className="font-mono text-2xl font-bold text-[#f2cd82]">REFERRAL</h1>
          </div>
          <button onClick={onBack}
            className="rounded border border-[#7a4f24] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[#c39a5f] hover:bg-[#7a4f24]/20">
            ◂ Back
          </button>
        </header>

        {/* your code + share */}
        <div className="mb-4 rounded-lg border border-[#e8bd6f]/60 bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-4 text-center">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[3px] text-[#9c7a4f]">Your code</p>
          <p className="mb-3 font-mono text-3xl font-bold tracking-[6px] text-[#f2cd82]">{code ?? '········'}</p>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank" rel="noreferrer"
              className="rounded bg-gradient-to-b from-[#4ade80] to-[#22b862] px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#062b13] no-underline transition hover:brightness-110"
            >
              WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join me in NULL_STATE — we both earn.')}`}
              target="_blank" rel="noreferrer"
              className="rounded bg-gradient-to-b from-[#5ac8ff] to-[#2f9de0] px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#062131] no-underline transition hover:brightness-110"
            >
              Telegram
            </a>
            <button
              onClick={copyLink}
              className="rounded border border-[#7a4f24] px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c39a5f] transition hover:bg-[#7a4f24]/20"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
          <p className="mt-3 font-mono text-[9px] leading-relaxed text-[#9c7a4f]">
            A friend counts once they clear Act 1 with your link. Bonus: their first weapon buy or pass mint
            gifts YOU a free Season Pass — automatically.
          </p>
        </div>

        {/* progress */}
        <div className="mb-4 rounded-lg border border-[#7a4f24]/50 bg-[#2b1a0d] px-4 py-3 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#9c7a4f]">Friends counted </span>
          <span className="font-mono text-xl font-bold text-[#7ef0a6]">{count}</span>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg border p-3 font-mono text-xs ${
            msg.kind === 'ok' ? 'border-[#4ade80]/50 bg-[#4ade80]/10 text-[#7ef0a6]' : 'border-[#e07a3a]/50 bg-[#e07a3a]/10 text-[#f0a878]'
          }`}>
            {msg.text}
          </div>
        )}

        {/* tier ladder */}
        <div className="flex flex-col gap-2">
          {TIERS.map(t => {
            const done = !!claims[t.key]
            const reached = count >= t.refs
            const Icon = t.skin ? GiGemNecklace : t.key === 't10' ? GiTicket : GiCrossedSwords
            const rewardText = t.skin
              ? `1 skin (permanent) + ${t.weapons} weapons · ${t.hours}h each`
              : `${t.weapons} weapon${t.weapons > 1 ? 's' : ''} · ${t.hours >= 24 ? `${t.hours / 24} day${t.hours / 24 > 1 ? 's' : ''}` : `${t.hours}h`} each`
            return (
              <div key={t.key} className={`rounded-lg border bg-gradient-to-b from-[#2b1a0d] to-[#1a0f06] p-3 ${reached && !done ? 'border-[#e8bd6f]' : 'border-[#7a4f24]/50'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-[#7a4f24]/50 bg-black/40 text-[#f2cd82]">
                    <Icon aria-hidden size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-bold text-[#f0dcb8]">{t.label}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[#c39a5f]">{rewardText}</div>
                  </div>
                  <div className="flex-shrink-0">
                    {done ? (
                      <span className="rounded border border-[#8a5a2b] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c39a5f]">Claimed</span>
                    ) : reached ? (
                      <button
                        onClick={() => startClaim(t.key)}
                        className="rounded bg-gradient-to-b from-[#4ade80] to-[#22b862] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#062b13] transition hover:brightness-110"
                      >
                        Claim
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] text-[#9c7a4f]">{count}/{t.refs}</span>
                    )}
                  </div>
                </div>

                {/* chip picker for this tier */}
                {claiming === t.key && !done && (
                  <div className="mt-3 border-t border-[#7a4f24]/40 pt-3">
                    <p className="mb-1.5 font-mono text-[10px] text-[#c39a5f]">
                      Pick {t.weapons} weapon{t.weapons > 1 ? 's' : ''}{t.skin ? ' + 1 skin' : ''}:
                    </p>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {weapons.map(w => {
                        const on = pickWeapons.includes(w.id)
                        return (
                          <button key={w.id}
                            onClick={() => setPickWeapons(prev => on ? prev.filter(x => x !== w.id) : prev.length >= t.weapons ? prev : [...prev, w.id])}
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition ${
                              on ? 'border-[#e8bd6f] bg-[#e8bd6f]/15 text-[#f2cd82]' : 'border-[#7a4f24]/60 text-[#c39a5f] hover:border-[#8a5a2b]'
                            }`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={w.sprite} alt="" className="h-4 w-4 [image-rendering:pixelated]" />
                            {w.name}
                          </button>
                        )
                      })}
                    </div>
                    {t.skin && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {skins.map(sk => (
                          <button key={sk.id}
                            onClick={() => setPickSkin(pickSkin === sk.id ? null : sk.id)}
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition ${
                              pickSkin === sk.id ? 'border-[#a970ff] bg-[#a970ff]/15 text-[#e6d8ff]' : 'border-[#7a4f24]/60 text-[#c39a5f] hover:border-[#8a5a2b]'
                            }`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={sk.sprite} alt="" className="h-4 w-4 [image-rendering:pixelated]" />
                            {sk.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={submitClaim}
                      disabled={busy || pickWeapons.length !== t.weapons || (t.skin && !pickSkin)}
                      className="w-full rounded bg-gradient-to-b from-[#e8bd6f] to-[#c9962f] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#2a1705] transition hover:brightness-110 disabled:opacity-40"
                    >
                      {busy ? '…' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* pass bonus explainer card */}
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#a970ff]/40 bg-gradient-to-b from-[#241a2e] to-[#140d1c] p-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-[#7a4f24]/40 bg-black/40 text-[#c9a6ff]">
            <GiPresent aria-hidden size={19} />
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-[#c9a6ff]">
            When any friend you invited makes their first weapon purchase or mints a Season Pass, a free
            Season Pass is minted straight to your wallet. No claim needed.
          </p>
        </div>
      </div>
    </div>
  )
}
