// The auto-assigned display name, in one place.
//
// This formula had grown three copies: lib/usernameService.ts owned it,
// app/api/player/identity/route.ts kept a hand-synced duplicate under a comment
// reading "Must match lib/usernameService.ts generateAutoUsername() exactly. A
// wallet that gets one name from this route and a different one from the client
// would see its name change under it", and lib/WalletProvider.tsx was about to
// need a fourth for the first-paint seed.
//
// Three copies of a rule whose failure mode is "the player's name changes under
// them" is a bug waiting for someone to edit one of them. This module is the
// rule; everyone else imports it.
//
// Deliberately dependency-free — no firebase, no react. It is imported by the
// client bundle's earliest paint path AND by a server route, and neither can
// afford to pull the Firestore SDK in behind it.

/** localStorage key holding the guest's stand-in address. */
export const GUEST_STORAGE_KEY = 'nullstate-guest-id'

/**
 * Auto-assigned username for an address that has never set one.
 *
 * Pure: same address in, same name out, no I/O. That property is what lets the
 * world map paint a brand-new guest's name with no network at all — see the
 * seed in WalletProvider.getGuestAddress().
 */
export function generateAutoUsername(walletAddress: string): string {
  return `Player_${walletAddress.slice(-4).toUpperCase()}`
}
