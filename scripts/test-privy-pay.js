#!/usr/bin/env node
/**
 * test-privy-pay.js — a Google player can pay, and nobody else pays for it.
 *
 * OWNER: *"harus bisa pembayaran juga lewat privy"* … *"jangan smart wallet."*
 *
 * Chessify (jadonamite/playchessify) wraps its whole app in PrivyProvider and
 * pairs it with ERC-4337 + a Pimlico bundler so social players never need gas.
 * Neither half of that copies over:
 *
 *   · Wrapping the app would ship the Privy SDK to every player, for a
 *     screen most are never shown. That is the cost lib/WagmiIsland.tsx and
 *     lib/walletBridge.tsx exist to avoid, and this follows the same shape —
 *     an island beside the app, publishing into an always-mounted context.
 *   · Gas is paid in OKB, the network's native token. A player holding USDT0
 *     and no OKB cannot buy until they hold a little OKB for gas — there is
 *     no stablecoin gas token on this chain, and no bundler or sponsor to
 *     keep funded. The publisher must never pretend otherwise.
 *
 * Source-level, deliberately: signing needs a real Privy wallet and the sandbox
 * has none. What is checked is that the guarantees exist and cannot quietly
 * come undone.
 *
 *   node scripts/test-privy-pay.js
 */
const fs = require('fs'), path = require('path')

let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

const bridge = read('lib/privySignerBridge.tsx')
const island = read('components/game/PrivySignerIsland.tsx')
const pub = read('components/game/PrivySignerPublisher.tsx')
const web3 = read('lib/Web3Providers.tsx')
const provider = read('lib/WalletProvider.tsx')

// ── players without Privy pay nothing for this ──────────────────────────────
ok('the always-mounted bridge imports no Privy and no viem runtime',
  !/from '@privy-io/.test(bridge) && !/^import \{[^}]*\} from 'viem'/m.test(bridge))
ok('the island is lazily imported, never in the initial chunk',
  /dynamic\(\(\) => import\('@\/components\/game\/PrivySignerIsland'\), \{ ssr: false \}\)/.test(web3))
ok('and mounts only when a Privy app id is configured',
  /if \(privyAppId\(\)\) setMount\(true\)/.test(web3))
ok('beside the app, not around it, so nothing remounts when it arrives',
  /<DeferredPrivySigner \/>/.test(web3) && /<WalletProvider>\{children\}<\/WalletProvider>/.test(web3))
ok('no app id means no provider, matching the mount check',
  /if \(!appId\) return null/.test(island))

// ── it outlives the login screen, which is the whole reason it exists ───────
ok('the island renders no UI at all — only the publisher',
  /<PrivySignerPublisher \/>/.test(island) && !/ns-signin/.test(island))

// ── X Layer, in the right order ─────────────────────────────────────────────
// Privy's docs are explicit that switchChain does not update providers already
// handed out. Taking the provider first returns a client that signs for the old
// chain — the same failure the owner hit in the OKX browser.
ok('the wallet is switched to X Layer BEFORE its provider is taken',
  pub.indexOf('await wallet.switchChain(xLayerChain.id)') > 0 &&
  pub.indexOf('await wallet.switchChain(xLayerChain.id)') < pub.indexOf('await wallet.getEthereumProvider()'))
ok('and the client is pinned to X Layer', /chain: xLayerChain,/.test(pub))
ok('the island pins both chain settings too',
  /defaultChain: xLayerChain,/.test(island) && /supportedChains: \[xLayerChain\],/.test(island))

// ── OKB gas, not a smart wallet ─────────────────────────────────────────────
// Gas is paid in the network's native token. There is no stablecoin gas token
// on X Layer, so any feeCurrency reference here is a leftover that would send
// a field the chain does not understand.
ok('no feeCurrency anywhere in the pay path',
  !/feeCurrency/.test(pub + island + bridge))
// Checked against IMPORTS, not prose — the comments in these files discuss
// smart wallets at length precisely because the decision was to not use them.
ok('and nothing here imports account abstraction',
  !/from '(permissionless|@privy-io\/react-auth\/smart-wallets)'/.test(pub + island + bridge) &&
  !/SmartWalletsProvider/.test(pub + island + bridge))

// ── one treasury, one token table ───────────────────────────────────────────
// The payment is duplicated; the FACTS it is built from must not be.
ok('the transfer uses the shared treasury and token constants',
  /TREASURY_WALLET/.test(pub) && /MARKETPLACE_TOKENS/.test(pub) &&
  /parseTokenAmount/.test(pub) && /from '@\/lib\/constants\/tokens'/.test(pub))
ok('and carries no attribution suffix', !/withAttribution|dataSuffix|getAttributionSuffix/.test(pub))

// ── precedence, and the line that must NOT move ─────────────────────────────
ok('a real wallet always outranks the embedded one',
  /const pay = w\.walletClient \? w\.payToTreasury : \(privy\.payToTreasury \?\? w\.payToTreasury\)/.test(provider) &&
  /walletClient: w\.walletClient \?\? privy\.walletClient/.test(provider))
// Re-keying the save onto the embedded wallet would orphan every document
// already stored under the derived account address.
ok('the SAVE KEY is untouched — the embedded wallet pays, it does not identify',
  /address:      realAddress \?\? authAddress \?\? guestAddress \?\? null,/.test(provider))
ok('and both spend paths go through the same selector',
  (provider.match(/: pay,/g) || []).length === 2)

console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
console.log('  NOTE: no real Privy wallet signs here — the sandbox has none.')
process.exit(fails ? 1 : 0)
