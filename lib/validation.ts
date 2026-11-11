import { isAddress } from 'viem'
import { z } from 'zod'

export const walletAddressSchema = z
  .string()
  .trim()
  .min(1, 'walletAddress is required')
  .refine(isAddress, 'Invalid wallet address')

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be 32 characters or less')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, hyphen')

export const weekIdInputSchema = z.coerce.string().trim().min(1, 'weekId is required')
export const seasonIdInputSchema = z.coerce.string().trim().min(1, 'seasonId is required')
export const vaultCodeSchema = z.string().trim().regex(/^\d{4}$/, 'Code must be 4 digits')

export const vaultSubmitBodySchema = z.object({
  walletAddress: walletAddressSchema,
  weekId: weekIdInputSchema,
  code: vaultCodeSchema,
})

const burnItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  rarity: z.string().optional(),
  qty: z.number().finite().positive().optional(),
  burnValue: z.number().finite().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
})

export const burnRecordBodySchema = z.object({
  wallet: walletAddressSchema,
  items: z.array(burnItemSchema).min(1, 'items must be a non-empty array').max(20, 'Too many items in one burn'),
  totalValue: z.number().finite().optional(),
  timestamp: z.number().finite().optional(),
})

// Golden Key weekly claim (Phase 5.5 #9A) — wallet only, weekId is always
// derived server-side from the current date (never trust a client-supplied
// week), so there's no weekId field here unlike vaultSubmitBodySchema.
export const goldenKeyClaimBodySchema = z.object({
  wallet: walletAddressSchema,
})

// Paper weekly claim (Phase 5.5 #9B) — same shape/rationale as the Golden
// Key claim above: wallet only, weekId derived server-side.
export const paperClaimBodySchema = z.object({
  wallet: walletAddressSchema,
})

// Daily Contract progress (GAME-DESIGN.md §5.2). Unlike the fragment credit
// below, this one DOES carry an amount, because the server has no view of
// combat and cannot count kills for itself. The server still decides what the
// amount is worth: it clamps every report to a per-metric ceiling and to the
// contract's own target (see lib/server/dailyContracts.ts), and the rewards
// are off-chain Point and shards, never money.
export const contractReportBodySchema = z.object({
  wallet: walletAddressSchema,
  metric: z.enum(['kills', 'floors', 'containers', 'burns']),
  amount: z.number().int().positive().max(100).optional(),
})

// Vault Fragment credit (GAME-DESIGN.md §5.1) — wallet only, for the same
// reason as the two claims above. There is deliberately NO amount field: the
// client says "a container was opened", the server decides what that is worth.
// A client-supplied amount would let anyone mint their way to the weekly
// reward in one request.
export const vaultFragmentBodySchema = z.object({
  wallet: walletAddressSchema,
})
