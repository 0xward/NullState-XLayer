# Treasure Vault Quest 🔐

## The Mystery

Deep in the bunkers lies a legendary **Treasure Vault**, protected by an ancient code. Few have dared to seek it. Can you solve the puzzle?

---

## Quest Objectives

To unlock the vault, you need:

1. ✏️ **The Code Paper** (Epic item)
   - Occasionally drops from Rotten Armoire or Lost Cache containers, anywhere in the bunkers
   - Contains a 4-digit secret code
   - Can **NOT be burned**
   - Capped at 1 per wallet per week (server-enforced)

2. 🔑 **The Golden Key** (Legendary item)  
   - Same drop pattern as the Code Paper — Rotten Armoire / Lost Cache containers
   - Can **NOT be burned**
   - Capped at 1 per wallet per week (server-enforced)

3. 🏺 **The Vault** (Bunker 5 — "The Last Light")
   - Present in that bunker's boss floor from the moment you enter it, sealed shut
   - Only openable once that bunker's boss (floor 5) is defeated
   - Requires both Code Paper + Golden Key
   - Opens with a 4-digit input

---

## How to Solve It

### Step 1: Find the Paper
- Open Rotten Armoire or Lost Cache containers anywhere in the bunkers
- 16% chance per eligible container, capped at 1/wallet/week
- When found: Code appears in your inventory
- **Memorize or screenshot the 4-digit code**

### Step 2: Find the Golden Key
- Same containers as the Paper — Rotten Armoire / Lost Cache
- 16% chance per eligible container, capped at 1/wallet/week
- Collect it and keep it safe

### Step 3: Reach the Vault
- Progress to **Bunker 5 ("The Last Light")**, floor 5 (the boss floor)
- The sealed Vault door is already there when you arrive — you'll see it, but it won't open yet
- Defeat that floor's boss to unlock it for opening

### Step 4: Input the Code
- Interact with vault → Code input UI opens
- Enter your 4-digit code using keyboard
- **You have 3 attempts max**
- **Wrong attempts lock you until next week**

### Step 5: Claim Reward
- **Correct code** → **1 USDT transferred to your wallet**
- Can claim once per week
- Next week: New code, new quest

---

## Code System

### Weekly Reset
- Vault code **changes every Monday at 00:00 UTC**
- Each week has a new random 4-digit code
- Old code invalid once week ends

### Attempt Limits
- **Max 3 attempts per week**
- Wrong guess = 1 attempt used
- Correct guess = Success (doesn't count as attempt)
- After 3 fails → Locked until next Monday
- Remaining attempts shown in UI

### Multiple Claims
- **1 claim per user per week** (Monday 00:00 UTC resets)
- Earn up to **5 USDT/month from vault alone**
- Extra income on top of burn rewards

---

## Strategy Tips

1. **Carry paper safely** - Don't lose it before reaching vault
2. **Write down code** - Paper item shows code; copy it
3. **Plan route** - Find both paper + key before reaching Bunker 5's boss
4. **Use your attempts wisely** - 3 chances, make them count
5. **Weekly refresh** - Monday brings new code, new opportunity

---

## Rewards

| Outcome | Reward | Details |
|---------|--------|----------|
| Correct Code | 1 USDT | Instant, 1x/week |
| Wrong Code | 0 USDT | Attempt used, try again |
| Max Attempts | Locked | Try next week |
| **Monthly Total** | **~5 USDT** | 4-5 correct codes |

*Reward amount is read live from the TreasureVaultV2 contract's `vaultReward` (owner-adjustable) — 1 USDT is the value it currently ships with, not a value hardcoded into the game client.*

---

## FAQ

**Q: Can I get another paper if I lose it?**  
A: Yes, papers respawn in containers. Find a new one if needed.

**Q: What if I die with paper + key?**  
A: Both stay with you in your inventory. Death only sends you back to the floor you died on, not out of the run.

**Q: What if time runs out in vault UI?**  
A: No timer; you have unlimited time to input code. Take your time.

**Q: Can I sell or burn the paper/key?**  
A: No, they auto-delete after your run ends. They're only for this quest.

**Q: What's the code format?**  
A: 4 digits: 0000 to 9999. All numbers, no letters.

---

*Ready to find the vault? Good luck, adventurer.* 🗝️✨
