# Backend Integration Guide

This guide covers backend setup for NullState game economy.

## 📋 Table of Contents

1. [Firebase Database Structure](#firebase-database-structure)
2. [Backend API Endpoints](#backend-api-endpoints)
3. [Smart Contract Integration](#smart-contract-integration)
4. [Leaderboard Cron Job](#leaderboard-cron-job)
5. [Vault Code Management](#vault-code-management)
6. [Error Handling](#error-handling)
7. [Security Considerations](#security-considerations)

---

## 🔥 Firebase Database Structure

### Database Schema

```
firebase-realtime-db/
├── /games
│   └── {userId}
│       ├── /currentRun
│       │   ├── bunkerDepth: number (1-6)
│       │   ├── currentFloor: number (1-3)
│       │   ├── inventory: {
│       │   │   itemId: {
│       │   │       rarity: string (common|uncommon|rare|epic|legendary)
│       │   │       value: number (in wei, 18 decimals)
│       │   │       collectedAt: number (timestamp)
│       │   │       bunkerFound: number
│       │   │       floorFound: number
│       │   │   }
│       │   ├── totalItemsCollected: number
│       │   ├── totalBurnedUSDm: number
│       │   ├── hasGoldenKey: boolean
│       │   ├── vaultCode: string (4-digit, if found Paper)
│       │   ├── vaultOpened: boolean
│       │   └── lastSavedAt: number (timestamp)
│       │
│       └── /seasonStats
│           └── {seasonId} (YYYYMM format, e.g., 202607)
│               ├── username: string
│               ├── walletAddress: string
│               ├── totalUSDmEarned: number
│               ├── totalItemsCollected: number
│               ├── totalEnemiesKilled: number
│               ├── daysActive: number
│               ├── vaultCodesCorrect: number
│               ├── seasonScore: number
│               ├── leaderboardRank: number (1-100)
│               ├── claimedSeasonBonus: boolean
│               └── lastUpdatedAt: number
│               └── allTime
│                   ├── totalItemsEver: number
│                   ├── totalUSDmEver: number
│                   └── totalKillsEver: number
├── /vaultCodes
│   └── {seasonId}
│       └── {weekId} (YYYYWW format)
│           ├── code: string (4-digit, encrypted)
│           ├── setAt: number (timestamp)
│           └── validUntil: number (timestamp, next Monday)
├── /leaderboards
│   └── {seasonId}
│       ├── rank1: { username, walletAddress, score, items, usdm, kills, daysActive }
│       ├── rank2: { ... }
│       ├── rank3: { ... }
│       ├── top100: [ ... ]
│       └── lastUpdatedAt: number (timestamp)
├── /burnRecords
│   └── {userId}
│       └── {burnId}
│           ├── itemCount: number
│           ├── totalValue: number
│           ├── rewardToken: string (address)
│           ├── timestamp: number
│           ├── seasonId: number
│           └── weekId: number
└── /playerProfiles
    └── {userId}
        ├── username: string
        ├── walletAddress: string
        ├── createdAt: number
        └── lastActiveAt: number
```

### Firebase Security Rules

```javascript
// firebase-rules.json
{
  "rules": {
    "games": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "vaultCodes": {
      ".read": "auth !== null",
      ".write": "root.child('backends').child(auth.uid).val() === true"
    },
    "leaderboards": {
      ".read": true,
      ".write": "root.child('backends').child(auth.uid).val() === true"
    },
    "burnRecords": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid || root.child('backends').child(auth.uid).val() === true"
      }
    },
    "playerProfiles": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

## 🔧 Backend API Endpoints

### 1. Record Burn

**Endpoint**: `POST /api/burn/record`

**Request**:
```typescript
interface BurnRequest {
  userId: string;
  walletAddress: string;
  itemIds: string[]; // e.g., ["item1.png", "item2.png"]
  itemCount: number;
  totalValue: bigint; // in wei (18 decimals)
  rewardToken: string; // "0x765DE816845861e75A25fCA122bb6898B8B1282a" (USDm)
  seasonId: number; // YYYYMM format
}
```

**Response**:
```typescript
interface BurnResponse {
  success: boolean;
  burnId: string; // UUID
  message: string;
  transactionHash: string; // from contract recordBurn()
  itemsDeleted: number;
  totalValueBurned: string; // in USDm decimal format
}
```

**Backend Logic**:
```typescript
async function recordBurn(req: BurnRequest) {
  // 1. Verify user session
  const user = await verifyUser(req.userId);
  if (!user) throw new Error("Unauthorized");

  // 2. Verify items exist in Firebase
  const itemsVerified = await verifyItemsExist(req.userId, req.itemIds);
  if (!itemsVerified) throw new Error("Items not found");

  // 3. Calculate total value (random within rarity ranges)
  const calculatedValue = calculateBurnValue(req.itemIds);
  if (calculatedValue !== req.totalValue) {
    throw new Error("Value mismatch");
  }

  // 4. Call contract: recordBurn()
  const tx = await rewardContract.recordBurn(
    req.walletAddress,
    req.itemIds.length,
    req.totalValue,
    req.rewardToken
  );

  // 5. Wait for confirmation
  await tx.wait(1);

  // 6. Delete items from Firebase inventory
  await deleteItemsFromInventory(req.userId, req.itemIds);

  // 7. Update burn records
  const burnId = generateUUID();
  await firebase.database().ref(`burnRecords/${req.userId}/${burnId}`).set({
    itemCount: req.itemCount,
    totalValue: req.totalValue,
    rewardToken: req.rewardToken,
    timestamp: Date.now(),
    seasonId: req.seasonId,
    transactionHash: tx.hash
  });

  // 8. Update player stats
  await updatePlayerStats(req.userId, {
    totalBurnedUSDm: increment(req.totalValue),
    lastBurnedAt: Date.now()
  });

  return {
    success: true,
    burnId,
    transactionHash: tx.hash,
    itemsDeleted: req.itemIds.length,
    totalValueBurned: formatUSDm(req.totalValue)
  };
}
```

---

### 2. Submit Vault Code

**Endpoint**: `POST /api/vault/submit-code`

**Request**:
```typescript
interface VaultCodeRequest {
  userId: string;
  walletAddress: string;
  weekId: number; // YYYYWW format
  code: string; // 4-digit
  seasonId: number;
}
```

**Response**:
```typescript
interface VaultCodeResponse {
  success: boolean;
  isCorrect: boolean;
  attemptsRemaining: number;
  message: string;
  rewardTx?: string; // if correct
}
```

**Backend Logic**:
```typescript
async function submitVaultCode(req: VaultCodeRequest) {
  // 1. Verify user
  const user = await verifyUser(req.userId);
  if (!user) throw new Error("Unauthorized");

  // 2. Get stored vault code from Firebase
  const storedCode = await firebase
    .database()
    .ref(`vaultCodes/${req.seasonId}/${req.weekId}/code`)
    .get();

  if (!storedCode.exists()) {
    throw new Error("Code not set for this week");
  }

  const codeFromDB = storedCode.val();
  const isCorrect = code === codeFromDB;

  // 3. Call contract: submitVaultCode()
  const tx = await vaultContract.submitVaultCode(
    req.walletAddress,
    req.weekId,
    req.code
  );

  await tx.wait(1);

  // 4. Check result (listen to contract events)
  const receipt = await tx.wait(1);
  const events = parseEvents(receipt);
  const correctEvent = events.find(e => e.name === "VaultCodeCorrect");
  const lockedEvent = events.find(e => e.name === "VaultLocked");

  // 5. Update player stats
  if (isCorrect) {
    await updatePlayerStats(req.userId, {
      vaultCodesCorrect: increment(1),
      totalUSDmEarned: increment(1e18) // 1 USDm
    });
  }

  return {
    success: true,
    isCorrect,
    attemptsRemaining: lockedEvent ? 0 : (3 - attempts),
    message: isCorrect ? "Vault opened!" : "Wrong code",
    rewardTx: isCorrect ? tx.hash : undefined
  };
}
```

---

### 3. Update Leaderboard (24h Cron)

**Endpoint**: `POST /api/leaderboard/update` (Internal, called by GitHub Actions)

**Request**:
```typescript
interface LeaderboardUpdateRequest {
  seasonId: number;
  apiKey: string; // Secret GitHub Actions key
}
```

**Response**:
```typescript
interface LeaderboardUpdateResponse {
  success: boolean;
  top3Updated: boolean;
  rank1: { username: string; score: number };
  rank2: { username: string; score: number };
  rank3: { username: string; score: number };
  timestamp: number;
}
```

**Backend Logic**:
```typescript
async function updateLeaderboard(seasonId: number) {
  // 1. Fetch all players' stats for season
  const snapshot = await firebase
    .database()
    .ref(`games`)
    .orderByChild(`seasonStats/${seasonId}/seasonScore`)
    .limitToLast(100)
    .get();

  const playersData = snapshot.val();
  const players = Object.entries(playersData).map(([userId, data]: any) => ({
    userId,
    username: data.seasonStats[seasonId].username,
    walletAddress: data.seasonStats[seasonId].walletAddress,
    seasonScore: data.seasonStats[seasonId].seasonScore,
    usdm: data.seasonStats[seasonId].totalUSDmEarned,
    items: data.seasonStats[seasonId].totalItemsCollected,
    kills: data.seasonStats[seasonId].totalEnemiesKilled,
    daysActive: data.seasonStats[seasonId].daysActive,
    vault: data.seasonStats[seasonId].vaultCodesCorrect
  }));

  // 2. Sort by score (descending)
  players.sort((a, b) => b.seasonScore - a.seasonScore);

  // 3. Get top 3
  const top3 = players.slice(0, 3);

  // 4. Call contract: updateLeaderboard()
  const tx = await rewardContract.updateLeaderboard(
    seasonId,
    top3.map(p => p.walletAddress),
    top3.map(p => Math.floor(p.seasonScore))
  );

  await tx.wait(1);

  // 5. Update Firebase leaderboard
  await firebase.database().ref(`leaderboards/${seasonId}`).set({
    rank1: { ...top3[0] },
    rank2: { ...top3[1] },
    rank3: { ...top3[2] },
    top100: players.slice(0, 100),
    lastUpdatedAt: Date.now(),
    transactionHash: tx.hash
  });

  console.log(`Leaderboard updated for season ${seasonId}`);
  return {
    success: true,
    rank1: { username: top3[0].username, score: top3[0].seasonScore },
    rank2: { username: top3[1].username, score: top3[1].seasonScore },
    rank3: { username: top3[2].username, score: top3[2].seasonScore },
    timestamp: Date.now()
  };
}
```

---

### 4. Generate Weekly Vault Code

**Endpoint**: `POST /api/vault/generate-weekly-code` (Internal, called every Monday 00:00 UTC)

**Request**:
```typescript
interface GenerateWeeklyCodeRequest {
  seasonId: number;
  weekId: number; // YYYYWW format
  apiKey: string;
}
```

**Response**:
```typescript
interface GenerateWeeklyCodeResponse {
  success: boolean;
  weekId: number;
  codeSet: boolean;
  validUntil: number; // timestamp
}
```

**Backend Logic**:
```typescript
async function generateWeeklyVaultCode(
  seasonId: number,
  weekId: number
) {
  // 1. Generate random 4-digit code
  const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  // 2. Encrypt code
  const encrypted = encrypt(code, ENCRYPTION_KEY);

  // 3. Store in Firebase
  const validUntil = getNextMondayUTC();
  await firebase.database().ref(`vaultCodes/${seasonId}/${weekId}`).set({
    code: encrypted,
    setAt: Date.now(),
    validUntil: validUntil.getTime()
  });

  // 4. Call contract: storeWeeklyVaultCode() (optional, for transparency)
  const tx = await vaultContract.storeWeeklyVaultCode(weekId, code);
  await tx.wait(1);

  console.log(`Weekly vault code generated for week ${weekId}`);
  return {
    success: true,
    weekId,
    codeSet: true,
    validUntil: validUntil.getTime()
  };
}
```

---

## 📝 Smart Contract Integration

### Contract Instances (ethers.js)

```typescript
// backend/services/contracts.ts

import { ethers } from "ethers";
import { PassSBT__factory, NullStateReward__factory, TreasureVault__factory } from "../typechain";

const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
const signer = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);

export const passSBT = PassSBT__factory.connect(
  process.env.PASS_SBT_ADDRESS!,
  signer
);

export const rewardContract = NullStateReward__factory.connect(
  process.env.REWARD_CONTRACT_ADDRESS!,
  signer
);

export const vaultContract = TreasureVault__factory.connect(
  process.env.TREASURE_VAULT_ADDRESS!,
  signer
);
```

### Environment Variables

```bash
# .env.local
CELO_RPC_URL=https://forno.celo.org
BACKEND_PRIVATE_KEY=0x...
PASS_SBT_ADDRESS=0x...
REWARD_CONTRACT_ADDRESS=0x...
TREASURE_VAULT_ADDRESS=0x...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
ENCRYPTION_KEY=...
GITHUB_ACTIONS_SECRET=...
```

---

## ⏰ Leaderboard Cron Job

Refer to `.github/workflows/leaderboard-update.yml` for details.

**Schedule**: Every day 00:00 UTC

**Triggers**:
1. Automatic (cron schedule)
2. Manual (workflow_dispatch)
3. On seasonal boundary (auto-run)

---

## 🚨 Error Handling

### Standard Error Responses

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string; // e.g., "INSUFFICIENT_BALANCE", "INVALID_CODE"
  details?: any;
}
```

### Common Errors

| Error | Code | Solution |
|-------|------|----------|
| User not authenticated | AUTH_FAILED | Check session |
| Items not found in inventory | ITEMS_NOT_FOUND | Refresh data |
| Contract transaction failed | TX_FAILED | Retry, check gas |
| Code not set for week | CODE_NOT_SET | Wait for Monday generation |
| User already claimed | ALREADY_CLAIMED | Try next week |
| Insufficient reward pool | POOL_DEPLETED | Pro-rata distribution |

---

## 🔒 Security Considerations

### Authentication

- Verify user session on every request
- Use wallet signature verification (optional upgrade)
- Rate limit API endpoints (100 req/min per user)

### Data Validation

- Sanitize all inputs
- Verify contract addresses before calling
- Validate transaction hashes
- Encrypt sensitive data (vault codes)

### Access Control

- Only backend can call `recordBurn()` on contract
- Only backend can submit vault codes
- Only owner can update pool sizes
- Firebase rules enforce user isolation

### Gas Safety

- Estimate gas before transactions
- Set gas limits with 20% buffer
- Monitor CELO balance (keep > 1 CELO)
- Use `gasPrice` from chain, don't hardcode

---

*For more details, see individual contract documentation.*
