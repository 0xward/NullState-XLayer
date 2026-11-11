# NullState Hybrid Storage Architecture

> **Updated 2026-07-12.** This doc previously described the pre-refactor
> architecture where every attack called `executeAction()` on-chain
> (0.01 CELO per action). That model is gone. See "History" at the bottom
> for what changed and why.

## Overview

NullState menggunakan **hybrid storage model** yang menggabungkan on-chain (Celo) dan off-chain (Firebase) untuk optimal balance antara Web3 ownership, performa, dan biaya. Combat/progress tracking sekarang hampir sepenuhnya off-chain; on-chain writes hanya terjadi di titik-titik yang benar-benar butuh settlement (identitas, reward, marketplace, pass).

---

## Storage Strategy

### On-Chain (Celo Smart Contract)

**NullState.sol — masih dipakai untuk:**
- `register()` — dipanggil sekali per wallet baru, sebelum masuk game pertama kali (lihat `useContractPlayer.ts` → `registerPlayer()`, dipicu dari `GameFlowManager.tsx`). Dilewati otomatis untuk wallet yang `exists === true` di on-chain (termasuk wallet lama dari jaman sistem per-attack-tx).
- `getPlayer(address)` — dibaca tiap kali profil di-fetch, buat cek `isRegistered` dan buat ngambil `xp`/`level`/`kills` mentah dari kontrak.

**⚠️ Known issue — XP/Level di getPlayer() sekarang BEKU:**
`executeAction()` (fungsi yang dulu nambahin xp/level tiap kematian) **sudah tidak dipanggil dari manapun** sejak combat dipindah ke `payUsdmFee()`. Akibatnya `playerProfile.xp`/`playerProfile.level` yang dibaca dari `getPlayer()` cuma nunjukin nilai dari saat registrasi (biasanya 0), dan **tidak pernah naik lagi** walau pemain main berjam-jam. Field ini masih ditampilkan di `MainMenu.tsx` ("LEVEL X"), `RewardsScreen.tsx`, `RewardClaimButton.tsx`, dan `SettingsModal.tsx` — jadi angka yang keliatan user saat ini kemungkinan besar salah/stuck. `kills` sudah punya jalur off-chain pengganti (`totalKills` via `recordRunKills()`, lihat di bawah); xp/level belum. **Perlu diputusin: bikin jalur off-chain serupa buat xp/level, atau berhenti nampilin field ini dan ganti sumbernya.**

**Fungsi kontrak yang TIDAK dipakai lagi (masih ada di contract yang di-deploy, tapi tidak dipanggil dari kode manapun):**
`executeAction()`, `respawn()`, `attackRaidBoss()`, `registerTweetAttack()` — sisa dari sistem lama (per-attack tx, raid boss). Wrapper JS-nya (`registerPlayer`/`respawnPlayer`/`executeAction`/`attackRaid`/`readPlayer`/`readRaid` di `lib/WalletProvider.tsx`, dan `updatePlayerProgress` di `lib/useContractPlayer.ts`) sudah dihapus 2026-07-12 karena confirmed dead code (dicek: 0 pemanggil di seluruh `components/`/`app/`, build ulang sukses tanpa error). Fungsi-fungsi ini masih ada di ABI/kontrak on-chain yang di-deploy — hanya wrapper JS-nya yang dihapus.

**Tradeoff on-chain yang tersisa (register only):**
❌ 1 tx wajib buat wallet baru sebelum bisa main pertama kali (belum dihilangkan)
✅ Cuma sekali per wallet, bukan per-aksi lagi

---

### Off-Chain (Firebase Firestore)

**Mutable user data yang benar-benar dipakai sekarang:**
- **Username** — `usernames/{walletAddress}`, via `lib/usernameService.ts`.
- **totalKills** — total kill sebenarnya sepanjang hidup pemain, ditulis lewat `recordRunKills()` di `lib/leaderboardService.ts`, dipanggil dari `DungeonGameWrapper.tsx` tiap event `nullstate-player-death`. Ini **bukan** field `kills` dari on-chain `getPlayer()` (yang cuma +0/+1 per kematian) — `totalKills` inilah yang dipakai buat leaderboard/stat "Souls Purged".
- **NULL_STRIKE fee** — plain ERC20 `transfer()` USDm ke reward contract (`payUsdmFee()` di `lib/WalletProvider.tsx`), dicatat/di-fund ke weekly pool. Bukan lagi lewat `NullState.sol`.
- **Burn record** — item yang di-burn direkam lewat `/api/burn/record`, divalidasi backend, lalu backend (bukan wallet user) yang submit `recordBurn()` on-chain pake backend signer.
- **Leaderboard scoring** — dihitung dari kombinasi field-field di atas (USDm/Items/Kills/Days/Vault), lihat `docs/leaderboard.md` untuk formula lengkapnya. **Sudah live**, bukan placeholder (lihat koreksi di bagian Leaderboard Strategy di bawah).

**Keuntungan:**
✅ Instant read/write (no gas)
✅ Username dapat diubah kapan saja
✅ totalKills akurat, gak kepotong sama batasan on-chain (bool enemyKilled)
✅ Leaderboard lookup cepat, gak perlu scan chain logs

**Tradeoff:**
❌ Centralized (dependent on Firebase uptime)
❌ Requires trust in data persistence

---

## Player Lifecycle

### 1. New Player - Registration Flow
```
User Connects Wallet
    ↓
GameFlowManager shows MainMenu
    ↓
User clicks "New Game"
    ↓
UsernameSetup screen appears
    ↓
handleUsernameSet(username) triggered:
    ├─ Check if player already registered on-chain
    ├─ If NOT registered: Call registerPlayer() → transaction
    ├─ After registration, call setPlayerUsername() → Firebase
    └─ Move to game
    ↓
Character Selection
    ↓
DungeonGame starts
    ↓
On Death Event:
    └─ Game emits 'nullstate-player-death' event (detail: xp, level, kills)
    └─ DungeonGameWrapper catches event
    └─ Calls recordRunKills(address, kills) → Firestore (FREE, no gas)
    ↓
Kills synced off-chain. xp/level from the event are currently NOT
persisted anywhere (see "Known issue" above) — they only ever live in the
game engine's in-memory state and the Firestore save-slot snapshot used to
resume a session (see game.js's getSaveSnapshot()), not in the on-chain
profile or the leaderboard doc.
```

### 2. Returning Player - Continue Flow
```
User Connects Wallet
    ↓
GameFlowManager checks playerProfile
    ↓
If playerProfile.isRegistered === true:
    ├─ Show "Continue Game" button
    ├─ Show username (from Firebase)
    ├─ Show stats (from on-chain)
    └─ Fetch latest data
    ↓
User clicks "Continue"
    ├─ Load on-chain profile (XP, level, kills, HP)
    ├─ Load username from Firebase
    └─ Game resumes with latest state
```

### 3. Legacy Player (Registered but No Username)
```
Old Player registered on-chain but no username in Firebase
    ↓
When they connect wallet:
    ├─ getOrCreateUsername() called
    ├─ NOT found in Firebase
    ├─ Auto-generate: "Player_0x1234" (last 4 chars of wallet)
    ├─ Save to Firebase with isAutoAssigned=true
    └─ They can change username anytime (setPlayerUsername)
    ↓
Leaderboard shows: "Player_0x1234" (or custom if they changed it)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  NullState Game Client                   │
└─────────────────────────────────────────────────────────┘
         │                              │
         │ useContractPlayer hook       │
         │ (orchestrator)               │
         ↓                              ↓
    ┌────────────┐              ┌──────────────────┐
    │   Celo    │              │ Firebase         │
    │ Blockchain│              │ Firestore        │
    └────────────┘              └──────────────────┘
         │                              │
    getPlayer() (read-only)  getOrCreateUsername()
    register() (once)        setUsername()
                              recordRunKills()
                              isUsernameAvailable()
         │                              │
    ┌────────────────────┐  ┌─────────────────────┐
    │ On-Chain Data      │  │ Off-Chain Data      │
    ├────────────────────┤  ├─────────────────────┤
    │ XP: frozen ⚠️       │  │ username: "Aku"     │
    │ Level: frozen ⚠️    │  │ totalKills: 45 ✅    │
    │ Kills: 0/1, unused │  │ wallet: 0xabcd..   │
    │ HP/Deaths: unused  │  │ createdAt: timestamp
    │ (see Known issue)  │  │ updatedAt: timestamp
    └────────────────────┘  └─────────────────────┘
    Written once at register()      Mutable, live
    Never updated after that        Centralized, free
```

---

## Username System Details

### Auto-Assignment (Legacy Players)
Pemain lama yang registered di kontrak tapi tidak punya username di Firebase akan mendapat:
- Format: `Player_{LAST_4_CHARS_OF_WALLET}`
- Contoh: `Player_1234` (if wallet = 0x...1234)
- Marked with `isAutoAssigned: true`
- Dapat diubah kapan saja dengan `setPlayerUsername()`

### Custom Username Rules
```javascript
✅ Valid:
  - 3-32 characters
  - Only: a-z, A-Z, 0-9, _, -
  - Examples: "Aku", "Player_123", "shadow-knight"

❌ Invalid:
  - Too short: "ab" (< 3 chars)
  - Too long: 33+ characters
  - Special chars: "Aku@", "Player#1", "shadow!"
  - Already taken by other wallet
```

### Username Changes
- User dapat ubah username kapan saja (no gas cost)
- Cek availability dengan `isUsernameAvailable()`
- Tidak bisa pakai username yang sudah taken
- Update langsung ke Firebase

---

## Leaderboard Strategy

**Current: LIVE, not a placeholder.** This section previously said the
leaderboard was an empty stub waiting on event indexing — that's no longer
true. `fetchLeaderboard()` in `lib/useContractPlayer.ts` calls
`getLeaderboard(100)` from `lib/leaderboardService.ts`, which reads straight
from Firestore. No on-chain log scanning happens at all (deliberately —
the public Forno RPC rate-limits/rejects full-history `eth_getLogs` scans,
which is why event indexing was dropped as an approach rather than pursued).

**Scoring formula** (see `docs/leaderboard.md` for the full breakdown):
```
Seasonal Score = 45% USDm + 20% Items + 15% Kills + 15% Days + 5% Vault
```
None of these 5 components read from on-chain `getPlayer()` — they're all
sourced from Firestore (USDm from burn/reward tracking, Kills from
`totalKills`, Items/Days/Vault from their own respective collections).
This is actually convenient given the XP/Level staleness issue above: the
leaderboard ranking itself isn't affected by frozen on-chain xp/level,
only the standalone "LEVEL X" / "XP" displays in the UI screens listed
above are.

---

## Technical Implementation

### Files
- `lib/contract.ts` - Contract ABIs & types
- `lib/usernameService.ts` - Firebase username operations
- `lib/useContractPlayer.ts` - React hook (orchestrator)
- `components/game/GameFlowManager.tsx` - Game state machine
- `components/game/DungeonGameWrapper.tsx` - Game engine wrapper
- `components/game/UsernameSetup.tsx` - Username input UI

### Flow Example: Player Dies

```typescript
// 1. Game engine detects death
function gameOver() {
  window.dispatchEvent(new CustomEvent('nullstate-player-death', {
    detail: { xp: 350, level: 5, kills: 15 }
  }))
}

// 2. DungeonGameWrapper catches event (current implementation)
window.addEventListener('nullstate-player-death', async (event) => {
  const { kills } = event.detail // xp/level are in the event but NOT used here
  await recordRunKills(address, kills) // Firestore write, FREE, no gas
})

// xp/level from the death event go nowhere right now — see "Known issue"
// at the top of this doc. No on-chain write happens on death anymore.
```

---

## Security Considerations

1. **Username Uniqueness**
   - Validated on-chain via Firestore query
   - No duplicate usernames across all players

2. **Data Integrity**
   - On-chain progress is immutable
   - Firebase has backup/recovery
   - Wallet address = proof of ownership

3. **Gas Protection**
   - No more per-action gas: combat costs 0.005 USDm per NULL_STRIKE
     (`payUsdmFee()`), not 0.01 CELO per attack like the old model.
   - The only gas-costing step for a brand-new wallet is the one-time
     `register()` call before their first game (see "Known issue" — this
     is still a friction point worth revisiting, see Future Improvements).

---

## Future Improvements

1. ⚠️ **Decide what to do about frozen XP/Level** — either add an
   off-chain `totalXp`/`totalLevel` (mirroring how `totalKills` already
   works) or stop displaying `playerProfile.xp`/`.level` in
   `MainMenu.tsx`/`RewardsScreen.tsx`/`RewardClaimButton.tsx`/
   `SettingsModal.tsx` and source those displays from somewhere else. This
   is the highest-priority open item from this doc.
2. Consider whether the one-time `register()` tx before a new player's
   first game is worth removing/making optional, now that every other
   action is friction-free.
3. Mobile-first optimizations for MiniPay (ongoing, see MiniPay-specific
   continuation prompts for current status).
4. Profile pictures, achievements/badges, trading system, guilds — not
   started, no change from before.

*(Raid boss / multiplayer raid mechanics, previously listed here, were
part of the old on-chain-per-action system and are not part of the
current design — removed from this list rather than carried forward as
if still planned.)*

---

## Summary

- **On-Chain:** `register()` once per new wallet; `getPlayer()` read for
  `isRegistered` (xp/level/kills from this read are stale — see Known
  issue).
- **Off-Chain:** Username, totalKills, burn tracking, leaderboard scoring
  — all live in Firestore, updated continuously during play.
- **Combat:** NULL_STRIKE fee via `payUsdmFee()` (0.005 USDm), not an
  on-chain contract call.
- **Marketplace / Rewards / Pass:** Separate live on-chain write paths
  (`buyMarketplaceItem()`, `claimWeeklyRewards()`/`claimSeasonBonus()`,
  `mintFreePass()`/`mintPaidPass()`) — each covered in their own docs
  (`docs/rewards-system.md`, `docs/pass-system.md`).
- **Leaderboard:** Live, Firestore-backed, not a placeholder.

## History

This doc originally described the pre-refactor architecture: every attack
called `executeAction()` on `NullState.sol` for 0.01 CELO, and the
leaderboard was an unimplemented stub. That model was replaced with the
Firestore-based combat/progress tracking described above. The dead JS
wrapper functions left over from that model
(`registerPlayer`/`respawnPlayer`/`executeAction`/`attackRaid`/`readPlayer`/
`readRaid` in `lib/WalletProvider.tsx`, `updatePlayerProgress` in
`lib/useContractPlayer.ts`) were removed 2026-07-12 after confirming (via
grep across the whole codebase, and a real `npm run build`) that nothing
called them anymore.
