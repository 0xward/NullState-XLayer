# Leaderboard & Rankings

## 🏆 Monthly Competition

Every month, players compete on a **global leaderboard** ranked by a hybrid scoring system.

### Top 10 Rewards

| Rank | Reward | How it reaches you |
|------|--------|--------------------|
| 🥇 **1st** | **20 USDT** | Claim in Rewards (needs that season's Pass) |
| 🥈 **2nd** | **5 USDT** | Claim in Rewards (needs that season's Pass) |
| 🥉 **3rd** | **3 USDT** | Claim in Rewards (needs that season's Pass) |
| **4th – 10th** | **1 USDT** each | Sent directly to your wallet, no claim |

**Total**: 35 USDT distributed monthly across the top 10.

The reward contract holds exactly three places (`updateLeaderboard` takes
`address[3]`), which is why only the podium has a claim button — ranks 4–10 are
paid by direct transfer instead.

---

### Season vs All-Time

The in-game Leaderboard has two tabs, and only one of them pays:

| Tab | Ranked by | Pays |
|---|---|---|
| **SEASON** | XP earned **this month** — everyone starts at zero on the 1st | ✅ the 35 USDT above |
| **ALL-TIME** | career XP, which never resets | — a record, not a prize |

This split exists because career XP is cumulative: ranking a season by it made
every month a re-run of the first, and meant a player joining later could never
win. See `GAME-DESIGN.md` §9.2c.

## 📊 Scoring Formula

Your **seasonal score** is calculated from 5 metrics:

### The 5 Pillars

```
Seasonal Score = 45% USDT + 20% Items + 15% Kills + 15% Days + 5% Vault
```

| Metric | Weight | Measured |
|--------|--------|----------|
| 💰 **Total USDT Earned** | 45% | Burn rewards + vault + bonuses |
| 📦 **Items Collected** | 20% | Total unique items looted |
| ⚔️ **Enemies Killed** | 15% | Combat engagement metric |
| 📅 **Days Active** | 15% | How often you play (loyalty) |
| 🔐 **Vault Codes Solved** | 5% | Weekly vault quest wins |

### Why This Scoring?

**45% USDT** - Rewards actual earnings  
→ Players who burn efficiently rank higher

**20% Items** - Rewards exploration  
→ Encourages diving into bunkers

**15% Kills** - Rewards combat  
→ Incentivizes fighting, not just looting

**15% Days** - Rewards consistency  
→ Loyal daily players get edge

**5% Vault** - Rewards problem-solving  
→ Weekly puzzle bonus

---

## 🎯 How Scoring Works

### Normalization (0-100 Scale)

Each metric is normalized to 0-100 based on **the best player that month**:

```
Example - Your Score:

You:
- USDT: 8 earned
- Items: 450 collected
- Kills: 8,000 total
- Days: 25 active
- Vault: 4 codes solved

Top Player (Normalization):
- USDT: 10 (best)
- Items: 500 (best)
- Kills: 10,000 (best)
- Days: 28 (best)
- Vault: 4 (best)

→ Your Normalized Score:

- USDT: (8/10) × 100 = 80 → 80 × 0.45 = 36.0
- Items: (450/500) × 100 = 90 → 90 × 0.20 = 18.0
- Kills: (8000/10000) × 100 = 80 → 80 × 0.15 = 12.0
- Days: (25/28) × 100 = 89 → 89 × 0.15 = 13.4
- Vault: min(4, 4) × 25 = 100 → 100 × 0.05 = 5.0

FINAL SCORE = 36 + 18 + 12 + 13.4 + 5 = 84.4 / 100
```

---

## 📈 Example Leaderboards

### Season 1 (July 2026)

```
Rank 1: Alice
├─ USDT Earned: 10 USDT
├─ Items: 500 items
├─ Kills: 10,000 enemies
├─ Days Active: 28 days
├─ Vault Codes: 4 correct
├─ Score: 95.2
└─ REWARD: 20 USDT 🥇

Rank 2: Bob
├─ USDT Earned: 8.5 USDT
├─ Items: 480 items
├─ Kills: 9,500 enemies
├─ Days Active: 27 days
├─ Vault Codes: 4 correct
├─ Score: 89.7
└─ REWARD: 5 USDT 🥈

Rank 3: Carol
├─ USDT Earned: 8 USDT
├─ Items: 450 items
├─ Kills: 8,500 enemies
├─ Days Active: 25 days
├─ Vault Codes: 3 correct
├─ Score: 84.2
└─ REWARD: 3 USDT 🥉

Rank 4: Dave (No reward)
├─ Score: 78.9
```

---

## 🗓️ Monthly Cycle

### Timeline

**Days 1-27**: Playing & earning
- Burn items, solve vaults, collect stats
- Leaderboard updates daily (00:00 UTC)
- Compete with other players

**Day 28-31**: End of season
- Last day to earn points
- Final leaderboard locked at 23:59 UTC
- Top 3 determined

**Days 32-39**: Claim period (7 days after season)
- Owner deposits 28 USDT to the reward pool (the podium's share)
- Top 3 players can claim bonuses; ranks 4–10 are transferred the remaining 7 USDT directly
- Rankings reset for new month

**Day 1 of next month**: Season reset
- New leaderboard begins
- New pass available
- New vault code generated

---

## 💡 Winning Strategies

### Strategy 1: "USDT Maximizer"
Focus on: Burning high-value items  
Result: 45% of score comes naturally  
Best for: Players who farm efficiently

### Strategy 2: "Explorer"
Focus on: Collecting diverse items  
Result: Unlock bunker 6 = access to all item tiers  
Best for: Completionists

### Strategy 3: "Combat King"
Focus on: Fighting every enemy  
Result: High kill count = 15% score boost  
Best for: Action game lovers

### Strategy 4: "Grinder"
Focus on: Playing daily consistency  
Result: 15% days active = reliable points  
Best for: Busy players (2-3 games/day)

### Strategy 5: "Balanced" (Recommended)
Focus on: All 5 metrics equally  
Result: Highest overall score  
Best for: Competitive players

---

## 🔄 Updates & Resets

### Daily Updates (00:00 UTC)

Every day at midnight UTC, the leaderboard is recalculated:

1. Fetch all players' stats from Firebase
2. Calculate hybrid scores
3. Rank all players
4. Update contract (top 3 only)
5. Broadcast new rankings

**You'll see your rank refresh every morning.**

### Monthly Reset (00:00 UTC, 1st of month)

1. Season ends
2. Top 3 finalized
3. Bonus pool opens for claiming
4. New season begins
5. Stats reset to 0
6. Leaderboard resets

---

## ❓ FAQ

**Q: Can my rank drop?**  
A: Yes, daily. If other players earn more, you drop. Always grinding!

**Q: What if I'm tied with someone?**  
A: Tie-breaker: Who earned more USDT? Then who has more items? System breaks all ties.

**Q: What if I don't play the last week?**  
A: Your score freezes. Others will pass you. Stay active!

**Q: Can I claim bonus if I wasn't rank 1-3 all month?**  
A: No, only final position matters. Final ranking at 23:59 UTC on last day.

**Q: When do bonuses get paid?**  
A: After owner deposits pool (usually day 1-3 of new season). Then you have 7 days to claim.

**Q: What if I miss the 7-day claim window?**  
A: The bonus stays locked. Claim within 7 days or forfeit it.

**Q: Can I see my breakdown?**  
A: Yes! Reward panel shows all 5 metrics + final score.

---

## 🎯 Leaderboard in Game

In the main menu:

```
┌─────────────────────────────────┐
│ NULLSTATE SEASON 1 (JULY 2026)  │
├─────────────────────────────────┤
│ Days Left: 12                   │
│ Last Updated: 2026-07-15 00:00  │
├─────────────────────────────────┤
│ 🥇 1. Alice       95.2 pts      │
│ 🥈 2. Bob         89.7 pts      │
│ 🥉 3. Carol       84.2 pts      │
│  4. Dave         78.9 pts      │
│  5. Eve          76.5 pts      │
│  ... (top 100)                 │
├─────────────────────────────────┤
│ YOUR RANK: 42 / 523 players    │
│ YOUR SCORE: 72.1 pts           │
│                                 │
│ [View Full Stats] [Claim Bonus] │
└─────────────────────────────────┘
```

---

*Next: [Rewards System](./rewards-system.md) | [Pass System](./pass-system.md)*
