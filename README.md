# NULL_STATE // Web3 RPG on X Layer

> A real-time, top-down dungeon crawler built on X Layer. Play, loot, and unleash NULL_STRIKE for free — only optional Marketplace and Season Pass purchases settle as real on-chain transactions, and stablecoin rewards are paid out from the Treasure Vault, Leaderboard, and Season Pass. Permadeath is softened: die and you respawn on the same floor, full HP. Playable right in the browser with OKX Wallet or MetaMask.

Built for the OKX X Layer TapeOut Accelerate hackathon.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Built on X Layer](https://img.shields.io/badge/Built%20on-X%20Layer-black)](https://www.okx.com/xlayer)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)

---

## What is NULL_STATE?

NULL_STATE is a pixel-art dungeon crawler that runs directly in the browser — no installs, no app store. Take up the Knight's armor, descend into a procedurally generated bunker, fight your way through Orc and Skeleton crews, and ride the lift between floors as you push deeper into the depths.

Playing, looting, and the **NULL_STRIKE** ultimate are all free — no wallet transaction required; NULL_STRIKE is gated by a short cooldown, not a fee. Weapons and armor can be bought on the in-game Marketplace with USDC/USDT, or swapped for using **NullState Point** — an off-chain, faucet-only currency earned by burning items (not real money, not withdrawable). Payments default to whichever stablecoin your wallet holds the most of.

---

## Gameplay

- **The Knight** — the playable character, an armored melee crawler with a class-flavored steel-slash attack. Gear (weapons, armor, cosmetic outfits) is what changes your look and power, not a class pick.
- **Procedural bunker floors** — square, grid-aligned rooms connected by corridors and doors, generated fresh per floor and cached for the rest of the run so a cleared floor stays cleared if you backtrack.
- **Fog of war** — rooms you haven't entered render fully dark; walking through a door permanently reveals that room for the rest of the run.
- **The Lift** — replaces simple staircases. Approach it to open a floor-select menu: revisit any floor you've already cleared, or push forward to the next one (locked until every hostile on the current floor — including elites and the floor boss — is dead).
- **The Golden Key** — a rare drop from interactive containers (Rotten Armoire, Lost Cache), capped at 1 per wallet per week and server-enforced. Combine it with a weekly Paper drop to attempt the Treasure Vault Quest in Bunker 5.
- **Inventory panel** — three-tab wooden-theme UI (LOOT / FOOD / GEAR) with equip, eat, and sell actions.
- **Marketplace** — buy weapons and armor with USDC or USDT via on-chain ERC-20 transfer. Ownership is verified server-side and stored in Firebase.
- **Permadeath, softened** — dying drops you back at the floor you died on with full HP, rather than sending you back to floor 1. Progress on floors you've already cleared is preserved.
- **NULL_STRIKE** — a free ultimate attack (short cooldown, no fee) you can trigger against elites, bosses, or when your HP runs critically low.
- **Floor scaling** — monsters grow stronger every floor (+8% HP & damage per tier by default, configurable in `monster-config.js`). Boss floors (every 5th floor) have hardcoded overrides for dramatic difficulty spikes.

---

## The Loop & Economy

The game runs on stablecoins + an in-game point — **no speculative token**. The loop is visible in-game under **Main Menu → How to Play**:

| Cadence | You do | You get |
|---|---|---|
| **Every run** | Play, loot, burn gear you don't need | **NullState Point** — in-game, faucet-only, *not* withdrawable; spend it to *Swap* for non-premium Marketplace gear |
| **Every week** | Find the Golden Key + Code Paper, solve the Treasure Vault code | **USDT** |
| **Every day** | Open the app; clear 3 Daily Contracts | **Glitch Shards + Point** — a 7-day login ladder (day 7 = one full weapon evolution) with a Streak Shield that forgives one missed day |
| **Every season** | Rank on the Leaderboard; hold a Season Pass | **USDT** — 35/month across the **top 10** ($20/$5/$3, then $1 to 10th) + Season Pass reward track |

- **Seasonal ranking is seasonal** — the Leaderboard ranks the XP you earn *within* the current month, not career XP, so every season starts level and a player who joins today can win it. Career XP has its own ALL-TIME board. See `docs/GAME-DESIGN.md` §9.2c.
- **Progression** — 5 bunkers × 5 floors = 25 depths. Gear, weapon tiers, and Point carry across runs; deeper acts drop higher-tier crafting shards.
- **Guest mode** — you can play with no wallet; progress is kept in `localStorage` and migrated onto your wallet the first time you connect one. USDT reward claims require a wallet.
- **Flexible stablecoin** — payments default to whichever of USDC/USDT the wallet holds the most of, with a manual override. Gas is paid in OKB.
- **Reward pool** — stablecoin reward pools are funded by 1892 Studio, seeded manually at launch, with the intent to route a share (~20%) of Marketplace/gear revenue back to players over time.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) (App Router) + React 18 + TypeScript |
| Game engine | Vanilla JS / Canvas2D, mounted into a React component (no game-framework dependency) |
| Styling | Tailwind CSS + custom wooden-theme CSS |
| Web3 | [wagmi](https://wagmi.sh) + [viem](https://viem.sh) (injected connector only — OKX Wallet and MetaMask), targeting X Layer |
| Tokens | USDC / USDT0 (ERC-20, 6-decimal) |
| Database | Firebase — Realtime DB (player profiles, marketplace ownership, materials) + Firestore (usernames, bunker saves, leaderboard) |
| Contracts | Solidity, deployed with Foundry |

---

## On-Chain Integration

| | |
|---|---|
| **Network** | X Layer (Chain ID `196`) |
| **Tokens** | USDC, USDT0 — ERC-20 transfers via `buyMarketplaceItem()` |
| **Wallet support** | Injected wallets only — OKX Wallet and MetaMask browser extension. WalletConnect/Coinbase Wallet/Rainbow are not integrated (WalletConnect relay was removed; see `docs/network-manifest.md`). |
| **Verification** | `POST /api/marketplace/verify` validates on-chain transfer, prevents replay, records ownership |

### TapeOut integration (read-only on-chain data)

The game reads **live TapeOut state from X Layer mainnet** (chain `196`) and shows it in the
world-map hub and on the Sealed Vault door — no wallet, no transaction, no cost:

- **What is read, live** (`GET /api/tapeout`, code in `lib/tapeout.ts`, hook in `hooks/useTapeOut.ts`):
  the factory's processor count (`cpuCount()`), the Genesis CPU X processor (`cpuAt(101)` +
  `name()`), and the owner of reference circuit TapeID `3.2.101` (`ownerOf(3)`). Every number
  on screen comes from an `eth_call` to the public X Layer RPC (`https://rpc.xlayer.tech`) —
  nothing is hardcoded.
- **What this satisfies**: the OKX X Layer TapeOut Accelerate rule that a project "use TapeOut
  circuits, contracts **or onchain data** on X Layer". This integration is the on-chain-data
  half of that clause.
- **What it is not**: this is not a DeWEB deployment and the game does not claim "100% on-chain".
  DeWEB (a site served from an on-chain container) is a separate step that needs mainnet funds
  and is **postponed** until funding is available.

---

## Getting Started

```bash
git clone https://github.com/0xward/NullState-XLayer.git
cd NullState-XLayer
npm ci          # install exact deps from package-lock.json
npm run dev     # development server — http://localhost:3000
```

### Build & Test Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build (static bundle) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript type check |

### Environment Variables

Create `.env.local` with:

```
FIREBASE_DATABASE_URL=your_firebase_rtdb_url
FIREBASE_SERVICE_ACCOUNT_JSON=your_service_account_json
BACKEND_PRIVATE_KEY=0x...            # backend signer (vault payouts, pass mints)
# Optional overrides — hardcoded mainnet fallbacks exist in lib/contract-abi.ts:
# NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS=
# NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS=
# NEXT_PUBLIC_TREASURE_VAULT_ADDRESS=
```

---

## Project Structure

```
app/                       Next.js App Router pages (landing, /game, /leaderboard, /profile)
app/api/marketplace/       Server routes: verify purchase, return owned items
components/game/           React wrappers (GameFlowManager, MainMenu, MarketplaceScreen, …)
public/game-engine/        The game engine
  assets.js                Sprite-sheet descriptors + archetype stats
  entities.js              Player & Enemy classes (stats, AI, animation)
  game.js                  Main loop, render, input, combat, floor management
  items.js                 Item definitions, loot tables, eat/equip logic
  marketplace-items.js     Marketplace catalogue (10 weapons/armor with USD pricing)
  monster-config.js        Data-driven per-floor scaling knobs (Phase 5)
  effects.js               Hit-stop, enhanced particles, floating damage numbers (Phase 5)
  dungeon.js               Procedural dungeon generator
  audio.js                 Sound effects manager
public/sprites/            Character, monster, and decoration sprite sheets
  player/                  knight — idle, run, death (the only playable character)
  monsters/                Orc & Skeleton crews — idle, run, death
  monsters2/               Skel Reaper & Vampire — full idle/walk/attack/death sheets
styles/globals.css         Tailwind base + wooden inventory UI theme
lib/                       Web3 provider setup (wagmi/viem, injected connector) + WalletProvider
contracts/                 Solidity contracts (PassSBTv3.sol, NullStateRewardV3.sol, TreasureVaultV2.sol)
```

---

## Monster Scaling (Phase 5)

Enemy difficulty scales automatically per floor. The configuration lives in
`public/game-engine/monster-config.js` and exposes:

- **`FLOOR_SCALE_FACTOR`** — compound multiplier per floor (default `1.08` = +8%/floor).
- **`floorOverrides`** — per-floor HP/DMG/XP overrides (used for boss floors 5, 10, 15, 20).
- **`hitStop`** — damage thresholds that control freeze duration on hit (0.04s–0.16s).
- **`shake`** — screen-shake amounts per event type (player attack, death, boss kill…).
- **`knockback`** — velocity vectors per weapon-behavior type.
- **`particles`** — burst counts per hit severity.

The helper `window.NS_FLOOR_SCALE(floor)` returns `{hpMul, dmgMul, xpMul}` for any floor.

---

## License

Released under the [MIT License](./LICENSE).

---

**Built on X Layer · ERC-20 Marketplace**
