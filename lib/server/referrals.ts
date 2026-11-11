import { createPublicClient, createWalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { celoTransport } from '@/lib/celoRpc'
import { PASS_SBT_ABI, PASS_SBT_ADDRESS } from '@/lib/contract-abi'
import { getCurrentSeasonId } from '@/lib/web3-client'
import type { getAdminDb } from '@/firebase-config'
import { getServerAttributionSuffix } from '@/lib/attribution-tag'

// =============================================
// REFERRALS — shared server helpers (growth blueprint 2A)
//
// Storage (Firebase RTDB):
//   refCodes/{CODE}          = wallet        (code -> referrer lookup)
//   referredBy/{invitee}     = { referrer, at }   (bound once, ever)
//   referrals/{referrer}     = { credited: {invitee:true}, count,
//                                claims: {t1|t3|t10: {...}} }
//   referralPassGifts/{referrer}/{seasonId} = { mintTxHash, at }
//
// A referral only COUNTS when the invitee clears Act 1 (client-reported —
// the rewards are timed trials + one cosmetic + a season pass, so client
// attestation is proportionate; every grant is still one-time-gated
// server-side and the pass mint is double-checked on-chain).
// =============================================

type Db = NonNullable<ReturnType<typeof getAdminDb>>

// Deterministic 8-char base36 code from the wallet address (FNV-1a over the
// hex chars — no crypto dependency, stable across calls). Exact resolution
// always goes through the refCodes/{code} mapping written on first read, so
// even a collision could never credit the wrong wallet silently — the first
// writer owns the code.
export function refCodeFor(wallet: string): string {
  const s = wallet.toLowerCase().replace(/^0x/, '')
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    h1 = (h1 ^ s.charCodeAt(i)) >>> 0; h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 = (h2 ^ s.charCodeAt(s.length - 1 - i)) >>> 0; h2 = Math.imul(h2, 0x85ebca6b) >>> 0
  }
  const raw = (h1.toString(36) + h2.toString(36)).replace(/[^a-z0-9]/g, '')
  return raw.slice(0, 8).toUpperCase().padEnd(8, '0')
}

// Ensure refCodes/{code} -> wallet exists (first writer wins).
export async function ensureRefCode(db: Db, wallet: string): Promise<string> {
  const code = refCodeFor(wallet)
  const ref = db.ref(`refCodes/${code}`)
  await ref.transaction((cur: string | null) => (cur ? undefined : wallet))
  return code
}

export const REFERRAL_TIERS = {
  t1: { refs: 1, weapons: 1, weaponHours: 72, skin: false },
  t3: { refs: 3, weapons: 3, weaponHours: 48, skin: true },
  t10: { refs: 10, weapons: 2, weaponHours: 168, skin: false },
} as const
export type ReferralTierKey = keyof typeof REFERRAL_TIERS

// ─── What the INVITEE gets ───────────────────────────────────────────────────
// Every tier above rewards the referrer. For a long time the person arriving
// through the link got nothing at all — and they are the one asked to do the
// work, because a referral only counts once they have cleared Act 1. Hours of
// play, no reward, while the friend who sent the link collects a weapon and a
// skin. That is the single most common way referral programmes fail: the
// invitee has no reason to follow through, so they don't, and the referrer's
// reward never triggers either. Both sides losing is not a stable design.
//
// So the invitee is handed a weapon the moment they bind. No choice screen and
// no claim step: this fires at the exact moment drop-off is highest, and every
// extra tap there costs conversion.
//
// Mid-tier on purpose. Something cheap would not register as a gift; something
// top-tier would undercut the shop, which is the thing that actually pays for
// the rewards. The trial clock starts on ACTIVATION, not on grant, so it cannot
// quietly expire on the shelf before they next open the game.
export const INVITEE_WELCOME = { weaponId: 'argent_waraxe', hours: 48 } as const

// Gift a free Season Pass to the referrer when their invitee makes a first
// purchase (weapon buy or pass mint). One gift per referrer per season;
// skipped silently if the referrer already holds this season's pass (the
// contract would revert the double-mint anyway). Never throws — a failed
// gift must not fail the purchase that triggered it.
export async function maybeGiftReferralPass(db: Db, buyerWallet: string): Promise<void> {
  try {
    const buyer = buyerWallet.toLowerCase()
    const boundSnap = await db.ref(`referredBy/${buyer}`).get()
    const referrer: string | undefined = boundSnap.val()?.referrer
    if (!referrer) return

    const seasonId = BigInt(getCurrentSeasonId())
    const giftRef = db.ref(`referralPassGifts/${referrer}/${seasonId}`)
    // Reserve the gift atomically so two concurrent purchases mint once.
    const tx = await giftRef.transaction((cur: unknown) => (cur ? undefined : { at: Date.now(), status: 'pending' }))
    if (!tx.committed) return

    const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY as `0x${string}` | undefined
    if (!backendPrivateKey || !PASS_SBT_ADDRESS) { await giftRef.remove(); return }

    const transport = celoTransport()
    const publicClient = createPublicClient({ chain: celo, transport })
    const holds = await publicClient.readContract({
      address: PASS_SBT_ADDRESS,
      abi: PASS_SBT_ABI,
      functionName: 'hasPassForSeason',
      args: [referrer as `0x${string}`, seasonId],
    }).catch(() => true) // read failed -> fail closed (skip mint)
    if (holds) { await giftRef.update({ status: 'skipped_already_holds' }); return }

    const account = privateKeyToAccount(backendPrivateKey)
    const walletClient = createWalletClient({ chain: celo, transport, account })
    const mintHash = await walletClient.writeContract({
      address: PASS_SBT_ADDRESS,
      abi: PASS_SBT_ABI,
      functionName: 'backendMintPass',
      args: [referrer as `0x${string}`, seasonId],
      account,
      dataSuffix: getServerAttributionSuffix(),
    })
    await publicClient.waitForTransactionReceipt({ hash: mintHash })
    await giftRef.update({ status: 'success', mintTxHash: mintHash })
  } catch (e) {
    // Log-and-continue: the buyer's own purchase must never fail because a
    // referral gift hiccuped.
    console.error('[referrals] pass gift failed:', e instanceof Error ? e.message : e)
  }
}
