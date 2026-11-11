// Hook for player persistence.
//
// Phase 0: player identity and progress are now FULLY OFF-CHAIN. There is no
// on-chain register()/getPlayer() anymore — a player exists the moment they
// hold a Firebase username. XP, level and kills live in Firestore
// (leaderboardService). Only reward payouts touch the chain, elsewhere.

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  PlayerProfile,
  LeaderboardEntry,
} from '@/lib/contract'
import {
  getOrCreateUsername,
  setUsername,
  isUsernameAvailable,
} from '@/lib/usernameService'
import { updateLeaderboardEntry, getLeaderboard, getLeaderboardEntry } from '@/lib/leaderboardService'
import { readCachedProfile, writeCachedProfile } from '@/lib/profileCache'

/**
 * The fast path: one same-origin GET. Returns null (not a throw) on any
 * failure, so the caller falls through to the SDK rather than showing an error
 * for something the player cannot act on.
 */
async function fetchIdentity(walletAddress: string): Promise<PlayerProfile | null> {
  try {
    const r = await fetch(`/api/player/identity?wallet=${walletAddress}`)
    if (!r.ok) return null
    const d = await r.json()
    if (!d?.username) return null
    return {
      walletAddress,
      username: d.username,
      xp: d.xp ?? 0,
      level: d.level ?? 1,
      kills: d.kills ?? 0,
      // Off-chain: holding a Firebase username IS being registered.
      isRegistered: true,
    }
  } catch {
    return null
  }
}

/**
 * The old path, kept for when the server has no Firebase credentials. Both
 * documents are read in parallel — nothing in the leaderboard entry depends on
 * the username — and allSettled rather than all, because a missing leaderboard
 * entry is normal for a brand-new wallet and must not take the name down with
 * it.
 */
async function fetchViaSdk(walletAddress: string): Promise<PlayerProfile> {
  const [nameRes, entryRes] = await Promise.allSettled([
    getOrCreateUsername(walletAddress),          // auto-assigns if new
    getLeaderboardEntry(walletAddress),          // xp/level/kills, all off-chain now
  ])
  if (nameRes.status === 'rejected') throw nameRes.reason
  const liveEntry = entryRes.status === 'fulfilled' ? entryRes.value : null
  return {
    walletAddress,
    username: nameRes.value.username,
    xp: liveEntry?.xp ?? 0,
    level: liveEntry?.level ?? 1,
    kills: liveEntry?.totalKills ?? 0,
    isRegistered: true,
  }
}

export function useContractPlayer(walletAddress: string | undefined) {
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Distinguishes "we have not looked yet" from "we looked and there is
  // nothing". Without it the two are both `playerProfile === null`, and a
  // consumer cannot tell whether to show a placeholder or commit to the
  // anonymous fallback. Starts false on the server AND on the client's first
  // render, which is what lets the hub render the same thing in both and
  // hydrate cleanly.
  const [profileSettled, setProfileSettled] = useState(false)

  // Fetch player profile from Firebase (username + live leaderboard stats).
  const fetchPlayerProfile = useCallback(async () => {
    if (!walletAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // ONE SAME-ORIGIN REQUEST, not the Firestore SDK. This is what finally
      // took the player's name off the critical path. The client SDK had to
      // download, boot, and complete a WebChannel handshake with
      // firestore.googleapis.com before it could answer "what is my name" —
      // 7,450ms of LCP render delay by PageSpeed's measure, on a page where
      // everything else was already drawn. /api/player/identity reads the same
      // two documents with the Admin SDK, over a connection the browser
      // already has open for the page itself.
      //
      // The SDK path below is kept as a fallback for the case where the server
      // has no Firebase credentials: then this is merely slow again, rather
      // than broken.
      const profile = await fetchIdentity(walletAddress) ?? await fetchViaSdk(walletAddress)

      setPlayerProfile(profile)
      writeCachedProfile(profile)
      const username = profile.username

      // Keep the leaderboard entry fresh (username/xp/level). Deliberately does
      // NOT pass kills — that figure is maintained separately by
      // recordRunKills() (see leaderboardService.ts).
      updateLeaderboardEntry(walletAddress, username, profile.xp, profile.level)
    } catch (err) {
      console.error('[v0] Failed to fetch player profile:', err)
      // Only blank the profile if there is no cached one to fall back on.
      // Offline or a Firestore hiccup should not turn a returning player back
      // into an anonymous WALKER.
      setPlayerProfile((prev) => prev ?? readCachedProfile(walletAddress))
    } finally {
      setIsLoading(false)
      // Settled on failure too — a fetch that errored has still answered the
      // only question the UI is asking, which is whether to keep waiting.
      // Leaving this false on the error path would strand the placeholder on
      // screen forever.
      setProfileSettled(true)
    }
  }, [walletAddress])

  // Paint the last known profile FIRST, then refresh it. This is what removes
  // the name from the critical path: the plate shows the real player instantly
  // and the fetch below quietly agrees with it a moment later.
  useEffect(() => {
    if (!walletAddress) { setPlayerProfile(null); return }
    const cached = readCachedProfile(walletAddress)
    if (cached) setPlayerProfile(cached)
    fetchPlayerProfile()
  }, [walletAddress, fetchPlayerProfile])

  // Set player username (Firebase only, no gas)
  const setPlayerUsername = useCallback(
    async (username: string) => {
      if (!walletAddress) throw new Error('Wallet not connected')

      setIsLoading(true)
      setError(null)

      try {
        const available = await isUsernameAvailable(username, walletAddress)
        if (!available) {
          throw new Error('Username already taken')
        }

        const savedUsername = await setUsername(walletAddress, username, false)

        setPlayerProfile((prev) => {
          const next: PlayerProfile = prev
            ? { ...prev, username: savedUsername }
            : {
                walletAddress,
                username: savedUsername,
                xp: 0,
                level: 1,
                kills: 0,
                isRegistered: true,
              }
          // Keep the cache honest, or the next load paints the OLD name for a
          // moment before the fetch corrects it — worse than no cache at all.
          writeCachedProfile(next)
          return next
        })

        return { success: true, username: savedUsername }
      } catch (err) {
        const message = (err as any)?.message || 'Failed to set username'
        setError(message)
        console.error('[v0] Set username error:', err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletAddress]
  )

  // Leaderboard is read straight from Firestore (see leaderboardService.ts).
  // Entries are kept fresh by updateLeaderboardEntry(), called from
  // fetchPlayerProfile() and from recordRunProgress()/recordRunKills().
  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    return getLeaderboard(100)
  }, [])

  return {
    playerProfile,
    isLoading,
    profileSettled,
    error,
    fetchPlayerProfile,
    setPlayerUsername,
    fetchLeaderboard,
  }
}
