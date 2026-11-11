# Deployment Checklist

## Pre-Deployment

- [ ] All 3 contracts compiled & tested on testnet
- [ ] Testnet deployment successful
- [ ] Security audit completed (or internal review)
- [ ] Environmental variables configured
- [ ] Firebase database structure verified
- [ ] GitHub Actions secrets set
- [ ] Backend endpoints tested

## Smart Contract Deployment

### 1. PassSBT Deployment

```bash
# Deploy
npx hardhat run scripts/deploy-pass-sbt.js --network celo

# Verify on Celoscan
Save contract address: PASS_SBT_ADDRESS=0x...

# Initialize 6 seasons
Call: initializeSeason(202607, startDate, endDate, maxSupply)
Repeat for seasons 2-6

# Add whitelist (optional)
Call: addBatchWhitelist([addresses...], seasonId)
```

### 2. NullStateReward Deployment

```bash
# Deploy (with PassSBT address)
npx hardhat run scripts/deploy-reward.js --network celo --pass-sbt=$PASS_SBT_ADDRESS

# Verify on Celoscan
Save contract address: REWARD_CONTRACT_ADDRESS=0x...

# Add backend address
Call: setBackendAddress(backendWalletAddress, true)

# Deposit initial weekly pool
Call: depositWeeklyPool(weekId, USDm_address, 2e18) // 2 USDm
```

### 3. TreasureVault Deployment

```bash
# Deploy
npx hardhat run scripts/deploy-vault.js --network celo

# Verify on Celoscan
Save contract address: TREASURE_VAULT_ADDRESS=0x...

# Add backend address
Call: setBackendAddress(backendWalletAddress, true)

# Deposit initial vault pool
Call: depositVaultPool(USDm_address, 10e18) // 10 USDm
```

## Backend Deployment

- [ ] Set all environment variables
- [ ] Deploy Firebase database
- [ ] Setup GitHub Actions secrets
- [ ] Test backend endpoints (localhost)
- [ ] Deploy backend to production (Cloud Run, Vercel, etc.)
- [ ] Test cron job (manual trigger)

## Frontend Deployment

- [ ] Update contract addresses in code
- [ ] Test wallet connection (testnet)
- [ ] Test all UI components
- [ ] Verify leaderboard display
- [ ] Test reward claiming
- [ ] Deploy to Vercel

## Post-Launch

- [ ] Monitor contract gas usage
- [ ] Check leaderboard updates (daily)
- [ ] Verify vault codes generate (weekly)
- [ ] Monitor Firebase usage
- [ ] Respond to user issues

---

Estimated timeline: 2-4 weeks
