# World-Map Hub — Implementation Plan

> **Status: PLAN ONLY — not built.** No game code has been changed. This document
> captures the design/plan so it survives across sessions. Visual reference: the
> mock iterations (published as Claude artifacts). Assets live in
> `public/worldmap/` (`map-bg.webp`, `ui-icons.png`).

## 0. Goal

Replace the current dashboard menu (`MainMenu` — Continue / New Game / Marketplace
/ …) with a **world-map hub**: the 5 bunkers shown as nodes on a pixel-art map
(some locked), buttons on left/right side-rails, plus a **Daily Run** node for
daily-return retention. Aimed at MiniPay users (Africa / LATAM / SEA): light,
instant, readable — not a heavy screen.

## 1. Core principle — low-risk UI swap

This is a **UI-layer swap, not a rebuild.** Only the landing screen (`MainMenu`)
is replaced. Every downstream screen — Marketplace, Rewards, Crafting,
Leaderboard, the game engine — is **untouched**. The new hub calls the **same
handlers that already exist**. That's what keeps the risk small and reversible.

## 2. Architecture

```
app/game/page.tsx
  └─ GameFlowManager   (phase = 'menu' | 'marketplace' | 'rewards' | …)
       ├─ phase 'menu'  →  <WorldMapHub>   ← REPLACE <MainMenu> here only
       │                     └ calls existing handlers:
       │                        onContinueGame · onMarketplace · onRewards · …
       ├─ phase 'marketplace' → <MarketplaceScreen>   (unchanged)
       ├─ phase 'rewards'     → <RewardsScreen>       (unchanged)
       ├─ phase 'game'        → <DungeonGame>          (unchanged)
       └─ … etc                                        (unchanged)
```

Concretely: create `components/game/WorldMapHub.tsx` that accepts the **same
props `MainMenu` already takes** (9 handlers: `onContinueGame`, `onNewGame`,
`onMarketplace`, `onCrafting`, `onLeaderboard`, `onRewards`, `onReferral`,
`onMintPass`, `onHowToPlay`). In `GameFlowManager`, swap `<MainMenu … />` for
`<WorldMapHub … />`. That's the whole wiring — no downstream change.

## 3. Destination mapping

| Current menu item | Where in the hub | Handler (already exists) |
|---|---|---|
| Continue | NODE — tap active bunker → MASUK | `onContinueGame` |
| New Game | ≡ MENU (destructive + confirm) | `onNewGame` |
| Rewards | LEFT RAIL + notif badge | `onRewards` |
| Mint Pass | LEFT RAIL | `onMintPass` |
| Referral | LEFT RAIL (Invite) | `onReferral` |
| Marketplace | RIGHT RAIL (Shop) | `onMarketplace` |
| Crafting | RIGHT RAIL (Craft) | `onCrafting` |
| Leaderboard | RAIL / map landmark | `onLeaderboard` |
| How to Play | ≡ MENU | `onHowToPlay` |
| Settings | HUD ⚙ (top-right) | existing SettingsModal |
| Daily Run | NEW prominent node | — new feature |
| Bag / Inventory | RIGHT RAIL (?) | inventory is in-game today — TBD |

Layout logic: **left rail = "come back & earn"** (Daily, Rewards, Pass, Invite),
**right rail = "build & spend"** (Shop, Craft, Bag), **corners = identity +
currency + settings**, **bottom = the action (MASUK)**. This mirrors how vertical
mobile RPGs (Last Day on Earth, AFK Arena, Archero) lay out their hubs.

## 4. Bunker nodes & state

Nodes are **data, not hardcode**: one array of `{ id, name, x%, y%, unlockRule }`.
The x/y percentages are the hatch positions baked into the map art (markers snap
to them — proven in mock v4). Each node has 3 states derived from campaign
progress:

- **✓ Cleared** — act completed
- **◉ Active ("KAMU")** — current bunker → MASUK button
- **🔒 Locked** — requirement not met (fog + padlock)

The current bunker / cleared set derives from existing campaign/act progress
(localStorage + engine state — exact source to confirm at build time). **The
unlock rule itself is a design decision (see §8).**

## 5. Assets & performance (MiniPay)

- **Map:** `public/worldmap/map-bg.webp` — compressed (~210KB), lazy-loaded,
  brightness nudged up (readable outdoors on cheap phones).
- **Icons:** `public/worldmap/ui-icons.png` — transparent 5×2 sheet (500×500);
  slice into individual icons (or CSS sprite) at build. The bunker-hatch icon
  (replacing the earlier "clock" miss) still needs to be added to the sheet.
- **Ratio:** map is 2:3, phones are ~9:16 — decide cover-crop vs full display.
- **Budget:** MiniPay 2MB bundle — `dynamic import` the hub; show it fast
  (skeleton first), art after. Must be quick on 2G.

## 6. Daily Run — separate sub-project

The biggest NEW piece and the key retention hook ("come back every day"). Needs
its own design: what it is (<60s quick run? daily claim? mini-challenge?), the
reward (POINT? materials?), daily reset (UTC), and **anti-abuse** (tie-in with
the SEC-1 concern — the reward endpoints have no wallet auth). Requires a new API
route + Firebase state.

**Recommendation:** keep it separate. Build the static hub first (Phases 1–2)
WITHOUT Daily Run, then do Daily Run as its own project (Phase 3) with a dedicated
design discussion.

## 7. Phased breakdown

- **Phase 0 — Assets (small):** regen/add the hatch icon, finalize map + 10
  icons in `public/worldmap/`, slice icons.
- **Phase 1 — Static hub replaces dashboard (medium):** build `WorldMapHub.tsx`
  (map bg + rails + HUD + ≡ menu + MASUK) from mock v4; wire buttons to the
  existing handlers; swap `<MainMenu>` in `GameFlowManager`; **feature-flag** it
  and keep `MainMenu` as fallback. Tap active node = Continue.
- **Phase 2 — Dynamic node state + unlock (medium):** read act progress → set
  each node state (cleared/active/locked); apply unlock rules (after §8); Rewards
  notif badge.
- **Phase 3 — Daily Run (large):** design mechanic + reward + reset + anti-abuse
  → new API + Firebase → Daily node. **Separate design discussion first.**
- **Phase 4 — Polish (small):** final brightness/contrast, node animation, sound,
  360×640 + PageSpeed check, remove old `MainMenu` once stable.

## 8. Open questions (need owner's decision)

1. **Bunker unlock rule** — level up? clear previous act? evolution weapon?
2. **Bag / Inventory** — build a separate stash screen for the "Bag" rail button,
   or drop it from the hub? (Inventory currently lives inside the game engine.)
3. **Leaderboard** — a rail button, or a landmark flag on the map?
4. **New Game** — is ≡ MENU enough (safe from accidental taps)?
5. **Map ratio** — full display (shorter) or cover-crop (fills phone height)?
6. **Daily Run** — what's the content & the reward? (needs its own session)

---

_This is a plan, not an implementation. Effort labels (small/medium/large) are
rough. Once §8 is decided, Phases 0–2 can be executed without touching any other
screen._
