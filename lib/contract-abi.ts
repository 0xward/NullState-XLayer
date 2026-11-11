/**
 * NullState Smart Contract ABIs & Addresses
 *
 * Contracts deployed on Celo Mainnet (chainId: 42220)
 * - PassSBT       : NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS
 * - NullStateReward: NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS
 * - TreasureVault : NEXT_PUBLIC_TREASURE_VAULT_ADDRESS
 */

// ─── Contract Addresses ───────────────────────────────────────────────────────
// Live & verified on Celo Mainnet. Env vars still override if set, but these
// hardcoded values act as the source of truth so the app never silently falls
// back to '0x'.

// PassSBT v1 was live at 0x5235ffBb4C02fCabf29b76Aa0011DA3E1eD96f0e but had
// TWO confirmed bugs (see contracts/PASSBT_V2_UPGRADE_GUIDE.md):
// (1) a lifetime-not-per-season mint lock, and (2) all 6 seasons were
// initialized on-chain with 2024 timestamps instead of 2026 (confirmed via
// CeloScan tx logs, session v34 — SeasonCreated event for 202607 shows
// startDate 1719792000 = 1 Jul 2024, not 2026). v1 has no admin function to
// fix already-initialized season dates, so v1 was retired in favor of
// PassSBTv2.sol (v2.1 — flexible USDm/USDC/USDT payment via backend-verified
// mint, see contracts/PassSBTv2.sol for the full design writeup).
//
// PassSBTv2 (v2.1) redeployed to Celo Mainnet 2026-07-13 at the address
// below, AFTER an earlier same-day deploy at
// 0x390239A07616624b6521EC0022D348512d09053b was abandoned — that one was
// compiled with a non-release solc build (npm resolved "^0.8.36" to an
// unofficial/nightly-like build, `0.8.36+commit.8a079791`, which had no
// matching entry in Celoscan's verified-compiler list, so it could never
// be verified). This address was compiled with solc 0.8.20+commit.a1b79de6
// (the same official release used throughout this project) — Celoscan
// verification SUCCEEDED. The old 0x39023... address was never
// initialized/used (no seasons, no mints) and is abandoned for good.
//
// DONE on-chain this session (Fa confirmed all 7 txs mined):
// 1. `setBackendAddress(0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6, true)`
//    — same backend wallet already authorized on TreasureVault.sol
//    (confirmed via that contract's BackendAddressUpdated event log).
// 2. `initializeSeason` x6, values from SEASONS_CONFIGURATION.md (2026
//    timestamps, corrected — not the 2024 values wrongly used on the
//    retired v1 contract).
//
// STILL PENDING — the only steps left before this is usable end-to-end:
// 1. Set NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS in Vercel to this address
//    (Fa needs to do this — I can't touch Vercel from here), redeploy.
// 2. Test a paid mint end-to-end on mobile — ideally from a wallet holding
//    USDC or USDT (not USDm), to actually confirm pickBestPaymentToken()
//    auto-detect picks the right token and /api/passsbt/mint's on-chain
//    verification + backendMintPass() call both succeed for a non-USDm
//    payment, not just the token everyone's been testing with so far.
export const PASS_SBT_ADDRESS = (process.env
  .NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS ||
  '0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39') as `0x${string}`

// #9 GUARD (added this session, investigating "Mint Pass Transaction failed
// despite sufficient balance"): the STILL PENDING note above says Vercel's
// NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS may still be set to a retired
// address from before the v2 redeploy. The `||` fallback above ONLY kicks
// in when the env var is unset/empty — if Vercel has it explicitly set to
// one of these two dead addresses, the app would silently keep calling a
// contract that either has no `backendMintPass()` function at all (v1) or
// was never initialized with any seasons (the abandoned solc-0.8.36
// attempt) — either way, the on-chain revert message won't contain any
// "insufficient funds"-style text, so getUserFriendlyError() (see
// lib/errorUtils.ts) falls through to its generic "Transaction failed.
// Please try again." — which matches the reported bug exactly, and has
// NOTHING to do with the user's actual token balance.
// This can't be fixed from code (only Vercel's dashboard controls the env
// var), but loudly logging it means the next time someone hits "Transaction
// failed" on a pass mint, opening the browser console immediately shows
// whether this is the cause — no tx hash needed to at least rule this in
// or out.
const RETIRED_PASS_SBT_ADDRESSES = [
  '0x5235ffbb4c02fcabf29b76aa0011da3e1ed96f0e', // v1 — lifetime-lock bug + 2024 season dates, no backendMintPass()
  '0x390239a07616624b6521ec0022d348512d09053b', // abandoned same-day v2 attempt — non-release solc build, never verified, never initialized (no seasons)
  '0x1ab2afa55d9b14df1200ada0495c8d78d4ba3f16', // v2.1 — retired in favor of v3 (PassSBTv3), session v44
]
if (PASS_SBT_ADDRESS && RETIRED_PASS_SBT_ADDRESSES.includes(PASS_SBT_ADDRESS.toLowerCase())) {
  const msg =
    `[NullState] PASS_SBT_ADDRESS (${PASS_SBT_ADDRESS}) is a RETIRED PassSBT contract. ` +
    `Every mint attempt will fail. Fix: update NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS in ` +
    `Vercel's env vars to 0x44065B9faf1149FEB4D6Dcdb10d864B2054c7f39 (or remove the var ` +
    `entirely so the hardcoded fallback above is used), then redeploy.`
  console.error(msg)
}

// NullStateRewardV3 (deployed 2026-07, Celo mainnet). Replaces V2
// (0x38F85c7cE8757E2940938D4e49bCDaE1CB5D475A) — see RETIRED list below.
// V2 capped seasonId at 1..6 while PassSBTv3 + the app use YYYYMM, which
// made the season-bonus reward impossible to deposit/claim; V3 relaxes that
// guard (see contracts/NullStateRewardV3.sol). Weekly-burn rewards are
// unaffected (that pool is already off-chain).
export const REWARD_CONTRACT_ADDRESS = (process.env
  .NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS ||
  '0xec2e7fe57a92ada02c1ab37d9415dad508b7f111') as `0x${string}`

// Retired-address guard (added session v55, same pattern as PASS_SBT_ADDRESS
// above — that guard caught a real live misconfiguration this session, so
// the same protection is added here even though no incorrect Reward/Vault
// env value has actually been observed yet). NullStateReward.sol (v1) was
// retired in favor of NullStateRewardV2.sol, but no deployed address for the
// v1 contract was ever recorded in this repo's docs, so the list below is
// empty for now — add the old address here if it's ever found (e.g. in a
// Vercel dashboard history or a teammate's notes), and this will start
// catching it automatically.
const RETIRED_REWARD_ADDRESSES: string[] = [
  '0x38f85c7ce8757e2940938d4e49bcdae1cb5d475a', // NullStateRewardV2 — seasonId capped 1..6 (broke season bonus), replaced by V3
]
if (
  REWARD_CONTRACT_ADDRESS &&
  RETIRED_REWARD_ADDRESSES.includes(REWARD_CONTRACT_ADDRESS.toLowerCase())
) {
  console.error(
    `[NullState] REWARD_CONTRACT_ADDRESS (${REWARD_CONTRACT_ADDRESS}) is a RETIRED ` +
      `NullStateReward contract. Fix: update NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS in ` +
      `Vercel's env vars to 0xec2e7fe57a92ada02c1ab37d9415dad508b7f111 (or remove the var ` +
      `entirely so the hardcoded fallback above is used), then redeploy.`
  )
}

export const TREASURE_VAULT_ADDRESS = (process.env
  .NEXT_PUBLIC_TREASURE_VAULT_ADDRESS ||
  '0xB145dE296cD37Cb2A62Ced70Ee4d93c1d78df742') as `0x${string}`

// Retired-address guard (added session v55) — same rationale as
// RETIRED_REWARD_ADDRESSES above. TreasureVault.sol (v1) was retired in
// favor of TreasureVaultV2.sol; no old deployed address was found recorded
// anywhere in this repo, so the list is empty until one turns up.
const RETIRED_VAULT_ADDRESSES: string[] = []
if (
  TREASURE_VAULT_ADDRESS &&
  RETIRED_VAULT_ADDRESSES.includes(TREASURE_VAULT_ADDRESS.toLowerCase())
) {
  console.error(
    `[NullState] TREASURE_VAULT_ADDRESS (${TREASURE_VAULT_ADDRESS}) is a RETIRED ` +
      `TreasureVault contract. Fix: update NEXT_PUBLIC_TREASURE_VAULT_ADDRESS in ` +
      `Vercel's env vars to 0xB145dE296cD37Cb2A62Ced70Ee4d93c1d78df742 (or remove the var ` +
      `entirely so the hardcoded fallback above is used), then redeploy.`
  )
}

// USDm (Mento Dollar, migrated from cUSD) — used for NULL_STRIKE fee & burn
// rewards. Standard 18-decimal ERC20.
export const USDM_ADDRESS = (process.env.NEXT_PUBLIC_USDM_ADDRESS ||
  '0x765DE816845861e75A25fCA122bb6898B8B1282a') as `0x${string}`

export const USDM_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// v2.1: pass price is now 0.30 USD, payable in whichever of USDm/USDC/USDT
// the connected wallet holds the most of (same MARKETPLACE_TOKENS pattern
// as the Marketplace — see lib/constants/tokens.ts). The old fixed
// v3 (PassSBTv3 redeploy): the hardcoded PASS_PRICE_USD = '0.3' constant
// that used to live here is GONE. Price is now a single on-chain source of
// truth — PassSBTv3.passPriceUsdCents (owner-adjustable via
// setPassPriceUsdCents(), see contracts/PassSBTv3.sol) — read at call time
// via getPassPriceUsd() below, instead of a separate hardcoded number that
// could silently drift out of sync with the contract (this is exactly what
// caused a prior redeploy: two places disagreeing on a number). Both
// app/api/passsbt/mint/route.ts (backend price verification) and
// hooks/usePassSBT.ts (frontend "how much do I pay") now call this.
//
// NOTE on the param type: deliberately NOT typed as viem's full `PublicClient`
// (as an earlier version of this function was). That type pulls in the
// getBlock()/transaction shape for every chain viem ships, which drifts
// whenever viem adds a new built-in chain (broke a `next build` this session
// after viem 2.52.2 added "tempo") — a client typed to one specific chain
// (e.g. celo) then stops structurally matching the generic type. Using a
// minimal structural type (just the one method this function actually calls)
// sidesteps that entirely and matches the existing pattern already used by
// pickBestFeeCurrency()/pickBestPaymentToken() in lib/constants/tokens.ts.

/**
 * Read the current pass price from PassSBTv3 on-chain and return it as a
 * decimal-dollar string (e.g. "0.30"), the same format parseTokenAmount()
 * in lib/constants/tokens.ts expects. Cents -> dollars conversion is done
 * here so callers never need to know the on-chain unit is cents.
 */
export async function getPassPriceUsd(
  publicClient: { readContract: (args: any) => Promise<unknown> }
): Promise<string> {
  const cents = (await publicClient.readContract({
    address: PASS_SBT_ADDRESS,
    abi: PASS_SBT_ABI,
    functionName: 'getPassPriceUsdCents',
  })) as bigint

  const centsNum = Number(cents)
  return (centsNum / 100).toFixed(2)
}


// ─── PassSBT ABI ─────────────────────────────────────────────────────────────

export const PASS_SBT_ABI = [
  // Season management (owner only)
  {
    name: 'initializeSeason',
    type: 'function',
    inputs: [
      { name: '_seasonId', type: 'uint256' },
      { name: '_startDate', type: 'uint256' },
      { name: '_endDate', type: 'uint256' },
      { name: '_maxSupply', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Whitelist management (owner only)
  {
    name: 'addToWhitelist',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'removeFromWhitelist',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'addBatchWhitelist',
    type: 'function',
    inputs: [
      { name: '_users', type: 'address[]' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'removeBatchWhitelist',
    type: 'function',
    inputs: [
      { name: '_users', type: 'address[]' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Pass minting
  {
    name: 'mintFreePass',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // v2.1: replaces v1/v2's mintPaidPass() (which pulled a hardcoded USDm
  // amount on-chain). Payment now happens off-chain first (plain ERC20
  // transfer() of 0.30 USD in USDm/USDC/USDT to TREASURY_WALLET, same as
  // Marketplace purchases), verified by app/api/passsbt/mint/route.ts,
  // which then calls this function using the backend signer. Restricted
  // onlyBackend on-chain — the frontend never calls this directly.
  {
    name: 'backendMintPass',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Owner-only: authorize/revoke a backend signer allowed to call
  // backendMintPass(). Not called from the frontend — included here so the
  // same PASS_SBT_ABI can be reused by a one-off admin script if needed.
  {
    name: 'setBackendAddress',
    type: 'function',
    inputs: [
      { name: '_backend', type: 'address' },
      { name: '_isBackend', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Query functions
  {
    name: 'hasPass',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getUserPassSeason',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'isWhitelisted',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getSeasonInfo',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [
      { name: 'supply', type: 'uint256' },
      { name: 'minted', type: 'uint256' },
      { name: 'startDate', type: 'uint256' },
      { name: 'endDate', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  // v2-only: check a SPECIFIC season regardless of whether it's the
  // contract's idea of "current" season. Not wired into any component yet
  // (v1 didn't have this), but available for e.g. showing "you already
  // own this" on a non-active season card in the future.
  {
    name: 'hasPassForSeason',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // v2-only: same on-chain "which season is active right now" logic that
  // hasPass() uses internally, exposed directly.
  {
    name: 'getCurrentSeasonId',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // v3-only: on-chain source of truth for pass price (USD cents), used by
  // getPassPriceUsd() above so the backend and frontend never hardcode a
  // separate number that could drift out of sync with the contract.
  {
    name: 'getPassPriceUsdCents',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // v2 replacement for v1's `userPassSeason` — same underlying idea (most
  // recently minted season for a user) but v1's version was also (mis)used
  // as the lifetime "already minted" lock, which is the bug v2 fixes.
  // getUserPassSeason() above already exposes this value through the
  // ABI-compatible name NullStateReward.sol expects; this raw mapping
  // getter is included too since it's public on the contract either way.
  {
    name: 'lastPassSeason',
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'whitelistClaimed',
    type: 'function',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'PassMinted',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'seasonId', type: 'uint256', indexed: false },
      { name: 'isFree', type: 'bool', indexed: false },
    ],
  },
  {
    name: 'SeasonCreated',
    type: 'event',
    inputs: [
      { name: 'seasonId', type: 'uint256', indexed: false },
      { name: 'startDate', type: 'uint256', indexed: false },
      { name: 'endDate', type: 'uint256', indexed: false },
    ],
  },
] as const

// ─── NullStateReward ABI ──────────────────────────────────────────────────────

export const REWARD_ABI = [
  // Burn tracking (backend only)
  {
    name: 'recordBurn',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_itemCount', type: 'uint256' },
      { name: '_burnValue', type: 'uint256' },
      { name: '_rewardToken', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Weekly pool management
  {
    name: 'depositWeeklyPool',
    type: 'function',
    inputs: [
      { name: '_week', type: 'uint256' },
      { name: '_rewardToken', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimWeeklyRewards',
    type: 'function',
    inputs: [{ name: '_week', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Leaderboard
  {
    name: 'updateLeaderboard',
    type: 'function',
    inputs: [
      { name: '_seasonId', type: 'uint256' },
      { name: '_topPlayers', type: 'address[3]' },
      { name: '_topScores', type: 'uint256[3]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'depositSeasonBonus',
    type: 'function',
    inputs: [
      { name: '_seasonId', type: 'uint256' },
      { name: '_rewardToken', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'claimSeasonBonus',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Query functions
  {
    name: 'getSeasonLeaderboard',
    type: 'function',
    inputs: [{ name: '_seasonId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'seasonId', type: 'uint256' },
          { name: 'topPlayers', type: 'address[3]' },
          { name: 'topScores', type: 'uint256[3]' },
          { name: 'rewardToken', type: 'address' },
          { name: 'totalDeposited', type: 'uint256' },
          { name: 'deposited', type: 'bool' },
          { name: 'finalized', type: 'bool' },
          { name: 'updatedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getUserWeeklyBurn',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_week', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getUserWeeklyClaimed',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_week', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'hasClaimedSeasonBonus',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_seasonId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'weeklyPools',
    type: 'function',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'week', type: 'uint256' },
      { name: 'rewardToken', type: 'address' },
      { name: 'depositedAmount', type: 'uint256' },
      { name: 'claimedAmount', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'weeklyPoolSize',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'maxPerUserPerWeek',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Constants
  {
    name: 'RANK1_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'RANK2_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'RANK3_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'BurnRecorded',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'itemCount', type: 'uint256', indexed: false },
      { name: 'burnValue', type: 'uint256', indexed: false },
      { name: 'rewardToken', type: 'address', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BurnClaimed',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'week', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'rewardToken', type: 'address', indexed: false },
    ],
  },
  {
    name: 'LeaderboardUpdated',
    type: 'event',
    inputs: [
      { name: 'seasonId', type: 'uint256', indexed: true },
      { name: 'topPlayers', type: 'address[3]', indexed: false },
      { name: 'topScores', type: 'uint256[3]', indexed: false },
    ],
  },
  {
    name: 'SeasonBonusClaimed',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'seasonId', type: 'uint256', indexed: false },
      { name: 'rank', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

// ─── TreasureVault ABI ────────────────────────────────────────────────────────

export const TREASURE_VAULT_ABI = [
  // Vault pool management (owner only)
  {
    name: 'depositVaultPool',
    type: 'function',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'withdrawVaultPool',
    type: 'function',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Code management (backend only)
  {
    name: 'storeWeeklyVaultCode',
    type: 'function',
    inputs: [
      { name: '_weekId', type: 'uint256' },
      { name: '_code', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'submitVaultCode',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
      { name: '_code', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'unlockVaultForNewWeek',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_newWeekId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Query functions
  {
    name: 'getUserAttempts',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getRemainingAttempts',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'hasClaimedThisWeek',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'isLockedThisWeek',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_weekId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getVaultPoolStats',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'deposited', type: 'uint256' },
      { name: 'claimed', type: 'uint256' },
      { name: 'available', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getAvailableVaultFunds',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'isCodeSetForWeek',
    type: 'function',
    inputs: [{ name: '_weekId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'currentRewardToken',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'VAULT_REWARD',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'MAX_ATTEMPTS_PER_WEEK',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    name: 'VaultCodeCorrect',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'weekId', type: 'uint256', indexed: true },
      { name: 'reward', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'VaultCodeIncorrect',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'weekId', type: 'uint256', indexed: true },
      { name: 'attemptNumber', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'VaultLocked',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'weekId', type: 'uint256', indexed: true },
    ],
  },
] as const
