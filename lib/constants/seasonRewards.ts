// What each leaderboard place is paid at the end of a season, in USDT.
//
// **Owner, 2026-07-31: 20 / 5 / 3, then $1 each down to rank 10.** $35 a month.
//
// ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
//
// It lives here, and not in `lib/server/seasonClose.ts` where it started,
// because two very different things need it and only one of them runs on a
// server:
//
//   • the season close (freezing the snapshot, generating the payout commands),
//   • and the LEADERBOARD the player is looking at while they compete.
//
// The second is the point. A prize nobody can see while they are playing for it
// is not a prize, it is a surprise — and the owner asked for it on the board:
// *"tampilkan juga di leaderboard musim lalu."* Copying the numbers into the
// component would have made a second source of truth for a figure that is a
// promise of real money; `seasonClose.ts` imports this file instead.
//
// Nothing here touches firebase-admin or viem, so a client component can import
// it without dragging the server into the bundle.

/** Reward by position, index 0 = rank 1. Length defines how deep the prize goes. */
export const RANK_REWARDS_USD = [20, 5, 3, 1, 1, 1, 1, 1, 1, 1] as const

/** How many places are paid at all. */
export const PAID_RANKS = RANK_REWARDS_USD.length

/**
 * How many of those the CONTRACT can pay.
 *
 * Fixed at 3 by the deployed `NullStateRewardV3`: `updateLeaderboard` takes
 * `address[3]` and `setRankRewards` takes exactly three amounts. Ranks 4-10
 * therefore cannot be claimed in-app at all — they are sent directly to the
 * winner's wallet. Redeploying the contract to widen this is out of scope, and
 * the UI says which is which rather than implying a claim that cannot exist.
 */
export const ONCHAIN_RANKS = 3

/** What rank `n` (1-based) is paid, or 0 if it is outside the prize. */
export function rewardForRank(rank: number): number {
  if (!Number.isFinite(rank) || rank < 1) return 0
  return RANK_REWARDS_USD[Math.floor(rank) - 1] ?? 0
}

/** The whole month's cost, so nothing has to add it up by hand. */
export const SEASON_POOL_USD = RANK_REWARDS_USD.reduce((a, b) => a + b, 0)

/** Which token every season prize is paid in. */
export const SEASON_PAYOUT_TOKEN = 'USDT'
