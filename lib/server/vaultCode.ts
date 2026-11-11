import type { getAdminDb } from '@/firebase-config'

type Db = NonNullable<ReturnType<typeof getAdminDb>>

// ─── The week's vault code, in Firebase ──────────────────────────────────────
//
// This used to live inside /api/paper/status as a private helper, which was
// fine while that route was the only thing that needed it. It is not anymore:
// /api/vault/prepare has to be able to put the code ON CHAIN before anybody
// wins (see lib/server/vaultChain.ts for why that matters), and it cannot do
// that without knowing what the code is.
//
// A second copy of "generate a 4-digit code, unless one already exists" is
// exactly the kind of duplicate that drifts into two different codes for the
// same week — one shown on the player's Paper, the other stored on chain, and
// a vault that rejects a code the game itself printed.
//
// GENERATING IT REVEALS NOTHING. The code is returned to a wallet only after
// that wallet has claimed this week's Paper (/api/paper/status enforces that,
// and still does). Creating the row is not the same as handing it out.

/**
 * This week's code, generating it once if it does not exist yet.
 *
 * The transaction is what makes it safe to call from several routes at once:
 * two "first request of the week" callers can both find the path empty, and
 * only one of their writes can commit — the other aborts and reads back the
 * winner's code. Without it, the player's Paper and the on-chain copy could be
 * generated independently and disagree forever.
 */
export async function ensureWeeklyCodeInDb(db: Db, weekId: string | number): Promise<string> {
  const ref = db.ref(`vaultCodes/${weekId}`)
  const snap = await ref.get()
  const existing = snap.val() as { code?: string } | null
  if (existing && typeof existing.code === 'string' && /^\d{4}$/.test(existing.code)) {
    return existing.code
  }

  const generated = String(Math.floor(1000 + Math.random() * 9000))
  const txResult = await ref.transaction((current: unknown) => {
    const cur = current as { code?: string } | null
    if (cur && typeof cur.code === 'string' && /^\d{4}$/.test(cur.code)) return undefined // abort — already set
    return { code: generated, generatedAt: Date.now() }
  })
  const finalVal = txResult.snapshot?.val() as { code?: string } | null
  return finalVal?.code ?? generated
}
