import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { walletAddressSchema, vaultFragmentBodySchema } from '@/lib/validation'
import { normalizeWalletAddress, getCurrentWeekIdString } from '@/lib/vault-utils'
import { creditFragment, readFragmentState, FRAGMENT_GOALS } from '@/lib/server/vault-fragments'
import { reportMetric } from '@/lib/server/dailyContracts'

// Reads ?wallet on GET, so it can only ever be served on demand — declare it
// dynamic or the build tries to prerender it and logs DYNAMIC_SERVER_USAGE.
export const dynamic = 'force-dynamic'

// =============================================
// VAULT FRAGMENTS (GAME-DESIGN.md §5.1)
//
// GET  /api/vault/fragments?wallet=0x...
//   -> { weekId, fragments, paperClaimed, goldenKeyClaimed, nextGoal, goals }
//
// POST /api/vault/fragments   Body: { wallet }
//   Called by game.js once per interactive container the player opens.
//   -> the same state, plus `granted: ['paper'|'goldenKey']` naming anything
//      this particular container just unlocked.
//
// The grant writes the SAME paperClaims/ and goldenKeyClaims/ records that
// /api/paper/claim and /api/goldenkey/claim write, so the weekly
// 1-per-wallet cap is enforced by the records themselves and /api/vault/submit
// needs no change to honour an item earned this way. See lib/server/
// vault-fragments.ts for why that matters.
//
// Degrades OPEN, matching every other weekly route here: with Firebase
// unconfigured this reports an empty bar rather than failing the run. The
// worst case is that fragments do not accumulate — never that the player is
// blocked from playing.
// =============================================

const EMPTY = (weekId: string) => ({
  weekId,
  fragments: 0,
  paperClaimed: false,
  goldenKeyClaimed: false,
  nextGoal: { key: FRAGMENT_GOALS[0].key, threshold: FRAGMENT_GOALS[0].threshold, label: FRAGMENT_GOALS[0].label },
  goals: FRAGMENT_GOALS.map((g) => ({ key: g.key, threshold: g.threshold, label: g.label })),
})

export async function GET(req: NextRequest) {
  try {
    const parsed = walletAddressSchema.safeParse(req.nextUrl.searchParams.get('wallet') ?? '')
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid wallet address' },
        { status: 400 },
      )
    }

    const weekId = getCurrentWeekIdString()
    const db = getAdminDb()
    if (!db) return NextResponse.json(EMPTY(weekId), { status: 200 })

    const state = await readFragmentState(db, weekId, normalizeWalletAddress(parsed.data))
    return NextResponse.json(
      { ...state, goals: FRAGMENT_GOALS.map((g) => ({ key: g.key, threshold: g.threshold, label: g.label })) },
      { status: 200 },
    )
  } catch (error) {
    console.error('[vault/fragments] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = vaultFragmentBodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      )
    }

    const weekId = getCurrentWeekIdString()
    const db = getAdminDb()
    if (!db) return NextResponse.json({ ...EMPTY(weekId), granted: [] }, { status: 200 })

    const wallet = normalizeWalletAddress(parsed.data.wallet)
    const state = await creditFragment(db, weekId, wallet)

    // The 'containers' Daily Contract (GAME-DESIGN.md §5.2) counts exactly the
    // same event this route already is: one POST per interactive container, the
    // first time it is opened. Crediting it here rather than from the engine
    // means the one metric the server CAN see is not taken on the client's
    // word — which is what lib/server/dailyContracts.ts has always claimed
    // about it, and was not true until now: the engine was posting the count
    // itself to /api/contracts.
    //
    // Best-effort, like the burn route's credit: a contract that fails to tick
    // must never cost the player the fragment they just earned.
    // `contracts`/`contractsGranted` are shaped for game.js's announceContracts()
    // so a contract finished by opening a container still says so in the run
    // log, exactly as it did when the engine posted the count itself.
    let contracts: unknown
    let contractsGranted: string[] = []
    try {
      const day = await reportMetric(db, wallet, 'containers', 1)
      contracts = day.contracts
      contractsGranted = day.granted
    } catch (err) {
      console.error('[vault/fragments] daily-contract credit failed (fragment kept):', err)
    }

    return NextResponse.json(
      {
        ...state,
        goals: FRAGMENT_GOALS.map((g) => ({ key: g.key, threshold: g.threshold, label: g.label })),
        contracts,
        contractsGranted,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[vault/fragments] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
