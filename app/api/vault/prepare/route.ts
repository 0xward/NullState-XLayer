import { NextResponse } from 'next/server'
import { getAdminDb } from '@/firebase-config'
import { getCurrentWeekIdString } from '@/lib/vault-utils'
import { ensureWeeklyCodeInDb } from '@/lib/server/vaultCode'
import { ensureWeeklyCodeOnChain, getVaultClients, isCodeOnChain } from '@/lib/server/vaultChain'

export const dynamic = 'force-dynamic'

// Storing a code is one write and normally finishes in a couple of seconds,
// but it waits for a Celo receipt and Vercel's 10s default is not a margin.
export const maxDuration = 30

// =============================================
// VAULT PREPARE — put this week's code on chain BEFORE anybody wins
// POST /api/vault/prepare   ->  { weekId, onChain, stored }
//
// PRIORITY #1 OF THE VAULT FIX, and the reason the other three are small.
//
// /api/vault/submit used to do two on-chain writes in one request the first
// time anyone won in a given week: store the week's code, then pay. Only the
// FIRST winner of the week took that path, which is why the failure looked
// random and survived for weeks — and the second write is the one that got
// dropped by a load-balanced Forno before it ever reached the mempool. Measured
// on chain for week 202632: "Store Weekly Vault Code" succeeded, "Submit Vault
// Code" was never broadcast at all. The pool was fine. Gas was fine. The code
// was set. The transaction simply did not exist.
//
// So the two writes are pulled apart in TIME rather than made more reliable.
// The engine calls this the moment the vault door is opened by anyone — hours
// or days before a code is solved — and by the time a player wins, the payout
// is a single write. The failure mode is not mitigated; the shape that produced
// it is gone.
//
// WHY IT NEEDS NO AUTH. It reveals nothing and grants nothing: the week's code
// is ALREADY public on chain (weeklyVaultCodes is a public getter on the
// deployed contract) and this route never returns it. Everything it can do,
// it can do at most once per week — after that `isCodeSetForWeek` is true and
// the call is one cheap RPC read. The worst an attacker achieves by hammering
// it is making our own server do a read it would have done anyway.
//
// The daily cron (/api/cron/season) calls the same helper as a net, so a week
// where nobody opens the vault door still has its code stored before the first
// winner appears.
// =============================================

export async function POST() {
  const weekId = getCurrentWeekIdString()

  try {
    const db = getAdminDb()
    if (!db) {
      // Degrades OPEN, like every other weekly route here. With Firebase down
      // there is no code to store, and refusing loudly would only turn a
      // backend outage into a broken vault door.
      return NextResponse.json({ weekId, onChain: false, stored: false, skipped: 'no_db' }, { status: 200 })
    }

    const clients = getVaultClients()
    if (!clients) {
      return NextResponse.json({ weekId, onChain: false, stored: false, skipped: 'not_configured' }, { status: 200 })
    }

    // Cheapest possible early exit, and the one taken on all but the first
    // call of the week: one RPC read, no Firebase write, no transaction.
    if (await isCodeOnChain(clients.publicClient, Number(weekId))) {
      return NextResponse.json({ weekId, onChain: true, stored: false }, { status: 200 })
    }

    const code = await ensureWeeklyCodeInDb(db, weekId)
    const result = await ensureWeeklyCodeOnChain(Number(weekId), code)

    if (!result.onChain) {
      console.error(`[vault/prepare] could not store week ${weekId} on chain:`, result.error ?? 'unknown')
    }
    return NextResponse.json(
      { weekId, onChain: result.onChain, stored: result.stored, txHash: result.txHash ?? null },
      { status: 200 },
    )
  } catch (error) {
    // Never fails the caller. This is a background errand fired by a game
    // screen; a player opening a vault door must not see an error because a
    // preparation step they never asked for did not work.
    console.error('[vault/prepare] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ weekId, onChain: false, stored: false, skipped: 'error' }, { status: 200 })
  }
}
