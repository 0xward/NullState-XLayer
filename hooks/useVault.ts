'use client'

import { useState, useEffect, useCallback } from 'react'
import { TREASURE_VAULT_ADDRESS, TREASURE_VAULT_ABI } from '@/lib/contract-abi'
import { getISOWeekId } from '@/lib/web3-client'
import { validateVaultCode } from '@/lib/vault-utils'
import { useWallet } from '@/lib/WalletProvider'

export interface VaultPoolStats {
  deposited: bigint
  claimed: bigint
  available: bigint
}

export function isVaultCodeSubmittable(code: string): boolean {
  return validateVaultCode(code)
}

export function useVault(walletAddress: string | undefined) {
  // From the wallet bridge, not wagmi's hooks. wagmi mounts BESIDE the app
  // rather than around it (lib/walletBridge.tsx), so this hook is not inside
  // WagmiProvider and calling usePublicClient()/useWalletClient() here throws
  // WagmiProviderNotFoundError — which is exactly what it did: opening Rewards
  // in MiniPay died with "a client-side exception has occurred". Both are null
  // until wagmi has loaded, and every path below already guards on that.
  const { publicClient } = useWallet()

  const [remainingAttempts, setRemainingAttempts] = useState<number>(3)
  const [hasClaimed, setHasClaimed] = useState<boolean>(false)
  const [isLocked, setIsLocked] = useState<boolean>(false)
  const [poolStats, setPoolStats] = useState<VaultPoolStats | null>(null)
  const [isCodeSet, setIsCodeSet] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentWeekId = BigInt(getISOWeekId())

  const fetchVaultStatus = useCallback(async () => {
    if (
      !walletAddress ||
      !publicClient ||
      !TREASURE_VAULT_ADDRESS ||
      TREASURE_VAULT_ADDRESS === '0x'
    )
      return

    setIsLoading(true)
    setError(null)

    try {
      const [attempts, claimed, locked, stats, codeSet] = await Promise.all([
        publicClient.readContract({
          address: TREASURE_VAULT_ADDRESS,
          abi: TREASURE_VAULT_ABI,
          functionName: 'getRemainingAttempts',
          args: [walletAddress as `0x${string}`, currentWeekId],
        }),
        publicClient.readContract({
          address: TREASURE_VAULT_ADDRESS,
          abi: TREASURE_VAULT_ABI,
          functionName: 'hasClaimedThisWeek',
          args: [walletAddress as `0x${string}`, currentWeekId],
        }),
        publicClient.readContract({
          address: TREASURE_VAULT_ADDRESS,
          abi: TREASURE_VAULT_ABI,
          functionName: 'isLockedThisWeek',
          args: [walletAddress as `0x${string}`, currentWeekId],
        }),
        publicClient.readContract({
          address: TREASURE_VAULT_ADDRESS,
          abi: TREASURE_VAULT_ABI,
          functionName: 'getVaultPoolStats',
        }),
        publicClient.readContract({
          address: TREASURE_VAULT_ADDRESS,
          abi: TREASURE_VAULT_ABI,
          functionName: 'isCodeSetForWeek',
          args: [currentWeekId],
        }),
      ])

      setRemainingAttempts(Number(attempts as bigint))
      setHasClaimed(claimed as boolean)
      setIsLocked(locked as boolean)

      const [deposited, claimedAmt, available] = stats as [bigint, bigint, bigint]
      setPoolStats({ deposited, claimed: claimedAmt, available })

      setIsCodeSet(codeSet as boolean)
    } catch (err) {
      console.error('[useVault] fetchVaultStatus error:', err)
      setError((err as Error)?.message ?? 'Failed to fetch vault status')
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress, publicClient, currentWeekId])

  /**
   * Submit vault code via the backend API route.
   * The contract's submitVaultCode() is backend-only (onlyBackend modifier),
   * so the frontend sends the code to /api/vault/submit which calls the contract.
   */
  const submitVaultCode = useCallback(
    async (code: string): Promise<{ success: boolean; message: string }> => {
      if (!walletAddress) throw new Error('Wallet not connected')
      if (hasClaimed) throw new Error('Already claimed this week')
      if (isLocked) throw new Error('Locked — too many failed attempts')
      if (remainingAttempts <= 0) throw new Error('No attempts remaining')

      setIsLoading(true)
      setError(null)

      try {
        if (!validateVaultCode(code)) {
          throw new Error('Code must be 4 digits')
        }

        const res = await fetch('/api/vault/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            weekId: currentWeekId.toString(),
            code,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error ?? 'Vault submission failed')
        }

        // Refresh vault state after submission
        await fetchVaultStatus()
        return { success: data.isCorrect, message: data.message }
      } catch (err) {
        const message = (err as Error)?.message ?? 'Vault submission failed'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [walletAddress, hasClaimed, isLocked, remainingAttempts, currentWeekId, fetchVaultStatus],
  )

  useEffect(() => {
    if (walletAddress) fetchVaultStatus()
  }, [walletAddress, fetchVaultStatus])

  return {
    remainingAttempts,
    hasClaimed,
    isLocked,
    poolStats,
    isCodeSet,
    currentWeekId,
    isLoading,
    error,
    fetchVaultStatus,
    submitVaultCode,
  }
}
