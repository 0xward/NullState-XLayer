# Data & Safety

## 🔒 Your Progress is Permanent

One of NullState's core promises:

### ✅ What DOES NOT Reset

- **Your items** - Forever in your inventory
- **Your stats** - Lifetime tracking
- **Your account** - Never deleted
- **Save Game clicks** - Data persists
- **Wallet transactions** - All recorded on-chain

### ✅ What DOES Reset

- **Seasonal leaderboard** - Every month (fresh competition)
- **Weekly vault codes** - Every Monday (new puzzle)
- **Weekly burn cap** - Every Monday (fresh pool)

---

## 💾 Data Storage

### On-Chain (Immutable)

Celo blockchain stores:
- Stablecoin transfers (Vault Quest + Season Bonus rewards paid in USDT; Marketplace/Pass purchases in USDM/USDC/USDT — burns produce NullState Point off-chain instead, see rewards-system.md)
- Vault code submissions (proof of completions)
- Leaderboard snapshots (top 3 finalized)
- Pass NFTs (your season pass certificates)

**Why?** Transparency & security. You own your data.

### Off-Chain (Firebase)

Our secure database stores:
- Item inventory (what you collected)
- Season stats (items, kills, days active)
- Vault codes (weekly puzzle codes, used for verification)
- Game progress (current bunker, floor)

**Why?** Speed. Blockchain is slow; inventory changes are instant.

---

## 🛡️ Security Measures

### Data in Transit

- HTTPS for all transfers

### Access Control

- Only you access your data (via wallet)
- Backend cannot see your inventory details
- Smart contracts verify ownership

### Backup

- Daily snapshots
- Multi-region storage
- Disaster recovery plan

---

## 🔐 Wallet Security

### You Control Everything

- **Private key** = Your responsibility
- **Seed phrase** = Write it down, keep safe
- **Wallet** = Use MiniPay or MetaMask (WalletConnect/Rainbow/Coinbase Wallet not integrated)
- **Transactions** = You sign every one

### Best Practices

1. Never share your seed phrase
2. Never share your private key
3. Only connect to the official URL: **https://playnullstate.xyz**. The old
   address, `nullstate-ten.vercel.app`, still redirects there, so a link you
   saved earlier keeps working — but treat any *other* host claiming to be
   NULL_STATE as a phishing attempt.
4. Use hardware wallet if you have large balances
5. Verify contract addresses before transactions

---

## 📊 Data Persistence Explained

### The Promise

**When you click "Save Game", nothing resets.**

Your data flows:

```
1. You collect item in-game
   ↓
2. Item stored to Firebase
   ↓
3. You click "Save Game"
   ↓
4. Data synced to backup
   ↓
5. You close game
   ↓
6. You re-open game 1 week later
   ↓
7. Item still there! ✅ (NO RESET)
```

### Auto-Save

- Every 30 seconds, progress saves automatically
- You don't have to manually save
- Even if you crash, you're protected

---

## 🌐 Transparency

### Smart Contracts

All contracts are **open-source & verifiable** on Celoscan:

- **PassSBT**: [View on Celoscan](https://celoscan.io)
- **NullStateReward**: [View on Celoscan](https://celoscan.io)
- **TreasureVault**: [View on Celoscan](https://celoscan.io)

You can audit the code yourself!

### Transactions

Every USDM transfer is visible:
- Burn rewards: Transparent on-chain
- Season bonuses: Locked in contract
- Vault claims: Logged as events

---

## ❓ FAQ

**Q: What if the server goes down?**  
A: Your on-chain data (USDM, passes, vault claims) is safe forever. Off-chain inventory can be restored from backups within hours.

**Q: Can NullState devs steal my items?**  
A: No. Only you control your wallet. Devs can't access private keys or move funds without you signing.

**Q: Is my USDM safe?**  
A: Yes. It's in a smart contract you control. Only you can claim/transfer it.

**Q: What if I lose my wallet?**  
A: Your on-chain assets (USDM, passes) are retrievable with seed phrase. Off-chain inventory may be recoverable by support.

**Q: How long is data kept?**  
A: Forever. NullState promises permanent data persistence.

**Q: Can I download my data?**  
A: Blockchain data is always public. Game data can be exported on request.

---

## 🔗 Contract Addresses

*To be added post-deployment*

```
Celo Mainnet (Chain ID 42220)

PassSBT: 0x...
NullStateReward: 0x...
TreasureVault: 0x...
USDM Token: 0x765DE816845861e75A25fCA122bb6898B8B1282a
```

---

*Next: [FAQ](./faq.md) | [Back to Home](./index.md)*
