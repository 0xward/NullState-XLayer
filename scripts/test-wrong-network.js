#!/usr/bin/env node
/**
 * test-wrong-network.js — "Wallet not connected" was a lie.
 *
 * OWNER, testing in the OKX in-app browser: *"posisi auto connect tapi gabisa
 * mint pass dan buy ada tulisan 'wallet not connected', itu kenapa?"*
 *
 * His wallet was connected. It was on OKX's default chain, and this line lives
 * inside wagmi (@wagmi/core/actions/getConnectorClient):
 *
 *     if (assertChainId && connectorChainId !== chainId)
 *       throw new ConnectorChainMismatchError(...)
 *
 * So useWalletClient({chainId: XLAYER_CHAIN_ID}) resolves to undefined on ANY
 * other chain, every payment path hit its `!walletClient` guard, and the player
 * was told they had no wallet — which is why it survived to the first
 * in-app-browser test.
 *
 * The nastiest part was already-written-and-never-called: `switchToXLayer` had
 * been plumbed through the bridge and had no caller anywhere in the app.
 *
 * These are source-level assertions rather than a browser run, deliberately.
 * Reproducing this needs a wallet that connects on a non-X Layer chain, and the
 * sandbox has no wallet at all — so what can honestly be checked is that the
 * guarantees exist, are wired, and cannot quietly come undone.
 *
 *   node scripts/test-wrong-network.js
 */
const fs = require('fs'), path = require('path')

let fails = 0
const ok = (l, c, d) => { console.log((c ? '  ✓ ' : '  ✗ FAIL: ') + l + (d !== undefined ? ' (' + d + ')' : '')); if (!c) fails++ }
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

const island = read('lib/WagmiIsland.tsx')
const bridge = read('lib/walletBridge.tsx')
const provider = read('lib/WalletProvider.tsx')
const bar = read('components/game/WrongNetworkBar.tsx')

// ── the upstream rule this whole file exists because of ─────────────────────
// Asserted against wagmi's own source, so a future upgrade that changes the
// behaviour shows up here rather than in a player's failed purchase.
const wagmi = fs.readFileSync(
  path.join(__dirname, '..', 'node_modules/@wagmi/core/dist/esm/actions/getConnectorClient.js'), 'utf8')
ok('wagmi still throws when the connector is on another chain',
  /assertChainId && connectorChainId !== chainId/.test(wagmi) &&
  /ConnectorChainMismatchError/.test(wagmi))
ok('and the app still asks for an X Layer-pinned wallet client, which is what trips it',
  /useWalletClient\(\{ chainId: XLAYER_CHAIN_ID \}\)/.test(island))

// ── the fix: ask, once per chain ────────────────────────────────────────────
ok('a connection on the wrong chain triggers a switch',
  /const onWrongChain = isConnected && !!chain && chain\.id !== XLAYER_CHAIN_ID/.test(island) &&
  /switchChain\(\{ chainId: XLAYER_CHAIN_ID \}\)/.test(island))
// Asking on every render is a popup loop, which is worse than the bug it fixes.
ok('and only ONCE per chain, never in a render loop',
  /askedFor = useRef<number \| null>\(null\)/.test(island) &&
  /if \(askedFor\.current === chain\.id\) return/.test(island) &&
  /askedFor\.current = chain\.id/.test(island))

// ── the message stops lying ─────────────────────────────────────────────────
// sendTx and payToTreasury — every path in the island that signs.
ok('all three payment paths in the island check the network first',
  (island.match(/^\s+assertReady\(\)$/gm) || []).length === 3,
  String((island.match(/^\s+assertReady\(\)$/gm) || []).length))
ok('and the message names X Layer instead of claiming there is no wallet',
  /Wrong network — NullState runs on X Layer/.test(island))

// The two hooks that guard on walletClient THEMSELVES rather than going
// through the island — the pass mint is the exact screen the owner reported,
// and the reward claim has the identical shape.
for (const [hook, file] of [['the Season Pass mint', 'hooks/usePassSBT.ts'],
                            ['the reward claim', 'hooks/useReward.ts']]) {
  const src = read(file)
  ok(`${hook} reports the network too, not a missing wallet`,
    /if \(wrongNetwork\) \{/.test(src) && /Wrong network — NullState runs on X Layer/.test(src))
  ok(`  …and re-runs when the chain changes`, /wrongNetwork\]/.test(src) || /wrongNetwork,/.test(src))
}

// ── the escape hatch is finally wired ───────────────────────────────────────
// switchToXLayer existed, was plumbed through the bridge, and had no caller.
ok('switchToXLayer is awaited, so the button can show a truthful pending state',
  /await switchChainAsync\(\{ chainId: XLAYER_CHAIN_ID \}\)/.test(island))
ok('and something actually calls it now',
  /switchToXLayer\(\)/.test(bar), 'WrongNetworkBar')

// ── the flag reaches the screens that can spend ─────────────────────────────
ok('wrongNetwork is on the bridge', /wrongNetwork: boolean/.test(bridge))
ok('defaulted false, so nothing shows before wagmi mounts', /wrongNetwork: false,/.test(bridge))
ok('and published through WalletProvider', /wrongNetwork: w\.wrongNetwork,/.test(provider))

for (const screen of ['MarketplaceScreen', 'CraftingScreen', 'SeasonPassScreen']) {
  const src = read(`components/game/${screen}.tsx`)
  ok(`${screen} shows the bar`, /<WrongNetworkBar \/>/.test(src) &&
    /import WrongNetworkBar from '\.\/WrongNetworkBar'/.test(src))
}

// ── and the bar never tells a connected player to connect ────────────────────
// The player already has a wallet — on the wrong network. A "connect wallet"
// prompt here would be the same lie this file exists to prevent.
ok('the bar never uses a connect-wallet prompt',
  !/connect\s+(a|an|the|your|my)?\s*wallet/i.test(bar))
ok('and it renders nothing at all when the network is right',
  /if \(!wrongNetwork\) return null/.test(bar))

console.log(fails ? `  ${fails} GAGAL` : '  semua lolos')
console.log('  NOTE: a real wrong-chain wallet is NOT simulated — the sandbox has no wallet.')
process.exit(fails ? 1 : 0)
