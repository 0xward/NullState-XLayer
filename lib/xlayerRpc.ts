import { defineChain, fallback, http, type Transport } from 'viem'

/**
 * One place that decides which X Layer RPC endpoint(s) this app talks to,
 * and the X Layer chain objects wagmi and viem use everywhere else.
 *
 * WHY THIS EXISTS
 * The endpoint was configured in two places that disagreed. lib/web3-client.ts
 * honoured NEXT_PUBLIC_XLAYER_RPC; lib/WagmiIsland.tsx hardcoded the public
 * URL. So setting that variable moved the SERVER off the default and left
 * every player's browser still pointed at it — which is the half that
 * matters, because the browser is where the per-player load actually lands.
 *
 * A config knob that silently only half-works is worse than no knob: it looks
 * like the problem was addressed.
 *
 * WHY A FALLBACK
 * The public RPC is free and rate-limited. Everything a player sees that
 * touches the chain goes through it — stablecoin balances in the shop, Season
 * Pass status, vault state. An RPC wobble does not error loudly; balances just
 * stop appearing. viem's fallback() moves to the next endpoint on failure, so a
 * second URL turns that outage into a slower read.
 *
 * No backup endpoint is hardcoded here on purpose. Every alternative provider
 * worth naming needs an account and a key, and inventing a public URL that
 * might be wrong, unmaintained or rate-limited harder than the default would be
 * worse than shipping one honest endpoint. Set the variable when you have one.
 *
 * CONFIGURE
 *   NEXT_PUBLIC_XLAYER_RPC=https://primary.example
 *   NEXT_PUBLIC_XLAYER_RPC=https://primary.example,https://backup.example
 * Comma-separated, tried in order. Unset falls back to the public endpoint
 * alone, which is what ships today.
 *
 * CHAIN OBJECTS
 * Defined here rather than imported from viem/chains so the RPC URLs are the
 * ones this app actually uses (https://rpc.xlayer.tech / testrpc) instead of
 * viem's built-in defaults, and so the testnet reads "X Layer Testnet" rather
 * than viem's older "X1 Testnet" name. Multicall3 addresses and the OKLink
 * explorer URLs mirror viem's own xLayer / xLayerTestnet definitions.
 */

/** X Layer mainnet (chain 196). */
export const XLAYER_CHAIN_ID = 196
/** X Layer testnet (chain 1952). */
export const XLAYER_TESTNET_CHAIN_ID = 1952

export const DEFAULT_XLAYER_RPC = 'https://rpc.xlayer.tech'
export const DEFAULT_XLAYER_TESTNET_RPC = 'https://testrpc.xlayer.tech'

/** Base of the OKLink explorer links shown to players (tx / address). */
export const XLAYER_EXPLORER_URL = 'https://www.oklink.com/xlayer'
export const XLAYER_EXPLORER_TX = 'https://www.oklink.com/xlayer/tx/'

export const xLayerChain = defineChain({
  id: XLAYER_CHAIN_ID,
  name: 'X Layer Mainnet',
  nativeCurrency: { decimals: 18, name: 'OKB', symbol: 'OKB' },
  rpcUrls: {
    default: { http: [DEFAULT_XLAYER_RPC] },
  },
  blockExplorers: {
    default: {
      name: 'OKLink',
      url: XLAYER_EXPLORER_URL,
      apiUrl: 'https://www.oklink.com/api/v5/explorer/xlayer/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 47416,
    },
  },
})

export const xLayerTestnetChain = defineChain({
  id: XLAYER_TESTNET_CHAIN_ID,
  name: 'X Layer Testnet',
  nativeCurrency: { decimals: 18, name: 'OKB', symbol: 'OKB' },
  rpcUrls: {
    default: { http: [DEFAULT_XLAYER_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: 'https://www.oklink.com/xlayer-test' },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 624344,
    },
  },
  testnet: true,
})

/** The configured mainnet endpoints, in priority order. Always at least one. */
export function xlayerRpcUrls(): string[] {
  // XLAYER_RPC_URL wins on the server, matching the precedence the API routes
  // already used. That order is deliberate, not incidental: a server-only URL
  // can carry a provider key, and the public variable is compiled into the
  // browser bundle where a key would be readable by anyone. If the public one
  // took priority, setting the private one would silently do nothing.
  const raw =
    (typeof window === 'undefined' ? process.env.XLAYER_RPC_URL : undefined) ??
    process.env.NEXT_PUBLIC_XLAYER_RPC ??
    DEFAULT_XLAYER_RPC

  const urls = raw
    .split(',')
    .map(u => u.trim())
    .filter(Boolean)

  return urls.length ? urls : [DEFAULT_XLAYER_RPC]
}

/**
 * Transport for every X Layer read/write in the app. A single URL produces a
 * plain http transport — fallback() over one endpoint would add a layer for
 * nothing.
 */
export function xlayerTransport(): Transport {
  const urls = xlayerRpcUrls()
  return urls.length === 1 ? http(urls[0]) : fallback(urls.map(u => http(u)))
}

/**
 * Transport for every X Layer TESTNET (chain 1952) read/write in the app.
 * The demo runs on testnet, so this is the transport the app's reads and
 * writes use by default — see lib/web3-client.ts and lib/server/vaultChain.ts.
 * Single public endpoint, same as the wagmi testnet transport in
 * lib/WagmiIsland.tsx; no env knob (the testnet RPC needs no key).
 */
export function xlayerTestnetTransport(): Transport {
  return http(DEFAULT_XLAYER_TESTNET_RPC)
}
