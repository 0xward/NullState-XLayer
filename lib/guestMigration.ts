// Guest → wallet progress migration (Phase 1, guest mode).
//
// When a player who has been playing as a guest connects a real wallet, their
// off-chain progress needs to follow them onto the wallet account. Progress is
// split across two databases:
//   • Firestore (client SDK)  — username + bunker save  ← handled here
//   • Realtime DB (admin SDK) — Point, materials, gear, tiers, blueprints,
//                               elixir                   ← /api/guest/migrate
//
// Merge policy = "fill the gaps, wallet wins" (owner decision): the wallet
// keeps anything it already had; the guest's data only fills what's missing,
// except fungible balances (handled additively server-side). See the API
// route for the Realtime DB details.

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import {
  loadGameSession,
  saveGameSession,
  clearGameSession,
} from './gameSessionService'

// Same key WalletProvider.tsx writes the local guest id under. Kept as a
// literal here (rather than importing WalletProvider) to avoid pulling the
// whole wagmi/viem client tree into this lightweight helper.
const GUEST_KEY = 'nullstate-guest-id'
// Guards against re-running migration for an id already handled this session.
const migratedThisSession = new Set<string>()

export function getStoredGuestId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const id = window.localStorage.getItem(GUEST_KEY)
    return id && /^0x[0-9a-fA-F]{40}$/.test(id) ? id.toLowerCase() : null
  } catch {
    return null
  }
}

function clearStoredGuestId() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(GUEST_KEY)
  } catch {
    /* ignore */
  }
}

// Move the Firestore username doc from guest → wallet, filling only if the
// wallet has none. Always removes the guest doc afterwards so the username
// isn't left orphaned (and its uniqueness freed).
async function migrateUsername(guest: string, wallet: string) {
  try {
    const guestRef = doc(db, 'usernames', guest)
    const guestSnap = await getDoc(guestRef)
    if (!guestSnap.exists()) return

    const walletRef = doc(db, 'usernames', wallet)
    const walletSnap = await getDoc(walletRef)
    if (!walletSnap.exists()) {
      const data = guestSnap.data()
      await setDoc(walletRef, {
        ...data,
        walletAddress: wallet,
        updatedAt: Date.now(),
      })
    }
    // Free the guest doc either way (moved, or the wallet already had one).
    await deleteDoc(guestRef)
  } catch (err) {
    console.error('[guest-migration] username migration failed:', err)
  }
}

// Copy the bunker save from guest → wallet only if the wallet has no save of
// its own (fill-the-gap). The guest save is consumed either way.
async function migrateGameSession(guest: string, wallet: string) {
  try {
    const walletSession = await loadGameSession(wallet)
    if (!walletSession) {
      const guestSession = await loadGameSession(guest)
      if (guestSession) await saveGameSession(wallet, guestSession)
    }
    await clearGameSession(guest)
  } catch (err) {
    console.error('[guest-migration] game session migration failed:', err)
  }
}

/**
 * Migrate everything a guest accumulated onto the freshly-connected wallet,
 * then retire the local guest id so the two identities don't diverge again.
 * Safe to call repeatedly — it no-ops once the guest id has been cleared or
 * already handled this session. Never throws.
 */
export async function migrateGuestProgress(walletAddress: string): Promise<void> {
  const wallet = walletAddress?.toLowerCase()
  const guest = getStoredGuestId()
  if (!wallet || !guest || guest === wallet) return
  if (migratedThisSession.has(guest)) return
  migratedThisSession.add(guest)

  // Firestore half (username + bunker save). These are idempotent, so a
  // retry after a failed Realtime DB step re-runs them harmlessly.
  await migrateUsername(guest, wallet)
  await migrateGameSession(guest, wallet)

  // Realtime DB half (Point, materials, gear, tiers, blueprints, elixir).
  let rtdbOk = false
  try {
    const res = await fetch('/api/guest/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestAddress: guest, walletAddress: wallet }),
    })
    rtdbOk = res.ok
  } catch (err) {
    console.error('[guest-migration] Realtime DB migration request failed:', err)
  }

  if (rtdbOk) {
    // Fully done — retire the guest identity for good.
    clearStoredGuestId()
  } else {
    // Server unreachable/misconfigured. Keep the guest id so a later connect
    // (this session or after a reload) can retry the Realtime DB step; the
    // already-completed Firestore half is idempotent. Wallet data is never at
    // risk either way.
    migratedThisSession.delete(guest)
  }
}
