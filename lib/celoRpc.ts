import { fallback, http, type Transport } from 'viem'

/**
 * One place that decides which Celo RPC endpoint(s) this app talks to.
 *
 * WHY THIS EXISTS
 * The endpoint was configured in two places that disagreed. lib/web3-client.ts
 * honoured NEXT_PUBLIC_CELO_RPC; lib/WagmiIsland.tsx hardcoded
 * https://forno.celo.org. So setting that variable moved the SERVER off Forno
 * and left every player's browser still pointed at it — which is the half that
 * matters, because the browser is where the per-player load actually lands.
 *
 * A config knob that silently only half-works is worse than no knob: it looks
 * like the problem was addressed.
 *
 * WHY A FALLBACK
 * Forno is free and documented as rate-limited. Everything a player sees that
 * touches the chain goes through it — stablecoin balances in the shop, Season
 * Pass status, vault state. A Forno wobble does not error loudly; balances just
 * stop appearing. viem's fallback() moves to the next endpoint on failure, so a
 * second URL turns that outage into a slower read.
 *
 * No backup endpoint is hardcoded here on purpose. Every alternative provider
 * worth naming needs an account and a key, and inventing a public URL that
 * might be wrong, unmaintained or rate-limited harder than Forno would be worse
 * than shipping one honest endpoint. Set the variable when you have one.
 *
 * CONFIGURE
 *   NEXT_PUBLIC_CELO_RPC=https://primary.example
 *   NEXT_PUBLIC_CELO_RPC=https://primary.example,https://backup.example
 * Comma-separated, tried in order. Unset falls back to Forno alone, which is
 * what ships today.
 */

export const DEFAULT_CELO_RPC = 'https://forno.celo.org'

/** The configured endpoints, in priority order. Always at least one. */
export function celoRpcUrls(): string[] {
  // CELO_RPC_URL wins on the server, matching the precedence the API routes
  // already used. That order is deliberate, not incidental: a server-only URL
  // can carry a provider key, and the public variable is compiled into the
  // browser bundle where a key would be readable by anyone. If the public one
  // took priority, setting the private one would silently do nothing.
  const raw =
    (typeof window === 'undefined' ? process.env.CELO_RPC_URL : undefined) ??
    process.env.NEXT_PUBLIC_CELO_RPC ??
    DEFAULT_CELO_RPC

  const urls = raw
    .split(',')
    .map(u => u.trim())
    .filter(Boolean)

  return urls.length ? urls : [DEFAULT_CELO_RPC]
}

/**
 * Transport for every Celo read/write in the app. A single URL produces a plain
 * http transport — fallback() over one endpoint would add a layer for nothing.
 */
export function celoTransport(): Transport {
  const urls = celoRpcUrls()
  return urls.length === 1 ? http(urls[0]) : fallback(urls.map(u => http(u)))
}
