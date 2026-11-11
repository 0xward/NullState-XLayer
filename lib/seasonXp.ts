// How much of a player's career XP belongs to the season currently running.
//
// Pure arithmetic, in its own file with no Firebase import, for one reason:
// this is the calculation that decides who gets paid, and it is the only part
// of the season leaderboard that can be tested without a browser or a database
// (`npm run test:seasonxp`).
//
// ── THE PROBLEM IT SOLVES ───────────────────────────────────────────────────
//
// OWNER: *"pertimbangan rank skrg sudah bagus belum? mengingat hanya dari xp?"*
//
// XP is cumulative and never resets (GAME-DESIGN.md §9.3), so ranking a SEASON
// by it produced an all-time board that merely paid out monthly. July's winner
// opened August already 5,926 XP ahead of second place — earned in a month that
// was over — and a player joining in September could never have won at all.
//
// A season score is therefore a DELTA. The first version took that delta
// against a BASELINE — career XP now, minus career XP when the season started —
// and it was wrong for exactly the players who had been here longest.
//
// ── HOW THE BASELINE FAILED, AND WHY IT LOOKED FINE ─────────────────────────
//
// OWNER, Season 2, from the live board: *"pake wallet lainnya kills terhitung
// tp xp tidak."* His row read 30 kills and 0 XP.
//
// Career XP is stored as a high-water mark — Math.max(stored, incoming) — so a
// New Game, which legitimately restarts at 0, cannot erase it. Combine the two
// and a returning player is frozen:
//
//     stored career xp (from Season 1) .... 8581
//     baseline for Season 2 ............... 8581
//     this run's xp ....................... 585
//     max(8581, 585) - 8581 ...............    0
//
// They earn nothing for the season until ONE RUN beats their all-time best. A
// brand-new wallet is baselined at 0 and works perfectly, which is why some
// accounts looked right and others sat at zero.
//
// ── WHAT REPLACED IT ────────────────────────────────────────────────────────
//
// The same shape recordRunKills has used correctly all along: remember what was
// last reported, add the increase. It accumulates what the player actually
// earned, it survives a New Game (a lower figure is a fresh run and counts in
// full), and it never consults a high-water mark.

/** The fields the calculation reads off a stored leaderboard doc. */
export interface SeasonXpDoc {
  /**
   * The engine's raw xp figure as last reported, NOT the career high-water
   * mark. The two differ the moment a player starts a New Game, and telling
   * them apart is the whole fix.
   */
  lastRecordedXp?: number
}

/**
 * How much XP to ADD to this season's total for a report of `xp`.
 *
 * Three cases, and the first two are the ones the baseline got wrong:
 *
 *   1. Never reported before -> 0. There is nothing to compare against, so the
 *      player is anchored here and starts earning from their next report. This
 *      is also the migration: every existing doc lands here once, and the
 *      season carries on from whatever it had rather than jumping.
 *   2. Higher than last time -> the increase. What they earned since.
 *   3. LOWER than last time -> the whole figure. p.xp only goes down when a run
 *      restarts, so the new run's progress counts in full. The old code read
 *      this as "no progress" forever.
 *
 * Never negative, and never inflated by re-reporting the same number: two
 * writers calling this with an unchanged `xp` add nothing the second time.
 */
export function seasonXpGain(doc: SeasonXpDoc | null | undefined, xp: number): number {
  if (!Number.isFinite(xp) || xp < 0) return 0
  const last = doc?.lastRecordedXp
  if (typeof last !== 'number') return 0
  return xp >= last ? xp - last : xp
}
