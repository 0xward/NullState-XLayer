/**
 * NullState player types.
 *
 * Phase 0: the old NullState.sol contract (register/executeAction/getPlayer)
 * has been RETIRED. Player identity and progress are fully off-chain now
 * (Firebase — see useContractPlayer.ts / leaderboardService.ts). The ABI
 * below is intentionally empty; only the PlayerProfile / LeaderboardEntry
 * shapes below are still used across the app.
 */

// Retired contract — ABI intentionally empty (kept as an export so any
// lingering type-only reference still resolves).
export const NULLSTATE_CONTRACT_ABI = [] as const

export interface PlayerProfile {
  username: string
  xp: number
  level: number
  kills: number
  isRegistered: boolean
  walletAddress: string
}

export interface LeaderboardEntry {
  rank: number
  walletAddress: string
  username: string
  xp: number
  level: number
  kills: number
}

/**
 * Character class constants (align with contract)
 */
export const CHARACTER_CLASSES = {
  WARRIOR: 0,
  MAGE: 1,
  ROGUE: 2,
  PALADIN: 3,
} as const

export const CHARACTER_CLASS_NAMES = {
  [CHARACTER_CLASSES.WARRIOR]: 'Warrior',
  [CHARACTER_CLASSES.MAGE]: 'Mage',
  [CHARACTER_CLASSES.ROGUE]: 'Rogue',
  [CHARACTER_CLASSES.PALADIN]: 'Paladin',
}
