'use client'

// PROTOCOL ZERO — has this player finished the campaign?
//
// The engine has owned this flag since the epilogue shipped
// (`hasCompletedCampaign()` in public/game-engine/game.js). This module does not
// introduce a second one; it reads the SAME key, so the two can never disagree.
// Duplicating the answer would be the exact failure the world-map flag module
// was written to avoid — two places deciding one thing.
//
// ── WHY THE SHELL NEEDS TO KNOW ──────────────────────────────────────────────
//
// OWNER, after cracking the vault for real: "setelah buka vault itu aku masuk
// menu abbys, menurut km itu hilangkan atau jangan?"
//
// He landed on the engine's own title screen — DESCEND / NEW GAME+ / THE NULL
// ABYSS — because the finale called returnToTitleScreen() unconditionally. That
// screen predates the world map, and with the map on it is a dead end: the HUD
// is hidden, so there is no Save & Exit, and nothing on it goes back to the map.
// Winning the game put the player somewhere they could not leave.
//
// The answer is not to remove the Abyss. It is the campaign-completion reward
// and, with the map as the home screen, the ONLY door to it and to New Game+.
// The answer is that the finale should surface to the map like every other
// cleared bunker, and the map should be the thing that holds the endgame.
//
// Two consumers, one key:
//   • WorldMapHub — Bunker 5 reads as CLEARED (so it can be raided for the
//     weekly vault) and the endgame entries appear in the menu.
//   • GameFlowManager — the run that just ended surfaces to the map instead of
//     to a screen with no exit.
//
// Per-device, like the engine's copy. This gates cosmetic access to modes the
// player has already earned, not a payout — the server owns every reward either
// of those modes can produce.

const key = (address: string | null | undefined) =>
  'nullstate-protocolzero-' + (address ? address.toLowerCase() : 'guest')

/** Written once, per wallet, by the engine's PROTOCOL ZERO epilogue. */
export function readCampaignComplete(address: string | null | undefined): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key(address)) === '1'
  } catch {
    // Storage blocked — the endgame entries stay hidden, which is the same
    // thing a player who has not finished sees. Never a thrown error on the
    // game's home screen.
    return false
  }
}

/**
 * Belt-and-suspenders for the surfacing path.
 *
 * The engine writes this flag inside `showCampaignEpilogue`, which is skipped on
 * a REPLAY of the finale (the epilogue is one-time). If the flag were somehow
 * missing on a wallet that has genuinely reached the end — storage cleared
 * between the epilogue and now, a wallet connected after finishing as a guest —
 * the map would hide the modes they earned. Writing it again on arrival is
 * idempotent and costs nothing.
 */
export function markCampaignComplete(address: string | null | undefined): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key(address), '1')
  } catch { /* storage blocked — the engine's own copy still gates the title screen */ }
}

// Shown once, on the first visit to the map after the campaign ends. Separate
// from the completion flag because "has finished" is permanent and "has been
// told what that unlocked" happens exactly one time.
const SEEN = (address: string | null | undefined) =>
  'nullstate-endgame-seen-' + (address ? address.toLowerCase() : 'guest')

export function takeEndgameReveal(address: string | null | undefined): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage.getItem(SEEN(address)) === '1') return false
    window.localStorage.setItem(SEEN(address), '1')
    return true
  } catch {
    return false
  }
}
