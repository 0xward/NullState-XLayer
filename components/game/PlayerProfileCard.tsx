'use client'

import { useEffect, useState } from 'react'
import { usePassSBT } from '@/hooks/usePassSBT'
import { useWallet } from '@/lib/WalletProvider'
import { maskAddress } from '@/lib/addressMask'

type ProfileResponse = {
  profile: {
    walletAddress: string
    nickname?: string
    joinedAt?: number | null
    currentSeasonId?: number
    inventory?: {
      health?: number
      mana?: number
      items?: Record<string, number>
    }
    stats?: {
      totalBurns?: number
      totalRewards?: number
      vaultAttempts?: number
    }
  }
  summary?: {
    totalBurnEvents: number
    weeklyRewardEntries: number
    seasonBonusEntries: number
  }
}

interface PlayerProfileCardProps {
  walletAddress?: string
}

export default function PlayerProfileCard({ walletAddress: walletAddressProp }: PlayerProfileCardProps) {
  // /profile renders this with no prop, and nothing else ever set one — so the
  // card sat on "Connect wallet to load profile." forever, which is both a dead
  // page and the exact copy MiniPay's zero-click-connect rule forbids. The
  // address now comes from the wallet the route already provides (app/profile
  // /layout.tsx wraps this in Web3Providers); the prop still wins when given.
  const wallet = useWallet()

  // The address is only read AFTER mount. useWallet() falls back to a guest
  // address held in localStorage, which does not exist while Next prerenders
  // this route (it is a static page) — so reading it during the first render
  // makes the server HTML and the first client render disagree, and React
  // throws a hydration mismatch (#418). Deferring one tick means both sides
  // start from the same "still resolving" state and the address arrives in the
  // commit that follows.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const walletAddress = walletAddressProp ?? (mounted ? wallet.address ?? undefined : undefined)
  const walletReady = mounted && wallet.walletReady

  const { hasPass, passSeasonId, isLoading: passLoading } = usePassSBT(walletAddress)
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setData(null)
      return
    }

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/player/profile?walletAddress=${walletAddress}`)
        const payload = await res.json()
        if (!res.ok) throw new Error(payload.error ?? 'Failed to load player profile')
        setData(payload)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [walletAddress])

  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.15)] bg-black/40 p-5">
      <h2 className="font-mono text-sm uppercase tracking-[2px] text-null-white">Player Profile</h2>

      {/* Never "Connect wallet" — inside MiniPay the address resolves on its
          own, so that copy would only ever be wrong there. Until the wallet has
          finished resolving this is honestly still loading; once it has and
          there is no address, the actionable next step is to open the game. */}
      {!walletAddress && !walletReady && (
        <p className="mt-3 text-sm text-null-muted">Loading profile...</p>
      )}
      {!walletAddress && walletReady && (
        <p className="mt-3 text-sm text-null-muted">
          No profile yet —{' '}
          <a href="/game" className="text-null-green underline underline-offset-2">
            start playing
          </a>{' '}
          to create one.
        </p>
      )}
      {walletAddress && (isLoading || passLoading) && (
        <p className="mt-3 text-sm text-null-muted">Loading profile...</p>
      )}
      {error && <p className="mt-3 text-sm text-null-red">{error}</p>}

      {data && (
        <div className="mt-4 space-y-2 text-sm text-null-muted">
          <p>
            <span className="text-null-white">Name:</span>{' '}
            {data.profile.nickname ?? maskAddress(data.profile.walletAddress)}
          </p>
          {/* Masked, and secondary to the name — MiniPay's phone-first identity
              rule bans a raw 0x… as the primary identifier. This printed the
              full address until now. */}
          <p>
            <span className="text-null-white">Wallet:</span> {maskAddress(data.profile.walletAddress)}
          </p>
          <p>
            <span className="text-null-white">Season:</span> {data.profile.currentSeasonId ?? '-'}
          </p>
          <p>
            <span className="text-null-white">Pass:</span>{' '}
            {passLoading ? (
              '…'
            ) : hasPass ? (
              // TASK #7 — pass-holder emblem (cosmetic flair). The acid-green
              // ◆ badge matches the in-game HUD emblem and the exclusive skin.
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-null-green"
                style={{
                  border: '1px solid rgba(0,255,136,0.5)',
                  background: 'rgba(0,255,136,0.08)',
                  textShadow: '0 0 6px rgba(0,255,136,0.6)',
                }}
              >
                ◆ Active · Season {passSeasonId.toString()}
              </span>
            ) : (
              'Inactive'
            )}
          </p>
          <p>
            <span className="text-null-white">Inventory:</span>{' '}
            HP {data.profile.inventory?.health ?? 0} · Mana {data.profile.inventory?.mana ?? 0}
          </p>
          <p>
            <span className="text-null-white">Items:</span> {Object.keys(data.profile.inventory?.items ?? {}).length}
          </p>
          <p>
            <span className="text-null-white">Burn events:</span> {data.summary?.totalBurnEvents ?? 0}
          </p>
        </div>
      )}
    </section>
  )
}
