'use client'

import { useEffect } from 'react'
import { useWallet } from '@/lib/WalletProvider'
import { recordRunKills, recordRunProgress } from '@/lib/leaderboardService'
import { PlayerProfile } from '@/lib/contract'
import DungeonGame from './DungeonGame'

interface DungeonGameWrapperProps {
  playerProfile: PlayerProfile | null
  setPlayerUsername: (username: string) => Promise<{ success: boolean; username: string }>
  // True when this run was entered via "New Game" rather than "Continue" —
  // passed straight through to DungeonGame so its mount effect knows to
  // skip loading (and to discard) any saved bunker session. See
  // GameFlowManager.tsx's handleNewGame/handleContinueGame.
  isNewRun?: boolean
  // Which run the Main Menu chose — threaded to DungeonGame -> engine mount so
  // it starts straight into that mode (no canvas title/preview).
  startMode?: 'new' | 'continue' | 'cycle' | 'abyss' | 'raid'
  /** Which bunker a raid targets; null for every other mode. */
  raidActIndex?: number | null
}

/**
 * DungeonGameWrapper
 *
 * Wraps DungeonGame and hooks into game events that need to reach outside
 * the vanilla-JS engine:
 *  - 'nullstate-player-death': fold this life's kill count into the
 *    off-chain Firestore leaderboard (recordRunKills is dedup-safe, see
 *    leaderboardService.ts), AND sync xp/level the same way via
 *    recordRunProgress — the event already carries xp/level (game.js sets
 *    them in the CustomEvent detail), they just weren't being read before.
 *    This is intentionally FREE — it does NOT call
 *    useContractPlayer/executeAction on-chain. Automatic on-death syncing
 *    must never cost the player gas; on-chain writes only ever happen from
 *    an explicit player action (NULL_STRIKE fee, manual claim, etc).
 *  - 'nullstate-items-burned': forward the burn payload to the backend so
 *    it can validate it and record it (Firestore + on-chain recordBurn via
 *    the backend signer — see app/api/burn/record/route.ts).
 */
export default function DungeonGameWrapper({ playerProfile, setPlayerUsername, isNewRun, startMode, raidActIndex }: DungeonGameWrapperProps) {
  const { address, isGuest } = useWallet()

  useEffect(() => {
    const handleGameDeath = (event: Event) => {
      const { xp, level, kills } = (event as CustomEvent).detail ?? {}
      if (!address) return
      // Guests play + save but never enter the public leaderboard.
      if (isGuest) return
      if (typeof kills === 'number') {
        recordRunKills(address, kills).catch(err => {
          console.error('[nullstate-player-death] failed to record kills:', err)
        })
      }
      if (typeof xp === 'number' && typeof level === 'number') {
        recordRunProgress(address, xp, level).catch(err => {
          console.error('[nullstate-player-death] failed to record xp/level:', err)
        })
      }
    }
    window.addEventListener('nullstate-player-death', handleGameDeath)
    return () => window.removeEventListener('nullstate-player-death', handleGameDeath)
  }, [address, isGuest])

  useEffect(() => {
    const handleBurn = async (event: Event) => {
      const detail = (event as CustomEvent).detail
      try {
        await fetch('/api/burn/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(detail),
        })
      } catch (err) {
        console.error('[nullstate-items-burned] failed to record burn:', err)
      }
    }
    window.addEventListener('nullstate-items-burned', handleBurn)
    return () => window.removeEventListener('nullstate-items-burned', handleBurn)
  }, [])

  return (
    <DungeonGame playerProfile={playerProfile} setPlayerUsername={setPlayerUsername} isNewRun={isNewRun} startMode={startMode} raidActIndex={raidActIndex} />
  )
}
