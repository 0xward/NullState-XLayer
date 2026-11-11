// The signed-in player's account address.
//
// Every Firebase-keyed path in this app — usernames, saves, materials, energy,
// leaderboard — is keyed by something matching /^0x[0-9a-f]{40}$/. That is true
// of real wallets and equally true of the random guest id WalletProvider mints
// for anyone playing without one. Rather than teach all of that about a second
// kind of identity, a Firebase account gets an address of the same shape,
// derived from its uid.
//
// So the model stays two-layer, not three:
//   real wallet   → can sign, can pay, can claim
//   account/guest → cannot sign; a stable key for progress
//
// The only difference between an account address and a guest id is where the
// bytes come from: a guest id is random and dies with localStorage, an account
// address is a pure function of the uid and therefore the same on every device
// the player signs in on. That is the entire feature.
//
// SECURITY, stated plainly: this address is not a credential and proves
// nothing. Neither is a guest id — it is a localStorage string anyone can
// forge. Whatever protects a player's documents has to be Firestore rules
// keyed on the authenticated uid, not the unguessability of this value. It is
// derived rather than random so that it is *stable*, not so that it is secret.
//
// Deliberately dependency-free: no firebase, no react. It is read during render
// by useWallet() on /game's first-load path, and pulling the Auth SDK in behind
// that would undo the code-splitting in lib/Web3Providers.tsx.

const ADDR_KEY = 'nullstate-auth-address'
const UID_KEY = 'nullstate-auth-uid'
const LABEL_KEY = 'nullstate-auth-label'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * The account address for the currently signed-in player, or null.
 *
 * Synchronous on purpose. Deriving it needs SHA-256, which Web Crypto only
 * offers as a promise, and useWallet() has to answer during render — so the
 * derivation happens once at sign-in and the result is cached here. Same shape
 * as profileCache: pay the async cost once, read it instantly forever after.
 */
export function getStoredAuthAddress(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const addr = window.localStorage.getItem(ADDR_KEY)
    return addr && ADDRESS_RE.test(addr) ? addr.toLowerCase() : null
  } catch {
    return null
  }
}

/** The uid the stored address was derived from, for detecting a stale pairing. */
export function getStoredAuthUid(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(UID_KEY)
  } catch {
    return null
  }
}

/**
 * uid → address, deterministically.
 *
 * SHA-256 of the uid, first 20 bytes, rendered as hex. Any stable mapping would
 * do; this one is chosen because it is a one-liner over a primitive every
 * browser already ships, needs no dependency, and cannot collide in practice
 * across a user base that would have to reach 2^80 accounts to try.
 */
export async function deriveAuthAddress(uid: string): Promise<string> {
  const bytes = new TextEncoder().encode(uid)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest).slice(0, 20))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}`
}

export function storeAuthIdentity(uid: string, address: string, label?: string | null) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(UID_KEY, uid)
    window.localStorage.setItem(ADDR_KEY, address.toLowerCase())
    if (label) window.localStorage.setItem(LABEL_KEY, label)
  } catch {
    /* private mode — the player is signed in for this tab and that is all */
  }
}

/**
 * The email (or display name) to show in Settings, cached at sign-in.
 *
 * Stored rather than read back from the Auth SDK on demand: Settings would
 * otherwise have to load firebase/auth just to print one line, which is the
 * whole thing lib/firebaseAuth.ts's separate-module split exists to avoid. It
 * is a label, never an identity — nothing branches on it.
 */
export function getStoredAuthLabel(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LABEL_KEY)
  } catch {
    return null
  }
}

export function clearAuthIdentity() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(UID_KEY)
    window.localStorage.removeItem(ADDR_KEY)
    window.localStorage.removeItem(LABEL_KEY)
    // The payout address belonged to that account's embedded wallet. Leaving it
    // behind would offer the next player's prize to the last player's wallet.
    window.localStorage.removeItem('nullstate-payout-address')
  } catch {
    /* ignore */
  }
}

// ─── "Not now" ───────────────────────────────────────────────────────────────
// Declining has to stick. A player who taps Skip and is asked again on the next
// New Game has been told their answer did not count, which is worse than never
// asking. Kept separate from the auth keys so that signing out does not quietly
// re-arm the prompt.

const SKIPPED_KEY = 'nullstate-signin-skipped'

export function hasSkippedSignIn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SKIPPED_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberSignInSkipped() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SKIPPED_KEY, '1')
  } catch {
    /* ignore */
  }
}

// ─── The address that can actually receive money ─────────────────────────────
//
// The account address above is a KEY, not a wallet: it is SHA-256 of a uid, and
// nobody holds its private key. That is fine for saving progress and fatal for
// paying a prize — USDT sent there is gone, not "stuck".
//
// Privy hands a Google/email player a real embedded wallet on sign-in, which
// they can control and export. That address is recorded here so the season
// payout has somewhere to send the prize. It is deliberately NOT used as the
// player's key: keying on it would give account-level access to an address the
// app cannot verify a signature for, and would break every save already stored
// under the derived address.
//
// Empty for a plain guest, and for anyone who signed in before this existed.
// The season code treats "no payout address" as a name to ask, never as an
// address to try.

const PAYOUT_KEY = 'nullstate-payout-address'

export function getStoredPayoutAddress(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const a = window.localStorage.getItem(PAYOUT_KEY)
    return a && ADDRESS_RE.test(a) ? a.toLowerCase() : null
  } catch {
    return null
  }
}

export function storePayoutAddress(address: string | null | undefined) {
  if (typeof window === 'undefined') return
  try {
    if (address && ADDRESS_RE.test(address)) {
      window.localStorage.setItem(PAYOUT_KEY, address.toLowerCase())
    }
  } catch {
    /* private mode — the payout address is re-read from Privy on next sign-in */
  }
}
