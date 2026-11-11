# NullState — Growth Blueprint (MiniPay listing)

Goal: turn MiniPay's discovery-page traffic into players who come back
tomorrow, tell a friend, and eventually buy a weapon. Three phases. Every
mechanic below runs on the **existing contracts + existing Firebase infra**
— zero new contracts. Where real money moves, the exact mechanism and its
cost/abuse controls are spelled out.

Grounding facts (verified in this repo):
- `PassSBTv3.backendMintPass()` is `onlyBackend` → the backend wallet can
  mint a **free Season Pass** to any address (used today for paid mints
  after off-chain payment verification). This powers the referral pass gift.
- Marketplace ownership (`marketplaceOwned/{wallet}`) is **Firebase**, not
  on-chain → timed weapon/skin trials are a pure server-side feature.
- The backend wallet (`BACKEND_PRIVATE_KEY`) already signs on-chain txs
  (vault payouts). A plain ERC20 `transfer` of USDT from it costs sub-cent
  gas on Celo → daily micro-payouts (0.01 USDT) are viable with **no
  contract at all**.
- Trial-gear rendering: the engine already reads `owned` from
  localStorage/Firebase at run start (`loadPersistedEquipment()`), so a
  merged `owned + activeTrials` list flows through with no engine surgery.

Market grounding (external): Telegram-mini-app games (Notcoin, Hamster
Kombat — 300M+ players, heavily Global-South) proved three things relevant
to MiniPay: (1) daily-showing-up must be the #1 rewarded behavior, (2)
referral trees are the cheapest acquisition channel in emerging markets,
(3) pure tap/claim loops **fade** — retention needs actual game depth
underneath. NullState has the depth; it's missing the daily surface.

---

## Phase 1 — New-user week (D0–D7): "the first 7 days pay you"

### 1A. Daily USDT drip for new users (0.01 USDT × 7 days) — ❌ CANCELLED

> **Owner decision (2026-07-22): NOT building this.** No capital allocated
> yet and the sybil risk isn't worth it pre-revenue. The design below is
> kept for reference only — revisit after the marketplace generates
> steady revenue to fund it. The daily-habit slot it would have filled is
> covered by Point-based daily play rewards instead.
**What the user sees:** a "Daily Reward" card on the main menu with a
7-slot tracker (day 1 → day 7). Each day: play ≥1 floor → tap claim →
+0.01 USDT lands in their MiniPay balance. Real money, visible in the
wallet they already check.

**Mechanism (no new contract):**
- API route `POST /api/daily/claim`. Server gates in Firebase RTDB:
  `newUserDrip/{wallet} = { firstSeen, claims: { <YYYY-MM-DD>: txHash } }`.
- Eligibility: `firstSeen` ≤ 7 days ago, no claim for today (UTC), and the
  wallet **cleared ≥1 dungeon floor today** (server-verifiable via the
  existing run/energy session records — the claim is a *play* reward, not a
  login reward).
- Payout: backend wallet sends `USDT.transfer(user, 10000)` (0.01 at 6
  decimals). Fee ≈ $0.001. `waitForTransactionReceipt`, store the hash.
- **Budget controls (mandatory):** global daily cap (e.g. first N claims
  per day, N set by owner), per-IP soft limit, kill-switch env var
  (`DRIP_ENABLED=0`), and a low-balance alarm (route refuses + logs when
  the hot wallet drops below a floor). The hot wallet holds a small float
  only — top it up weekly like the vault pool.
- **Cost math:** worst case $0.07 + ~$0.007 gas per new user. 10,000 new
  users = ≤ $770. That is exceptionally cheap paid acquisition — but only
  with the play-gate + caps above.
- **Sybil, honestly:** wallets are free, so this WILL be farmed at some
  scale. Defenses: the floor-clear gate (costs minutes of real play per
  wallet per day — farming 100 wallets = hours of grinding for $0.70/day),
  MiniPay-only claim (`window.ethereum.isMiniPay` + server heuristics),
  global cap, and the fact that MiniPay wallets are phone-number-anchored.
  Accept the residual leakage as marketing spend; the cap bounds it.

### 1B. Premium weapon trial for new users (48h, choose 2)
**What the user sees:** after finishing Act 1 (a real commitment gate, not
install), a "Armory Trial" chest opens: pick any **2** premium weapons.
They sit in inventory as "TRIAL" items; the 48h countdown starts **when
the weapon is first equipped**, not when granted. Countdown badge on the
item card; expired trials grey out with a "Buy — $X" button right there.

**Mechanism:** `trials/{wallet}: [{ itemId, grantedAt, activatedAt|null,
durationH: 48 }]` in Firebase. `/api/marketplace/owned` returns
`owned + trials`; the client tags trial items; the engine treats active
trials as owned (equippable), expired ones drop out at next load. Activation
is set server-side the first time the item is equipped (`/api/marketplace/equip`
already exists — it flags `activatedAt` when a trial item is worn).

**Why this converts:** the player *feels* the +ATK and the visual FX for
two days, builds their playstyle around it, then loses it. The buy button
appears exactly at the moment of loss. This is the oldest conversion
mechanic in games because it works.

---

## Phase 2 — Referral tree + zero-reading discoverability

### 2A. Referral tiers (owner-specified, all off-chain except the pass)
A "ref" only **counts when the invitee finishes Act 1** (anti-fake, and it
guarantees the invitee actually experienced the game).

| Refs | Reward to referrer | Mechanism |
|---|---|---|
| 1 | any 1 weapon, 3-day trial | `trials/` grant (72h) |
| 3 | **1 skin permanent (choose)** + 3 weapons 48h | skin → `marketplaceOwned/` write; weapons → `trials/` |
| 10 | any 2 weapons, 7 days each (independent timers) | `trials/` grants (168h) |
| bonus | invitee's **first** weapon buy or pass mint → referrer gets a **free Season Pass, auto-equipped** | `PassSBTv3.backendMintPass(referrer)` — existing contract, backend-signed; equip via existing equip flow |

**Mechanism:** referral code = short code derived from wallet, deep-link
`?ref=<code>` stored at first launch (localStorage + sent with the guest/
wallet bootstrap), credited at Act-1-completion into
`referrals/{referrerWallet}: { count, credited: {refWallet: true}, tier
rewards claimed }`. Self-ref and duplicate-device guarded server-side.
Share button opens WhatsApp/Telegram with a prefilled message + link —
in the markets MiniPay lives in, WA/TG groups ARE the growth channel.

### 2B. Discoverability: assume nobody reads (because nobody reads)
Rules for every feature above:
1. **Inbox, not docs.** A single "Rewards" bell icon on the main menu with
   a red badge count. Everything claimable lives there as a card with an
   icon + a number + one button. No paragraphs.
2. **Show, don't explain.** First run: the daily-drip card animates in with
   the 7-day tracker and a glowing "day 1" slot. Trial chest literally
   opens on screen after Act 1. The referral screen is a picture of the
   reward ladder, not a rules page.
3. **Numbers on the menu.** The main menu always shows the next claimable
   thing ("Daily +0.01 USDT — ready" / "Vault opens in 2d 4h"). If nothing
   is claimable, show the *next* one and when.
4. **Push does not exist on MiniPay** — the discovery page has no
   notifications. Compensate in-game: streak counter (fear of losing it),
   comeback gift after 3+ idle days, and the WA/TG share loops that pull
   users back socially.
5. Copy in simple English, icon-first; localize later (id/pt/es/fr/sw) as
   strings only.

---

## Phase 3 — Endgame: what happens after Bunker 5

Diagnosis (owner-confirmed): after Act 5's vault room the game just...
stops. No announcement, no next goal — players hit the wall and quit at the
exact moment they're most invested. Fixes, cheapest-first:

### 3A. Close the story properly (1 evening of work)
When Act 5's boss dies + vault interaction completes: a real ending —
"SYSTEM REBOOT" epilogue screen (reuse the story/interlude system),
a permanent **"Protocol Zero" badge** on the profile/leaderboard name, a
one-time completion bundle (Point + t3 shard cache). An ending is not
content, it's *respect* — players who finish tell people about games that
end properly.

> **Status (shipped):** 3A ending + 3D signposting (PR #71), 3C Null Cycles
> (PR #74), and 3B Null Abyss core (PR #75) are live. Deferred as follow-ups
> on the Abyss: the **weekly shared seed** (all players get the same map that
> week — currently each dive is randomly generated; depth is still directly
> comparable) and the **interactive pick-1-of-3 mutator** every 5 floors
> (depth scaling already escalates difficulty). Owner reads
> `GET /api/abyss/score` for the season top-3 to publish via the
> `update-leaderboard` CLI.

### 3B. THE NULL ABYSS — endless descent (the real endgame)
Unlocks on campaign completion, advertised the moment the final boss dies:
**"THE FLOOR BREAKS. The Abyss is open."**
- Infinite depth below Bunker 5. Reuses the existing dungeon generator +
  depth-scaling that already exists (`makeDungeon(depth)` scales stats).
  Every 5 floors = boss (existing boss pool, escalating multipliers).
- **Score = deepest floor reached this season.** This finally gives the
  on-chain season leaderboard a real, skill-based metric (today it's XP
  farming). Weekly abyss seed = same map layout for everyone that week —
  fair competition, shareable ("I died at depth 23, you?").
- **Mutators** every 5 floors: pick 1 of 3 modifiers (reuse the relic
  mutation system) — +enemy speed / -your HP / no hearts... player-chosen
  risk = depth bragging rights.
- Shard economics: abyss drops scale with depth (t3 shards live deep) →
  the crafting/evolution sink finally has a repeatable farm loop, which
  feeds marketplace demand (better weapon → deeper dive → want better
  weapon).
- Season top-3 = deepest divers → `updateLeaderboard` → USDT bonus. The
  whole reward stack suddenly points at one activity.

### 3C. NULL CYCLES — NG+ for campaign lovers (cheap)
After completion, "New Game+" restarts the campaign at Cycle 2: enemies
+35%/cycle, shard drops +25%/cycle, and an exclusive outfit tint per cycle
(pure `spriteOverrideTint`, zero art cost). Signposted on the menu:
"CYCLE 2 — [demon-red tint preview]".

### 3D. Signposting rule (fixes "gaada pemberitahuan")
At every act/bunker transition, a banner states the NEXT goal: "ACT 3
CLEARED → NEXT: The Drowned Line" ... "ACT 5 AHEAD: the Sealed Vault —
find the Paper + Golden Key". The menu quest-line card mirrors it. A
player should never have to wonder what the game wants from them next.

---

## Build order & cost

| # | Item | Cost to owner | Eng. effort |
|---|---|---|---|
| 1 | 3A ending + 3D signposting | $0 | S |
| 2 | ~~1A daily drip~~ — CANCELLED (owner: no capital yet) | — | — |
| 3 | 1B weapon trials | $0 (opportunity cost only) | M |
| 4 | 2B rewards inbox + menu surfacing | $0 | M |
| 5 | 2A referral tiers | pass mints are free; trials $0 | M–L |
| 6 | 3B Null Abyss | $0 (reuses engine) | L |
| 7 | 3C Null Cycles | $0 | S |

KPIs to watch (industry ballparks for casual mobile, use as reference not
gospel): D1 ≥ 25–30%, D7 ≥ 10–12%, referral K-factor > 0.2, trial→purchase
conversion ≥ 3–5%. Requires the analytics events from the earlier P0 note
(D1/D7 funnel) to be in place first — you cannot tune what you can't see.

Future scaling (owner note): when MiniPay listing lands and user counts
justify it, the same rails scale by raising numbers only — bigger drip cap,
bigger vault %, bigger season pool. No new systems needed.
