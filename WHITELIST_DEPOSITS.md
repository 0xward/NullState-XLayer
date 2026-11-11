# Whitelist & Deposit Guide

## Overview

This guide covers:
1. Adding whitelist addresses for free season passes
2. Depositing weekly burn reward pools
3. Depositing season bonus pools
4. Depositing the TreasureVault reward pool

All operations are owner-only and can be done via the X Layer explorer's Write Contract UI
or via a script.

---

## 1. Whitelist Management (PassSBT)

### Add a Single Address

**Contract:** PassSBT (`NEXT_PUBLIC_PASS_SBT_CONTRACT_ADDRESS`)
**Function:** `addToWhitelist(address _user, uint256 _seasonId)`

Via the X Layer explorer:
1. Open `https://www.okx.com/web3/explorer/xlayer/address/<PASS_SBT_ADDRESS>` and use its Write Contract tab
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
  const provider = new ethers.JsonRpcProvider(process.env.XLAYER_RPC_URL);
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
XLAYER_RPC_URL=https://rpc.xlayer.tech \
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
| `_rewardToken` | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` (USDC) |
| `_amount` | Amount in base units — e.g. `2000000` for 2 USDC |

**Before calling:** Approve NullStateReward to spend USDC:
```
USDC.approve(<REWARD_CONTRACT_ADDRESS>, <amount>)
```

**Weekly pool size:** 2 USDC (`2000000` base units)

---

## 3. Deposit Season Bonus Pool (NullStateReward)

**Function:** `depositSeasonBonus(uint256 _seasonId, address _rewardToken, uint256 _amount)`

**Minimum amount:** Rank 1 (20 USDC) + Rank 2 (5 USDC) + Rank 3 (3 USDC) = **28 USDC**

| Parameter | Value |
|---|---|
| `_seasonId` | e.g. `202607` |
| `_rewardToken` | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` (USDC) |
| `_amount` | `28000000` (28 USDC minimum) |

**Before calling:** Approve NullStateReward to spend 28+ USDC.

---

## 4. Deposit Vault Reward Pool (TreasureVault)

**Contract:** TreasureVault (`NEXT_PUBLIC_TREASURE_VAULT_ADDRESS`)
**Function:** `depositVaultPool(address _token, uint256 _amount)`

**Vault reward:** 1 USDC per successful vault claim.

Deposit enough for the expected number of weekly claimants. For example, to
fund 10 claims: `10000000` (10 USDC).

**Before calling:** Approve TreasureVault to spend USDC:
```
USDC.approve(<VAULT_ADDRESS>, <amount>)
```

---

## 5. Supported Tokens

| Token | Address |
|---|---|
| USDC (recommended) | `0xB6CEceAB302E2E4948951eE7843FC24E92933061` |
| USDT0 | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` |
| OKB (native gas token) | — (no contract address) |

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
- [ ] Season bonus deposited (28+ USDC) via `depositSeasonBonus()`
- [ ] Weekly pool deposited (2 USDC/week) via `depositWeeklyPool()`
- [ ] Vault pool funded via `depositVaultPool()`
- [ ] GitHub Secrets configured (see `FIREBASE_SETUP.md`)
