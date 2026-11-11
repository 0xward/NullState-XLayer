import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/firebase-config'
import { walletAddressSchema } from '@/lib/validation'
import { generateAutoUsername } from '@/lib/guestIdentity'

// ─── Why this route exists ───────────────────────────────────────────────────
// The world map's largest painted element is the player's own name, and until
// this route it could not appear until the CLIENT Firestore SDK had booted and
// completed a WebChannel handshake with firestore.googleapis.com. PageSpeed
// measured the result precisely: LCP element `<span class="ns-hub-name">`,
// render delay 7,450ms — on a page where the map, the trail, the rail and every
// button were already on screen.
//
// Two earlier attempts at this missed. Running the username and leaderboard
// reads in parallel removed one round trip but not the SDK bootstrap, and
// caching the last profile in localStorage only helps a RETURNING visitor —
// a PageSpeed run, and a player's first ever open, always have empty storage.
// What was left is the part neither touched: the client should not be talking
// to Firestore at all to answer "what is my name".
//
// So the same two documents are read here, with the Admin SDK, and the browser
// makes one same-origin GET on a connection it already has open. No SDK to
// download or boot, no cross-origin handshake, no preconnect needed.
//
// AUTHENTICATION: none, deliberately. This returns only what the world map
// already shows to the person holding the wallet — a display name and a level.
// It writes exactly one thing: an auto-assigned name for a wallet that has none
// yet, which is what the client SDK did too, at the same moment, for the same
// reason. It is not a route that can move value.

export const dynamic = 'force-dynamic'

// A hung Firebase call must not run until Vercel's own function timeout, which
// returns an HTML error page instead of this route's JSON. Same guard as
// /api/player/profile, same reason.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}

// This used to be a hand-synced copy of lib/usernameService.ts's version, under
// a comment warning that the two must match or a wallet would see its name
// change under it. It is now imported from lib/guestIdentity.ts, which both
// sides share — the warning is enforced by there being one implementation
// rather than by whoever edits next remembering to read it.

export async function GET(req: NextRequest) {
  const parsed = walletAddressSchema.safeParse(new URL(req.url).searchParams.get('wallet') ?? '')
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid wallet address' }, { status: 400 })
  }
  const wallet = parsed.data.toLowerCase()

  const db = getAdminFirestore()
  if (!db) {
    // The client keeps its own Firestore path as a fallback, so an
    // unconfigured server means "slower", not "broken".
    return NextResponse.json({ error: 'Firestore Admin is not configured on the server' }, { status: 503 })
  }

  try {
    const [nameSnap, boardSnap] = await withTimeout(
      Promise.all([
        db.collection('usernames').doc(wallet).get(),
        db.collection('leaderboard').doc(wallet).get(),
      ]),
      8000,
      'Firestore read',
    )

    let username: string | null = nameSnap.exists ? (nameSnap.data()?.username ?? null) : null
    let assigned = false

    if (!username) {
      username = generateAutoUsername(wallet)
      assigned = true
      // Best effort. If the write fails the player still gets a name for this
      // session and the client's own path will try again — better than making
      // them wait on a write to learn what they are called.
      const now = Date.now()
      db.collection('usernames').doc(wallet).set(
        { walletAddress: wallet, username, isAutoAssigned: true, createdAt: now, updatedAt: now },
        { merge: true },
      ).catch(err => console.error('[identity] auto-assign write failed:', err))
    }

    const board = boardSnap.exists ? boardSnap.data() : null

    return NextResponse.json(
      {
        walletAddress: wallet,
        username,
        isAutoAssigned: assigned,
        xp: board?.xp ?? 0,
        level: board?.level ?? 1,
        kills: board?.totalKills ?? board?.kills ?? 0,
      },
      {
        headers: {
          // Private to this wallet and it changes as they play, so no shared
          // cache — but a few seconds of browser cache absorbs the double
          // fetch a remount would otherwise cause.
          'Cache-Control': 'private, max-age=5',
        },
      },
    )
  } catch (err) {
    console.error('[identity] read failed:', err)
    return NextResponse.json({ error: 'Failed to read player identity' }, { status: 500 })
  }
}
