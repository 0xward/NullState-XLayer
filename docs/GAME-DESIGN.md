# NullState — Game Design

**Read this before touching anything.** This is the document that answers
"what game is this, and why would anyone open it tomorrow." Every other doc
in this folder describes a *system*; this one describes the *game those
systems are supposed to add up to*.

It exists because they stopped adding up. `lib/constants/game-config.ts`
carried a `bunkers` block claiming 6 bunkers of 3 floors and a `specialItems`
block placing the Golden Key at "bunker 1, floor 3". Neither was true, and
neither was read by a single line of source — the engine is a static
`<script>`, it cannot import from `lib/`. Those numbers reached the
player-facing docs. Nine dead blocks have since been deleted from that file
and it now carries the rule that kept them out; this doc is the thing to
trust for anything above the level of a price.

---

## How to read the status markers

Every claim below is tagged. Nothing here is allowed to be ambiguous about
whether it is real:

- **`[TODAY]`** — built, shipped, true right now.
- **`[TARGET]`** — agreed design, not built yet.
- **`[CHANGE]`** — built, but the agreed design differs from what exists.

If you implement a `[TARGET]`, flip it to `[TODAY]` in the same PR. A
design doc that drifts from the code is worse than no design doc — that is
exactly how `game-config.ts` became a liability.

---

## 1. What NullState is

> A short-session mobile dungeon crawler on Celo where **playing this week
> is what earns you real USDT at the end of it.**

Three words that decide every argument:

**Short.** One raid is 3–10 minutes. MiniPay players are on mid-range
phones, often on the move. If a loop needs a 20-minute sitting, it is
wrong for this audience regardless of how good it is.

**Repeatable.** The campaign is not the content. The campaign is the
tutorial. The content is raiding a world you already unlocked, forever.

**Real.** Money actually moves. That is the differentiator against every
other pixel roguelite, and it means the *cadence* of payout matters more
than the *size* of it.

### What it is NOT

- **Not a story game you finish.** The story is the wrapper, not the goal.
- **Not a daily-payout game.** Daily play pays *progress*. Money is weekly.
- **Not an idle/tap game.** There is real combat under this. Tap-loops fade;
  the depth is the moat (see `GROWTH-BLUEPRINT.md`, market grounding).

---

## 2. The structural decision (2026-07-30)

**Campaign = tutorial. The world map = the game.**

The old structure was a linear campaign that ends — `campaignActIndex` only
ever increments (`game.js:5244`), and `WorldMapHub.tsx:234` says out loud
that re-entering a cleared bunker "would need an engine entry point that
doesn't exist yet." A finite campaign and a forever-weekly-payout are two
different genres bolted together, and the seam is exactly where players got
stuck: bunker cleared, ✓ on the map, no way back in.

The agreed shape:

| Stage | What it is |
|---|---|
| First playthrough | 5 bunkers, story beats, ~2–3 sessions. Onboarding. |
| After the campaign | **All five bunkers permanently open.** The map is home. |
| Forever after | Daily and weekly loops run *inside* those bunkers. |

**`[TODAY]`** Cleared bunkers are re-enterable, and now differ from each other. See §7.

### Persistence: what actually needs to persist

This was nearly over-engineered, so it is written down plainly.

**Within one visit — `[TODAY]`, works correctly.** `G.floors[depth]` caches
`{dun, enemies, decor, bossAlive, visited}` (`game.js:463`), and `descend()`
writes the live floor back before leaving (`game.js:754-758`). Kill a
monster on floor 2, ride the lift to floor 4 and back — it is still dead.
Opened containers stay empty, smashed props stay smashed. No duplicates.
**Do not "fix" this. It is already right.**

**Across visits — deliberately NOT persistent.** A raid on a cleared bunker
generates a fresh floor. This is not a compromise, it is the correct design:
a permanently-looted bunker is a bunker nobody returns to. Farming needs
respawn. LDOE ships respawn timers for precisely this reason.

The consequence is that re-entry needs **no serialization at all** — just a
new engine entry point. `mount({ startMode })` already accepts
`'new' | 'continue' | 'cycle' | 'abyss'` (`game.js:5442-5452`); this is one
more mode, not surgery.

**Mid-run save fidelity — `[TODAY]`, separate concern.** Fixed; see §8.

---

## 3. The four time layers

A live game needs an answer at every timescale. Miss one and the player falls
out of the loop there. Layer 2 was empty, and that was the whole problem; it is
now filled. Layer 4's three problems are resolved too (§9).

### Layer 1 — Session: "why play right now" — `[TODAY]`

A raid is 3–10 minutes: descend, fight, loot, extract. This layer works.
Combat, procedural floors, loot rarity, the lift, containers — all shipped.

### Layer 2 — Daily: "why come back tomorrow" — `[TODAY]`

This was the empty layer, and the whole problem. Energy (5/day) is a
*limiter*, not a *reason* — you limit what people want more of, and there
was nothing they wanted more of once the vault was claimed. **All four
mechanics in §5 now fill it**: Vault Fragments, Daily Contracts, the surfaced
craft timer, and the login streak.

### Layer 3 — Weekly: "why care this week" — `[TODAY]`, needs §5.1

The Vault. One shared 4-digit code per ISO week (Monday 00:00 UTC), Old
Paper carries the code, Golden Key opens the door, 3 attempts per wallet,
correct code pays USDT on-chain immediately — and **says so**, on a popup that
names the amount and the token and stays until the player dismisses it (§6b).

This layer works mechanically. What is wrong is *how you get in*: pure luck.

### Layer 4 — Seasonal: "why care this month" — `[TODAY]`

Season = `YYYYMM` UTC. Season Pass SBT, leaderboard, top-3 USDT bonus. Its
three problems — two disagreeing leaderboards, a wholly manual payout, and
three different "kills" numbers — are resolved in §9. The payout is still
signed by hand, by design.

---

## 4. The player's week (the target)

This is the acceptance test. If a change does not make one of these rows
better, it is not a priority.

| Day | What the player does | What pulls them back |
|---|---|---|
| 1 | Raid, 3 daily contracts, fragments 6/12, start a 6h craft | Craft timer |
| 1 pm | Collect the craft — weapon is tier 2 | Stronger now |
| 2 | Deeper bunker, fragments 12/12 → **Paper granted**, streak 2 | Key still 9/28 |
| 3 | Grind the Key, contracts, streak 3 | Streak + fragments |
| 4–5 | Fragments 28/28 → **Golden Key granted** | The vault is now open |
| 6 | Enter the vault → **USDT** | Leaderboard still moving |
| 7 | Week resets — but the weapon is tier 3, so next week is faster | Ratchet |

The load-bearing sentence: **playing on day 2 must visibly buy the day-6
payout.** Today it buys nothing. That is the single biggest fix in this doc.

---

## 5. Layer 2 mechanics (the daily loop)

All four run on systems already in the repo. No new currency, no new
contract, no new vendor.

### 5.1 Vault Fragments — `[TODAY]` — **highest priority**

**The problem.** Old Paper and Golden Key are pure 16% rolls on rare
containers, capped 1 per wallet per week (`props.js` `rollLootSlots`).
Two bad outcomes, both common:

- **Lucky player** gets both on day 1 → days 2–7 have no purpose.
- **Unlucky player** grinds all week and goes home with nothing → and a
  player who earned nothing for a week's effort does not come back.

It also produced the dead-end that started this: reach the vault holding
only one of the two, and there is no recourse.

**The design.** Effort becomes a guaranteed path, luck stays as a shortcut.

- Opening any **interactive container** grants **+1 Vault Fragment**. That is
  the nine types carrying `interactive: true` in `props.js` — `cabinet_s`,
  `wardrobe`, `chest`, `safe`, `plaque_coin`, `footlocker`, `shelf_stocked`,
  `dresser`, `cabinet_ornate`.
- The sealed and premium caches and the vault door are **excluded for free**:
  `onOpenButtonTap` routes those to `grantCacheLoot`/`openVaultWindow` and
  never reaches `openContainerWindow`, which is where the credit fires.
  `Decor.open()` guards on `this.opened`, so a container cannot be farmed
  twice.
- Fragments are per-wallet at `vaultFragments/{weekId}/{wallet}` and reset
  with the ISO week alongside everything else.
- **8 fragments → Old Paper granted.** **18 fragments → Golden Key granted.**
- The existing 16% roll stays untouched on top, so luck still shortcuts the
  grind — it just no longer *gates* it.
- Grants write the **same** `paperClaims/` and `goldenKeyClaims/` records that
  `/api/paper/claim` and `/api/goldenkey/claim` write and `/api/vault/submit`
  gates on, through the same abort-if-present transaction. So the
  1-per-wallet-per-week cap holds for free, the two award paths can never both
  pay out, and no other route needed changing.
- The client never names an amount. It reports "a container was opened" and
  the server decides what that is worth — a client-supplied quantity would let
  anyone mint the weekly reward in one request.

**Where the player sees it:** a progress bar in the inventory directly beneath
the Golden Key and Old Paper rows (it disappears once both are held), a run-log
line every fifth fragment, and an exact "open N more" count in the vault door's
requirements line.

**Shipped in:** `lib/server/vault-fragments.ts`, `app/api/vault/fragments/route.ts`,
`creditVaultFragment()` in `game.js`.

**The numbers, and how they were arrived at.** They started at 12 and 28,
*estimated* from `spawnDecorInto` at 8–15 interactive containers per bunker.

Measured with the real generator (`npm run measure:bunker`, which mounts the
actual engine at each depth and counts what it builds), a bunker holds about
**7** — two runs of 200 floors landed at 6.3 and 7.4. The estimate was 1.3–2.4×
too high.

That mattered, because **the vault needs both items**. At 28 the Golden Key took
~4.4 fully-cleared bunkers; a player opening a realistic ~70% of what they find
had to play nearly every day of the week to reach it. Anyone playing three to
five sessions got the Paper, missed the Key, and therefore earned **nothing** —
precisely the outcome this mechanic exists to make impossible.

| Thresholds | 3 sessions | 4 | 5 | 7 |
|---|---|---|---|---|
| 12 / 28 (old) | Paper | Paper | Paper | both |
| **8 / 18** | Paper | **both** | both | both |

At 8 and 18 the Paper lands on day one, so the mechanic teaches itself early,
and the Key falls mid-week — the arc in §4.

> Still a model, not player data: it assumes one bunker per session and ~70% of
> containers opened. Re-run `npm run measure:bunker` whenever `props.js` gains or loses
> an interactive type, and revisit once real weeks exist.

**Why this is the top priority:** it fixes the dead-end, the unlucky-week
churn, and the empty day 2 — with one mechanic, at zero cost.

### 5.2 Daily Missions — `[TODAY]`

> **Naming, 2026-08-02.** Owner: *"ko contract sih namanya? kenapa engga mission
> aja? bahasanya bukan game banget kalo contracts."* The player-facing word is
> **MISSIONS**; the module, the route (`/api/contracts`) and the RTDB paths keep
> `contract` because renaming stored keys is a live-data migration that buys the
> player nothing. He is right, but not for the reason given — in English game
> vocabulary "Contracts" is at home (Warzone, Hunt: Showdown, Cyberpunk all use
> it). It fails on the **audience**: *kontrak* in Indonesian means an employment
> or rental agreement, paperwork, with none of the mercenary connotation.
> *Misi* is a direct cognate. Same divergence as `nullstateTokenBalance` holding
> "NullState Point" — do not "fix" it.

Three objectives, reset 00:00 UTC, drawn deterministically from a six-entry
pool by a hash of the day id — so everyone gets the same three that day, no
state is needed to remember the roll, and two players can compare notes.
**Targets are sized against a measured bunker, not a guessed one.**
`npm run measure:bunker` mounts the real engine at every depth and prints the
arithmetic. A full five-floor clear yields roughly **7 lockable containers and
30 enemies** — and that second number is the one that caught the first draft
out, because **floor 5 is the boss floor and holds exactly one enemy**, so
almost every kill comes from floors 1–4.

The pool originally asked for 40 and 80 kills. Measured, those are 1.3 and 2.7
bunkers: a day rolling the 80 would have had the player clear a whole bunker
and finish **one contract out of three**, which reads as punishment, not a
nudge. Retuned:

| Contract | Bunkers of effort |
|---|---|
| `floors3` | 0.6 |
| `cont5` | 0.7 |
| `kills30` | 1.0 |
| `cont8` | 1.2 |
| `kills60` | 2.0 — the deliberate stretch |

Three metrics are picked per day and never repeat, so at most one kills
contract can appear. On most days a thorough bunker finishes two of the three.
**On the day that rolls the 60-kill stretch alongside `cont8` it takes two
bunkers to clear everything** — said plainly rather than claimed away, because
two of five daily runs for a full sweep is a fair price and pretending
otherwise is how a target ends up wrong in the first place.

Rewards are Glitch Shards and NullState Point, credited **the instant a bar
fills** — no claim step, matching how burning already works. Deliberately
**not** USDT (owner decision, consistent with the cancelled daily drip in
`GROWTH-BLUEPRINT.md` §1A). Both currencies already exist and are off-chain,
so the feature costs the operator nothing.

**On trust.** Container progress is credited server-side off the same call that
awards a vault fragment, so it cannot be inflated. Kills, floors and burns
cannot be — the server has no view of combat, so the client reports them. That
is a real limitation, bounded three ways: a per-metric ceiling on any single
request, a per-day ceiling that is the contract's own target, and rewards that
are off-chain and non-withdrawable. It is the same trust level the burn route
already runs at (it takes the client's word for which items were destroyed).
Nothing here touches USDT.

**Where the player sees it:** a `◇ 1/3` chip on the map, ahead of fragments
because it is the thing that resets tonight. Tapping it — or the map's DAILY
rail button, which until now was a `SOON` badge promising exactly this feature
— opens today's three with per-contract progress.

**Shipped in:** `lib/server/dailyContracts.ts`, `app/api/contracts/route.ts`,
`reportContract()` in `game.js`, `DailyStatusBar.tsx`. Locked down by
`npm run test:contracts`.

### 5.3 Login streak — `[TODAY]`

Seven escalating days. Loss aversion is the strongest retention force available
and it costs nothing.

Half of this already existed: the Season Pass daily claim grants +1 energy and
+3 t1 shards per UTC day — a login reward that was never framed as one, and
only for pass holders. This is the version everyone gets, guests included.

**Why it is separate from Daily Contracts.** Contracts answer *why play today*.
They do not answer *why open this at all today*, and those are different
questions. A player with ten spare minutes plays; a player with one spare
minute opens the app or does not — and if they do not, what breaks is the
habit, not the session.

| Day | Pays |
|---|---|
| 1 | 80 NullState Point |
| 2 | 2 Glitch Shards (t1) |
| 3 | +1 energy |
| 4 | 3 Glitch Shards (t1) |
| 5 | 150 NullState Point |
| 6 | 4 Glitch Shards (t1) |
| **7** | **8 Glitch Shards (t1)** |

**Why the ladder is shaped like this.** Every rung is t1 shards, energy or
Point on purpose. Shard *tier* is act-gated — `_shardTierForAct()` drops t1 on
acts 1–2, t2 on 3–4, t3 on act 5 — so paying a t2 shard would hand a new player
a currency they cannot spend and did not earn.

Day 7 is **8 t1 shards because `EVOLUTION_SHARD_COSTS[0]` is 8**: a full week is
worth exactly one weapon evolution. That is the ratchet §4 asks for in so many
words — *"the weapon is tier 3, so next week is faster"* — and it is a prize a
player can name, which a scattering of shards is not.

Sized against Daily Contracts (200–400 Point or 2–4 t1 for real work): a whole
week of merely opening the app is worth roughly **one day of playing it**. That
ordering is deliberate. Showing up should be rewarded; it must never out-earn
showing up *and playing*.

**No claim step**, matching the decision Daily Contracts already made — opening
the app *is* the event. The chip sits first on the daily bar because it is the
one number there the player can lose, and loss aversion only works when the
thing at risk is in front of them.

Trust: the day is the server's UTC day, the streak is derived from the stored
last day rather than sent, and the advance happens inside one RTDB transaction —
so two tabs cannot both advance it or both be paid. A grant that throws still
counts the day, because a re-claimable day is worse than one missed grant.

Locked down by `npm run test:streak` (52 assertions against a stubbed RTDB —
the day boundaries cannot be tested in a browser without waiting for midnight)
and `npm run test:streak-ui` (43 assertions in a real browser).

#### 5.3b The two things that made it a game — 2026-07-31

> **Owner:** *"pop up daily nya jelek banget, kaya bukan game banget, streak nya
> juga ga kaya game2 lain."*

He is describing a real and specific absence, not a paint job. Everything above
existed and worked; none of it was ever **shown**.

**The ladder is on screen.** Every shipped version of this mechanic puts all
seven rungs in front of the player at once, with what each one pays, because
that visible distance to the big one *is* the mechanic. NullState had a
sentence — "day 3 of 7" — and a number in a chip. The route had been sending the
whole ladder since the day it shipped and nothing rendered it. It renders now:
banked days stamped, today lit, day 7 drawn as the destination, and the DAILY
panel **opens itself** on the one visit per UTC day that actually paid something
(`grantedLabel` is non-null only on the request that advanced the day, so it can
open at most once).

**A missed day is forgiven, once.** "Back to 1" was the harshest version of this
mechanic that shipped anywhere. Duolingo ran 600+ experiments on this single
feature and landed on a freeze; the players offered one were measurably *more*
likely to still be there a week later and *less* likely to lose the streak at
all. A streak with no safety net does not build discipline, it manufactures the
moment a player decides the thing they were building is gone.

So: **one Streak Shield, earned by three days in a row.**

- It covers exactly **one** missed day. Two and the streak is genuinely broken —
  the tension has to still be real.
- It costs the operator **nothing**: the missed rung is never paid. The ladder
  is stepped *over*, not through, so a shielded week pays six rungs, not seven.
- Spending it sets the next earn three days out, so protection is always
  something the player is currently working for.
- A brand-new player is unprotected for two days on purpose — the shield is
  something you earn by showing the habit, which is what makes it worth telling
  them about on day one.

`SHIELD_EARN_AFTER` in `lib/server/loginStreak.ts`. The whole decision still
happens inside the one transaction, and `readStreak` had to learn the same rule
as `touchStreak`: a state the writer would honour but the reader calls broken
shows the player a dead streak they have not actually lost.

Sources for the research: [Beamable on daily login
rewards](https://beamable.com/blog/inspiring-examples-of-daily-login-rewards-for-your-mobile-game),
[MAF on retention](https://maf.ad/en/blog/daily-login-rewards-engagement-retention/),
[Duolingo's streak mechanic
deconstructed](https://duolingo.deconstructoroffun.com/mechanics/streaks),
[UX Magazine on hot-streak design without
shame](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame).

### 5.4 Surface the craft timer — `[TODAY]`

Weapon crafting is already time-gated: 6h into tier 2, 12h into tier 3,
server-authoritative (`game-config.ts` `weaponEvolution.craft`). It is a
self-set appointment — one of the most reliable return mechanics there is —
and today nothing tells the player about it unless they open the Crafting
screen.

Now a chip in the map's daily status bar (§5.5): **⏳ 3h 20m** while it runs,
and a bright **✦ WEAPON READY** the moment it is done — tappable, straight into
the Crafting screen. The countdown corrects for client clock skew against the
server's `serverNow`, so the timer reads true even on a phone with a wrong
clock.

### 5.5 The map must show the hook in five seconds — `[TODAY]`

Opening the app shows, above the ENTER button and without a tap:

| Chip | Source | Shown when |
|---|---|---|
| **🔥 4** | `/api/streak` | once a streak exists |
| **✦ WEAPON READY** / **⏳ 2h 14m** | `/api/weapons/craft` | a craft is running |
| **◇ 1/3** | `/api/contracts` | always, once loaded |
| **◈ 7/12** | `/api/vault/fragments` | something is still to earn |
| **⚡ 4** | `/api/energy` | always, once loaded |

It sits in the bottom bar's own container, in the path the eye already takes
toward the only action on the screen — read rather than discovered. The streak
goes first: it is the only number here the player can *lose*, and loss aversion
needs the thing at risk in front of them.

### The DAILY panel

Tapping **any chip**, or the **DAILY** button on the left rail, opens one panel
holding all of it — streak, contracts, fragments, energy, craft — with a single
countdown to the next reset.

**Why it is a panel.** Owner, watching it in use: *"itu sebuah menu yang kalo di
klik yang muncul malah di luar, bukan di dalam menu daily itu sendiri."* The
DAILY rail button used to dispatch an event that expanded a strip at the
*bottom* of the map, nowhere near the icon pressed — while every other rail
button (Rewards, Pass, Bag, Shop, Craft, Settings) opens a screen. And the strip
showed only the contracts, while the streak, fragments and energy stayed as
chips somewhere else. "Daily" was three places and one of them behaved unlike
its neighbours.

The chips stay on the bar because they are the *glance*, and what is at risk has
to be visible without a tap. The panel is the *detail*, and there is one of it.

**One countdown is only honest because of §9b.** Energy used to refill on a
rolling 24h while contracts and the streak reset at 00:00 UTC; a single "resets
in 1h 27m" would have been a lie for one of the three. They share a clock now.

**Contracts and streak have no chip yet, on purpose.** They are in the build
order and not built, and a chip showing a number nobody tracks is exactly how
`game-config.ts` happened (rule 2, §10). Each chip appears when its system
does; with all three quiet the bar renders nothing rather than an empty frame.

Every fetch runs after first paint and degrades to a hidden chip, never to an
error — a status bar that can show an error is one that can make the home
screen look broken.

---

## 6. What every existing system is FOR

Cross-check for future work. If a system has no row here, question why it
exists.

| System | Layer | Role | Status |
|---|---|---|---|
| Combat, floors, lift | Session | The game | `[TODAY]` |
| Campaign (5 acts) | Onboarding | Teach + unlock the map | `[TODAY]` |
| Bunker raids | Session→Daily | Repeatable content; the map's whole point | `[TODAY]` |
| Energy (5/day) | Daily | Pace sessions, drive refill sales | `[TODAY]` |
| Daily Contracts | Daily | Reason to open the app | `[TODAY]` |
| Streak | Daily | Loss aversion | `[TARGET]` |
| Craft timers (6h/12h) | Daily | Self-set appointment | `[TODAY]` |
| Glitch Shards | Daily→Weekly | Power ratchet | `[TODAY]` |
| NullState Point | Daily→Weekly | Gear ratchet (faucet-only) | `[TODAY]` |
| Vault Fragments | Daily→Weekly | **Connects daily play to money** | `[TODAY]` |
| The Vault | Weekly | The jackpot | `[TODAY]` |
| Leaderboard | Seasonal | Competition | `[TODAY]` §9 |
| Season Pass | Seasonal | Subscription | `[TODAY]` |
| Referrals | Growth | Acquisition | `[TODAY]` |
| Null Abyss | Endgame | Skill ceiling + season metric | `[TODAY]` |
| Null Cycles (NG+) | Endgame | Difficulty mode, **not** a replay gate | `[CHANGE]` |

Two notes on that last column:

**Money in vs money out.** In: energy refill $1, elixir $1, shard pack $1,
blueprints $1×5, gear $0.5–2, craft skip $1–2, Season Pass (price is
on-chain). Out: the weekly vault, and the monthly top-3 bonus. Daily play
must stay free to operate — that is why layer 2 pays progress, not money.

**NG+ changes meaning.** Once the map is the game, NEW GAME+ stops being
"replay to reach the vault again" and becomes purely an optional difficulty
tier. Nobody should ever be forced through it to reach a weekly reward.

---

## 6b. The win — `[TODAY]`

**Owner, after cracking a vault for real:** *"tidak ada pop up untuk user, pop
up menang usdt dan jumlahnya, dan penjelasan auto transfer."*

He was right, and it was the worst gap in the game. The one moment real money
moves — the entire reason this game exists — was a single line inside the code
panel reading *"Reward sent to your wallet"*, with **no amount, no currency**,
and nothing saying the transfer is automatic. Then the bunker auto-finished
**1.4 seconds later** and took it off screen.

The server had already read the exact amount and token off the vault contract,
to stamp the Rewards history, and simply **did not return them**. So the data
was there the whole time; the screen just never got it.

Three things the popup has to say, because the player has no other way to learn
any of them:

| | Why |
|---|---|
| **How much, and in what** | the largest text on the screen |
| **It is already sent, no claim** | the MiniPay failure mode is hunting for a claim button that does not exist and concluding you were not paid |
| **It may take a few seconds** | so a wallet that has not updated yet is not read as a loss |

**Nothing auto-dismisses.** CONTINUE is what ends the bunker now, so the number
cannot leave the screen before it is read. A pending payout says *pending* and
**never invents a figure** — a wrong number here is worse than no number.

Locked down by `npm run test:vaultwin`, which found a real layout bug on the way
in: the decorative flare is deliberately wider than the card and stuck 34px out
of each side, pushing a 390px phone into horizontal scroll. Not something a
screenshot would have shown.

### 6c. …and where the win leaves you — `[TODAY]`

> **Owner, the same session:** *"setelah buka vault itu aku masuk menu abbys,
> menurut km itu hilangkan atau jangan?"*

**Answer: not removed — moved.**

Winning the campaign called `returnToTitleScreen()` unconditionally, which drops
the player onto the engine's own title screen: DESCEND, NEW GAME+, THE NULL
ABYSS. That screen was the game's home *before the world map existed*. With the
map on (the default since the pre-listing audit), it is a **dead end** — the run
teardown hides the HUD, so there is no Save & Exit, and nothing on it leads back
to the map. Winning the game put the player somewhere they could not leave,
seconds after being paid.

The Abyss is not the problem. It is the completion reward, and with the map as
the home screen it is one of only two modes that unlock at the end. The problem
was **where the player was standing when they were offered it**.

- The finale surfaces to the **world map**, like every other cleared bunker
  (`finishCampaign()` → `nullstate-campaign-complete` → GameFlowManager). With
  the hub off it still ends on the title screen, because there the title *is*
  the home screen — that is the kill-switch path, not a bug.
- **THE NULL ABYSS** and **NEW GAME+** live under `≡ MENU` on the map,
  permanently, gated on the PROTOCOL ZERO flag the engine already writes
  (`lib/campaignComplete.ts` reads the *same* key — two places deciding one
  thing is exactly what rule 2 forbids).
- A **one-time panel** on the first visit after the ending says what unlocked,
  and says the thing the player most needs to know next: **Bunker 5 is how you
  reach the vault every week from now on.**
- All five bunkers read as **cleared** afterwards, not just four. There is no
  "next" bunker after the campaign, so leaving one `active` would point at a
  descent that does not exist.

Locked down by `npm run test:campaign-end` — both halves, the engine's handoff
and the map's response.

---

## 7. Bunker re-entry (raids)

**`[TODAY]`.** The map used to promise a world the engine did not have.

- Cleared bunkers are selectable on the map and enter as a **fresh raid**
  (`RAID ▸`). The engine reaches them through `mount({ startMode:'raid',
  raidActIndex })` → `startRaid()`.
- **A raid costs 1 energy** (owner decision). Continuing a saved run stays
  free. Grinding having a price is what makes the $1 refill meaningful —
  this is the natural transaction point, and it is money *in*. The cost is
  charged by routing a raid through the existing outdoor strip, so
  `onOutdoorReachedDoor` handles the spend, the retreat-from-the-door and the
  refill modal with no second copy of that logic.
- Raids do not advance the campaign, replay story beats, or show the tutorial.
- Fragments, shards, loot, XP and kills all accrue normally in a raid.

**Three ways a raid could have destroyed the player's campaign, all closed:**

1. **Progress regression.** The map read `currentAct` straight off the saved
   session, so raiding Bunker 1 would have shown a five-bunker veteran a map
   with 3-5 locked. Progress is now its own monotonic high-water mark
   (`lib/campaignProgress.ts`), seeded from the save on first read.
2. **Save deletion.** `DungeonGame`'s Continue branch *consumes* the session it
   loads. A raid now touches neither — it builds its run from scratch.
3. **Lost floor position.** A raid shares the same session document, so farming
   Bunker 1 would have reset a Bunker 3 run to floor 1. The campaign's
   act/depth is stashed on the way in and restored on the way out, in
   localStorage rather than a ref so it survives a save-and-exit mid-raid.

A raid saved mid-run carries `raid: true` in its snapshot and resumes as a
raid — otherwise the resumed run would clear as a campaign bunker and move the
player's resume point to one they had already beaten.

**Locked down by `npm run test:raid`** (`scripts/test-raid-campaign-resume.js`),
which drives the real map in headless Chromium: it seeds a player midway through
Bunker 3, checks the cleared bunkers offer `RAID`, taps it, and asserts the
campaign's act *and floor* come back while everything the raid earned is kept.

That test found a fourth hazard the three above had missed — the resume stash
was consumed inside the snapshot guard, so any path where the engine had no
snapshot to give left it on disk for the *next* raid to restore. Its own first
run was also a false green: with no engine mounted the whole write block was
skipped and the assertions passed against the untouched seeded draft. The
engine stub and the "raid keeps what it earned" assertion exist to make that
impossible to repeat.

**Bunkers now have a reason to choose between them — `[TODAY]`.**

### What was actually there before

Not "the scaling half-exists already", which is what this section used to
claim. Measured with `npm run measure:acts`, which mounts the real engine at
every act:

| | Bunker 5 vs Bunker 1 |
|---|---|
| walkable floor area | **1.00×** |
| rooms | 0.95× |
| enemies | **0.93×** |

The last bunker was very slightly *emptier* than the first. Floor size came
from `depth` alone, which runs 1–5 inside every bunker, so the act never
entered the arithmetic. Worse, `actHardMode` had **one entry, for act 4** — so
bunkers 1 through 4 were mechanically identical, since enemy stats also scale
on depth. The only thing that changed across those four was which archetypes
could roll: variety, not difficulty.

"Which bunker?" had no mechanical answer to give.

### The two axes, now real

**Risk** — `actHardMode` in `monster-config.js` covers all five acts. Gentle at
the start so a new player's first raid is not harder than the campaign taught
them, steep at the end so the last bunker earns its T3 shards. Act 4 is
unchanged at 2.0/1.3; those numbers were tuned against the boss one-shotting
players and nothing here reopens that.

**Time** — `ACT_SIZE` in `dungeon.js` adds width, height and one room per act.
Rooms are what carry enemies and containers, so effort and reward scale
together without a second knob.

| Bunker | Risk | Enemy HP | Shards | Length |
|---|---|---|---|---|
| 1 · Treeline | ▰▱▱▱▱ | 1.00× | T1 | — |
| 2 · Sunken Field | ▰▰▱▱▱ | 1.20× | T1 | +15% |
| 3 · Frostline | ▰▰▰▱▱ | 1.45× | T2 | +30% |
| 4 · Hollow Market | ▰▰▰▰▱ | 1.70× | T2 | +55% |
| 5 · The Last Light | ▰▰▰▰▰ | 2.00× | T3 | +65% |

Measured after: 1.65× the area of bunker 1, 1.55× the enemies. Deliberately
modest — a MiniPay session is 3–10 minutes on a mid-range phone, so **bunker 1
stays the short option**. That is the point of an axis rather than a global
difficulty bump.

### And the player can see it

A difference nobody is shown is not a choice. The map's bottom bar now carries
risk pips, shard tier and length under the bunker's name — on the way to the
ENTER button, not somewhere to go looking for. Locked bunkers show it too:
knowing Bunker 5 is the only T3 source is a reason to keep going.

`lib/constants/bunkers.ts` holds what the map renders. **That file is the same
shape as the `bunkers` block that made `game-config.ts` a liability**, so it is
guarded differently: `npm run test:bunkers` mounts the engine, reads its own
`actHardMode` and shard-tier rule, measures floor size per act, and fails if
any number in the constants disagrees. The engine stays the source of truth.
`npm run test:bunkers-ui` then checks it reaches the screen.

> **Open question, still open:** how long is one bunker in *real play*? The
> sandbox can measure rooms and enemies, not a person's minutes. If a full
> 5-floor clear of Bunker 5 runs past ~10 minutes, add a "raid one floor and
> extract" option — that is the shape a MiniPay session actually has.

> **A bug this surfaced.** `apply()` in `WorldMapHub` runs twice — once from the
> instant localStorage draft, again when the Firestore copy lands — and its
> clamp (`prev > highest ? highest : prev`) ran both times. Tapping a locked
> bunker to read what it holds snapped the selection back to your own bunker a
> beat later, with no explanation. The clamp now applies only until the player
> taps something.

---

## 7b. Fixed: opened things could never be opened again

**`[TODAY]`.** Found while wiring §5.1, and it was the floor under the reported
vault dead end.

`Decor.open()` marks a prop `opened`, and `updateActionButton` skipped anything
opened when picking a target. Two consequences:

- **The vault door became unreachable after one tap.** `closeVaultWindow`'s own
  comment promised "the vault door stays interactive, so you can check your
  Paper and re-open it to enter the code" — and it was false. Tapping *back to
  the bunker* to go read the code locked the player out of the vault for the
  rest of the run. The only remaining control was *leave without opening*,
  which **ends the campaign**. The invisible exit buttons fixed earlier were
  one layer; this was the one underneath.
- **Container loot left behind was destroyed.** Close the window with slots
  untaken — one mis-tap on a phone — and it was gone, silently.

Now `_canReopenDecor()` lets the vault door always be re-targeted, and lets a
container be re-targeted while it still holds untaken slots (the button reads
`REOPEN`). Closing a container with loot inside says so in the run log.

Neither can be farmed: `rollLootSlots()` memoises on `this.lootSlots`, so a
reopened container shows the *same* remaining slots rather than a fresh roll,
and the vault fragment is credited on the first open only.

---

## 7c. Fixed: a floor could be generated with no way out

**`[TODAY]`.** Reported from a real MiniPay session: entered Bunker 1 floor 1,
could not move out of the spawn area, could not test anything else.

The cause is geometric, not a placement mistake. A corridor is one tile
(`TILE = 40`) and the player's radius is 14, so **anything with a solid
footprint wider than 12px seals one** — which is every prop in the game.
`spawnDecorInto` keeps props off doorways and hugging room walls, but a room
whose only exit is narrow, or two props landing either side of a gap, can still
close the last opening.

Flood-filling from the spawn across generated floors, using the engine's own
wall test and its own `NS_solidDecorAt` footprint:

| | Floors with the lift unreachable |
|---|---|
| crate 44×44 (as shipped in #197) | **5 in 60** |
| crate 34×34 (before #197) | 2 in 60 |
| no decor at all | **0 in 100** — walls are never the problem |

So **widening the crate for the art turned a latent bug into a common one**,
and shrinking it again would only have hidden it.

The fix is therefore a guarantee rather than a size: `_ensureFloorTraversable`
runs at the end of `ensureFloor`, walks the floor from the spawn, and if the
lift cannot be reached deletes whichever props sit on the frontier of the
reachable region, then walks it again. That is the minimal set that can be
responsible, so it converges in a pass or two and rarely removes more than one
prop. Vault doors and sealed/premium caches are never removed — they are
content and are placed inside rooms.

**0 in 150 after the fix**, at every depth. Locked down by
`npm run test:traversable`.

> Two things this exposed about measuring: the first version of the check
> required the player to reach the lift's *exact* pixel, which is often
> wall-adjacent and unreachable for a 14px body — it reported walkable floors
> as sealed. And the first version of the fix probed only a blocked cell's
> centre when deciding which prop was guilty, while the reachability walk had
> probed the body's left and right edges too, so it kept "finding nothing to
> remove" on 2 floors in 100.

### 7c-2. The same bug, one level in: props sealing the *side rooms*

**`[TODAY]`.** After 7c shipped, the owner played again: *"masih banyak yang
menghalangi jalan, taruh nya yg betul jangan dekat lorong untuk barang yang
tidak bisa di pecahkan."*

Correct, and the distinction they drew is the one that matters. `props.js`
`hit()` refuses damage to anything `ambient` or `interactive`, so:

- a **barrel** in a doorway costs a moment — you smash it;
- a **cabinet or scenery crate** in the same doorway is a wall.

7c only guaranteed *spawn → lift*. A prop could still seal a side room
entirely, and side rooms are where the lockable containers live — which is to
say, where the weekly reward comes from. So the guarantee is now two:

| | Guarantee |
|---|---|
| **A** | With every **unbreakable** prop in place, each room the walls allow, the lift, and **every lockable container** must still be reachable. |
| **B** | With **everything** in place, the lift must still be reachable. Breakables may narrow a path; they may not seal the run. |

Removal is minimal and targeted: flood a second region outward from whatever is
stranded, then remove only the props standing on **both** frontiers — the ones
literally in the doorway between the two. Intersecting at the *prop* level
rather than the cell level matters, because a wide cabinet blocks three lattice
cells in a row and each side may touch only one of them.

**0 in 150** for sealed rooms, sealed containers, and unreachable lifts.

> **The mistake this nearly shipped, and the measurement that caught it.** The
> first version of guarantee A compared the reachable *cell count* against the
> walls-only count and deleted whatever sat on the frontier. But a prop standing
> in an open room always costs a few cells simply by occupying them — so that
> rule condemned every prop on the floor. `npm run measure:bunker` put lockable
> containers per bunker at **1.4, down from 7.5**: it would have quietly emptied
> the Vault Fragment economy while every traversability check reported success.
> Connectivity, not area, is the right question. Both numbers are re-measurable;
> neither was guessed.

---

## 7d. Fixed: the inventory grew a new fragment bar on every render

**`[TODAY]`.** From the same session, with screenshots: the stash filled with
dozens of identical `FRAGMENTS → OLD PAPER` bars, so burning an item meant
scrolling past all of them — *"sampe2 aku harus scroll hanya untuk burn item di
dalam game"*.

`renderStashPanel()` does not empty its host. It removes children by an
**explicit list of class names** and rebuilds those. The fragment bar (§5.1)
shipped with a class that was never added to that list, so each of the sixteen
call sites appended one more and nothing ever removed them. Reproduced exactly:
**17 renders → 17 bars.**

One line fixes it. `npm run test:inventory` drives the real panel through 17
renders and fails on the pre-fix engine, so it is a regression test rather than
a description of the fix.

> **The rule this leaves behind, written in the code:** anything added to that
> panel must be named in its removal list. A panel that clears itself by
> enumeration will silently accumulate whatever it was not told about.

The owner also asked whether burning should move out of the inventory entirely
— *"atau ga buat menu terpisah saja di dibawah volume???"*. Open question, not
a bug: the scrolling was this defect, not the layout. Worth revisiting on its
own merits once the panel is behaving.

---

## 7e. Fixed: burning on the Rewards screen did not count toward contracts

**`[TODAY]`.** *"kenapa burn items di menu rewards tidak terhitung juga ke
daily????"* — because there are **two** ways to burn and only one of them is
the engine. The in-run inventory dispatches `nullstate-items-burned`; the
out-of-game Rewards screen posts to `/api/burn/record` directly and never runs
`game.js`. The contract was credited from the engine, so it saw only the first.

Both paths already pass through `/api/burn/record`, so the credit moved there —
one call site that sees every burn, using a quantity the route has already
validated, which makes it *harder* to inflate than the client report it
replaced.

Auditing that turned up the same mistake next door: `dailyContracts.ts` claimed
container progress was credited server-side, and it was not — the engine was
posting the count. It now rides on `/api/vault/fragments`, off the same POST
that awards the fragment (one request per container, first open only).

| Metric | Credited by | Client-authoritative? |
|---|---|---|
| `containers` | `/api/vault/fragments` | no |
| `burns` | `/api/burn/record` | no |
| `kills` | engine → `/api/contracts` | yes — the server has no view of combat |
| `floors` | engine → `/api/contracts` | yes — same |

Completion is still announced on every path: the two server-side routes return
the contract state, the engine logs it through one shared `announceContracts()`,
and the Rewards screen appends it to the burn confirmation it already shows.

---

## 7f. Burn history: seven days, and a rollup so nothing shrinks — `[TODAY]`

> **Owner:** *"masalah history burn yang menumpuk, lebih baik tunjukan burn 7
> hari terakhir, lalu hilangkan sisanya, dan jelaskan di bawahnya."*

Right on both halves. A wallet that plays a season leaves hundreds of burn rows
behind, each carrying its full item list, and the Rewards screen rendered **all
of them** — so the useful part (*what did I burn today?*) sat on top of an
unbounded wall of receipts, and `/api/player/profile` shipped the entire pile
over the wire to draw it.

These rows are a **log, not a ledger**. The Point was credited to
`playerProfiles/{wallet}/nullstateTokenBalance` at the moment of the burn and has
never been recomputed from here, so deleting an old row costs the player nothing
they can spend.

**What it would have cost, done naively**, is the two season totals shown above
the list — both derived by summing the very array being trimmed. That is the
same class of bug as the `paperClaims` note in the prune (§9b): the number
quietly shrinks, and it reads as the player losing something rather than as rows
being deleted.

So nothing is simply dropped:

- The list is cut to the **last 7 days**, server-side, so a season of receipts
  never crosses the wire to be discarded on arrival.
- The prune folds every older row into `burnRollup/{seasonId}/{wallet}` —
  events, value, item count — **before** deleting it, in a transaction, with a
  `prunedThrough` watermark so a crash between the two cannot double-count.
- `/api/player/profile` adds the rollup back, so `totalBurnEvents` and
  `totalBurnedValue` are byte-for-byte what they were.
- A row with **no usable timestamp is never deleted**: one we cannot date is one
  we cannot prove is stale, and the cost of keeping it is a line on a screen.
- The screen **says so, underneath**, including how many earlier burns are not
  shown and that every one of them was paid into the balance at the time.

`BURN_HISTORY_DAYS` in `lib/server/seasonClose.ts`, alongside the other prune
constants. Locked down by the burn block in `npm run test:season`.

---

## 8. Fixed: Save & Exit no longer regenerates floors

**`[TODAY]`.** It used to. `getSaveSnapshot()` persisted 14 fields — act,
depth, maxDepthReached, xp/level/kills/hp, equipment, inventory, weekly run
caps — but **not `G.floors`**, and `dungeon.js` generated from bare
`Math.random()` with no seed, so the same floor could not be reproduced at all.

Save & Exit on floor 3 → Continue → `ensureFloor(3)` found an empty cache and
built a **new** floor: different layout, monsters back on their feet, looted
containers refilled, smashed props whole. At risk were XP, ordinary items
(→ NullState Point via burn) and Glitch Shards, which are also sold at $1 per
5. Never at risk: the weekly Paper and Golden Key, guarded both by the saved
run caps and by the server's 1-per-wallet-per-week records.

### The fix, in two halves

Either half alone fixes nothing.

**1. The layout is a pure function of a seed.** One `runSeed` is chosen at
`newGame()` and saved with the run; a floor's seed is
`hash(runSeed, cycle, act, abyss, depth)`. Same seed, same floor, forever — so
the map itself costs **zero bytes** to persist.

**2. What the player did to it is a delta** against that layout: which enemies
died, which props broke, which containers were opened and what is still inside
them, which rooms are lit. Indices into the generated arrays — sound only
*because* of (1).

Measured: **2.6 KB** for a whole five-floor bunker with every prop smashed and
every container opened. Firestore's limit is 1 MB.

### Why `Math.random` is swapped rather than threaded

Randomness for one floor is spread across four files — `dungeon.js` lays out
rooms, `game.js` picks archetypes and elites, `props.js` places and rolls
decor, `entities.js` jitters each enemy. The engine is plain `<script>` tags
with no module system (rule 1, §10), so there is no shared rng to import and
threading one would mean touching every constructor. Generation is synchronous
and finishes inside one call, so the global is swapped for exactly that window
and restored in a `finally`.

### Two guards, both of which earned their place

**A snapshot does not always keep describing the run it was taken from.** The
shell rewrites `campaignActIndex`/`depth` on it when a bunker is cleared (so
ENTER points at the *next* bunker) and again when a raid finishes (so the
campaign resumes where the raid left it). Replaying the old floors into the new
bunker would start it with the monsters already dead and the containers already
emptied. So the save records a `floorsKey` — cycle, act, abyss, raid — and the
delta is dropped unless it still matches.

**Regeneration can legitimately differ.** A Premium Sector cache appears only
while that act's blueprint is owned, and ownership lives outside this save. So
each floor stores the array lengths its indices were taken from; a mismatch
drops the delta rather than killing the wrong monsters.

> **A pre-existing bug this surfaced.** The snapshot written when a raid
> finishes was cached *during* the raid, so it still said `raid: true`.
> `enterSavedSession()` restores `RAID_MODE` from that flag — so the next
> Continue resumed as a raid, and clearing that bunker took the raid branch
> again, fired `nullstate-raid-cleared`, and advanced nothing. **The campaign
> silently stopped progressing.** Fixed in the same place the campaign path
> already fixed up its own snapshot, for the same reason.

Locked down by `npm run test:seeded` (15 assertions), which fails on the old
engine.

---

## 9. The seasonal layer

### 9.1 One leaderboard — `[TODAY]`

There were two, and they disagreed:

1. Firestore `leaderboard`, written client-side, sorted by **XP** — what the
   player saw (`Leaderboard.tsx`).
2. RTDB `leaderboards/{seasonId}` + the on-chain `getSeasonLeaderboard` — what
   decided **who got paid**, surfaced by `LeaderboardDisplay.tsx`, which was
   rendered **nowhere**.

So the ranking players competed on was not the ranking that paid, and nothing
in the code said which was meant to win.

**Owner decision: XP is canonical.** It is what players already see, it is
cumulative and accurate, and the alternative rests on a number that cannot be
right (see 9.3). `LeaderboardDisplay.tsx` and `/api/leaderboard` — its only
consumer — are deleted. `lib/server/seasonClose.ts` is now the one place a
season ranking is computed, and it reads XP.

### 9.2 The season payout — `[TODAY]`, prepared automatically

Paying the season bonus meant the owner remembering to run
`scripts/deposit-reward.js` twice, every month, from memory. Miss it and the
claim button was dead for every player with no error anywhere to notice.

**Owner decision: prepare automatically, the owner still signs.** Money keeps a
human in the loop — no unattended transfer, and **no signer key on the server**.
The deployer key owns both reward contracts and this repo is public; it stays on
the owner's device. What is automated is everything up to the signature:

| Step | Who |
|---|---|
| Detect the season has ended | cron, 01:00 UTC **daily** (`vercel.json`) |
| Compute and **freeze** the top 10 by XP | `/api/cron/season` |
| Show that a payout is owed | `/stats`, and `GET /api/season/status` |
| Hand over the exact commands to run | `payoutCommands()` |
| **Sign and send** | **the owner** |
| Mark it paid | `POST /api/season/status` |

**Why the cron runs daily for a monthly event.** A monthly schedule fires once
and has no retry — a deploy in flight or a cold start on the 1st would leave the
season unfrozen for a month, which is the exact "silently does nothing" failure
this feature exists to remove. Daily makes a miss self-heal the next morning;
every other day is a no-op that writes nothing.

**Why the snapshot is frozen.** XP keeps moving after a season ends — it is
cumulative and does not reset (9.3). Reading "the top 3" at payout time would
give a different answer than at closing time, and the later it is read the more
wrong it is. The write is a transaction that aborts if a snapshot exists, so a
cron retry, a duplicate schedule or a manual `curl` can never re-rank winners
the owner has already read.

**No wallet is filtered out** of the ranking server-side. The owner reviews the
list before signing — that review *is* the safeguard, and it is the whole reason
the payout stayed manual. A hidden exclusion list would be a second policy
nobody reads until it pays the wrong person.

Both routes **fail closed**: without `CRON_SECRET` / `ADMIN_SECRET` they refuse
rather than defaulting to open. Freezing a ranking is the one action here that
cannot be undone.

#### 9.2b Ten places, and the three the contract can reach — 2026-07-31

**Owner: `$20 / $5 / $3`, then `$1` each down to rank 10. $35 a month.**

Paying ten instead of three is a change of shape, not just of size. A three-deep
prize means everyone outside the podium is playing for nothing they can name,
and by mid-month the ranking is usually settled — so the reward stops motivating
exactly the players who are still playing. A tail of $1 places gives 8th place
something to defend and 11th something to reach, for $7 a month.

**The contract only knows three.** `NullStateRewardV3` takes `address[3]` in
`updateLeaderboard` and `setRankRewards(r1, r2, r3)`. Ranks 4–10 therefore
cannot be claimed in-app **at all**, and redeploying to widen it is out of scope.
They are paid by direct ERC-20 transfer — which is what the owner already does
in practice — through a new `pay` subcommand on the treasury CLI.

`payoutCommands()` emits all ten lines, in order, and the pool is funded with
**$28, not $35**: depositing the tail would strand $7 in a contract with no way
to release it. Emitting only the podium commands would have been the dangerous
version — they look complete, they succeed, and seven people are silently paid
nothing.

**A drift this closed.** `docs/TREASURY-OPS.md` records the on-chain rank
rewards being set to `$1 / $0.60 / $0.40` on 2026-07-22 while
`RANK_REWARDS_USD` said `$20 / $5 / $3`. `setRankRewards` is what
`claimSeasonBonus` pays from, so `/stats` and the frozen snapshot were promising
a first-place finisher twenty dollars the contract would have paid one for.
Nothing caught it because nothing could: the constant is a **mirror** of
on-chain state, and a mirror never compared to the chain is just a second,
quieter source of truth — rule 2 (§10) one layer out. `season-rewards` is now
`commands[0]` of every payout, so paying re-syncs them by construction.

**And the board says what it is worth.** The prize table lived only in
`seasonClose.ts` and on `/stats`, an operator page — so the players competing
for it could not see it. It moved to `lib/constants/seasonRewards.ts` (no
firebase-admin, so a client component can import it) and the in-game Leaderboard
now shows a **PRIZE** column per rank, the split between claim and direct
transfer, and a **Last season** section built from the public
`GET /api/season/status` snapshot — including whether it has been paid.

> Owner: *"tampilkan juga di leaderboard musim lalu."*

#### 9.2c The season is ranked by the season — 2026-08-02

> **Owner:** *"menurutmu pertimbangan rank skrg sudah bagus belum? mengingat
> hanya dari xp?"*

No, and not for the reason it looks like. The metric was not the problem —
**the window was.**

XP is cumulative and never resets (9.3). So ranking a *season* by it produced an
**all-time board that merely paid out monthly**. The July snapshot shows exactly
what that costs: 8,581 / 2,655 / 1,972. First place opened August **5,926 XP
ahead of second**, earned in a month that was already over and already paid for.

The consequence that actually matters is not unfairness at the top, it is the
door: **a player joining in September could never have won.** They start at zero
against months of accumulation, while the app advertises "top 10 earn USDT" to
them on the way in. A leaderboard that closes permanently to newcomers is worse
than one with no prize at all, and it silently undoes §9.2b — widening the prize
to ten places is pointless if the order of those ten places is frozen.

**The spec was right the whole time.** `rewards-system.md` has said *"Rankings
are by experience (XP) earned **during the season**"* since it was written. The
code read career XP. This is rule 2 (§10) in its most expensive form: not a
config nobody reads, but a documented promise nobody implemented.

**The shape of the fix.** A season score is a DELTA — career XP now, minus
career XP when the season started for that wallet.

- `leaderboard/{wallet}` gains `seasonId` + `seasonBaseXp`; on any write where
  the stored season is not the current one, the baseline becomes `doc.xp` — the
  career total as of the last write, which by definition was last season. **Not**
  the incoming figure, which would discard whatever was earned before the first
  sync of the month.
- `seasonLeaderboard/{seasonId}/players/{wallet}` mirrors XP earned this season.
  Its own collection, so the read is a plain single-field `orderBy` needing no
  composite index, and each month is partitioned automatically.
- Season kills ride the **same delta** `recordRunKills` already computes — the
  hard part (not double-counting a Revive that keeps `p.kills` climbing) is
  solved once, in one place, or the two totals drift.
- `readTopByXp` reads the season collection and **falls back to the career
  board when a season has no rows**, so every season that closed before this
  existed keeps producing the answer it produced at the time. A silent empty
  top 10 for July would read as "nobody won".
- At rollout every doc has no `seasonId`, so the first write baselines each
  player at their current career total and **everyone starts level**. No
  backfill.

Career XP is untouched and still ranks the **ALL-TIME** tab. Rondo does not lose
the 8,581; it just stops being the reason he wins next month too.

The arithmetic lives in `lib/seasonXp.ts` — Firebase-free on purpose, because it
decides who gets paid and that deserves a test that needs neither a browser nor
a database (`npm run test:seasonxp`).

**Still open, and stated rather than guessed.** Ranking by XP still means
ranking by *time spent*, with no weighting for risk — so grinding Bunker 1 is
optimal, which fights the risk/length axes §7 introduced. And energy is
purchasable ($1 = 5 runs), so XP is buyable; at a $20 first prize that is
plausibly +EV. Neither is addressed here. Both are smaller than the window
problem and both are cheaper to fix once the window is right.

> **What "notify" means here, precisely.** There is no mail or push transport in
> this repo, so nothing emails the owner. The notification is a *state that
> looks wrong*: `/stats` shows "Winners frozen — payout pending" in amber until
> `POST /api/season/status` marks it paid. That is a real improvement over a
> claim button that silently does nothing, and it is not the same thing as an
> alert. If a real channel is ever wanted, that is a separate piece of work.

### 9.3 Which "kills" is canonical — `[TODAY]`, and it already was

Three numbers existed:

| | What it is |
|---|---|
| on-chain `kills` | **structurally wrong** — `executeAction()` takes a boolean, so a 40-kill run increments it by 1 |
| Firestore `totalKills` | the real lifetime figure |
| `p.kills` | the live per-run counter |

**`totalKills` is canonical.** Verified rather than assumed: every place that
shows a lifetime kill count already reads it —
`leaderboardService.ts` resolves `data.totalKills ?? data.kills ?? 0` for both
the leaderboard row and the profile, and the only other reader (`HudStatLine`)
shows `p.kills`, which is correct because it is labelling the *current run*.
**No UI reads the on-chain counter at all.** So this needed a decision recorded,
not a code change — and the record is what was missing.

---

## 9b. Audit, 2026-07-31 — does it all hang together?

A whole-system pass over everything, not just recent work: every API route
traced to a caller, every RTDB path to its writers and readers, every number in
the player-facing docs checked against the code that produces it.

**Six things were wrong.** Five are fixed here; one is a standing limitation
with a number attached.

### Fixed

**1. Converting to a wallet threw the week away.** `/api/guest/migrate` moved
Point, materials, gear, tiers, blueprints and elixir — and **none** of the
time-boxed records. A guest who spent the week opening containers arrived at
their new wallet with **zero Vault Fragments**, losing the whole path to that
week's USDT at the exact moment they converted. The login streak, today's
contracts and the weekly item claims went the same way.

Now in `lib/server/guestMigrate.ts`, with a rule per record rather than one
blanket policy — fragments **add**, claims **fill** (so the week's cap survives
and no second Old Paper is granted), contracts take the **max** (summing would
pay a free contract for converting), streak keeps the **longer run** and the
bigger best-ever. `npm run test:migrate`.

**2. The season payout command I generated did not run.** `payoutCommands()`
emitted `season-deposit` without `--token`, and `resolveToken()` in
`deposit-reward.js` *dies* rather than defaulting — so the second line handed to
the owner failed on paste. The whole point of preparing automatically is that
paying is a paste. Fixed, and the test now checks **both** commands against that
script's own argument validation instead of only the first.

**3. `game-mechanics.md` said Common items cannot be burned.** They can, for
1–5 Point. Nothing in the engine, the Rewards screen or the burn route filters
them. Table corrected.

**4. Two docs disagreed on the season token.** §3 said USDm; `OWNER-RUNBOOK.md`
and `rewards-system.md` both say USDT, and the runbook is what gets executed.
§3 corrected, and the token is now a named constant the generated command reads.

**5. The runbook did not know about its own automation.** `OWNER-RUNBOOK.md`
still said "work out the top 3 and run these two commands". Rewritten around
`/api/season/status`, the `/stats` indicator and the mark-paid call.

**Also deleted:** 8 files, 519 lines, all verified unreferenced —
`USDmDisplay`, `GameUI`, `TokenBalanceWidget`, `CustomCursor`,
`LiveStatsTicker`, `SectionDivider`, `useScrollReveal`, and
`/api/vault/status`, which had no caller left. Lint baseline 34 → 33.

### Verified correct

- The money path connects end to end: fragments → `paperClaims` /
  `goldenKeyClaims` → the exact records `/api/vault/submit` gates on.
- Every number in `game-mechanics.md` matches its source. Rarity odds compute to
  58.8 / 26.5 / 10.6 / 3.5 / 0.6 against a documented 59 / 26 / 11 / 3.5 / 0.6;
  burn ranges, fragment thresholds, the streak ladder, the bunker table and
  5 free runs/day all agree with code.
- `firebaseAuth.ts` reads as unreferenced to a naive grep but is loaded through
  `await import()` in three places. It is wired.

### Also fixed, in the follow-up

**6. Two clocks on one bar.** Energy refilled on a **rolling 24 hours** from
first use while contracts and the streak reset at **00:00 UTC** — so a player
who played at 20:00 got new contracts four hours later and new energy
twenty-four hours later, with nothing on screen explaining why. Energy is now on
the UTC day too. `windowStart` keeps its name and type and holds the day it was
spent against, so records written by the old code reset correctly on first read:
no migration, and nobody gains or loses a run at the changeover. `windowHours`
is deleted — nothing read it once the boundary moved, and a config value nothing
reads is how `game-config.ts` became a liability.

It is slightly more generous (play at 20:00, allowance back at midnight). A
deliberate trade: the $1 refill sells to players who want more than five in one
sitting, and that motivation is untouched. What it buys is one clock — and the
DAILY panel can now show a single honest countdown for everything.

**7. Nothing pruned the daily/weekly buckets.** `prune()` now runs on the same
daily cron. It deletes `dailyContracts`, `dailyContractClaims`, `passPerkClaims`
(>30 days) and `vaultFragments` (>8 weeks).

It does **not** touch `paperClaims`, `goldenKeyClaims` or `vaultCompleted`,
because `/api/stats` counts **lifetime** totals out of those three — pruning
them would shrink the public stats page, and the drop would read as players
leaving rather than as rows being deleted. There is a test for each of those
three specifically. A key whose shape is not recognised is never stale, so a
malformed bucket is left alone rather than guessed at.

---

## 10. Rules for future contributors

These are the invariants. Breaking one is how the game drifted the first
time.

1. **The engine cannot import from `lib/`.** `public/game-engine/*.js` are
   static `<script>` files. Shared values cross the boundary through
   `window.__NS`, `mount()` options, or an API call — never an import. If a
   constant must be shared, the engine's copy is authoritative for gameplay
   and the `lib/` copy must say so in a comment.

2. **Config that nothing reads is a lie.** Before adding to
   `game-config.ts`, confirm a line of source will import it. Nine blocks
   there had zero references and actively contradicted the game — `season`,
   `bunkers`, `specialItems`, `loot`, `seasonRewards`, `burnRewards`,
   `persistence`, `ui`, `docNotes` — and their wrong numbers reached the
   player docs before anyone noticed. They are gone; the file's own header
   now states the rule.

3. **Money is weekly. Progress is daily.** Do not add USDT payouts to the
   daily layer.

4. **Never make a real reward reachable only by luck.** Luck may accelerate
   it; effort must guarantee it. §5.1 is the pattern.

5. **Sessions stay short.** If a change makes the minimum useful session
   longer than ~5 minutes, it is wrong for MiniPay.

6. **Content does not fix a missing loop.** More bunkers, monsters and
   weapons will not answer "why come back tomorrow." Content is consumed;
   loops are not. Fix the loop first.

7. **Update this file in the same PR.** Flip `[TARGET]` → `[TODAY]` when you
   ship it.

---

## 11. Build order

**Before the MiniPay listing — required**
1. ~~§5.1 Vault Fragments~~ — **shipped**
2. ~~§7 Bunker raids~~ — **shipped**
3. ~~§5.5 Daily status on the map~~ — **shipped** (absorbed §5.4)

**Before the listing — strongly recommended**
4. ~~§5.2 Daily Contracts~~ — **shipped**
5. ~~Delete the dead blocks in `game-config.ts`~~ — **shipped**

**After the listing**
6. ~~§5.3 Login streak~~ — **shipped**
7. ~~§7 Bunker differentiation (time vs risk)~~ — **shipped**
8. ~~§8 Seeded dungeon → fixes Save & Exit~~ — **shipped**
9. ~~§9 Leaderboard consolidation + automated season payout~~ — **shipped**

---

## Decision log

| Date | Decision | By |
|---|---|---|
| 2026-07-30 | Campaign = tutorial, world map = the game | Owner |
| 2026-07-30 | Paper/Key guaranteed by effort (fragments); luck stays as a shortcut | Owner |
| 2026-07-30 | Raiding a cleared bunker costs 1 energy | Owner |
| 2026-07-30 | Daily rewards pay progress only; USDT stays weekly | Owner |
| 2026-07-22 | Daily USDT drip cancelled — no capital pre-revenue | Owner (`GROWTH-BLUEPRINT.md` §1A) |

---

## Related documents

- [`GROWTH-BLUEPRINT.md`](./GROWTH-BLUEPRINT.md) — acquisition, referrals, endgame
- [`game-mechanics.md`](./game-mechanics.md) — player-facing rules
- [`treasure-vault-quest.md`](./treasure-vault-quest.md) — vault specifics
- [`rewards-system.md`](./rewards-system.md) — payout mechanics
- [`OWNER-RUNBOOK.md`](./OWNER-RUNBOOK.md) — operational tasks
