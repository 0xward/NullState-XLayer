import { NextResponse } from 'next/server'
import { getTapeOutSnapshot } from '@/lib/tapeout'

/**
 * GET /api/tapeout — live TapeOut state from X Layer mainnet, read-only.
 *
 * The server does the eth_calls (lib/tapeout.ts); the browser never touches
 * the RPC or a wallet. 60s shared cache so a burst of players does not turn
 * into a burst of RPC calls — but the numbers are always a fresh read, never
 * a constant baked into the bundle.
 *
 * On RPC failure this answers 502 with { error } — callers show the error
 * state instead of stale data.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const snapshot = await getTapeOutSnapshot()
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch {
    return NextResponse.json({ error: 'tapeout_unavailable' }, { status: 502 })
  }
}
