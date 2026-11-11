'use client'

import { useState, useEffect, useCallback } from 'react'
import { REWARD_CONTRACT_ADDRESS, REWARD_ABI } from '@/lib/contract-abi'
import { getCurrentSeasonId } from '@/lib/web3-client'
import { pickBestFeeCurrency } from '@/lib/constants/tokens'
import { getAttributionSuffix } from '@/lib/attribution-tag'
import { useWallet } from '@/lib/WalletProvider'

export interface SeasonLeaderboard {
  seasonId: bigint
  topPlayers: [`0x${string}`, `0x${string}`, `0x${string}`]
  topScores: [bigint, bigint, bigint]
  rewardToken: `0x${string}`
  totalDeposited: bigint
  deposited: boolean
  finalized: boolean
  updatedAt: bigint
}

// NOTE: the on-chain "weekly burn pool" reward (claimWeeklyRewards /
// getUserWeeklyBurn) was retired in Phase 5.5 #8 — burning now credits
// off-chain NullState Point instantly, with no claim step, so that pool is
// never funded and the claim never fires. All of that dead weekly-claim code
// has been removed from this hook. The real weekly reward is the Treasure
// Vault (paid instantly on a correct code — see hooks/useVault.ts). Season
// bonus (below) remains the on-chain claim this hook still serves.
export function useReward(walletAddress: string | undefined) {
  // From the wallet bridge, not wagmi's hooks. wagmi mounts BESIDE the app
  // rather than around it (lib/walletBridge.tsx), so this hook is not inside
  // WagmiProvider and calling usePublicClient()/useWalletClient() here throws
  // WagmiProviderNotFoundError — which is exactly what it did: opening Rewards
  // in MiniPay died with "a client-side exception has occurred". Both are null
  // until wagmi has loaded, and every path below already guards on that.
  const { publicClient, walletClient, wrongNetwork } = useWallet()

  const [seasonLeaderboard, setSeasonLeaderboard] = useState<SeasonLeaderboard | null>(null)
  const [hasClaimedSeasonBonus, setHasClaimedSeasonBonus] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentSeason = BigInt(getCurrentSeasonId())

  const fetchSeasonLeaderboard = useCallback(
    async (seasonId?: bigint): Promise<SeasonLeaderboard | null> => {
      if (!publicClient || !REWARD_CONTRACT_ADDRESS || REWARD_CONTRACT_ADDRESS === '0x')
        return null

      const id = seasonId ?? currentSeason
      try {
        const result = await publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'getSeasonLeaderboard',
          args: [id],
        })
        const lb = result as SeasonLeaderboard
        setSeasonLeaderboard(lb)
        return lb
      } catch (err) {
        console.error('[useReward] fetchSeasonLeaderboard error:', err)
        return null
      }
    },
    [publicClient, currentSeason],
  )

  const checkSeasonBonusClaimed = useCallback(
    async (seasonId?: bigint): Promise<boolean> => {
      if (
        !walletAddress ||
        !publicClient ||
        !REWARD_CONTRACT_ADDRESS ||
        REWARD_CONTRACT_ADDRESS === '0x'
      )
        return false

      const id = seasonId ?? currentSeason
      try {
        const result = await publicClient.readContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'hasClaimedSeasonBonus',
          args: [walletAddress as `0x${string}`, id],
        })
        setHasClaimedSeasonBonus(result as boolean)
        return result as boolean
      } catch (err) {
        console.error('[useReward] checkSeasonBonusClaimed error:', err)
        return false
      }
    },
    [walletAddress, publicClient, currentSeason],
  )

  const claimSeasonBonus = useCallback(
    async (seasonId?: bigint): Promise<{ success: boolean; hash: `0x${string}` }> => {
      // `account` is narrower on viem's generic WalletClient than on the one
      // wagmi's useWalletClient() returned, so it is checked here rather than
      // asserted — a client with no account cannot sign anyway.
      // Same wrong-chain trap as the pass mint: on any chain but Celo the
      // wallet client is undefined and this used to blame the connection.
      if (wrongNetwork) {
        throw new Error('Wrong network — NullState runs on Celo. Switch your wallet to Celo and try again.')
      }
      if (!walletClient?.account || !publicClient) throw new Error('Wallet not connected')
      const account = walletClient.account

      setIsLoading(true)
      setError(null)

      try {
        const id = seasonId ?? currentSeason
        const feeCurrency = await pickBestFeeCurrency(publicClient, account.address)
        const hash = await walletClient.writeContract({
          address: REWARD_CONTRACT_ADDRESS,
          abi: REWARD_ABI,
          functionName: 'claimSeasonBonus',
          args: [id],
          account,
          feeCurrency,
          dataSuffix: getAttributionSuffix(),
        })

        await publicClient.waitForTransactionReceipt({ hash })
        await checkSeasonBonusClaimed(id)
        return { success: true, hash }
      } catch (err) {
        const message = (err as Error)?.message ?? 'Failed to claim season bonus'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletClient, publicClient, currentSeason, checkSeasonBonusClaimed, wrongNetwork],
  )

  useEffect(() => {
    if (walletAddress) {
      fetchSeasonLeaderboard()
      checkSeasonBonusClaimed()
    }
  }, [walletAddress, fetchSeasonLeaderboard, checkSeasonBonusClaimed])

  return {
    seasonLeaderboard,
    hasClaimedSeasonBonus,
    currentSeason,
    isLoading,
    error,
    fetchSeasonLeaderboard,
    checkSeasonBonusClaimed,
    claimSeasonBonus,
  }
}
