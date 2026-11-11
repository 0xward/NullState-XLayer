// Vault Fragments — the effort path to the weekly Vault (GAME-DESIGN.md §5.1).
//
// WHAT THIS REPLACES. Old Paper and the Golden Key were pure 16% rolls on rare
// containers, capped 1 per wallet per week. Two outcomes, both bad and both
// common: a lucky player got both on day 1 and had nothing left to do for six
// days, and an unlucky one ground all week and went home with nothing. The
// second is the one that loses players — a week of effort that paid zero is
// not a setback, it is a reason to uninstall. It also produced the dead end
// that started this work: reach the vault door carrying only one of the two
// and there was no recourse at all.
//
// THE RULE NOW: luck may shortcut the grind, effort must guarantee it.
// Opening an interactive container earns one fragment. Cross a threshold and
// the item is granted outright. The 16% roll is untouched and still fires on
// top, so a lucky player still gets the early thrill — it simply no longer
// GATES the reward.
//
// WHY THE GRANT WRITES THE SAME RECORDS AS THE OLD PATH. paperClaims/ and
// goldenKeyClaims/ are what /api/paper/claim and /api/goldenkey/claim already
// write, what /api/{paper,goldenkey}/status already read, and what
// /api/vault/submit gates on. Granting through the exact same transaction
// means the weekly 1-per-wallet cap holds for free, the two award paths can
// never both pay out, and no other route needed a single line changed.
//
// Fragments live at vaultFragments/{weekId}/{wallet} and vanish with the ISO
// week, alongside every other weekly record.

import { getAdminDb } from '@/firebase-config'

type AdminDb = NonNullable<ReturnType<typeof getAdminDb>>

/** The two items a full fragment bar can buy, and what each costs. */
export const FRAGMENT_GOALS = [
  { key: 'paper' as const, threshold: 8, path: 'paperClaims', label: 'Old Paper' },
  { key: 'goldenKey' as const, threshold: 18, path: 'goldenKeyClaims', label: 'Golden Key' },
]

export type FragmentGoalKey = (typeof FRAGMENT_GOALS)[number]['key']

// THE NUMBERS, AND HOW THEY WERE ARRIVED AT.
//
// These started at 12 and 28, ESTIMATED by reading spawnDecorInto (max 5 props
// per room, 12% of them rare, northOnly types falling back to tables on side
// walls) at 8-15 interactive containers per bunker.
//
// Measured with the real generator — `npm run measure:bunker`, which mounts
// the actual engine at each depth and counts what it produces — a bunker holds
// about **7**, across two runs of 200 floors that landed at 6.3 and 7.4. The
// estimate was between 1.3x and 2.4x too high.
//
// That mattered, because the vault needs BOTH items. At 28 the Golden Key took
// roughly 4.4 bunkers of complete clearing; a player opening a realistic ~70%
// of what they find needed to play close to every day of the week to reach it.
// Anyone playing three to five sessions got the Paper, missed the Key, and
// therefore earned NOTHING — which is precisely the outcome this whole
// mechanic exists to make impossible.
//
// At 8 and 18 a four-session week clears both, the Paper lands on day one so
// the mechanic teaches itself early, and the Key falls mid-week. That matches
// the arc in GAME-DESIGN.md §4.
//
// Still a model, not player data: it assumes one bunker per session and ~70%
// of containers opened. Re-run the measurement whenever props.js gains or
// loses an interactive type, and revisit these once real weeks exist.

export interface FragmentState {
  weekId: string
  fragments: number
  paperClaimed: boolean
  goldenKeyClaimed: boolean
  /** What the bar is filling toward next, or null once both are held. */
  nextGoal: { key: FragmentGoalKey; threshold: number; label: string } | null
}

function fragmentsRef(db: AdminDb, weekId: string, wallet: string) {
  return db.ref(`vaultFragments/${weekId}/${wallet}`)
}

/** Read the wallet's fragment count and which items it already holds this week. */
export async function readFragmentState(
  db: AdminDb,
  weekId: string,
  wallet: string,
): Promise<FragmentState> {
  const [fragSnap, paperSnap, keySnap] = await Promise.all([
    fragmentsRef(db, weekId, wallet).get(),
    db.ref(`paperClaims/${weekId}/${wallet}`).get(),
    db.ref(`goldenKeyClaims/${weekId}/${wallet}`).get(),
  ])

  const raw = fragSnap.val()
  const fragments = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0

  return buildState(weekId, fragments, paperSnap.exists(), keySnap.exists())
}

function buildState(
  weekId: string,
  fragments: number,
  paperClaimed: boolean,
  goldenKeyClaimed: boolean,
): FragmentState {
  const held: Record<FragmentGoalKey, boolean> = { paper: paperClaimed, goldenKey: goldenKeyClaimed }
  const next = FRAGMENT_GOALS.find((g) => !held[g.key]) ?? null
  return {
    weekId,
    fragments,
    paperClaimed,
    goldenKeyClaimed,
    nextGoal: next ? { key: next.key, threshold: next.threshold, label: next.label } : null,
  }
}

/**
 * Award one fragment, then grant whatever that unlocked.
 *
 * The increment is a transaction so two containers opened in different tabs
 * cannot land on the same value. Each grant is the SAME check-and-set the
 * existing claim routes use, so a fragment grant racing the 16% loot roll for
 * the same item resolves to exactly one winner.
 */
export async function creditFragment(
  db: AdminDb,
  weekId: string,
  wallet: string,
  amount = 1,
): Promise<FragmentState & { granted: FragmentGoalKey[] }> {
  const step = Math.max(1, Math.min(10, Math.floor(amount)))

  const tx = await fragmentsRef(db, weekId, wallet).transaction((cur: unknown) => {
    const n = typeof cur === 'number' && Number.isFinite(cur) ? Math.max(0, Math.floor(cur)) : 0
    return n + step
  })

  const committed = tx.snapshot?.val()
  const fragments = typeof committed === 'number' ? committed : step

  const granted: FragmentGoalKey[] = []
  const held: Record<FragmentGoalKey, boolean> = { paper: false, goldenKey: false }

  for (const goal of FRAGMENT_GOALS) {
    const claimRef = db.ref(`${goal.path}/${weekId}/${wallet}`)

    if (fragments < goal.threshold) {
      held[goal.key] = (await claimRef.get()).exists()
      continue
    }

    // At or past the threshold: claim it if nobody has. `current !== null`
    // aborts, which is exactly how /api/paper/claim guards the same record —
    // so a wallet that already found this item by luck keeps that one and is
    // never handed a second.
    const claimTx = await claimRef.transaction((current: unknown) => {
      if (current !== null) return undefined
      return { claimedAt: Date.now(), via: 'fragments' }
    })

    held[goal.key] = true
    if (claimTx.committed) granted.push(goal.key)
  }

  return { ...buildState(weekId, fragments, held.paper, held.goldenKey), granted }
}
