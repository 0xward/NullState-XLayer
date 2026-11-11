// How far the player has actually got in the campaign — kept SEPARATELY from
// the saved session, and only ever allowed to go up.
//
// WHY THIS EXISTS. The world map used to read its progress straight off the
// saved session's `campaignActIndex`, and set it directly:
//
//     apply(loadGameSessionDraft(address)?.campaignActIndex)
//
// That was fine while the campaign was a one-way street, because the session
// index and "furthest bunker reached" were the same number. Raids (GAME-DESIGN
// §7) break that equality: raiding Bunker 1 makes the live session's act index
// 0, the in-run autosave persists it, and a player who had cleared all five
// bunkers would come back to a map showing Bunker 1 active and 3-5 LOCKED —
// their whole campaign erased by farming the first level.
//
// So progress is its own monotonic record. A raid can move the session index
// wherever it likes; it can never lower this.
//
// Stored per wallet in localStorage rather than Firestore on purpose: it is
// derivable (it is the high-water mark of a value already synced with the
// session), it is read on the map's critical path where a network round-trip
// would show the wrong bunkers for a beat, and being wrong costs a re-clear
// rather than money. readHighestAct() takes the max with whatever the synced
// session reports, so a player on a new device recovers their progress from
// the Firestore copy on the first map view and it is written back here.

const KEY_PREFIX = 'nullstate-campaign-progress-'
const RESUME_PREFIX = 'nullstate-campaign-resume-'

function key(wallet: string): string {
  return `${KEY_PREFIX}${wallet.toLowerCase()}`
}

function clampAct(value: unknown, maxAct: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(maxAct, Math.max(0, Math.floor(value)))
}

/**
 * The furthest act this wallet has reached, merged with whatever the saved
 * session reports and written back if the session is ahead.
 *
 * `sessionAct` is the session's own `campaignActIndex` — pass it when you have
 * it so an existing player (who has never written this record) is seeded from
 * their save on the very first read, and so a device that restored from
 * Firestore catches up.
 */
export function readHighestAct(wallet: string, sessionAct?: number, maxAct = 4): number {
  if (typeof window === 'undefined' || !wallet) return 0
  let stored = 0
  try {
    stored = clampAct(Number(window.localStorage.getItem(key(wallet))), maxAct) ?? 0
  } catch {
    /* storage blocked — fall through to whatever the session says */
  }
  const fromSession = clampAct(sessionAct, maxAct)
  if (fromSession === null) return stored
  if (fromSession <= stored) return stored
  recordHighestAct(wallet, fromSession, maxAct)
  return fromSession
}

/**
 * Raise the high-water mark. Never lowers it — that is the whole contract, and
 * the reason every caller can pass whatever act it happens to be looking at
 * without checking first.
 */
export function recordHighestAct(wallet: string, act: number, maxAct = 4): void {
  if (typeof window === 'undefined' || !wallet) return
  const next = clampAct(act, maxAct)
  if (next === null) return
  try {
    const cur = clampAct(Number(window.localStorage.getItem(key(wallet))), maxAct) ?? 0
    if (next > cur) window.localStorage.setItem(key(wallet), String(next))
  } catch {
    /* storage blocked — the map falls back to the session index, as before */
  }
}

// ─── Where the campaign was standing when a raid interrupted it ──────────────
//
// A raid overwrites the live session — same wallet, same document — so without
// this, going off to farm Bunker 1 would cost a player their floor-4 position
// in Bunker 3. They would keep every item, level and shard and still have to
// walk three floors again, which reads as the game losing their place.
//
// So the raid stashes the campaign's act/depth on the way in and puts it back
// on the way out. localStorage rather than a React ref on purpose: a player who
// saves and exits mid-raid comes back through a fresh page load, and a ref
// would already be gone by the time their raid finishes.

export interface CampaignResume {
  campaignActIndex: number
  depth: number
  maxDepthReached: number
}

/** Remember where the campaign was, just before a raid takes over the save. */
export function stashCampaignResume(wallet: string, resume: CampaignResume | null | undefined): void {
  if (typeof window === 'undefined' || !wallet) return
  try {
    if (!resume || typeof resume.campaignActIndex !== 'number') {
      window.localStorage.removeItem(RESUME_PREFIX + wallet.toLowerCase())
      return
    }
    window.localStorage.setItem(RESUME_PREFIX + wallet.toLowerCase(), JSON.stringify({
      campaignActIndex: Math.max(0, Math.floor(resume.campaignActIndex)),
      depth: Math.max(1, Math.floor(resume.depth || 1)),
      maxDepthReached: Math.max(1, Math.floor(resume.maxDepthReached || 1)),
    }))
  } catch {
    /* storage blocked — the raid just costs the floor position, as it would have anyway */
  }
}

/** Read it back and clear it — a stash is consumed by the raid that ends. */
export function takeCampaignResume(wallet: string): CampaignResume | null {
  if (typeof window === 'undefined' || !wallet) return null
  try {
    const raw = window.localStorage.getItem(RESUME_PREFIX + wallet.toLowerCase())
    if (!raw) return null
    window.localStorage.removeItem(RESUME_PREFIX + wallet.toLowerCase())
    const v = JSON.parse(raw) as Partial<CampaignResume>
    if (typeof v?.campaignActIndex !== 'number') return null
    return {
      campaignActIndex: Math.max(0, Math.floor(v.campaignActIndex)),
      depth: Math.max(1, Math.floor(v.depth || 1)),
      maxDepthReached: Math.max(1, Math.floor(v.maxDepthReached || 1)),
    }
  } catch {
    return null
  }
}
