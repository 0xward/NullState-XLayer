# Whitelist & Deposit Guide

## Overview

This guide covers:
1. Adding whitelist addresses for free season passes
2. Depositing weekly burn reward pools
3. Depositing season bonus pools
4. Depositing the TreasureVault reward pool

All operations are owner-only and can be done via Celoscan's Write Contract UI
or via a script.

---

## 1. Whitelist Management (PassSBT)

### Add a Single Address

**Contract:** PassSBT (`NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS`)
**Function:** `addToWhitelist(address _user, uint256 _seasonId)`

Via Celoscan:
1. Open `https://celoscan.io/address/<PASS_SBT_ADDRESS>#writeContract`
2. Connect your owner wallet
3. Call `addToWhitelist` with the user address and season ID (e.g. `202607`)

### Batch Add Addresses (Recommended for 46+ wallets)

**Function:** `addBatchWhitelist(address[] _users, uint256 _seasonId)`

```javascript
// scripts/batch-whitelist.js
const ethers = require('ethers');

const PASS_SBT_ABI = [
  'function addBatchWhitelist(address[] calldata _users, uint256 _seasonId) external',
];

const ADDRESSES = [
  '0xAddress1',
  '0xAddress2',
  // ... up to 46 addresses
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL);
  const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(
    process.env.PASS_SBT_ADDRESS,
    PASS_SBT_ABI,
    wallet,
  );

  const seasonId = 202607; // Change per season

  // Split into batches of 20 to stay under gas limit
  const batchSize = 20;
  for (let i = 0; i < ADDRESSES.length; i += batchSize) {
    const batch = ADDRESSES.slice(i, i + batchSize);
    console.log(`Adding batch ${Math.floor(i / batchSize) + 1}...`);
    const tx = await contract.addBatchWhitelist(batch, seasonId, {
      gasPrice: ethers.parseUnits('5', 'gwei'),
      gasLimit: 500000,
    });
    await tx.wait(1);
    console.log(`✅ Batch done: ${tx.hash}`);
  }
}

main().catch(console.error);
```

Run with:
```bash
CELO_RPC_URL=https://forno.celo.org \
OWNER_PRIVATE_KEY=<your_key> \
PASS_SBT_ADDRESS=<contract_address> \
node scripts/batch-whitelist.js
```

### Remove a Whitelisted Address

**Function:** `removeFromWhitelist(address _user, uint256 _seasonId)`

---

## 2. Deposit Weekly Burn Pool (NullStateReward)

**Contract:** NullStateReward (`NEXT_PUBLIC_REWARD_CONTRACT_ADDRESS`)
**Function:** `depositWeeklyPool(uint256 _week, address _rewardToken, uint256 _amount)`

**Parameters:**
| Parameter | Value |
|---|---|
| `_week` | ISO week ID in `YYYYWW` format (e.g. `202627` for week 27 of 2026) |
| `_rewardToken` | `0x765DE816845861e75A25fCA122bb6898B8B1282a` (USDm) |
| `_amount` | Amount in wei — e.g. `2000000000000000000` for 2 USDm |

**Before calling:** Approve NullStateReward to spend USDm:
```
USDm.approve(<REWARD_CONTRACT_ADDRESS>, <amount>)
```

**Weekly pool size:** 2 USDm (`2000000000000000000` wei)

---

## 3. Deposit Season Bonus Pool (NullStateReward)

**Function:** `depositSeasonBonus(uint256 _seasonId, address _rewardToken, uint256 _amount)`

**Minimum amount:** Rank 1 (20 USDm) + Rank 2 (5 USDm) + Rank 3 (3 USDm) = **28 USDm**

| Parameter | Value |
|---|---|
| `_seasonId` | e.g. `202607` |
| `_rewardToken` | `0x765DE816845861e75A25fCA122bb6898B8B1282a` (USDm) |
| `_amount` | `28000000000000000000` (28 USDm minimum) |

**Before calling:** Approve NullStateReward to spend 28+ USDm.

---

## 4. Deposit Vault Reward Pool (TreasureVault)

**Contract:** TreasureVault (`NEXT_PUBLIC_TREASURE_VAULT_ADDRESS`)
**Function:** `depositVaultPool(address _token, uint256 _amount)`

**Vault reward:** 1 USDm per successful vault claim.

Deposit enough for the expected number of weekly claimants. For example, to
fund 10 claims: `10000000000000000000` (10 USDm).

**Before calling:** Approve TreasureVault to spend USDm:
```
USDm.approve(<VAULT_ADDRESS>, <amount>)
```

---

## 5. Supported Tokens

| Token | Address |
|---|---|
| USDm (recommended) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| USDT | `0x88eEc42eaf6E1b371f4a7e786fDDB2E782b72ccA` |
| USDC | `0xeF63B1FdEfA2C442f41911160bCEFdaD5896e107` |
| CELO (native) | `0x471ecE3750da237F93b8e339C536Cb1483c48E8f` |

---

## 6. Emergency Withdrawal

If funds need to be recovered, the owner can call:

**NullStateReward:** `emergencyWithdraw(address _token, uint256 _amount)`

**TreasureVault:** `withdrawVaultPool(address _token, uint256 _amount)`
> Only available funds (deposited − claimed) can be withdrawn.

---

## 7. Verification Checklist

Before each season:
- [ ] Season initialized via `initializeSeason()` on PassSBT
- [ ] Whitelist addresses added via `addBatchWhitelist()`
- [ ] Season bonus deposited (28+ USDm) via `depositSeasonBonus()`
- [ ] Weekly pool deposited (2 USDm/week) via `depositWeeklyPool()`
- [ ] Vault pool funded via `depositVaultPool()`
- [ ] GitHub Secrets configured (see `FIREBASE_SETUP.md`)
