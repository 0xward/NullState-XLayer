# Frontend Integration Guide

## Overview

NullState uses **wagmi v2 + RainbowKit** for wallet connectivity and **viem** for
contract reads/writes on Celo Mainnet (chainId 42220).

---

## 1. Environment Variables

Copy `.env.example` and fill in:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS` | PassSBT deployed address |
| `NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS` | NullStateReward deployed address |
| `NEXT_PUBLIC_TREASURE_VAULT_ADDRESS` | TreasureVault deployed address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |

---

## 2. Contract Integration Files

| File | Purpose |
|---|---|
| `lib/contract-abi.ts` | Full ABIs + contract addresses for all 3 contracts |
| `lib/web3-client.ts` | Viem public client + week/season ID helpers |
| `hooks/usePassSBT.ts` | React hook for PassSBT interactions |
| `hooks/useReward.ts` | React hook for NullStateReward (burn rewards + leaderboard) |
| `hooks/useVault.ts` | React hook for TreasureVault quest status |

---

## 3. Hook Usage

### PassSBT — Season Pass

```tsx
import { usePassSBT } from '@/hooks/usePassSBT'

function PassPanel({ address }: { address: string }) {
  const {
    hasPass,
    passSeasonId,
    isWhitelisted,
    isLoading,
    mintFreePass,
    mintPaidPass,
    getSeasonInfo,
    checkWhitelist,
  } = usePassSBT(address)

  const seasonId = 202607n  // July 2026

  return (
    <div>
      {hasPass ? (
        <p>✅ Pass active — Season {passSeasonId.toString()}</p>
      ) : (
        <>
          {isWhitelisted && (
            <button onClick={() => mintFreePass(seasonId)}>
              Mint Free Pass
            </button>
          )}
          <button onClick={() => mintPaidPass(seasonId)}>
            Mint Paid Pass (0.3 USDm)
          </button>
        </>
      )}
    </div>
  )
}
```

> **Note:** Before calling `mintPaidPass`, the user must first approve 0.3 USDm
> on the USDm token contract (`0x765DE816845861e75A25fCA122bb6898B8B1282a`).

### NullStateReward — Burn Rewards & Leaderboard

```tsx
import { useReward } from '@/hooks/useReward'
import { formatUnits } from 'viem'

function RewardPanel({ address }: { address: string }) {
  const {
    weeklyBurnAmount,
    weeklyClaimable,
    seasonLeaderboard,
    hasClaimedSeasonBonus,
    currentWeek,
    currentSeason,
    claimWeeklyRewards,
    claimSeasonBonus,
    fetchSeasonLeaderboard,
  } = useReward(address)

  return (
    <div>
      <p>Weekly burn: {formatUnits(weeklyBurnAmount, 18)} USDm</p>
      <p>Claimable: {formatUnits(weeklyClaimable, 18)} USDm</p>

      {weeklyClaimable > 0n && (
        <button onClick={() => claimWeeklyRewards()}>
          Claim Weekly Rewards
        </button>
      )}

      {seasonLeaderboard && !hasClaimedSeasonBonus &&
        seasonLeaderboard.topPlayers.includes(address as `0x${string}`) && (
        <button onClick={() => claimSeasonBonus()}>
          Claim Season Bonus 🏆
        </button>
      )}
    </div>
  )
}
```

### TreasureVault — Quest Status

```tsx
import { useVault } from '@/hooks/useVault'

function VaultPanel({ address }: { address: string }) {
  const {
    remainingAttempts,
    hasClaimed,
    isLocked,
    poolStats,
    isCodeSet,
    submitVaultCode,
  } = useVault(address)

  const handleSubmit = async (code: string) => {
    const result = await submitVaultCode(code)
    if (result.success) {
      alert('🎉 Vault opened! 1 USDm claimed.')
    } else {
      alert(`❌ Wrong code. ${remainingAttempts - 1} attempts left.`)
    }
  }

  if (hasClaimed) return <p>✅ Vault claimed this week</p>
  if (isLocked) return <p>🔒 Locked — try again next week</p>
  if (!isCodeSet) return <p>⏳ Vault code not yet set for this week</p>

  return (
    <div>
      <p>Attempts remaining: {remainingAttempts} / 3</p>
      {poolStats && (
        <p>Pool available: {poolStats.available.toString()} wei</p>
      )}
      {/* 4-digit code input UI */}
    </div>
  )
}
```

---

## 4. Vault Code Submission API Route

`useVault.submitVaultCode()` calls `/api/vault/submit` (POST).
Create this route at `app/api/vault/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

const VAULT_ABI = [
  'function submitVaultCode(address _user, uint256 _weekId, string calldata _code) external',
]

export async function POST(req: NextRequest) {
  const { walletAddress, weekId, code } = await req.json()

  try {
    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL)
    const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY!, provider)
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_TREASURE_VAULT_ADDRESS!,
      VAULT_ABI,
      wallet,
    )

    const tx = await contract.submitVaultCode(walletAddress, BigInt(weekId), code)
    await tx.wait(1)

    return NextResponse.json({ correct: true, message: '🎉 Vault opened!' })
  } catch (err: any) {
    if (err.message?.includes('wrong')) {
      return NextResponse.json({ correct: false, message: 'Wrong code' }, { status: 200 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

Add `BACKEND_PRIVATE_KEY` and `CELO_RPC_URL` to Vercel environment variables
(server-side only, **not** prefixed with `NEXT_PUBLIC_`).

---

## 5. USDm Token Approval (for mintPaidPass)

Before minting a paid pass, the user's wallet must approve the PassSBT contract
to spend 0.3 USDm on their behalf:

```typescript
import { useWalletClient, usePublicClient } from 'wagmi'

const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

const USDM_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a'
const PASS_PRICE = 300000000000000000n // 0.3 USDm in wei

const hash = await walletClient.writeContract({
  address: USDM_ADDRESS,
  abi: ERC20_APPROVE_ABI,
  functionName: 'approve',
  args: [PASS_SBT_ADDRESS, PASS_PRICE],
  account: walletClient.account,
})
await publicClient.waitForTransactionReceipt({ hash })
// Then call mintPaidPass()
```

---

## 6. Season IDs Reference

| Season | ID | Start (UTC) | End (UTC) |
|--------|-----|-------------|-----------|
| July 2026 | `202607` | 2026-07-01 | 2026-07-31 |
| August 2026 | `202608` | 2026-08-01 | 2026-08-31 |
| September 2026 | `202609` | 2026-09-01 | 2026-09-30 |
| October 2026 | `202610` | 2026-10-01 | 2026-10-31 |
| November 2026 | `202611` | 2026-11-01 | 2026-11-30 |
| December 2026 | `202612` | 2026-12-01 | 2026-12-31 |

---

## 7. Network Details

| Property | Value |
|---|---|
| Network | Celo Mainnet |
| Chain ID | `42220` |
| RPC | `https://forno.celo.org` |
| Explorer | `https://celoscan.io` |
| USDm Token | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
