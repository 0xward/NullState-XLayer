import type { getAdminDb } from '@/firebase-config'
import { ensureWeeklyCodeOnChain, payVaultWinner, type VaultPayoutFailure } from '@/lib/server/vaultChain'

type Db = NonNullable<ReturnType<typeof getAdminDb>>

// ─── Nobody should have to earn a reward twice ───────────────────────────────
//
// THE FAILURE THIS EXISTS FOR, in the owner's own words: he solved the vault,
// the payout did not go through, and the ONLY way the game offered to retry it
// was to open the vault door again — which means re-entering Bunker 5, clearing
// it, killing the final boss, and getting back to the door. He recovered his
// reward by reading the contract on celoscan and working out what had happened.
// A player cannot do that. For them the sequence is: win, get nothing, and have
// no route back to the money at all.
//
// The self-heal on re-open is a good thing and it stays. What was missing is
// that it is the ONLY route, and it is gated behind the most expensive thing in
// the game. So a pending reward is now collected by the server, on a schedule,
// with the player doing nothing:
//
//   - runs from the daily cron that already exists (/api/cron/season)
//   - covers this week AND last week, so a reward that goes pending on a Sunday
//     night is not stranded by the week rolling over on Monday
//   - stores the week's code first, then pays — one write each, never both in
//     the same breath (that pairing is the original bug; lib/server/vaultChain.ts
//     has the measurements)
//
// WHAT MAKES IT SAFE TO RUN EVERY DAY. Paying twice is the only outcome worse
// than not paying, and three separate things prevent it: the contract enforces
// one claim per wallet per week; payVaultWinner() reads hasClaimedThisWeek
// before it writes and again if a write appears to fail; and a settled row is
// skipped here entirely. A sweep over a week with nothing pending does one
// Firebase read and stops.

export type SweepOutcome = {
  weekId: string
  wallet: string
  status: 'paid' | 'pending'
  txHash?: string
  reason?: VaultPayoutFailure
}

export type SweepResult = {
  checked: number
  paid: number
  stillPending: number
  outcomes: SweepOutcome[]
}

type CompletedRow = {
  txHash?: string | null
  paidOnChain?: boolean
  amount?: number
  token?: string
}

/** A row is settled when it has a real tx hash, or the contract told us it was
 *  already paid. Anything else is money the player is owed. */
export function isSettled(row: CompletedRow | null | undefined): boolean {
  if (!row) return false
  if (row.paidOnChain === true) return true
  return typeof row.txHash === 'string' && row.txHash.length > 0
}

/**
 * Retry every unpaid vault win in the given weeks.
 *
 * `deps` exists so the whole thing can be tested without a chain: the sweep's
 * job is deciding WHICH rows to retry and what to write back, and that logic is
 * worth a test far more than viem's ability to send a transaction is.
 */
export async function sweepPendingVaultPayouts(
  db: Db,
  opts: {
    weekIds: (string | number)[]
    /** hard stop, so one bad week cannot turn the daily cron into a long job */
    limit?: number
    deps?: {
      ensureCode?: typeof ensureWeeklyCodeOnChain
      pay?: typeof payVaultWinner
    }
  },
): Promise<SweepResult> {
  const ensureCode = opts.deps?.ensureCode ?? ensureWeeklyCodeOnChain
  const pay = opts.deps?.pay ?? payVaultWinner
  const limit = opts.limit ?? 25

  const outcomes: SweepOutcome[] = []
  let checked = 0
  let paid = 0

  for (const rawWeek of opts.weekIds) {
    if (outcomes.length >= limit) break
    const weekId = String(rawWeek)

    const [completedSnap, codeSnap] = await Promise.all([
      db.ref(`vaultCompleted/${weekId}`).get(),
      db.ref(`vaultCodes/${weekId}`).get(),
    ])
    if (!completedSnap.exists()) continue

    const rows = (completedSnap.val() ?? {}) as Record<string, CompletedRow>
    const unpaid = Object.entries(rows).filter(([, row]) => !isSettled(row))
    checked += unpaid.length
    if (unpaid.length === 0) continue

    // No code for the week means nothing can be submitted for it. That is a
    // broken week, not a broken payout — say so rather than burning gas on
    // writes that must revert.
    const expectedCode = String((codeSnap.val() as { code?: string } | null)?.code ?? '')
    if (!/^\d{4}$/.test(expectedCode)) {
      for (const [wallet] of unpaid) {
        outcomes.push({ weekId, wallet, status: 'pending', reason: 'code_not_on_chain' })
      }
      continue
    }

    // ONE store attempt for the whole week, before any payout. This is the
    // separation the fix is built on: by the time a single submitVaultCode goes
    // out below, the code has been on chain for at least a transaction.
    await ensureCode(Number(weekId), expectedCode)

    for (const [wallet] of unpaid) {
      if (outcomes.length >= limit) break

      const result = await pay({ weekId: Number(weekId), walletAddress: wallet, expectedCode })

      // `already_claimed` is a payout that landed while we were failing to hear
      // about it — settle the row rather than retrying it every night forever.
      if (result.ok || result.reason === 'already_claimed') {
        await db.ref(`vaultCompleted/${weekId}/${wallet}`).update({
          ...(result.ok ? { txHash: result.txHash } : { paidOnChain: true }),
          ...(result.ok && result.amount !== undefined ? { amount: result.amount, token: result.token } : {}),
          pendingReason: null,
          pendingDetail: null,
          sweptAt: Date.now(),
        })
        paid++
        outcomes.push({
          weekId,
          wallet,
          status: 'paid',
          ...(result.ok ? { txHash: result.txHash } : {}),
        })
        continue
      }

      // Still stuck. Record WHY — the reason is checked, never assumed, and it
      // is what the player is shown next time they ask.
      await db.ref(`vaultCompleted/${weekId}/${wallet}`).update({
        pendingReason: result.reason,
        pendingDetail: result.detail ?? null,
        sweptAt: Date.now(),
      })
      outcomes.push({ weekId, wallet, status: 'pending', reason: result.reason })
    }
  }

  return {
    checked,
    paid,
    stillPending: outcomes.filter((o) => o.status === 'pending').length,
    outcomes,
  }
}
