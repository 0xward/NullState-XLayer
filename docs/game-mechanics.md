# Game Mechanics

## 🏰 Bunker System

NullState has **5 bunkers**, each with **5 procedurally generated floors**.
Floor 5 of every bunker is a boss floor. The sealed Vault door sits on floor 5
of Bunker 5, "The Last Light".

### Bunker Progression

Bunkers differ on two axes: **how dangerous** and **how long**.

| Bunker | Name | Risk | Enemy HP | Shards | Length |
|---|---|---|---|---|---|
| 1 | The Treeline Bunker | ▰▱▱▱▱ | ×1.00 | T1 | — |
| 2 | The Sunken Field | ▰▰▱▱▱ | ×1.20 | T1 | +15% |
| 3 | The Frostline Bunker | ▰▰▰▱▱ | ×1.45 | T2 | +30% |
| 4 | The Hollow Market | ▰▰▰▰▱ | ×1.70 | T2 | +55% |
| 5 | The Last Light | ▰▰▰▰▰ | ×2.00 | T3 | +65% — holds the Vault |

Later bunkers have bigger floors with more rooms, which means more enemies and
more containers — so the longer run pays more. **Bunker 1 stays the short one**
for when you have five minutes, and Bunker 5 is the only place T3 Glitch Shards
drop. Every bunker's profile is shown on the map before you enter.

**Cleared a bunker? It stays open.** Tap any bunker with a ✓ on the world map
and the button reads **RAID** — you drop back in for a freshly generated run.
Loot, Glitch Shards, XP and Vault Fragments all count exactly as they do the
first time. A raid costs **1 energy**, same as a first descent, and it never
touches your campaign progress: the story does not replay and your place in the
bunker you are working through is kept.

Enemy difficulty scales two ways: their stats rise with the **floor depth**,
and the **monster roster widens with each bunker**, so later bunkers throw
crews you have not met before.

**Item rarity is not gated by bunker.** Every rarity can drop anywhere from
Bunker 1 onward — what changes is the *container*. Richer containers roll
several times and keep the best result, so a Lost Cache is far likelier to
hand you something legendary than a Supply Crate is, on any floor.

### Progression Rules

- **Must clear all enemies** on a floor before the lift will take you deeper
- **Fog of War** - Rooms you haven't visited are dark
- **Golden Lift** - Travel freely to any floor you have already reached in
  this bunker. Monsters you killed stay dead, containers you emptied stay
  empty, and props you smashed stay broken — the floor is exactly as you
  left it.
- **Permadeath, Softened** - Die = respawn with full HP. Deaths do cost you:
  the shard payout for the run drops 20% per death after the first, down to
  a floor of 40%.

---

## 📦 Container Loot System

Interactive containers — the ones with an **OPEN** button — roll **2-4 loot
slots**. Some slots come up empty, so a container can yield fewer than that.
Breakable props (crates, barrels, urns) are different: smash them and their
loot lands as pickups on the spot.

### How It Works

1. **Open Container** → a two-panel window opens: the container's LOOT on one
   side, YOUR INVENTORY on the other
2. **Take What You Want** → tap a slot to take it, or hit **TAKE ALL**
3. **No Floor Drop** → container loot goes straight to your stash, never onto
   the ground
4. **Nothing is lost** → close the window with loot still inside and the
   container stays where it is with that loot in it. Walk back to it and the
   button reads **REOPEN**. A container you emptied stays empty for the rest of
   that bunker visit.

### Rarity Colors

- ⬜ **Common** (~59%) - Gray
- 🟩 **Uncommon** (~26%) - Green
- 🟦 **Rare** (~11%) - Blue
- 🟪 **Epic** (~3.5%) - Purple
- 🟨 **Legendary** (~0.6%) - Gold

Those are the odds for a **single roll**. Richer containers roll two or three
times and keep the best result, which is what makes a Lost Cache worth far
more than a Supply Crate. An active **Drop-Rate Elixir** adds one extra
keep-the-better roll to everything for 30 minutes.

---

## 🎯 Item Rarity & Values

Each item has a hidden burn value (random within its rarity range):

| Rarity | Burn Value (NullState Point) |
|--------|-----------|
| Common | 1 - 5 |
| Uncommon | 10 - 50 |
| Rare | 50 - 150 |
| Epic | 150 - 350 |
| Legendary | 350 - 500 |

**Everything burns except the two special items below.** This table used to say
Common could not be burned; it can, for 1-5 Point — `items.js` gives it a burn
value and nothing in the engine, the Rewards screen or the burn route filters it
out. Corrected after an audit checked the claim against the code.

> Burn values are **NullState Point** (off-chain, faucet-only in-game currency — spendable on Marketplace "Swap" purchases, not withdrawable/real money), not USDT. See `docs/rewards-system.md` and `public/game-engine/items.js` for the source of truth.

**Special Items:**
- 📄 **Old Paper (Epic)** - Cannot burn. Tap it in your inventory to read this week's 4-digit vault code.
- 🔑 **Golden Key (Legendary)** - Cannot burn. Opens the sealed vault door in Bunker 5.
- **Both stay in your stash.** They carry between bunkers and survive a Save & Exit — you do not lose them when a run ends. Each is capped at **one per wallet per week** (server-enforced, resets Monday 00:00 UTC).

### 📋 Daily Missions

Three objectives every day, reset at **00:00 UTC**. Everyone gets the same
three, so you can compare with a friend.

They pay **Glitch Shards** and **NullState Point** the moment you finish them —
no claim button, no screen to visit. Typical asks: put down 30 enemies, secure
3 floors, crack 5 lockable containers, burn 8 items.

One good session usually clears two of the three. The third is what tomorrow is
for.

Burning counts **wherever you burn** — in your stash mid-run, or from the
Rewards screen between runs. Either way the mission moves.

The Rewards screen lists your **last 7 days** of burns and clears the older
receipts, so the list stays readable instead of growing all season. Nothing is
lost: the NullState Point from every burn was paid into your balance the moment
you made it, and the season totals above the list still count all of them.

Tap any chip on the map — or the **DAILY** button on the left rail — to open the
**DAILY panel**: your streak, today's three missions, your vault fragments,
your energy and any running craft, with one countdown to the next reset.

**Everything daily resets together at 00:00 UTC** — missions, your streak, and
your free energy.

---

### 🔥 Login Streak

Just opening the game counts. Every UTC day you show up moves your streak up
one rung, and each rung pays more than the last:

| Day | You get |
|---|---|
| 1 | 80 NullState Point |
| 2 | 2 Glitch Shards |
| 3 | +1 energy |
| 4 | 3 Glitch Shards |
| 5 | 150 NullState Point |
| 6 | 4 Glitch Shards |
| **7** | **8 Glitch Shards** — exactly one weapon evolution |

No button to press: the reward lands the moment the map opens, and the **🔥**
chip shows how many days you are on. After day 7 the ladder starts again, and
your longest run is kept as a record.

Open the **DAILY** panel and you can see the whole week at once — every rung and
what it pays, the ones you have already banked stamped, and today lit up. On the
visit that pays you, the panel opens by itself and leads with what you just got.

### 🛡 The Streak Shield

**Three days in a row earns you a Streak Shield.** Miss a day and it is spent for
you automatically — your streak survives and carries on the next time you open
the game. You do not get paid for the day you missed; you just do not lose
everything for it.

- One shield at a time. It covers **one** missed day, not two.
- After it is spent, three more days in a row earns the next one.
- **Miss two days, or miss one with no shield, and the streak goes back to 1.**

The panel tells you which of those you are in — "Streak Shield ready", or how
many days until the next one.

---

### 🧩 Vault Fragments — the guaranteed way to get them

You are never left to luck. Every **lockable container** you open — the ones
with an **OPEN** button, like the Rotten Armoire or the Lost Cache — earns you
one **Vault Fragment**.

| Fragments | You get |
|---|---|
| 8 | 📄 **Old Paper**, guaranteed |
| 18 | 🔑 **Golden Key**, guaranteed |

Both can still drop early by chance, and often do — the fragments are the floor,
not the ceiling. **A week of playing can never pay you nothing.**

Watch the bar in your inventory, right under the two items it buys. It resets
with the week, along with everything else.

---

### 🏆 When you crack it

A popup tells you exactly what you won — **the amount and the token** — and that
it has **already been sent to your wallet**. There is no claim button, because
there is nothing to claim: the transfer happens on-chain the moment your code is
accepted. It can take a few seconds to appear in MiniPay.

The popup waits for you. Tap **CONTINUE** when you are ready; nothing disappears
on a timer.

---

### ⭐ After the campaign

Beat all five bunkers and you land back on the **world map**, with a panel
telling you what you have just unlocked. Every bunker stays open to **RAID** —
and Bunker 5 is how you reach the vault every week from then on, so that is
where the money is.

Two new ways down appear under **≡ MENU**, and stay there:

- **THE NULL ABYSS** — an endless descent with no bottom. Your deepest fall is
  your rank this season, and death ends the run.
- **NEW GAME+** — replay the campaign harder. Enemies gain +35% per cycle,
  shards pay +25%, and you keep your level and your gear.

---

## 🎮 Your Character

You play as the **Knight** — the sole playable character.

- High HP, medium damage
- Steel Slash attack effect

Your power comes from **gear**, not class choice: buy weapons and armour in
the Marketplace, then evolve your weapon with Glitch Shards earned in-run.

---

## ⚡ NULL_STRIKE Ultimate

When your HP drops critically low (or a boss is in range), trigger **NULL_STRIKE** for a powerful all-consuming attack.

- **Cost**: Free — no wallet transaction; gated only by a short cooldown
- **Effect**: Massive damage to elites/bosses

---

## 💾 Your Progress is Safe

**When you click "Save Game", your data is NOT reset.**

- All items saved
- Inventory preserved
- Bunker and floor progress locked in
- Level, XP and equipped gear recorded
- Old Paper and Golden Key stay in your stash

You can close anytime and come back to the same bunker, on the same floor,
with everything you were carrying.

**And the same floor means the same floor.** The rooms are laid out exactly as
you left them, you are standing where you stood, monsters you killed are still
dead, containers you emptied are still empty, props you smashed are still
broken, and the rooms you had lit stay lit.

---

## 📊 Player Stats

Your profile tracks:

- **Level & XP** — your career progression, carried across every run
- **Enemies Killed** — a lifetime total, not a per-run one
- **NullState Point Balance** — from burning items; spendable on Marketplace gear
- **Glitch Shards** (t1/t2/t3) — banked at the end of each bunker, spent on weapon evolution
- **Leaderboard rank** — computed from the XP you earn **during the current season**; everyone starts each month at zero. The top 10 at season end share **35 USDT**: $20/$5/$3 for the podium, $1 each for ranks 4-10. Your career XP is a separate ALL-TIME board and never resets

Your **stablecoin reward history** (vault wins and season bonuses actually
paid out) lives on the Rewards screen rather than the profile.

Level, XP and kills are **cumulative and do not reset** between seasons. What
is seasonal is the Season Pass and the monthly top-10 bonus.

---

*Learn more: [Rewards System](./rewards-system.md) | [Leaderboard](./leaderboard.md)*
