// marketplace-items.js — NullState OFFCHAIN Marketplace + Equipment + Food config
// ---------------------------------------------------------------------------
// This is a CONFIG-ONLY module (no engine wiring here). It is safe to load on
// its own and exposes everything the game + marketplace UI need via
// window.NS_MARKET. Owner can add new equipment by appending to EQUIPMENT.
//
// Design (agreed in build discussion):
//  • Purchases are paid as a plain ERC20 transfer() of USDT / USDC / USDm on
//    Celo to the TREASURY wallet (NO smart contract needed — confirmed by
//    MiniPay docs). Ownership is recorded OFFCHAIN (Firebase), the payment tx
//    is the on-chain proof and is verified server-side before unlock.
//  • Equipment is PERMANENT (never consumed), can be equipped/unequipped.
//  • Food (loot ids 321–515) is CONSUMABLE: Eat -> heal % of maxHp by rarity.
//  • FX tier drives attack visual richness (higher price = flashier effect).
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // ── Treasury + accepted tokens (Celo Mainnet 42220) ──────────────────────
  var TREASURY = '0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6';

  var TOKENS = {
    USDm: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
    USDC: { address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6  },
    USDT: { address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6  },
  };

  // ── Equipment slots ──────────────────────────────────────────────────────
  // mainhand = weapon (affects atkDmg + attack FX/behavior)
  // body     = armor  (affects maxHp %)
  // outfit   = cosmetic skin (Phase 9) — PURE VISUALS, ZERO stats. Changes only
  //            how the Knight looks (assets.js LPC_OUTFIT layer); never touches
  //            HP/ATK, so the HP-100 cap and combat balance are untouched.
  var SLOTS = { WEAPON: 'mainhand', ARMOR: 'body', OUTFIT: 'outfit' };

  // ── 10 starter items (owner can append more; list is NOT locked) ─────────
  // sprite: path in the repo/GitHub. All 10 icons are 64x64 PNG (RGBA,
  // transparent bg) and live in public/sprites/marketplace/ (added Phase 5.2).
  // effect fields are read by the engine when the item is equipped.
  var EQUIPMENT = [
    // ── ARMOR (body) : hpBonus = fraction added to base maxHp ──
    { id:'leather_guard', name:'Leather Guard', type:'armor', slot:SLOTS.ARMOR,
      price:0.5, tokenPrice:3000, fxTier:1, effect:{ hpBonus:0.15 },
      sprite:'/sprites/marketplace/leather_guard.png',
      desc:'+15% Max HP. Worn hide, light but reliable.' },
    { id:'iron_plate', name:'Iron Plate', type:'armor', slot:SLOTS.ARMOR,
      price:1.0, tokenPrice:6000, fxTier:1, effect:{ hpBonus:0.25 },
      sprite:'/sprites/marketplace/iron_plate.png',
      desc:'+25% Max HP. Solid forged plating.' },
    { id:'rune_armor', name:'Rune Armor', type:'armor', slot:SLOTS.ARMOR,
      price:2.0, fxTier:2, effect:{ hpBonus:0.40 },
      sprite:'/sprites/marketplace/rune_armor.png',
      desc:'+40% Max HP. Etched with warding runes that shimmer on hit.' },

    // ── WEAPONS (mainhand), v76 Task #7 ──
    // Cheapest -> dearest. Every weapon has its OWN art (the marketplace icon
    // IS the sprite in your hand), its own procedural swing (NS_WEAPON.motion)
    // and its own attack SFX (NS_WEAPON.sfx). No two share a behavior.
    // rusty_blade is the FREE DEFAULT weapon (TASK B): every player/guest starts
    // with it equipped so nobody is ever weaponless. It stays in EQUIPMENT so
    // getEquipment() keeps resolving it (it is the NS_WEAPON render entry and
    // several monsters carry it), but `hidden:true` keeps it out of the shop and
    // it has no price/tokenPrice — it can't be bought or swapped.
    { id:'rusty_blade', name:'Rusty Blade', type:'weapon', slot:SLOTS.WEAPON,
      price:0.5, hidden:true, fxTier:1, fxColor:'#d8dde2', effect:{ atkBonus:10, behavior:'slash' },
      sprite:'/sprites/marketplace/rusty_blade.png',
      desc:'+10 ATK. A chipped old sword — better than fists.' },
    // BASIC weapons: also swappable for NullState Point at exactly
    // price * 6000 (TOKEN_SWAP_RATE_PER_USD). Premium (fxTier-3, glowing)
    // weapons below have no tokenPrice — real currency only.
    // PRICES REPRICED 2026-07 for the MiniPay listing (Africa / SEA / LatAm):
    // $8 ceiling, everything else clustered $0.50–$3.50. The rationale lives in
    // lib/constants/marketplace.ts — this file MIRRORS it, it does not decide.
    { id:'emberwood_maul', name:'Emberwood Maul', type:'weapon', slot:SLOTS.WEAPON,
      price:1.0, tokenPrice:6000, fxTier:2, fxColor:'#d98a4a', effect:{ atkBonus:18, behavior:'knockback' },
      sprite:'/sprites/marketplace/emberwood_maul.png',
      desc:'+18 ATK. Spiked emberwood — every blow sends foes flying.' },
    { id:'ironbolt_crossbow', name:'Ironbolt Crossbow', type:'weapon', slot:SLOTS.WEAPON,
      price:1.5, tokenPrice:9000, fxTier:2, fxColor:'#e0b25a', effect:{ atkBonus:24, behavior:'ranged' },
      sprite:'/sprites/marketplace/ironbolt_crossbow.png',
      desc:'+24 ATK, ranged. Punches a heavy bolt clean through the dark.' },
    { id:'argent_waraxe', name:'Argent Waraxe', type:'weapon', slot:SLOTS.WEAPON,
      price:2.0, tokenPrice:12000, fxTier:2, fxColor:'#cfd8e3', effect:{ atkBonus:30, behavior:'cleave' },
      sprite:'/sprites/marketplace/argent_waraxe.png',
      desc:'+30 ATK. A broad silver bite that cleaves everything in the arc.' },
    { id:'ancient_blade', name:'Ancient Blade', type:'weapon', slot:SLOTS.WEAPON,
      price:3.0, fxTier:3, fxColor:'#ffd24a', effect:{ atkBonus:40, behavior:'double_hit' },
      sprite:'/sprites/marketplace/ancient_blade.png',
      desc:'+40 ATK. Two blistering slashes — few foes survive.' },
    { id:'frost_spear', name:'Frost Spear', type:'weapon', slot:SLOTS.WEAPON,
      price:3.5, fxTier:3, fxColor:'#bdeeff', effect:{ atkBonus:35, behavior:'slow', slowPct:0.5 },
      sprite:'/sprites/marketplace/frost_spear.png',
      desc:'+35 ATK, chills and slows enemies.' },
    { id:'verdant_reaper', name:'Verdant Reaper', type:'weapon', slot:SLOTS.WEAPON,
      price:5.0, fxTier:3, fxColor:'#57e389', effect:{ atkBonus:60, behavior:'aoe' },
      sprite:'/sprites/marketplace/verdant_reaper.png',
      desc:'+60 ATK. A wide living arc that reaps everything around you.' },
    { id:'void_katana', name:'Voidedge Katana', type:'weapon', slot:SLOTS.WEAPON,
      price:6.5, fxTier:3, fxColor:'#b46bff', effect:{ atkBonus:70, behavior:'triple_slash' },
      sprite:'/sprites/marketplace/void_katana.png',
      desc:'+70 ATK. Three void-lit cuts land before the first is seen.' },
    { id:'sunfire_bow', name:'Sunfire Longbow', type:'weapon', slot:SLOTS.WEAPON,
      price:8.0, fxTier:3, fxColor:'#ffcf3d', effect:{ atkBonus:80, behavior:'volley' },
      sprite:'/sprites/marketplace/sunfire_bow.png',
      desc:'+80 ATK, ranged. Looses a fan of three sunfire arrows.' },

    // ── SKINS (outfit) : Phase 9 cosmetics ──
    // MIRRORS lib/constants/marketplace.ts EXACTLY (keep both in sync). PURE
    // VISUALS: effect stays EMPTY — no atkBonus/hpBonus ever. The look is keyed
    // by the item id in assets.js LPC_OUTFIT (a real LPC clothing/armour layer
    // set); skinTint is a cosmetic-only flex colour. The FREE default outfit is
    // always shown next to these — the game is fully playable without any skin.
    // Prices follow the owner's ranking of the skins — a cosmetic's price IS
    // its ranking. ashen_warden retired (wrong vibe); see the note in
    // lib/constants/marketplace.ts, which this file MIRRORS.
    { id:'ashfall_scav', name:'Ashfall Scavenger', type:'outfit', slot:SLOTS.OUTFIT,
      price:2.0, fxTier:2, skinTint:'#7a6a4a', effect:{},
      sprite:'/sprites/marketplace/ashfall_scav.png',
      desc:'Hooded cloth and worn leather. What you wear when there is no armoury left.' },
    { id:'sungild', name:'Sungild Regalia', type:'outfit', slot:SLOTS.OUTFIT,
      price:3.0, fxTier:3, skinTint:'#e0b23a', effect:{},
      sprite:'/sprites/marketplace/sungild.png',
      desc:'Gilded champion regalia that catches every torchlight.' },
    { id:'emberguard', name:'Emberguard', type:'outfit', slot:SLOTS.OUTFIT,
      price:4.0, fxTier:3, skinTint:'#c85a1e', effect:{},
      sprite:'/sprites/marketplace/emberguard.png',
      desc:'Ember-forged warden leathers with a warm coal glow.' },
    { id:'nullsteel', name:'Nullsteel', type:'outfit', slot:SLOTS.OUTFIT,
      price:2.0, fxTier:3, skinTint:'#2f6f8f', effect:{},
      sprite:'/sprites/marketplace/nullsteel.png',
      desc:'Cold hooded plate, lit from within by a dead reactor.' },
    { id:'voidweave', name:'Voidweave', type:'outfit', slot:SLOTS.OUTFIT,
      price:5.0, fxTier:3, skinTint:'#6a24b0', effect:{},
      sprite:'/sprites/marketplace/voidweave.png',
      desc:'A hooded violet weave that drinks the dark around you.' },
    { id:'hazard_warden', name:'Hazard Warden', type:'outfit', slot:SLOTS.OUTFIT,
      price:2.0, fxTier:3, skinTint:'#b6ff3d', effect:{},
      sprite:'/sprites/marketplace/hazard_warden.png',
      desc:'Acid-green hazard gear, still humming from whatever it was built to survive.' },
    // TASK #7 — EXCLUSIVE Season-Pass skin (mirror of lib/constants/marketplace.ts).
    // hidden:true (never in the shop) + passOnly:true (engine injects it into
    // `owned` only for active pass holders — see setPassHolder in game.js).
    // Pure cosmetic, zero stats. price:0 = free-with-pass, never charged.
    { id:'pass_warden', name:'NullState Warden', type:'outfit', slot:SLOTS.OUTFIT,
      price:0, hidden:true, passOnly:true, fxTier:3, skinTint:'#00ff88', effect:{},
      sprite:'/sprites/marketplace/pass_warden.png',
      desc:'Acid-green warden regalia — the mark of a Season Pass holder.' },
  ];

  // Pre-v76 ids for the four weapons that were re-skinned this session. Wallets
  // that already bought the old version keep the item: this is a READ-side alias
  // only — nothing ever writes an old id back. void_reaper/hunters_bow/
  // ancient_aegis/warden_plate were removed outright (owner request) and so have
  // no target to alias to.
  var LEGACY_IDS = {
    voidcaller_scythe: 'sunfire_bow',
    ancient_warblade: 'void_katana',
    war_axe: 'argent_waraxe',
    twin_daggers: 'emberwood_maul',
  };
  function resolveId(id){ return LEGACY_IDS[id] || id; }

  // ── WEAPON EVOLUTION (Phase 4, blueprint §3) ──────────────────────────────
  // MIRRORS lib/constants/marketplace.ts buildWeaponEvolution() EXACTLY — keep
  // the two in sync. A weapon is bought at tier 1 then leveled with Glitch
  // Shards: each step adds +20% of base atkBonus (additive, never HP) and a
  // hotter tint/glow. maxTier = max(2, fxTier) so every weapon evolves once.
  // Owner decisions (2026-07-19): cost [8,14] matching-tier shards per step.
  var EVOLUTION_SHARD_COSTS = [8, 14];
  var EVOLUTION_ATK_DELTA_PCT = 0.20;
  // Phase 8: reaching a weapon's MAX tier grants a traversal utility that opens
  // sealed caches (props.js cache_grapple / cache_melt). Mirrors
  // UTILITY_AT_MAX_TIER in lib/constants/marketplace.ts — keep in sync.
  var UTILITY_AT_MAX_TIER = {
    void_katana: 'grapple',
    sunfire_bow: 'grapple',
    verdant_reaper: 'melt_wall',
    ancient_blade: 'melt_wall',
  };

  function brightenHex(hex, amt){
    var h = (hex || '#ffffff').replace('#', '');
    var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    function to2(c){ var v = isNaN(c) ? 255 : Math.round(c + (255 - c) * amt); return ('0' + v.toString(16)).slice(-2); }
    return '#' + to2(r) + to2(g) + to2(b);
  }

  function buildWeaponEvolution(item){
    if (!item || item.type !== 'weapon') return [];
    var maxTier = Math.max(2, item.fxTier);
    var steps = maxTier - 1;
    var shardKey = 't' + item.fxTier;
    var baseAtk = (item.effect && item.effect.atkBonus) || 0;
    var delta = Math.max(1, Math.round(baseAtk * EVOLUTION_ATK_DELTA_PCT));
    var fx = item.fxColor || '#ffffff';
    var util = UTILITY_AT_MAX_TIER[item.id];
    var tiers = [];
    for (var i = 0; i < steps; i++){
      var req = {};
      req[shardKey] = (i < EVOLUTION_SHARD_COSTS.length) ? EVOLUTION_SHARD_COSTS[i] : EVOLUTION_SHARD_COSTS[EVOLUTION_SHARD_COSTS.length - 1];
      var tier = {
        materialsRequired: req,
        atkBonusDelta: delta,
        spriteOverrideTint: brightenHex(fx, 0.20 + 0.20 * i),
        fxColorOverride: brightenHex(fx, 0.30 + 0.25 * i),
        // Must stay identical to lib/constants/marketplace.ts — this file is
        // the engine's mirror of it. Flat `fx` gave tier 2 and tier 3 the same
        // aura, so the most visible cue did not move for the pricier upgrade.
        glowOverride: brightenHex(fx, 0.35 * i),
      };
      if (util && i === steps - 1) tier.unlockUtility = util; // MAX tier only
      tiers.push(tier);
    }
    return tiers;
  }

  // Attach the ladder to every weapon in place (armor keeps none).
  for (var ei = 0; ei < EQUIPMENT.length; ei++){
    if (EQUIPMENT[ei].type === 'weapon') EQUIPMENT[ei].evolutionTiers = buildWeaponEvolution(EQUIPMENT[ei]);
  }
  function getEvolutionTiers(id){ var e = getEquipment(id); return (e && e.evolutionTiers) || []; }
  function maxWeaponTier(id){ var e = getEquipment(id); return 1 + ((e && e.evolutionTiers && e.evolutionTiers.length) || 0); }

  // ── FOOD (consumables) ────────────────────────────────────────────────────
  // Any loot item whose id falls in FOOD_RANGES is edible. Eating heals a % of
  // the player's maxHp scaled by the item's (deterministic) rarity.
  var FOOD_RANGES = [ [321, 515] ]; // owner-tunable; see item_contact_sheet_2
  var FOOD_OPTIONAL_RANGES = [ [1045, 1075] ]; // seafood — disabled by default
  var FOOD_HEAL_BY_RARITY = {
    common:    0.03,  // 3%
    uncommon:  0.035, // 3.5%
    rare:      0.04,  // 4%
    epic:      0.045, // 4.5%
    legendary: 0.05,  // 5%
  };

  function isFood(id) {
    for (var i = 0; i < FOOD_RANGES.length; i++) {
      if (id >= FOOD_RANGES[i][0] && id <= FOOD_RANGES[i][1]) return true;
    }
    return false;
  }
  function foodHealFraction(rarity) {
    return FOOD_HEAL_BY_RARITY[rarity] || FOOD_HEAL_BY_RARITY.common;
  }
  function getEquipment(id) {
    var rid = resolveId(id);
    for (var i = 0; i < EQUIPMENT.length; i++) if (EQUIPMENT[i].id === rid) return EQUIPMENT[i];
    return null;
  }

  window.NS_MARKET = {
    TREASURY: TREASURY,
    TOKENS: TOKENS,
    SLOTS: SLOTS,
    EQUIPMENT: EQUIPMENT,
    FOOD_RANGES: FOOD_RANGES,
    FOOD_OPTIONAL_RANGES: FOOD_OPTIONAL_RANGES,
    FOOD_HEAL_BY_RARITY: FOOD_HEAL_BY_RARITY,
    isFood: isFood,
    foodHealFraction: foodHealFraction,
    getEquipment: getEquipment,
    LEGACY_IDS: LEGACY_IDS,
    resolveId: resolveId,
    // Phase 4 — weapon evolution (mirrors lib/constants/marketplace.ts)
    EVOLUTION_SHARD_COSTS: EVOLUTION_SHARD_COSTS,
    EVOLUTION_ATK_DELTA_PCT: EVOLUTION_ATK_DELTA_PCT,
    buildWeaponEvolution: buildWeaponEvolution,
    getEvolutionTiers: getEvolutionTiers,
    maxWeaponTier: maxWeaponTier,
  };
})();
