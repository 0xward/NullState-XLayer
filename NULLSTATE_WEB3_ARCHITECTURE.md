# NullState Web3 Game Architecture

> ⚠️ **SUPERSEDED — DO NOT USE AS A REFERENCE.** This doc describes an
> early "fully on-chain" design (dated July 6, 2026) that was replaced by
> the hybrid on-chain/Firestore model actually shipped. It's kept only for
> history. Several functions described below
> (`getPlayerProfile()`, `getAllPlayers()`,
> `registerPlayer(username, characterClass)`) **do not match the actual
> deployed ABI** (`getPlayer()`, `register()` with no params) — this may
> have been an earlier planning draft that was never fully implemented as
> written. **See `ARCHITECTURE_HYBRID.md` for the current, verified
> architecture** (updated 2026-07-12, cross-checked against the actual
> code and confirmed with a real `npm run build`).

## Overview

NullState is now a fully on-chain Web3 game built on Celo with MiniPay integration. Player progress (username, XP, level, kills) is **persisted to the smart contract** at `0xe6c471dd3c715db8b10457113867885afa12ec13`.

## Game Flow

### 1. **Landing Page** (`/app/page.tsx`)
- Changed button from "LAUNCH APP" → "LAUNCH GAME"
- Directs to `/game` route

### 2. **Game Route - Main Menu** (`/app/game/page.tsx` → `GameFlowManager`)
After wallet connection, user sees **three options**:
- **Continue Game** - Load existing profile (if registered on-chain)
- **New Game** - Register new player
- **Leaderboard** - View global rankings

### 3. **Username Setup** (`UsernameSetup.tsx`)
Before character selection:
- User enters a username (3-32 chars, alphanumeric + underscore/hyphen)
- This becomes the on-chain identity
- Will appear on leaderboard and inventory

### 4. **Character Selection** (inside `GameFlowManager`)
Select one of 4 classes:
- Warrior (default balance fighter)
- Mage (ranged spellcaster)
- Rogue (swift & deadly)
- Paladin (holy defender)

### 5. **Game Play** (`DungeonGame.tsx` → `DungeonGameWrapper.tsx`)
- Wrapped with contract integration
- Real-time dungeon crawler with canvas-based engine
- Stats tracked: XP, level, kills, floor depth

### 6. **Death & Progress Save**
When player dies:
- Death screen shows: floor reached, level, souls purged (kills), CELO reclaimed
- **Automatically saves to smart contract**: `updatePlayerProgress(xp, level, kills)`
- Game listens for `nullstate-player-death` custom event from engine
- Progress is written on-chain before "Rise Again" button appears

### 7. **Leaderboard** (`Leaderboard.tsx`)
- Fetches all registered players from contract's `getAllPlayers()`
- Reads each player's profile via `getPlayerProfile(address)`
- Sorts by XP (descending)
- Displays: Rank, Username, Level, XP, Kills

## Smart Contract Integration

### Contract Address
```
0xe6c471dd3c715db8b10457113867885afa12ec13 (Celo Mainnet)
```

### Key Functions

#### Read Functions
```solidity
// Get a player's profile by wallet address
getPlayerProfile(address player) → (
  string username,
  uint64 xp,
  uint16 level,
  uint32 kills,
  uint8 characterClass,
  bool isRegistered
)

// Get all registered player addresses
getAllPlayers() → address[]
```

#### Write Functions
```solidity
// Register new player with username and character class
registerPlayer(string _username, uint8 _characterClass)

// Update player progress (called on death)
updatePlayerProgress(uint64 _xp, uint16 _level, uint32 _kills)
```

### Character Classes
```typescript
WARRIOR = 0
MAGE = 1
ROGUE = 2
PALADIN = 3
```

## Data Persistence Strategy

### **Full On-Chain (Recommended Path Chosen)**
- ✅ Username stored in contract
- ✅ XP, level, kills stored in contract
- ✅ Character class stored in contract
- ✅ All data immutable and decentralized
- ✅ User owns their profile via wallet
- ⚠️ Gas costs for each progress save
- ⚠️ Slower save operations (blockchain latency)

### Wallet Address as Player ID
- Player wallet address = unique on-chain identity
- **Continue Game** works by checking wallet address in contract
- When wallet reconnects, all progress is auto-loaded from contract

## Key Files & Components

```
components/game/
├── GameFlowManager.tsx       ← Main orchestrator (menu → username → game)
├── DungeonGameWrapper.tsx    ← Hooks game engine into contract
├── DungeonGame.tsx           ← Canvas-based game engine wrapper
├── MainMenu.tsx              ← Continue/New Game/Leaderboard menu
├── UsernameSetup.tsx         ← Username input before character selection
├── CharacterSelection.tsx    ← Integrated into GameFlowManager
└── Leaderboard.tsx           ← Global rankings from contract

lib/
├── contract.ts               ← Contract address, ABI, constants
├── useContractPlayer.ts      ← React hook for contract interaction
├── WalletProvider.tsx        ← Wagmi + RainbowKit setup
└── Web3Providers.tsx         ← Wagmi config & providers

public/game-engine/
├── game.js (modified)        ← Added 'nullstate-player-death' event dispatch
├── entities.js, dungeon.js, etc.

app/
├── page.tsx                  ← Landing page (button: "LAUNCH GAME")
└── game/
    └── page.tsx              ← Game route (dynamic = 'force-dynamic')
```

## Data Flow on Death

```
game.js (gameOver)
  ↓
  Emits: window.dispatchEvent(new CustomEvent('nullstate-player-death', {
    detail: { xp, level, kills }
  }))
  ↓
DungeonGameWrapper.tsx (listens for 'nullstate-player-death')
  ↓
  Calls: updatePlayerProgress(xp, level, kills)
  ↓
useContractPlayer hook
  ↓
  wagmi writeContract() → Smart Contract
  ↓
  Transaction confirmed
  ↓
  fetchPlayerProfile() to refresh state
```

## Environment Variables Needed

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your-walletconnect-project-id>
```

(Default fallback is set if not provided, but WalletConnect modal won't appear)

## Session Management

### Session Lifetime
1. User connects wallet
2. useContractPlayer hook auto-fetches their profile from contract
3. If registered, "Continue" button enabled
4. Username/level displayed in MainMenu
5. On game death, progress auto-saved to contract
6. On next visit (same wallet), profile auto-loads

### Disconnect & Reconnect
- If wallet disconnects, user sent back to MainMenu
- On reconnect with same wallet, previous progress is there
- No local storage needed — everything on-chain

## Testing Checklist

- [ ] Landing page "LAUNCH GAME" button works
- [ ] Wallet connection works (MetaMask / MiniPay)
- [ ] MainMenu shows three options (Continue, New Game, Leaderboard)
- [ ] New Game flow: Username Setup → Character Select → Game
- [ ] Username stored on-chain after registration
- [ ] Inventory shows username above assets
- [ ] Death saves XP, level, kills to contract
- [ ] Leaderboard fetches and sorts players by XP
- [ ] Continue Game loads previous profile
- [ ] Disconnect/reconnect preserves profile

## Known Limitations & Future Improvements

### Current
- Character class selected at registration (immutable per run)
- Inventory UI shows username but character class not yet prominently displayed
- Leaderboard shows live data, may be slow with many players

### Future Enhancements
1. **Multi-character support** - Allow player to create multiple characters per wallet
2. **Guilds/Leaderboards** - Seasonal leaderboards, guild battles
3. **NFT Artifacts** - Drop rare NFTs as loot
4. **Trading** - In-game marketplace
5. **Achievements** - On-chain achievement badges
6. **Farming** - Caching layer (Firebase) for faster leaderboard reads

## Architecture Decision: Why On-Chain?

### Why store everything on-chain vs Firebase?

**On-Chain (Chosen)**
- ✅ True Web3 ownership - players own their data via wallet
- ✅ Immutable history - provable game stats
- ✅ Atomic transactions - death save can't fail mid-way
- ✅ Trust-less - no central authority controls records
- ❌ Slower (5-10s per save vs instant)
- ❌ Costs gas (~0.005 CELO per save)

**Off-Chain (Firebase)**
- ✅ Instant saves, better UX
- ✅ No gas costs
- ❌ Centralized - Vercel/Firebase owns the data
- ❌ Can be censored/deleted
- ❌ Not truly decentralized

**Decision:** For a Web3 game on Celo, on-chain storage aligns with the philosophy. The ~5s save latency is acceptable for a roguelike dungeon crawler where death is permanent anyway.

---

**Last Updated:** July 6, 2026  
**Game Version:** NullState v2 (Web3 Edition)
