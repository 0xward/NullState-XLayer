// Server-side Season Pass helpers (TASK #7 — daily perks).
//
// The pass is a soulbound NFT (contracts/PassSBTv3.sol). "Does this wallet get
// pass perks RIGHT NOW" is answered on-chain by PassSBTv3.hasPass(user), which
// returns true only when the wallet holds a pass for the CURRENTLY-ACTIVE
// season (see the contract's getCurrentSeasonId()/hasPass()). We read it here
// with the same publicClient the mint-verify route uses, so a perk can never
// be granted to a wallet the chain says is not an active holder.

import { publicClient } from '@/lib/web3-client'
import { PASS_SBT_ADDRESS, PASS_SBT_ABI } from '@/lib/contract-abi'

/**
 * On-chain check: does `wallet` currently hold an active-season pass?
 * Returns false (never throws) if the contract isn't configured or the RPC
 * read fails — perks fail CLOSED (a read error must not hand out a free
 * grant), the opposite of the energy-spend bridge which fails open.
 */
export async function hasActivePass(wallet: string): Promise<boolean> {
  if (!PASS_SBT_ADDRESS || PASS_SBT_ADDRESS === '0x') return false
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return false
  try {
    const has = await publicClient.readContract({
      address: PASS_SBT_ADDRESS,
      abi: PASS_SBT_ABI,
      functionName: 'hasPass',
      args: [wallet as `0x${string}`],
    })
    return has === true
  } catch {
    return false
  }
}
