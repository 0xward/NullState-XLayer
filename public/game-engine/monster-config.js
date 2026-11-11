/* ============================================================
   NULL_STATE :: MONSTER SCALING CONFIG  (Phase 5)
   Data-driven per-floor monster difficulty scaling.
   All values are multipliers applied ON TOP of the base
   Enemy constructor scaling (1 + (depth-1)*0.14).
   ============================================================ */

const MONSTER_FLOOR_CONFIG = {
  // Global scale factor applied per floor tier (compounding multiplier).
  // Formula: finalScale = base * (FLOOR_SCALE_FACTOR ^ (floor - 1))
  FLOOR_SCALE_FACTOR: 1.08,   // +8% HP & DMG per floor tier

  // Per-tier overrides (optional). Keys are floor numbers.
  // These REPLACE the formula scale for that specific floor.
  floorOverrides: {
    5:  { hpMul: 2.2,  dmgMul: 1.8,  xpMul: 2.5,  label: 'Boss Floor' },
    10: { hpMul: 4.2,  dmgMul: 2.8,  xpMul: 4.0,  label: 'Boss Floor II' },
    15: { hpMul: 7.5,  dmgMul: 4.2,  xpMul: 6.5,  label: 'Boss Floor III' },
    20: { hpMul: 13.0, dmgMul: 6.5,  xpMul: 10.0, label: 'Boss Floor IV' },
  },

  // Elite bonus stacks on top of floor scaling.
  elite: { hpMul: 2.3, dmgMul: 1.45, xpMul: 2.6, rMul: 1.28 },

  // Boss-scale stacks on top of everything else.
  boss: { hpMul: 2.0, dmgMul: 1.4, rMul: 1.7, scMul: 1.85 },

  // Per-Act ("bunker") hard-mode overrides — Phase 5.5 Bunker 5 "THE LAST
  // LIGHT". Keyed by campaignActIndex (0-based: Act 1 = 0 ... Act 5 = 4).
  // Stacks MULTIPLICATIVELY on top of elite/boss/floor scaling above (it
  // does not replace any of it) — read in entities.js Enemy constructor via
  // window.__NS.campaignActIndex. Numbers confirmed by Ward (v27): HP x2,
  // DMG x1.6, i.e. every enemy in Bunker 5 (all 5 floors of that act, not
  // just the boss floor) hits noticeably harder and takes twice the hits to
  // kill compared to the same floor number in an earlier bunker.
  // Per-bunker difficulty — the RISK half of GAME-DESIGN.md §7's time-vs-risk
  // axis. (The time half is ACT_SIZE in dungeon.js.)
  //
  // MEASURED BEFORE THIS CURVE EXISTED: only act 4 had an entry, so bunkers 1
  // through 4 were mechanically IDENTICAL. Enemy stats scale on `depth`, which
  // runs 1-5 inside every bunker, so a bunker-4 monster on floor 2 had exactly
  // the stats of a bunker-1 monster on floor 2. The only thing that changed
  // across those four bunkers was which archetypes could roll — variety, not
  // difficulty. "Which bunker?" had no mechanical answer.
  //
  // The curve is gentle at the start and steep at the end, so the first raid a
  // new player attempts is not harder than the campaign taught them it would
  // be, while the last one earns its T3 shards.
  //
  // Act 4 is UNCHANGED at 2.0/1.3 — those numbers were tuned against a real
  // problem (the Bunker 5 boss was one-shotting players; dmg came down from 1.6
  // and the per-hit cap in game.js was the actual fix). Nothing here reopens
  // that. The other four are new.
  actHardMode: {
    0: { hpMul: 1.00, dmgMul: 1.00, label: 'THE TREELINE BUNKER' },
    1: { hpMul: 1.20, dmgMul: 1.05, label: 'THE SUNKEN FIELD' },
    2: { hpMul: 1.45, dmgMul: 1.12, label: 'THE FROSTLINE BUNKER' },
    3: { hpMul: 1.70, dmgMul: 1.20, label: 'THE HOLLOW MARKET' },
    4: { hpMul: 2.00, dmgMul: 1.30, label: 'THE LAST LIGHT — Hard Mode' },
  },

  // ---- Game-feel knobs (used by effects.js) ----
  // Hit-stop duration (seconds) scaled by damage dealt.
  hitStop: {
    minDmg:    5,    // below this: no hitstop
    maxDmg:    80,   // at this dmg and above: maxDuration
    minDur:    0.04, // seconds for a light hit
    maxDur:    0.16, // seconds for a heavy hit
    bossMul:   1.5,  // extra multiplier on boss hits
  },

  // Screen shake per event (shake units — decays at 22/s in game.js).
  // Values cut roughly 35-45% this session (punch list #10, v38) — combined
  // with the render-side smoothing fix in game.js (previously raw
  // per-frame white noise with no interpolation), the old numbers read as
  // overwhelming even for a light hit. bossKill kept relatively the
  // highest of the set since that's meant to be the one "big" moment, but
  // even that came down from 28 to 16.
  shake: {
    playerHit:   6,
    playerAttack: 4,
    enemyDeath:   5,
    critHit:     9,
    bossHit:     11,
    bossKill:    16,
  },

  // Knockback velocities (px/s).
  knockback: {
    base:      { x: 240, y: 155 },
    knockback:  { x: 420, y: 270 },  // weapon behavior 'knockback'
    aoe:        { x: 320, y: 210 },  // weapon behavior 'aoe'
    boss:       { x: 180, y: 120 },  // bosses resist knockback
  },

  // Particle burst counts on impact.
  particles: {
    lightHit:   6,
    heavyHit:  14,
    critHit:   20,
    death:     28,
    bossKill:  60,
  },
};

// Helper: compute total floor scaling for a given floor number.
// Returns { hpMul, dmgMul, xpMul } ready to multiply into base stats.
function getFloorScale(floor) {
  const cfg = MONSTER_FLOOR_CONFIG;
  const ov = cfg.floorOverrides[floor];
  if (ov) return { hpMul: ov.hpMul, dmgMul: ov.dmgMul, xpMul: ov.xpMul };
  const factor = Math.pow(cfg.FLOOR_SCALE_FACTOR, floor - 1);
  return { hpMul: factor, dmgMul: factor, xpMul: factor };
}

// Expose globally (loaded via <script> in the game page).
if (typeof window !== 'undefined') {
  window.NS_MONSTER_CONFIG = MONSTER_FLOOR_CONFIG;
  window.NS_FLOOR_SCALE = getFloorScale;
}
