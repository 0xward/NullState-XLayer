/**
 * Game economy constants.
 *
 * ── THE RULE FOR THIS FILE ───────────────────────────────────────────────────
 * Everything here MUST be read by something. Before adding a block, confirm a
 * line of source will import it.
 *
 * Nine blocks were removed in one pass because none of them were: `season`,
 * `bunkers`, `specialItems`, `loot`, `seasonRewards`, `burnRewards`,
 * `persistence`, `ui` and `docNotes`. They were not merely unused — they were
 * WRONG, and being wrong in a file called game-config is worse than not
 * existing, because it reads like the source of truth:
 *
 *   bunkers        claimed 6 bunkers of 3 floors. There are 5, of 5.
 *   specialItems   put the Golden Key at "bunker 1, floor 3". It is a 16% roll
 *                  in any lockable container, plus the fragment path.
 *   loot           said a container yields 3-8 items. It rolls 2-4 slots.
 *   burnRewards    published a rarity split of 40/30/20/8/2. The real weights
 *                  in items.js give ~59/26/11/3.5/0.6.
 *   ui             listed a main menu that the world map replaced.
 *   persistence    claimed a 30s autosave. It is event-driven with a 60s net.
 *
 * Those numbers reached the player-facing docs and had to be corrected there
 * too. See docs/GAME-DESIGN.md §10 rule 2.
 *
 * ── WHY SO MUCH OF IT WAS DEAD ───────────────────────────────────────────────
 * The engine (public/game-engine/*.js) is served as static <script> files and
 * CANNOT import from lib/. Anything about dungeon generation, loot tables or
 * item rarity is owned by the engine and can only ever be a stale copy here.
 * This file is for values the TypeScript side actually reads: prices, energy,
 * craft timers, pass perks.
 *
 * If a value genuinely must exist on both sides, the engine's copy is
 * authoritative and the copy here must say so. There is precedent below: the
 * pass price used to live here and was removed for exactly this reason, since
 * the contract owns it.
 */

export const GAME_CONFIG = {
  pass: {
    // ── TASK #7 — "make the pass worth its price" perks ───────────────────
    // Every perk is NON-PAY-TO-WIN: the HP-100 cap is untouched and the FREE
    // path always exists alongside (free players still get 5 energy runs/day
    // and earn shards by playing). Holding an ACTIVE-season pass grants:
    //   - a profile + in-game BADGE (cosmetic flair; no config needed)
    //   - dailyEnergyRuns : +N bonus energy runs, claimable once per UTC day
    //   - dailyShards     : a small Glitch-Shard stipend, claimable once per UTC
    //                       day (shards only speed weapon EVOLUTION — additive
    //                       ATK, never HP — and are also earned free in-run, so
    //                       this is a convenience nudge, not a power gate)
    // Both daily claims are gated on-chain (PassSBTv3.hasPass) + one-per-UTC-day
    // in Firebase (see app/api/passsbt/perks). Amounts are deliberately modest.
    dailyEnergyRuns: 1,
    dailyShards: { t1: 3, t2: 0, t3: 0 },
  },

  // Energy / Action system (Genius blueprint Phase 1). This replaced a
  // never-implemented `pass.playLimitFree` / `playLimitWithPass` pair, which
  // sat in this file describing a cap nothing enforced until energy shipped —
  // and stayed there afterwards. Both are gone now; energy is the cap.
  // One energy = one fresh bunker entry (RunSession start). Continuing a
  // saved run costs nothing. Owner decision (2026-07-19): 5 free runs per day,
  // $1 refill grants +5 bonus runs, free runs do NOT roll over (bonus runs
  // persist until spent — they were paid for).
  //
  // The allowance resets at 00:00 UTC, the same instant Daily Contracts and the
  // login streak do. It was a rolling 24h window until the audit in
  // GAME-DESIGN.md §9b found that put two meanings of "a day" on one status bar.
  // `windowHours` went with it: nothing read it once the boundary became the
  // UTC day, and a config value nothing reads is how game-config.ts became a
  // liability in the first place (see the header of this file).
  energy: {
    freeRunsPerDay: 5,
    refillPriceUSD: 1,
    refillRuns: 5,
  },

  // Drop-Rate Elixir (Genius blueprint Phase 3, §2.6): a $1 consumable that
  // biases loot-rarity rolls upward for 30 real-time minutes (one extra
  // keep-the-better reroll in rollItemDrop — see items.js). Wallet-bound,
  // off-chain count + activeUntil timestamp (same trust model as energy).
  elixir: {
    priceUSD: 1,
    durationMin: 30,
  },

  // Weapon Evolution (Genius blueprint Phase 4, §3): a bought weapon is
  // LEVELED with Glitch Shards (earned free in-run) or a $1 shard pack. Each
  // tier adds attack + a richer FX tint/glow; it NEVER touches maxHp (flat 100
  // cap is inviolable — only armor raises HP). Owner decisions (2026-07-19):
  //   Q1 shard cost per tier = [8, 14] matching-tier shards (tier1->2, 2->3).
  //   Q2 atk delta = +20% of the weapon's base atkBonus, ADDITIVE per tier,
  //      with NO monster rebalance for the MVP.
  //   Q3 $1 shard pack = 5 shards of a tier the PLAYER chooses.
  //   Q4 tier count reuses fxTier: maxTier = max(2, fxTier) so every weapon
  //      evolves at least once (fxTier-3 weapons reach tier 3).
  // The per-tier shard cost + atk delta + tint overrides live on each item's
  // evolutionTiers array (see lib/constants/marketplace.ts, the single source
  // of truth the upgrade route reads). Only the $1 pack economics live here.
  weaponEvolution: {
    // $1 Glitch Shard pack — verify-and-record payment primitive
    // (app/api/materials/buy). Player picks which tier (t1/t2/t3) to top up.
    shardPack: { priceUSD: 1, shards: 5 },

    // Phase 5 — Time-Gate Crafting + Instant Complete. An upgrade is no longer
    // instant: starting a craft LOCKS the weapon and its shards, then a timer
    // runs. Owner decisions (2026-07-19):
    //   - durations: craft INTO tier 2 = 6h, INTO tier 3 = 12h.
    //   - Finish Now (skip the timer) is tiered: $1 to finish a tier-2 craft,
    //     $2 for tier-3 (longer timer, dearer skip).
    //   - firstCraftInstant: the wallet's VERY FIRST craft completes instantly
    //     (no timer, still costs shards) so every player feels one evolution
    //     payoff immediately. Every craft after that is timed.
    // The craft queue is server-authoritative (Realtime DB craftQueue/{wallet},
    // single active craft per wallet) — the timer gates real money, so the
    // client only READS it for the countdown; it can never shorten it.
    craft: {
      firstCraftInstant: true,
      durationHoursByTargetTier: { 2: 6, 3: 12 } as Record<number, number>,
      finishNowPriceUSDByTargetTier: { 2: 1, 3: 2 } as Record<number, number>,
    },
  },

  // Phase 8 — Premium Sector Blueprints. Bunker-scoped, off-chain ownership
  // (Firebase Realtime DB blueprintsOwned/{wallet}/{sectorId}, same shape as
  // marketplaceOwned). Owning an act's blueprint spawns a guaranteed
  // Glitch-Shard-rich "Premium Sector Cache" on that act's FIRST floor — pure
  // OPTIONAL bonus loot that never gates or alters the 5 core story acts.
  // sectorId 'sector_<n>' maps to campaign act n (1-indexed). Loot skews hard
  // to Glitch Shards (the crafting currency), pitched as optional bonus sectors.
  //
  // PRICING (2026-07, owner decision): a flat $1 each, down from $3-$5.
  //
  // The old ladder was set when weapons ran to $15. After the marketplace
  // repricing it left a blueprint as the second-dearest thing in the game —
  // more than every weapon but three — which is backwards: a blueprint is a
  // bonus chest on one act's first floor, not a piece of gear you keep.
  //
  // Flat rather than scaled by act, deliberately. A ladder ($1 → $2) would
  // charge the most for the LAST act, which is exactly the sector the fewest
  // players ever reach — pricing the tail of the funnel highest. Flat also
  // makes the whole set $5, an amount someone might actually buy outright,
  // and needs no explanation in the UI.
  //
  // Safe for payments in flight: /api/blueprints/buy matches an ERC20 transfer
  // of AT LEAST priceUSD, so anything sent at the old price still settles.
  premiumSectors: [
    { id: 'sector_1', act: 1, name: 'Treeline Reserve',        priceUSD: 1, desc: 'A sealed sub-vault beneath the Treeline Bunker. Guarantees a Glitch-Shard cache every Act 1 run.' },
    { id: 'sector_2', act: 2, name: 'Sunken Cache Sector',     priceUSD: 1, desc: 'Flooded storage under the Sunken Field. Guarantees a Glitch-Shard cache every Act 2 run.' },
    { id: 'sector_3', act: 3, name: 'Frostlock Reserve',       priceUSD: 1, desc: 'An ice-locked strongroom off the Frostline. Guarantees a Glitch-Shard cache every Act 3 run.' },
    { id: 'sector_4', act: 4, name: 'Hollow Reserve',          priceUSD: 1, desc: 'A hidden reserve behind the Hollow Market. Guarantees a Glitch-Shard cache every Act 4 run.' },
    { id: 'sector_5', act: 5, name: 'Last Light Vaultworks',   priceUSD: 1, desc: 'Deep vaultworks under the Last Light. Guarantees a Glitch-Shard cache every Act 5 run.' },
  ],

  // Burn Reward System — NullState Point (Phase 5.5 #8)
  // Burning is off-chain and instant: no weekly pool, no owner deposit, no
  // per-user cap, no claim step. Items convert straight into the player's
  // NullState Point balance (Firestore-tracked, see /api/burn/record).
  // NullState Point is a faucet-only in-game asset — it cannot be
  // withdrawn/cashed out; its only use is swapping for Marketplace gear
  // priced $0.5–$2 (see lib/constants/marketplace.ts tokenPrice + the
  // Marketplace "Swap" button).
} as const;

export default GAME_CONFIG;
