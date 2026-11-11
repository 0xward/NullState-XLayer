import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  runTransaction,
} from 'firebase/firestore'
import { db } from './firebase'
import { LeaderboardEntry } from './contract'
import { currentSeasonId } from './season'
// The arithmetic that decides who gets paid lives in its own Firebase-free
// module so it can be tested directly — see lib/seasonXp.ts.
import { seasonXpGain } from './seasonXp'

// ─── THE SEASON BOARD, AND WHY IT HAD TO EXIST ───────────────────────────────
//
// OWNER: *"menurutmu pertimbangan rank skrg sudah bagus belum? mengingat hanya
// dari xp?"*
//
// The honest answer was no, and not for the reason it looks like. XP is
// CUMULATIVE and never resets (GAME-DESIGN.md §9.3) — so ranking a *season* by
// it produced an all-time board that happened to pay out monthly. July's
// winner opened August already 5,926 XP ahead of second place, earned in a
// month that was over. Nobody joining in September could ever have won: they
// start at zero against players with months of accumulation behind them.
//
// That is a leaderboard which closes to newcomers permanently, while the app
// advertises "top 10 earn USDT" to every one of them.
//
// So the money now follows XP EARNED DURING THE SEASON. Career XP is untouched
// and still ranks the all-time board — Rondo does not lose the 8,581, it just
// stops being the reason he wins next month too.
//
// ── HOW THE BASELINE IS TAKEN ───────────────────────────────────────────────
//
// `leaderboard/{wallet}` carries `seasonId` + `seasonBaseXp`. On any write, if
// the stored season is not the current one, the baseline becomes `data.xp` —
// the career total as of the LAST write, which by definition was last season.
// Not the incoming figure: that would silently discard whatever the player
// earned before their first sync of the month.
//
// At rollout every existing doc has no `seasonId`, so the first write baselines
// each player at their current career total and everyone starts the season on
// zero. That is exactly the desired migration, and it needs no backfill.
const seasonKey = () => String(currentSeasonId())

const seasonPlayerRef = (seasonId: string, wallet: string) =>
  doc(db, 'seasonLeaderboard', seasonId, 'players', wallet)


interface LeaderboardDoc {
  walletAddress: string
  username: string
  xp: number
  level: number
  // Real cumulative kill total, tracked entirely off-chain (see
  // recordRunKills below). NOT the same as the on-chain `kills` counter:
  // the NullState contract's executeAction() only takes a boolean
  // `enemyKilled` flag, so it can only ever increment on-chain kills by 0
  // or 1 per death — a run where the player killed 40 enemies before dying
  // still only adds +1 on-chain. totalKills is the accurate figure and is
  // what the Leaderboard/Settings "kills" stat should read from.
  totalKills?: number
  // Legacy field from before totalKills existed; kept only so old docs
  // still render something until their next death re-syncs totalKills.
  kills?: number
  // The run-kills value (game.js's `p.kills`, the live per-life counter)
  // that was last folded into totalKills. Needed because p.kills is NOT
  // reset between deaths within the same continuous play session (a
  // Revive keeps counting from where it left off) — see recordRunKills.
  lastRecordedKills?: number
  /**
   * The engine's raw xp as last reported — NOT the career high-water mark
   * above. Season XP is the increase between reports, so this is the only
   * field that makes a returning player's season score move. See seasonXp.ts.
   *
   * Replaces `seasonId` + `seasonBaseXp`, which are no longer written: a
   * baseline that nothing computes against is a value that can only mislead
   * the next reader. Old docs may still carry them; nothing reads them.
   */
  lastRecordedXp?: number
  updatedAt: number
}

/**
 * Snapshot a player's username/xp/level into Firestore so the leaderboard
 * stays fresh without ever needing to scan chain logs. Deliberately does
 * NOT touch totalKills/kills — see recordRunKills for how the kill stat is
 * maintained; overwriting it here would clobber the accumulated total with
 * the (much smaller, capped) on-chain figure every time a profile is read.
 */
export async function updateLeaderboardEntry(
  walletAddress: string,
  username: string,
  xp: number,
  level: number
): Promise<void> {
  try {
    const normalizedAddr = walletAddress.toLowerCase()
    const seasonId = seasonKey()
    const ref = doc(db, 'leaderboard', normalizedAddr)
    // A transaction now, because the season baseline is a decision that has to
    // see what is already stored. This is also the write that USUALLY takes the
    // baseline: it fires from fetchPlayerProfile() when the app opens, i.e.
    // before the first run of the month.
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const data = (snap.exists() ? snap.data() : {}) as Partial<LeaderboardDoc>
      // max(), matching recordRunProgress: career xp reads as "best ever
      // reached", so a New Game (which legitimately restarts at 0 XP) can never
      // erase it — and can never drive season xp negative either.
      const careerXp = Math.max(data.xp ?? 0, xp)
      // The season total ACCUMULATES — see seasonXpGain. Both writers use the
      // same `lastRecordedXp`, so whichever runs first books the gain and the
      // other adds nothing: re-reporting an unchanged figure is worth zero.
      const gain = seasonXpGain(data, xp)
      const seasonSnap = await tx.get(seasonPlayerRef(seasonId, normalizedAddr))
      const seasonPrev = (seasonSnap.exists() ? seasonSnap.data() : {}) as { xp?: number }
      tx.set(ref, {
        walletAddress: normalizedAddr,
        username,
        xp: careerXp,
        level: Math.max(data.level ?? 1, level),
        lastRecordedXp: xp,
        updatedAt: Date.now(),
      }, { merge: true })
      tx.set(seasonPlayerRef(seasonId, normalizedAddr), {
        walletAddress: normalizedAddr,
        username,
        xp: (seasonPrev.xp ?? 0) + gain,
        level: Math.max(data.level ?? 1, level),
        updatedAt: Date.now(),
      }, { merge: true })
    })
  } catch (err) {
    // Never let leaderboard sync failures break gameplay
    console.error('[leaderboard] Failed to update entry:', err)
  }
}

/**
 * Fold this life's kills into the wallet's lifetime totalKills stat.
 * Call this once per death event, passing the RAW p.kills value from the
 * game engine at that moment (the full "SOULS PURGED" figure shown on the
 * death screen), not the on-chain boolean.
 *
 * Because a Revive keeps the run's p.kills counter going instead of
 * resetting it to 0, the same continuous life can dispatch several death
 * events whose `rawKillsThisLife` keeps growing (e.g. 12, then 12+9=21).
 * Naively adding each event's raw value would double-count. Instead we
 * track the raw value we last folded in (`lastRecordedKills`) and only add
 * the delta:
 *   - Same life, kept playing after a Revive: rawKills(21) >= last(12)
 *     -> add the 9 new kills.
 *   - A genuinely new life started (rawKills resets to a smaller number,
 *     e.g. p.kills starts back at 0/low after a fresh run): rawKills(5) <
 *     last(21) -> treat the drop as "a new life started", add all 5 rather
 *     than a negative/zero delta.
 * A Firestore transaction is used so two rapid death events (e.g. a flaky
 * connection retry) can't race and lose an update.
 */
export async function recordRunKills(
  walletAddress: string,
  rawKillsThisLife: number
): Promise<void> {
  if (!Number.isFinite(rawKillsThisLife) || rawKillsThisLife <= 0) return
  try {
    const normalizedAddr = walletAddress.toLowerCase()
    const ref = doc(db, 'leaderboard', normalizedAddr)
    await runTransaction(db, async (tx) => {
      // ── BOTH READS FIRST. THIS ORDER IS NOT A STYLE CHOICE ─────────────────
      //
      // Firestore rejects a transaction that reads after it writes: "Firestore
      // transactions require all reads to be executed before all writes." The
      // season mirror was added below the career write, so every call threw,
      // the catch swallowed it into a console line nobody was watching, and
      // NOTHING was recorded — not the season kills it was added for, and not
      // the career kills that had worked for months.
      //
      // Owner, from the live board: *"aku test login pakai email, tapi di
      // leaderboard tidak tercatat jumlah kills nya?"* XP was fine on the same
      // row, which is the tell — recordRunProgress does one read and two
      // writes, so it was never affected.
      const seasonId = seasonKey()
      const seasonRef = seasonPlayerRef(seasonId, normalizedAddr)
      const snap = await tx.get(ref)
      const seasonSnap = await tx.get(seasonRef)
      const data = (snap.exists() ? snap.data() : {}) as Partial<LeaderboardDoc>
      const seasonPrev = (seasonSnap.exists() ? seasonSnap.data() : {}) as { kills?: number }
      const prevTotal = data.totalKills ?? data.kills ?? 0
      const lastRecorded = data.lastRecordedKills ?? 0
      const delta =
        rawKillsThisLife >= lastRecorded
          ? rawKillsThisLife - lastRecorded
          : rawKillsThisLife // a fresh life started; count it in full
      tx.set(
        ref,
        {
          totalKills: prevTotal + delta,
          lastRecordedKills: rawKillsThisLife,
          updatedAt: Date.now(),
        },
        { merge: true }
      )
      // Season kills ride the SAME delta — the hard part (not double-counting a
      // Revive that keeps p.kills climbing) is already solved above, and
      // solving it twice is how the two totals would drift apart.
      tx.set(
        seasonRef,
        {
          walletAddress: normalizedAddr,
          kills: (seasonPrev.kills ?? 0) + delta,
          updatedAt: Date.now(),
        },
        { merge: true }
      )
    })
  } catch (err) {
    console.error('[leaderboard] Failed to record run kills:', err)
  }
}

/**
 * Sync a player's LIVE xp/level (from the client-side game engine — the
 * only real source of truth for these stats now that combat no longer
 * calls the NullState contract's executeAction(), see notes in
 * useContractPlayer.ts) into the wallet's leaderboard doc.
 *
 * Call this everywhere recordRunKills() is already called (Save & Exit,
 * silent auto-save, on-death) passing the same live snapshot's xp/level.
 *
 * Uses max(existing, new) rather than a blind overwrite: xp/level should
 * read as "best ever reached", so a fresh character started after death
 * (which legitimately starts back at low xp/level) never erases a
 * higher figure this wallet already reached on a previous life.
 */
export async function recordRunProgress(
  walletAddress: string,
  xp: number,
  level: number
): Promise<void> {
  if (!Number.isFinite(xp) || !Number.isFinite(level)) return
  try {
    const normalizedAddr = walletAddress.toLowerCase()
    const ref = doc(db, 'leaderboard', normalizedAddr)
    await runTransaction(db, async (tx) => {
      // BOTH READS FIRST — Firestore rejects a read after a write, and that
      // rule already cost this file every kill for a month. See
      // scripts/test-leaderboard-writes.js.
      const seasonId = seasonKey()
      const snap = await tx.get(ref)
      const seasonSnap = await tx.get(seasonPlayerRef(seasonId, normalizedAddr))
      const data = (snap.exists() ? snap.data() : {}) as Partial<LeaderboardDoc>
      const seasonPrev = (seasonSnap.exists() ? seasonSnap.data() : {}) as { xp?: number }
      const nextXp = Math.max(data.xp ?? 0, xp)
      const nextLevel = Math.max(data.level ?? 1, level)
      // Career xp stays a high-water mark, because that is what "career" means
      // and a New Game must not erase it. The SEASON no longer derives from it:
      // for a returning player the high-water mark never moves, which is
      // exactly how a wallet with 30 kills ended up showing 0 season XP.
      const gain = seasonXpGain(data, xp)
      tx.set(
        ref,
        {
          walletAddress: normalizedAddr,
          xp: nextXp,
          level: nextLevel,
          lastRecordedXp: xp,
          updatedAt: Date.now(),
        },
        { merge: true }
      )
      // The season mirror. `username` is deliberately absent: this write can
      // happen mid-run with no name in hand, and merging an undefined over a
      // real one would blank the row. updateLeaderboardEntry owns the name.
      tx.set(
        seasonPlayerRef(seasonId, normalizedAddr),
        {
          walletAddress: normalizedAddr,
          xp: (seasonPrev.xp ?? 0) + gain,
          level: nextLevel,
          updatedAt: Date.now(),
        },
        { merge: true }
      )
    })
  } catch (err) {
    console.error('[leaderboard] Failed to record run progress:', err)
  }
}

/**
 * Fetch a single wallet's live leaderboard doc (xp/level/totalKills) —
 * used by useContractPlayer.ts to override the frozen on-chain xp/level
 * with the real, currently-accurate figures synced via recordRunProgress.
 */
export async function getLeaderboardEntry(
  walletAddress: string
): Promise<{ xp: number; level: number; totalKills: number } | null> {
  try {
    const normalizedAddr = walletAddress.toLowerCase()
    const snap = await getDoc(doc(db, 'leaderboard', normalizedAddr))
    if (!snap.exists()) return null
    const data = snap.data() as LeaderboardDoc
    return {
      xp: data.xp ?? 0,
      level: data.level ?? 1,
      totalKills: data.totalKills ?? data.kills ?? 0,
    }
  } catch (err) {
    console.error('[leaderboard] Failed to fetch entry:', err)
    return null
  }
}

/**
 * The board that PAYS: top N by XP earned during `seasonId` (default: the
 * season running right now).
 *
 * A plain single-field `orderBy` on a subcollection, so it needs no composite
 * index — which is half the reason the season lives in its own collection
 * rather than as extra fields on the all-time doc.
 *
 * Falls back to nothing rather than to the all-time board on failure: showing
 * career totals under a "SEASON" heading would be a wrong answer presented as
 * a right one, and this is the screen the prize is decided on.
 */
export async function getSeasonLeaderboard(
  topN: number = 100,
  seasonId: string = String(currentSeasonId()),
): Promise<LeaderboardEntry[]> {
  try {
    const q = query(
      collection(db, 'seasonLeaderboard', seasonId, 'players'),
      orderBy('xp', 'desc'),
      limit(topN),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d, index) => {
      const data = d.data() as LeaderboardDoc
      return {
        rank: index + 1,
        walletAddress: data.walletAddress,
        username: data.username,
        xp: data.xp ?? 0,
        level: data.level ?? 1,
        kills: data.totalKills ?? data.kills ?? 0,
      }
    })
  } catch (err) {
    console.error('[leaderboard] Failed to fetch season leaderboard:', err)
    return []
  }
}

/**
 * Fetch the top N players by CAREER XP directly from Firestore.
 *
 * This is the all-time board now, not the one the season bonus is paid from —
 * see the note at the top of this file. It is still worth showing: a player who
 * spent months building 8,581 XP should not have that quietly stop existing
 * because the prize moved to a fairer metric.
 */
export async function getLeaderboard(topN: number = 100): Promise<LeaderboardEntry[]> {
  try {
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('xp', 'desc'),
      limit(topN)
    )
    const snap = await getDocs(q)

    const entries: LeaderboardEntry[] = snap.docs.map((d, index) => {
      const data = d.data() as LeaderboardDoc
      return {
        rank: index + 1,
        walletAddress: data.walletAddress,
        username: data.username,
        xp: data.xp,
        level: data.level,
        kills: data.totalKills ?? data.kills ?? 0,
      }
    })

    return entries
  } catch (err) {
    console.error('[leaderboard] Failed to fetch leaderboard:', err)
    return []
  }
}
