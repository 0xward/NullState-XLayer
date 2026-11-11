import { NextRequest, NextResponse } from 'next/server'
import { vaultSubmitBodySchema } from '@/lib/validation'
import {
  parseWeekId,
} from '@/lib/vault-utils'
import {
  payVaultWinner,
  getVaultWeekState,
  waitForClaimedThisWeek,
  readPaidAmount,
  VAULT_FAILURE_MESSAGE,
} from '@/lib/server/vaultChain'
import { publicClient } from '@/lib/web3-client'

// Headroom for the on-chain payout to confirm inside the request. A payout
// that waits for an X Layer receipt still needs more than Vercel's 10s
// default — that default is what killed the request after the code was stored
// and before submitVaultCode was ever broadcast.
export const maxDuration = 60

// =============================================
// VAULT SUBMIT — Firebase-free (2026-11-11)
//
// POST /api/vault/submit
// Body: { walletAddress, weekId, code }
//
// WHAT CHANGED. The route used to read everything from Firebase Realtime
// Database — the week's code (vaultCodes), attempts (vaultAttempts), the win
// record (vaultCompleted), and the item-ownership gate (paperClaims +
// goldenKeyClaims). With no Firebase configured the route answered every
// request with 503 'Firebase Admin is not configured on the server'. All of
// that state now comes from the TreasureVaultV2 contract instead, and the
// user decision recorded 2026-11-11 drops the item gate entirely: Paper and
// Golden Key stay in the game as visuals / progression, but the server no
// longer enforces owning them. The 4-digit weekly code is the only gate
// (besides the on-chain state: not yet claimed this week, attempts left,
// pool funded).
//
// THE CONTRACT IS THE SOURCE OF TRUTH. submitVaultCode(user, week, code) is
// the only write, and it does everything in one call: it increments
// userVaultAttempts, compares the code against weeklyVaultCodes on chain,
// pays vaultReward when correct, and locks the wallet at 3 wrong attempts.
// That is why the route passes the PLAYER's code straight through instead
// of a canonical one — there is no canonical copy anywhere else to pass. A
// mined transaction does NOT imply a correct code (a wrong code also mines,
// emitting VaultCodeIncorrect), so the route re-reads hasClaimedThisWeek
// after the receipt to decide paid vs wrong. The preflight reads exist only
// to give a clear error before spending backend gas; a stale read there is
// harmless because the contract re-checks everything at write time.
//
// WRONG CODES COST A BACKEND TX. That is deliberate, not wasteful: the
// 3-attempt lockout is enforced on chain by counting submitVaultCode calls,
// so a wrong code has to be submitted to count. Skipping the write for a
// wrong code would leave the attempt counter at 0 forever and the 4-digit
// code brute-forceable. Backend gas per submit is a fraction of a cent.
//
// NO PENDING STATE ANYMORE. A payout either lands on chain (claimed=true)
// or it does not (the tx never ran, or it reverted and rolled back —
// including the attempt increment). There is nothing to sweep and nothing
// for the player to wait on: a failed payout is retried by submitting
// again. The daily sweep (lib/server/vaultSweep.ts) has no Firebase records
// to retry under this design and is left untouched; it simply finds
// nothing.
//
// WHAT THE ALREADY-CLAIMED RESPONSE CANNOT KNOW. Without a win record the
// route cannot name the original payout tx, so txHash is null and amount /
// token are the CURRENT reward figure read live off the contract (which can
// differ from what was paid if the owner changed vaultReward since).
//
// FUTURE WEEKS. The code for a week must already be on chain (isCodeSetForWeek)
// before anyone can win it — the owner (or backend) stores it with
// storeWeeklyVaultCode. /api/vault/prepare used to source the code from
// Firebase; without Firebase it degrades to a no-op, so a new week's code
// has to be put on chain by the owner directly.
// =============================================

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
    const user = walletAddress as `0x${string}`

    // ── On-chain preflight (replaces the Firebase reads). Best-effort only:
    //    the contract re-checks all of this at write time. ──
    const state = await getVaultWeekState(publicClient, user, weekId)

    if (!state.codeSet) {
      return NextResponse.json({ error: 'Vault code not found for this week' }, { status: 404 })
    }

    if (state.claimed) {
      const paid = await readPaidAmount(publicClient)
      return NextResponse.json(
        {
          success: true, isCorrect: true, rewardStatus: 'paid',
          message: 'Vault already unlocked for this week',
          attemptsRemaining: 0, txHash: null,
          amount: paid.amount, token: paid.token,
        },
        { status: 200 },
      )
    }

    if (state.locked || state.attemptsUsed >= 3) {
      return NextResponse.json(
        { success: false, isCorrect: false, message: 'No attempts remaining this week', attemptsRemaining: 0 },
        { status: 200 },
      )
    }

    // ── Submit the player's code. The contract verifies it, counts the
    //    attempt, pays when correct, locks at 3. ──
    const result = await payVaultWinner({ weekId, walletAddress, expectedCode: code })

    if (!result.ok) {
      // The submission never reached the contract (or reverted before the
      // code was checked), so no attempt was consumed. Re-read the week
      // state so the response names the true attempts remaining.
      const fresh = await getVaultWeekState(publicClient, user, weekId)

      if (result.reason === 'already_claimed') {
        const paid = await readPaidAmount(publicClient)
        return NextResponse.json(
          {
            success: true, isCorrect: true, rewardStatus: 'paid',
            message: 'Vault already unlocked for this week',
            attemptsRemaining: 0, txHash: null,
            amount: paid.amount, token: paid.token,
          },
          { status: 200 },
        )
      }
      if (result.reason === 'not_configured') {
        return NextResponse.json({ error: 'Backend signer not configured' }, { status: 503 })
      }
      if (result.reason === 'code_not_on_chain') {
        return NextResponse.json({ error: 'Vault code not found for this week' }, { status: 404 })
      }

      // pool_empty / signer_out_of_gas / rpc / reverted. The code was never
      // evaluated on chain. If the on-chain code says it was wrong, say so
      // (the pool failure is moot); otherwise the win is pending and the
      // player retries by submitting again.
      const isCorrect = state.expectedCode !== '' && state.expectedCode === code
      if (!isCorrect) {
        return NextResponse.json(
          {
            success: false, isCorrect: false, rewardStatus: 'none',
            message: 'Wrong code. Try again.',
            attemptsRemaining: fresh.attemptsRemaining,
            attemptsUsed: fresh.attemptsUsed,
            txHash: null,
          },
          { status: 200 },
        )
      }
      return NextResponse.json(
        {
          success: true, isCorrect: true, rewardStatus: 'pending',
          message: VAULT_FAILURE_MESSAGE[result.reason],
          reason: result.reason,
          attemptsRemaining: fresh.attemptsRemaining,
          attemptsUsed: fresh.attemptsUsed,
          txHash: null,
        },
        { status: 200 },
      )
    }

    // ── The tx mined. Correctness is the contract's verdict, not the receipt
    //    status: a wrong code also mines (VaultCodeIncorrect). Re-read the
    //    claim flag, with a short retry — a load-balanced RPC can lag one
    //    read behind the mined receipt (the mint flow proved this). ──
    const claimed = await waitForClaimedThisWeek(publicClient, user, weekId)
    const fresh = await getVaultWeekState(publicClient, user, weekId)

    if (claimed) {
      return NextResponse.json(
        {
          success: true, isCorrect: true, rewardStatus: 'paid',
          message: 'Correct code! Reward sent.',
          attemptsRemaining: fresh.attemptsRemaining,
          attemptsUsed: fresh.attemptsUsed,
          txHash: result.txHash,
          amount: result.amount, token: result.token,
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        success: false, isCorrect: false, rewardStatus: 'none',
        message: 'Wrong code. Try again.',
        attemptsRemaining: fresh.attemptsRemaining,
        attemptsUsed: fresh.attemptsUsed,
        txHash: result.txHash,
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
