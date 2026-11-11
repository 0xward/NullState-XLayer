'use client'

import type { PlayerProfile } from '@/lib/contract'

// ─── Why this exists ─────────────────────────────────────────────────────────
// The world map's largest painted element is the player's own name, and until
// this cache it could not appear until Firestore answered. PageSpeed measured
// the consequence exactly: LCP element `<span class="ns-hub-name">`, render
// delay 7,080ms. The map, the trail, the rail and the buttons were all on
// screen — the page was waiting on one string.
//
// A returning player's name does not change between sessions, so there is no
// reason to make them wait for it. The last profile is kept per wallet and
// painted immediately on the next visit; the live fetch still runs and
// overwrites it, usually with the identical values.
//
// Deliberately NOT sessionStorage: the point is the second visit, hours later.
// Deliberately keyed by address: two wallets on one phone must never see each
// other's name, and switching wallets must not show the previous one's.

const KEY = (addr: string) => `ns-profile:${addr.toLowerCase()}`
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000   // a month; a name is not perishable

interface Cached {
  at: number
  profile: PlayerProfile
}

export function readCachedProfile(address: string | undefined | null): PlayerProfile | null {
  if (!address || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY(address))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cached
    if (!parsed?.profile?.username) return null
    if (Date.now() - (parsed.at ?? 0) > MAX_AGE_MS) return null
    // The address is part of the key, but trust the stored copy over the key in
    // case anything ever wrote the wrong bucket.
    if (parsed.profile.walletAddress?.toLowerCase() !== address.toLowerCase()) return null
    return parsed.profile
  } catch {
    return null   // private mode, quota, corrupt JSON — the live fetch still runs
  }
}

export function writeCachedProfile(profile: PlayerProfile) {
  if (typeof window === 'undefined' || !profile?.walletAddress) return
  try {
    window.localStorage.setItem(KEY(profile.walletAddress), JSON.stringify({ at: Date.now(), profile }))
  } catch { /* not worth failing a render over */ }
}
