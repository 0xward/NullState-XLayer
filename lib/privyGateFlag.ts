'use client'

import { useEffect, useState } from 'react'

// ─── The Privy gate: temporary, off by default, and never for MiniPay ────────
//
// OWNER, 2026-08-02: *"aku lagi ikutan talent.app juga sebenernya, jadi untuk
// user non minipay, aku mau ada koneksi wallet barengan dengan login google …
// pake privy aja … tp ini hanya untuk user dan penjurian talent.app saja
// muncul nya … karena ini sementara saja."*
//
// Four properties, and every one of them is load-bearing:
//
//   1. OFF BY DEFAULT. This is scaffolding for a judging period, not a product
//      decision. A temporary thing that ships enabled is a temporary thing that
//      becomes permanent by forgetting.
//   2. NEVER INSIDE MINIPAY. MiniPay resolves an address with zero clicks and
//      its listing rules reject a screen between the player and the game. That
//      guarantee is enforced at the call site by the same `!isMiniPay` that
//      already gates the sign-in offer — this flag cannot switch it on.
//   3. REQUIRES AN APP ID. Privy cannot initialise without one, so a deployment
//      that sets the flag and forgets the id must fall back rather than render a
//      broken screen. `privyAppId()` returning null is treated as "off".
//   4. NOTHING IS RIPPED OUT. With the flag off, the existing Google/email
//      sign-in returns exactly as it was. Turning this off after the judging is
//      one environment variable, not a revert.
//
//   NEXT_PUBLIC_PRIVY_GATE=1   → on for this deployment
//   ?privy=1 / ?privy=0        → force on/off for one device, for testing
//
// Precedence is URL over env, matching lib/worldMapHubFlag.ts: the env var is
// the deployment-wide switch, the query param is how one person checks one
// device without changing what anyone else sees.

const ENV_ON = process.env.NEXT_PUBLIC_PRIVY_GATE === '1'

/** The Privy app id, or null when it is not configured. */
export function privyAppId(): string | null {
  const id = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/**
 * MiniPay, read straight off the injected provider.
 *
 * A DELIBERATE second copy of a rule that already lives at the call site, and
 * safe to duplicate because it is one-way: it can only ever turn the gate OFF.
 * If the two ever disagree, the disagreement costs a MiniPay player nothing and
 * a non-MiniPay player one screen they were going to see anyway.
 *
 * It exists because the authoritative check goes through wagmi, and wagmi is
 * mounted on an idle callback with a 1500ms ceiling (lib/Web3Providers.tsx).
 * This one needs nothing mounted — MiniPay injects window.ethereum before the
 * page's own scripts run — so it is right from the very first render, which is
 * precisely the window in which the gate was flashing.
 */
function isMiniPayNow(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !!(window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay
  } catch {
    return false
  }
}

export function readPrivyGateFlag(): boolean {
  // Before anything else, including the query-string override. There is no
  // argument for a URL that can force a login screen into MiniPay.
  if (isMiniPayNow()) return false
  // No app id means Privy cannot initialise. Fall back rather than render a
  // login screen that can never log anyone in.
  if (!privyAppId()) return false
  if (typeof window !== 'undefined') {
    try {
      const q = new URLSearchParams(window.location.search).get('privy')
      if (q === '1') return true
      if (q === '0') return false
    } catch { /* malformed query string — fall through to the env default */ }
  }
  return ENV_ON
}

/**
 * Seeded FALSE rather than from the env, unlike the world-map flag.
 *
 * That module seeds from its env value because it is on by default and a
 * one-frame flip would show every player the wrong home screen. This one is off
 * by default and loads a heavy SDK, so the safe first render is the one that
 * loads nothing: the gate appears a frame later on the rare deployment that
 * enables it, and never flickers on the normal path.
 */
/**
 * Clears the mark the inline script in app/game/layout.tsx puts on <html> to
 * hide the prerendered home screen. Safe to call any number of times.
 *
 * Two callers, and both are needed. PrivyGate lifts it once the gate has
 * actually painted — the gate is its own full-screen backdrop, so the sheet has
 * nothing left to hide. GameFlowManager lifts it the moment it turns out the
 * gate is NOT coming after all, which is the case the script cannot decide for
 * itself: whether an injected wallet is about to connect is not knowable until
 * wagmi has mounted.
 */
export function liftGateVeil() {
  if (typeof document === 'undefined') return
  document.documentElement.removeAttribute('data-ns-gate')
}

export function usePrivyGateFlag(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(readPrivyGateFlag())
    // ── Re-checked for a beat, then never again ──────────────────────────────
    //
    // The gate renders on the first paint, which is the whole point: waiting
    // for wagmi put the world map on screen 1.2s BEFORE the login, which is the
    // bug this feature was reported for in the first place.
    //
    // Rendering that early means trusting a synchronous read of
    // window.ethereum, and the one way that read can be wrong is a provider
    // injected a moment late. So it is re-run for 1.5s — the same ceiling
    // lib/Web3Providers.tsx gives wagmi — and any MiniPay that turns up inside
    // that window switches the gate off within a frame instead of leaving it up
    // until wagmi mounts. It only ever flips ON→OFF; nothing here can turn the
    // gate on for somebody it was off for.
    let n = 0
    const id = setInterval(() => {
      if (!readPrivyGateFlag()) { setOn(false); clearInterval(id) }
      if (++n >= 15) clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [])
  return on
}
