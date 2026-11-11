# Rewards System

## 💰 How to Earn

NullState offers multiple income streams:

1. **Burn Items** (Anytime) - Convert loot to NullState Point (off-chain, spend in Marketplace)
2. **Vault Quest** (Weekly) - Solve code puzzle, earn real USDT
3. **Seasonal Bonuses** (Monthly) - Rank in leaderboard, earn real USDT

---

## 🔥 Burning Items

### What is "Burning"?

**Burning** = Converting your loot items into **NullState Point** — an off-chain,
in-game-only currency (not real money, not withdrawable). Think of it like an
arcade token: earned by burning loot, spent on Marketplace gear.

- Items are **permanently removed** from inventory
- NullState Point is credited **instantly** — no weekly pool, no claim step
- Only usable inside NullState (Marketplace swaps)

### What Can Be Burned?

✅ **Burnables:**
- Common, Uncommon, Rare, Epic, and Legendary items

❌ **Cannot Burn:**
- Paper (quest item)
- Golden Key (quest item)

### How to Burn

1. Open **Inventory**
2. Select items to burn (multi-select ok)
3. Click **"Burn Items"**
4. Items deleted, NullState Point credited to your balance immediately

### Burn Values (Random)

| Rarity | NullState Point Range |
|--------|-------------------------|
| Common | 1 - 5 |
| Uncommon | 10 - 50 |
| Rare | 50 - 150 |
| Epic | 150 - 350 |
| Legendary | 350 - 500 |

Each item's burn value is **randomized within its range**. Higher rarity = more tokens!

### Spending NullState Point

NullState Point can be spent in the **Marketplace** on lower-priced gear
($0.5–$2 items) via the **Swap** button (sits below the regular "Buy"
button on eligible items). Pricier items ($3.5+) can only be bought with
real USDM/USDC/USDT.

| Item Price (USD) | NullState Point Required |
|--------------------|-----------------------------|
| $0.5 | 3,000 |
| $1.0 | 6,000 |
| $1.5 | 9,000 |
| $2.0 | 12,000 |

Rate: 6,000 NullState Point ≈ $1 of Marketplace gear.

---

## 🏺 Vault Quest Rewards

*Covered in [Treasure Vault Quest](./treasure-vault-quest.md)*

- **Reward**: 1 USDT per correct code
- **Frequency**: 1x per week
- **Total/month**: ~5 USDT (if you get it right each week)

---

## 🏆 Seasonal Bonus Rewards

### Leaderboard Rankings

Each month, the **top 10 players by XP** earn bonus USDT — **35 USDT** in total.

| Rank | Reward | How you get it |
|------|--------|----------------|
| 🥇 1st | 20 USDT | Claim in Rewards |
| 🥈 2nd | 5 USDT | Claim in Rewards |
| 🥉 3rd | 3 USDT | Claim in Rewards |
| 4th – 10th | 1 USDT each | **Sent to your wallet** |

**Why the top 3 claim and the rest do not.** The reward contract holds exactly
three places (`updateLeaderboard` takes `address[3]`), so ranks 4–10 have no
claim to make — the owner transfers those directly instead. Same money, one
fewer step, and no Season Pass needed for them.

### How Rankings Work

Rankings are by **experience (XP) earned** during the season — your rank
updates as you play. No composite formulas; the leaderboard screen shows
exactly what counts.

### When to Claim

- **Season ends**: last day of the UTC month.
- **After the winners are published on-chain and the owner deposits the
  bonus pool**, the top 3 claim from Rewards → Claim Rewards in-app.
- Claiming requires holding that season's Season Pass. There is no
  claim deadline — a past season's bonus stays claimable.
- **Ranks 4–10 have nothing to claim.** Their 1 USDT is sent straight to the
  wallet on the frozen leaderboard, with no Pass requirement.
- The final standings, and whether they have been paid, are shown at the bottom
  of the in-game **Leaderboard** under *Last season*.

---

## 📊 Earning Potential

Amounts are **owner-configured on-chain** and can change per week/season —
the in-game Rewards screen always shows the current values. Directionally:
the weekly Vault code pays a fixed amount per correct solve (once per
wallet per week), and the seasonal top-3 split a fixed bonus pool. Neither
requires spending anything. NullState Point from burns is in-game only and
not part of stablecoin earnings.

### Earning Tips

1. **Burn any-rarity items** - Converts to NullState Point (spend on Marketplace gear, not real money)
2. **Collect diverse rarities** - Legendary items = biggest NullState Point burns
3. **Solve vault weekly** - Guaranteed 1 USDT/week
4. **Stay active daily** - Days Active = leaderboard points
5. **Kill everything** - Combat engagement = leaderboard edge
6. **Build consistent record** - No reset, stats carry over

---

## 🪙 About the reward currency

All game rewards (Vault Quest + seasonal bonuses) pay out in **USDT** — a
dollar-pegged stablecoin on Celo. For *purchases* (Marketplace gear, Season
Pass) you can pay with **USDM, USDC, or USDT**, whichever you hold the most
of — but what the game *pays you* is always USDT.

- **Value**: 1 USDT ≈ $1 USD
- **Network**: Celo Mainnet
- **Wallet**: Transfer to any Celo-compatible wallet
- **Exchange**: Trade on a DEX (Uniswap, etc.)

Your USDT earnings are **real, on-chain value**.

---

*Next: [Leaderboard & Rankings](./leaderboard.md) | [Pass System](./pass-system.md)*
