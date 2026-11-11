import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { vaultSubmitBodySchema } from '@/lib/validation'
import {
  getAttemptsRemaining,
  parseWeekId,
  normalizeWalletAddress,
} from '@/lib/vault-utils'
import {
  storeThenPay,
  VAULT_FAILURE_MESSAGE,
  type VaultPayoutFailure,
} from '@/lib/server/vaultChain'

// Headroom for the on-chain payout to confirm inside the request. It is now
// normally ONE write (lib/server/vaultChain.ts explains why), but a payout that
// waits for a Celo receipt still needs more than Vercel's 10s default — that
// default is what killed the request after the code was stored and before
// submitVaultCode was ever broadcast.
export const maxDuration = 60

// `amount`/`token` are what was ACTUALLY paid, read back off the vault contract
// straight after the transfer. They were already being computed and written to
// vaultCompleted for the Rewards history — and then thrown away instead of
// returned, so the one screen where the money moves could not name it. The
// player saw "Reward sent to your wallet", with no figure and no currency, for
// 1.4 seconds. See openVaultWinPopup() in game.js.
type PayoutResult = {
  rewardStatus: 'paid' | 'pending'
  txHash: string | null
  amount?: number
  token?: string
  // WHY a pending result now carries a reason. The popup used to print one
  // sentence for every failure alike — "the transfer completes as soon as the
  // reward pool is topped up" — and the server had never looked at the pool.
  // On the week this was measured the pool held 0.85 USDT against a 0.05
  // reward and the real fault was a dropped RPC broadcast; that sentence cost
  // the owner, and then an agent, an hour of looking at treasury balances. See
  // VAULT_FAILURE_MESSAGE in lib/server/vaultChain.ts.
  reason?: VaultPayoutFailure
  message?: string
}

// Best-effort on-chain finalize. NEVER throws — a failure here leaves the
// reward `pending`, it never turns a correct code into an error.
//
// All the on-chain reasoning moved to lib/server/vaultChain.ts. What is left
// here is the Firebase side: stamp what was paid, or record WHY it was not so
// the daily sweep and the player see the same, true reason.
async function finalizeVaultPayout(params: {
  weekId: number
  walletAddress: string
  normalizedWallet: string
  expectedCode: string
  db: NonNullable<ReturnType<typeof getAdminDb>>
}): Promise<PayoutResult> {
  const { weekId, walletAddress, normalizedWallet, expectedCode, db } = params

  const result = await storeThenPay({ weekId, walletAddress, expectedCode })

  if (result.ok) {
    await db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).update({
      txHash: result.txHash,
      ...(result.amount !== undefined ? { amount: result.amount, token: result.token } : {}),
      // Clear any reason left by an earlier failed attempt — a paid reward that
      // still carries "pool_empty" is how a fixed problem keeps being reported.
      pendingReason: null,
      pendingDetail: null,
    })
    return { rewardStatus: 'paid', txHash: result.txHash, amount: result.amount, token: result.token }
  }

  // `already_claimed` means the contract has ALREADY paid this wallet for this
  // week — a payout that landed while we were failing to hear about it. That is
  // a success with a missing receipt, not a failure, and it must not be
  // reported as pending or the sweep will keep retrying a settled reward.
  //
  // Recorded as `paidOnChain` rather than by inventing a txHash: the popup
  // turns txHash into a celoscan link, and a link to a hash that does not exist
  // is worse than no link. The settled-check below reads both.
  if (result.reason === 'already_claimed') {
    await db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).update({
      paidOnChain: true,
      pendingReason: null,
      pendingDetail: null,
    })
    return { rewardStatus: 'paid', txHash: null }
  }

  console.error(
    `[vault/submit] payout pending (${result.reason}) for ${normalizedWallet} week ${weekId}:`,
    result.detail ?? '',
  )
  await db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).update({
    pendingReason: result.reason,
    pendingDetail: result.detail ?? null,
    pendingAt: Date.now(),
  })
  return {
    rewardStatus: 'pending',
    txHash: null,
    reason: result.reason,
    message: VAULT_FAILURE_MESSAGE[result.reason],
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsedBody = vaultSubmitBodySchema.safeParse(await req.json())
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const { walletAddress, weekId: rawWeekId, code } = parsedBody.data
    const weekId = parseWeekId(rawWeekId)
    const normalizedWallet = normalizeWalletAddress(walletAddress)

    const db = getAdminDb()
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin is not configured on the server' },
        { status: 503 },
      )
    }

    const [codeSnap, attemptsSnap, solvedSnap, paperClaimSnap, goldenKeyClaimSnap] = await Promise.all([
      db.ref(`vaultCodes/${weekId}`).get(),
      db.ref(`vaultAttempts/${weekId}/${normalizedWallet}`).get(),
      db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).get(),
      db.ref(`paperClaims/${weekId}/${normalizedWallet}`).get(),
      db.ref(`goldenKeyClaims/${weekId}/${normalizedWallet}`).get(),
    ])

    if (!codeSnap.exists()) {
      return NextResponse.json({ error: 'Vault code not found for this week' }, { status: 404 })
    }

    const expectedCode = String(codeSnap.val()?.code ?? '')

    // #9C — item-ownership gate. Paper and Golden Key are both capped at
    // 1/wallet/week and recorded the moment they're picked up; reuse those
    // records as the ownership check before spending an attempt.
    const hasPaper = paperClaimSnap.exists()
    const hasGoldenKey = goldenKeyClaimSnap.exists()
    if (!hasPaper || !hasGoldenKey) {
      const missing = [!hasPaper && 'Paper', !hasGoldenKey && 'the Golden Key'].filter(Boolean).join(' and ')
      return NextResponse.json(
        {
          success: false,
          isCorrect: false,
          error: 'missing_items',
          message: `You need ${missing} from this week's containers before you can submit a vault code.`,
          attemptsRemaining: getAttemptsRemaining(Number(attemptsSnap.val() ?? 0)),
        },
        { status: 200 },
      )
    }

    // Already recorded a win this week. If the on-chain payout already landed
    // (txHash present) we're done. If it's still PENDING — the classic case
    // where the first win of the week timed out mid-payout — retry ONLY the
    // payout now (the code is stored on-chain by this point, so it's a single
    // fast tx). This self-heals a stuck reward the instant the player re-opens
    // the vault, without spending an attempt or re-validating the code.
    if (solvedSnap.exists()) {
      const solved = solvedSnap.val() as {
        txHash?: string | null; amount?: number; token?: string; paidOnChain?: boolean
      } | null
      const alreadyPaid = !!(
        solved && ((typeof solved.txHash === 'string' && solved.txHash.length > 0) || solved.paidOnChain === true)
      )
      if (alreadyPaid) {
        return NextResponse.json(
          {
            success: true, isCorrect: true, rewardStatus: 'paid',
            message: 'Vault already unlocked for this week',
            attemptsRemaining: 0, txHash: solved!.txHash,
            // Stamped at payout time. Re-opening a solved vault should show the
            // same figure it showed when it was won, not a fresh contract read
            // that may have changed since.
            amount: solved!.amount, token: solved!.token,
          },
          { status: 200 },
        )
      }
      const finalize = await finalizeVaultPayout({ weekId, walletAddress, normalizedWallet, expectedCode, db })
      return NextResponse.json(
        {
          success: true,
          isCorrect: true,
          rewardStatus: finalize.rewardStatus,
          attemptsRemaining: 0,
          message: finalize.rewardStatus === 'paid'
            ? 'Correct code! Reward sent.'
            : finalize.message ?? 'Your win is recorded and the reward retries automatically.',
          reason: finalize.reason,
          txHash: finalize.txHash,
          amount: finalize.amount, token: finalize.token,
        },
        { status: 200 },
      )
    }

    const attemptsUsed = Number(attemptsSnap.val() ?? 0)
    if (attemptsUsed >= 3) {
      return NextResponse.json(
        { success: false, isCorrect: false, message: 'No attempts remaining this week', attemptsRemaining: 0 },
        { status: 200 },
      )
    }

    // The Firebase code (the exact value the player's Paper shows) is the
    // SOURCE OF TRUTH for correctness. The on-chain reward is a SEPARATE,
    // best-effort step (see finalizeVaultPayout) — it must NEVER turn a
    // correct code into an error.
    const isCorrect = expectedCode === code
    const updatedAttempts = attemptsUsed + 1

    await db.ref(`vaultAttempts/${weekId}/${normalizedWallet}`).set(updatedAttempts)

    let txHash: string | null = null
    let rewardStatus: 'paid' | 'pending' | 'none' = isCorrect ? 'pending' : 'none'
    let paidAmount: number | undefined
    let paidToken: string | undefined
    let pendingReason: VaultPayoutFailure | undefined
    let pendingMessage: string | undefined

    if (isCorrect) {
      // Record the win immediately — independent of the payout.
      await db.ref(`vaultCompleted/${weekId}/${normalizedWallet}`).set({
        completedAt: Date.now(),
        attempts: updatedAttempts,
        txHash: null,
      })

      const finalize = await finalizeVaultPayout({ weekId, walletAddress, normalizedWallet, expectedCode, db })
      txHash = finalize.txHash
      rewardStatus = finalize.rewardStatus
      paidAmount = finalize.amount
      paidToken = finalize.token
      pendingReason = finalize.reason
      pendingMessage = finalize.message
    }

    return NextResponse.json(
      {
        success: isCorrect,
        isCorrect,
        rewardStatus,
        attemptsRemaining: getAttemptsRemaining(updatedAttempts),
        attemptsUsed: updatedAttempts,
        message: isCorrect
          ? (rewardStatus === 'paid'
              ? 'Correct code! Reward sent.'
              : pendingMessage ?? 'Your win is recorded and the reward retries automatically.')
          : 'Wrong code. Try again.',
        reason: pendingReason,
        txHash,
        amount: paidAmount,
        token: paidToken,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Vault submit error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Invalid weekId' ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
