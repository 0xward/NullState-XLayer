/**
 * Marketplace items — TypeScript source of truth for the React Marketplace UI
 * and the server-side purchase verifier. Mirrors public/game-engine/
 * marketplace-items.js (the in-canvas engine copy). Owner can append items
 * here + drop the sprite in /public/sprites/marketplace/ — the list is NOT
 * locked. Prices are in USD (paid 1:1 in USDm/USDC/USDT).
 *
 * Every icon is a 64x64 RGBA PNG in public/sprites/marketplace/. Since v76 the
 * weapon icon art is ALSO the sprite the hero holds (public/sprites/weapons/
 * <id>.png is the same artwork rotated to a canonical grip-down pose), so the
 * shop preview and the equipped weapon can never drift apart.
 */
import { MARKETPLACE_TOKENS, TREASURY_WALLET, tokenLabel, TOKEN_LOGOS, type MarketplaceTokenSymbol } from './tokens'

// Phase 9 adds a THIRD equipment slot for pure cosmetics ('outfit'). Outfits
// change ONLY how the Knight looks (an LPC sprite layer — see assets.js
// LPC_OUTFIT) and carry ZERO gameplay effect; the discriminated union below
// enforces "no stats on an outfit" at COMPILE TIME.
export type EquipmentType = 'weapon' | 'armor' | 'outfit'
export type EquipmentSlot = 'mainhand' | 'body' | 'outfit'

// Weapon Evolution (Phase 4, blueprint §3). A weapon is bought once at its
// base tier (tier 1) then leveled with Glitch Shards. Each entry describes ONE
// upgrade step: evolutionTiers[0] = tier1->2, evolutionTiers[1] = tier2->3.
// The array is built deterministically from the weapon's fxTier/fxColor/
// atkBonus (see buildWeaponEvolution) so the owner only tunes base stats.
export interface WeaponEvolutionTier {
  materialsRequired: { t1?: number; t2?: number; t3?: number } // shards for THIS step
  atkBonusDelta: number      // ATK added on top of base (ADDITIVE, never HP)
  spriteOverrideTint?: string // -> NS_WEAPON.ovlTint at runtime (hex)
  fxColorOverride?: string    // -> player._fxColor swing-FX color (hex)
  glowOverride?: string       // -> NS_WEAPON.glow premium aura (hex)
  unlockUtility?: 'grapple' | 'melt_wall' // DEFER to Phase 8 — data only, no runtime effect yet
}

// Fields common to every marketplace entry (weapon, armor, or cosmetic outfit).
interface MarketplaceItemBase {
  id: string
  name: string
  price: number          // USD
  tokenPrice?: number    // NullState Point price (off-chain swap) — only set
                         // for items $0.5–$2 (Phase 5.5 #8). Items without
                         // this field can only be bought with real
                         // USDm/USDC/USDT, never swapped for tokens.
  fxTier: 1 | 2 | 3      // drives shop-card glow richness (higher price = flashier)
  sprite: string
  desc: string
  hidden?: boolean       // TASK B: the item still resolves via getMarketplaceItem
                         // (so the engine can render it and monsters can carry
                         // it) but is NOT shown in the shop and can't be
                         // bought/swapped. Used for the FREE default weapon
                         // (rusty_blade), which every player/guest starts with.
  passOnly?: boolean     // TASK #7: granted only to active Season-Pass holders
                         // (never bought). Always paired with hidden:true. The
                         // engine injects it into `owned` when the wallet holds
                         // a pass so it can be equipped in the Gear tab.
}

// Weapons & armor: they carry gameplay stats, and weapons carry an evolution
// ladder (Phase 4). This is the ONLY item shape allowed to hold an `effect`.
export interface GearItem extends MarketplaceItemBase {
  type: 'weapon' | 'armor'
  slot: 'mainhand' | 'body'
  fxColor?: string       // v67 T11: per-weapon attack-FX color (hex). Read by
                         // the engine (entities.js swing arcs, game.js arrows)
                         // via the marketplace-items.js mirror. Weapons only.
  effect: {
    atkBonus?: number
    hpBonus?: number      // fraction, e.g. 0.4 = +40% max HP
    behavior?: string
    slowPct?: number
  }
  evolutionTiers?: WeaponEvolutionTier[] // weapons only; empty for armor
}

// Phase 9 — Cosmetic Skin. A skin is a NEW LPC sprite LAYER (assets.js
// LPC_OUTFIT, keyed by the item id) with ZERO gameplay effect: the HP-100 cap
// and combat balance are untouched, there is no pay-to-win. The type FORBIDS
// atkBonus/hpBonus/behavior — `effect` is the empty object and `fxColor`/
// `evolutionTiers` are `never`, so TS rejects any attempt to give a skin stats.
// `skinTint` is a purely-cosmetic flex colour (UI only, never combat).
export interface OutfitItem extends MarketplaceItemBase {
  type: 'outfit'
  slot: 'outfit'
  effect: Record<string, never> // no stats — enforced by the type
  skinTint?: string
  fxColor?: never
  evolutionTiers?: never
}

export type MarketplaceItem = GearItem | OutfitItem

// ── Phase 4 evolution tuning (owner decisions 2026-07-19) ────────────────────
// Q1: shard cost per upgrade step (tier1->2, tier2->3), paid in shards of the
// weapon's own fxTier. Q2: each step adds this fraction of the weapon's base
// atkBonus (additive, no monster rebalance for MVP).
export const EVOLUTION_SHARD_COSTS = [8, 14] as const
export const EVOLUTION_ATK_DELTA_PCT = 0.20

// Brighten a hex color toward white by `amt` (0..1) — evolved tiers glow hotter.
function brightenHex(hex: string, amt: number): string {
  const h = (hex || '#ffffff').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amt)
  const to2 = (c: number) => (isNaN(c) ? 255 : mix(c)).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

// Phase 8: reaching a weapon's MAX tier can grant a traversal utility that
// opens sealed caches in the dungeon (props.js cache_grapple / cache_melt).
// Only a few top-tier weapons grant one, so the ability is an aspirational
// end-of-ladder reward. Keys must match the engine's sealedUtility values.
export const UTILITY_AT_MAX_TIER: Record<string, 'grapple' | 'melt_wall'> = {
  void_katana: 'grapple',
  sunfire_bow: 'grapple',
  verdant_reaper: 'melt_wall',
  ancient_blade: 'melt_wall',
}

// Build the evolution ladder for a weapon. maxTier = max(2, fxTier) so every
// weapon evolves at least once; a fxTier-3 weapon can reach tier 3 (two steps).
export function buildWeaponEvolution(item: MarketplaceItem): WeaponEvolutionTier[] {
  if (item.type !== 'weapon') return []
  const maxTier = Math.max(2, item.fxTier)
  const steps = maxTier - 1
  const shardKey = (`t${item.fxTier}`) as 't1' | 't2' | 't3'
  const baseAtk = item.effect.atkBonus || 0
  const delta = Math.max(1, Math.round(baseAtk * EVOLUTION_ATK_DELTA_PCT))
  const fx = item.fxColor || '#ffffff'
  const util = UTILITY_AT_MAX_TIER[item.id]
  const tiers: WeaponEvolutionTier[] = []
  for (let i = 0; i < steps; i++) {
    const cost = EVOLUTION_SHARD_COSTS[i] ?? EVOLUTION_SHARD_COSTS[EVOLUTION_SHARD_COSTS.length - 1]
    const materialsRequired: { t1?: number; t2?: number; t3?: number } = {}
    materialsRequired[shardKey] = cost
    const tier: WeaponEvolutionTier = {
      materialsRequired,
      atkBonusDelta: delta,
      spriteOverrideTint: brightenHex(fx, 0.20 + 0.20 * i),
      fxColorOverride: brightenHex(fx, 0.30 + 0.25 * i),
      // The aura used to be `fx` flat, which meant tier 2 and tier 3 emitted
      // the SAME glow — the one cue a player reads from across a room, and it
      // did not move at all for the more expensive upgrade. Now the final tier
      // burns noticeably hotter than the first, in the weapon's own colour.
      glowOverride: brightenHex(fx, 0.35 * i), // i=0 -> signature colour, i=1 -> hot
    }
    if (util && i === steps - 1) tier.unlockUtility = util // granted at MAX tier only
    tiers.push(tier)
  }
  return tiers
}

// Highest tier a weapon can reach (base tier is 1).
export function maxWeaponTier(item: MarketplaceItem): number {
  return 1 + (item.evolutionTiers?.length || 0)
}

// NullState Point swap rate: 6000 Point per $1. Every swap-eligible item now
// prices at EXACTLY price * this rate — before the 2026-07 repricing the rate
// silently varied from 2500 to 6000 Point per dollar depending on the item,
// which made "how much Point is a dollar worth?" unanswerable.
//
// TOKEN_SWAP_MAX_PRICE_USD is the ceiling for swap eligibility, and it is
// ENFORCED (app/api/marketplace/swap) rather than merely documented — a
// tokenPrice accidentally added to an expensive item can no longer open the
// free path to it. Swap eligibility is still an explicit allowlist (the items
// carrying `tokenPrice`), not "everything under the cap": being cheap makes an
// item ELIGIBLE to be swappable, it does not make it swappable.
export const TOKEN_SWAP_RATE_PER_USD = 6000
export const TOKEN_SWAP_MAX_PRICE_USD = 2

// ─────────────────────────────────────────────────────────────────────────────
// PRICING (repriced 2026-07 for the MiniPay listing — owner decision)
//
// NullState's audience is MiniPay's: West/East Africa, Southeast Asia, Latin
// America. The old ladder topped out at $15 and averaged ~$6, which is a full
// day's earnings for a large share of that audience — priced so high that the
// realistic outcome is nobody buys anything and the economy never starts.
//
// The rules the ladder now follows:
//   1. $8 is the CEILING. Exactly one item (sunfire_bow, the strongest weapon)
//      sits there — it is the aspirational purchase, not the expected one.
//   2. Everything else clusters at $0.50–$3.50, the band where an impulse buy
//      is actually plausible on a MiniPay balance.
//   3. No gap between adjacent rungs is larger than $1.50, so a player always
//      has a "just a bit better" step within reach. Gaps are where ladders
//      lose people.
//   4. Cosmetics undercut weapons of similar flash. They grant ZERO stats, so
//      pricing them like power would be both a bad deal and off-message for a
//      game that advertises no pay-to-win.
//
// The Season Pass is $3 and deliberately sits mid-ladder: it should read as the
// best-value purchase in the game, which it cannot do if gear towers over it.
//
// Lowering a price is SAFE for money already in flight: the on-chain verifier
// (app/api/marketplace/verify) matches transfers with `value >= priceWei`, so a
// payment sent at an older, higher price still settles.
// ─────────────────────────────────────────────────────────────────────────────
const BASE_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  // ── ARMOR ── (tokenPrice = swappable for NullState Point; see the swap
  // allowlist note above TOKEN_SWAP_RATE_PER_USD)
  { id:'leather_guard', name:'Leather Guard', type:'armor', slot:'body', price:0.5, tokenPrice:3000, fxTier:1,
    effect:{ hpBonus:0.15 }, sprite:'/sprites/marketplace/leather_guard.png',
    desc:'+15% Max HP. Worn hide, light but reliable.' },
  { id:'iron_plate', name:'Iron Plate', type:'armor', slot:'body', price:1.0, tokenPrice:6000, fxTier:1,
    effect:{ hpBonus:0.25 }, sprite:'/sprites/marketplace/iron_plate.png',
    desc:'+25% Max HP. Solid forged plating.' },
  { id:'rune_armor', name:'Rune Armor', type:'armor', slot:'body', price:2.0, fxTier:2,
    effect:{ hpBonus:0.40 }, sprite:'/sprites/marketplace/rune_armor.png',
    desc:'+40% Max HP. Etched with warding runes that shimmer on hit.' },
  // ── WEAPONS (v76 Task #7) ── cheapest -> dearest. Mirrors
  // public/game-engine/marketplace-items.js exactly; keep both in sync.
  // rusty_blade is the FREE DEFAULT weapon (TASK B): every player/guest starts
  // with it equipped so nobody is ever weaponless. It stays in the item list so
  // getMarketplaceItem() keeps resolving it (it is the NS_WEAPON render entry
  // and several monsters carry it), but `hidden:true` removes it from the shop
  // and it has no price/tokenPrice — it can't be bought or swapped.
  { id:'rusty_blade', name:'Rusty Blade', type:'weapon', slot:'mainhand', price:0.5, hidden:true, fxTier:1, fxColor:'#d8dde2',
    effect:{ atkBonus:10, behavior:'slash' }, sprite:'/sprites/marketplace/rusty_blade.png',
    desc:'+10 ATK. A chipped old sword — better than fists.' },
  // ── The three BASIC weapons are also swappable for NullState Point (the burn
  //    reward), at exactly price * TOKEN_SWAP_RATE_PER_USD. All three now sit
  //    at or under TOKEN_SWAP_MAX_PRICE_USD, so the swap band is finally a
  //    truthful statement rather than a comment the data contradicted.
  //    PREMIUM weapons below (fxTier-3, glowing) have NO tokenPrice — real
  //    currency only, which is what keeps the free path from reaching the top
  //    of the ladder. (rusty_blade is the free default weapon, so it is neither
  //    a shop nor a swap item — see above.)
  { id:'emberwood_maul', name:'Emberwood Maul', type:'weapon', slot:'mainhand', price:1.0, tokenPrice:6000, fxTier:2, fxColor:'#d98a4a',
    effect:{ atkBonus:18, behavior:'knockback' }, sprite:'/sprites/marketplace/emberwood_maul.png',
    desc:'+18 ATK. Spiked emberwood — every blow sends foes flying.' },
  { id:'ironbolt_crossbow', name:'Ironbolt Crossbow', type:'weapon', slot:'mainhand', price:1.5, tokenPrice:9000, fxTier:2, fxColor:'#e0b25a',
    effect:{ atkBonus:24, behavior:'ranged' }, sprite:'/sprites/marketplace/ironbolt_crossbow.png',
    desc:'+24 ATK, ranged. Punches a heavy bolt clean through the dark.' },
  { id:'argent_waraxe', name:'Argent Waraxe', type:'weapon', slot:'mainhand', price:2.0, tokenPrice:12000, fxTier:2, fxColor:'#cfd8e3',
    effect:{ atkBonus:30, behavior:'cleave' }, sprite:'/sprites/marketplace/argent_waraxe.png',
    desc:'+30 ATK. A broad silver bite that cleaves everything in the arc.' },
  { id:'ancient_blade', name:'Ancient Blade', type:'weapon', slot:'mainhand', price:3.0, fxTier:3, fxColor:'#ffd24a',
    effect:{ atkBonus:40, behavior:'double_hit' }, sprite:'/sprites/marketplace/ancient_blade.png',
    desc:'+40 ATK. Two blistering slashes — few foes survive.' },
  { id:'frost_spear', name:'Frost Spear', type:'weapon', slot:'mainhand', price:3.5, fxTier:3, fxColor:'#bdeeff',
    effect:{ atkBonus:35, behavior:'slow', slowPct:0.5 }, sprite:'/sprites/marketplace/frost_spear.png',
    desc:'+35 ATK, chills and slows enemies.' },
  { id:'verdant_reaper', name:'Verdant Reaper', type:'weapon', slot:'mainhand', price:5.0, fxTier:3, fxColor:'#57e389',
    effect:{ atkBonus:60, behavior:'aoe' }, sprite:'/sprites/marketplace/verdant_reaper.png',
    desc:'+60 ATK. A wide living arc that reaps everything around you.' },
  { id:'void_katana', name:'Voidedge Katana', type:'weapon', slot:'mainhand', price:6.5, fxTier:3, fxColor:'#b46bff',
    effect:{ atkBonus:70, behavior:'triple_slash' }, sprite:'/sprites/marketplace/void_katana.png',
    desc:'+70 ATK. Three void-lit cuts land before the first is seen.' },
  // The ceiling. Nothing in NullState costs more than this.
  { id:'sunfire_bow', name:'Sunfire Longbow', type:'weapon', slot:'mainhand', price:8.0, fxTier:3, fxColor:'#ffcf3d',
    effect:{ atkBonus:80, behavior:'volley' }, sprite:'/sprites/marketplace/sunfire_bow.png',
    desc:'+80 ATK, ranged. Looses a fan of three sunfire arrows.' },
  // ── SKINS (outfit) — Phase 9 cosmetics ── PURE VISUALS, zero stats. Each is a
  // distinct LPC clothing/armour layer set (assets.js LPC_OUTFIT) drawn over the
  // body; `effect` MUST stay empty (the type forbids stats). The skin only
  // changes how the Knight LOOKS — the game is fully playable without any of
  // them (the FREE default outfit renders exactly as before when none is worn).
  // Icons in public/sprites/marketplace/<id>.png are composited from the SAME
  // LPC layers the skin renders, so the shop preview == what you wear.
  // Priced UNDER the weapons they visually rival: a skin grants nothing but a
  // look, so charging power-money for it is both poor value and off-message for
  // a game whose pitch is "no pay-to-win". Cheap cosmetics are also the
  // guilt-free second purchase for someone who already bought their weapon.
  // SKIN PRICES follow the owner's own ranking of them, because a cosmetic's
  // price IS its ranking — the dearest one is the one being called the best.
  //
  // THE LADDER IS NOW THREE RUNGS, NOT SIX. Voidweave $5, Emberguard $4,
  // Sungild $3, and then a FLAT $2 floor shared by Hazard Warden, Nullsteel and
  // Ashfall Scavenger. The owner's reason for levelling those three: they read
  // as the same quality as each other, and a price ladder that separates items
  // nobody perceives as different is just noise — it tells the player a story
  // about the art that the art does not tell them back.
  //
  // A shared floor is also better economics than a strict ordering here. At $2
  // the choice between the three is purely "which look do I want", which is the
  // question a cosmetic should be asking; at $5/$4/$1.50 it was "which one can
  // I justify", which is the question that ends in no purchase at all.
  //
  // ashen_warden was RETIRED here (generic grey fantasy plate, wrong game).
  // LEGACY_ITEM_IDS maps it to ashfall_scav so a wallet that bought it still
  // resolves to something wearable.
  { id:'sungild', name:'Sungild Regalia', type:'outfit', slot:'outfit', price:3.0, fxTier:3, skinTint:'#e0b23a',
    effect:{}, sprite:'/sprites/marketplace/sungild.png',
    desc:'Gilded champion regalia that catches every torchlight.' },
  { id:'emberguard', name:'Emberguard', type:'outfit', slot:'outfit', price:4.0, fxTier:3, skinTint:'#c85a1e',
    effect:{}, sprite:'/sprites/marketplace/emberguard.png',
    desc:'Ember-forged warden leathers with a warm coal glow.' },
  { id:'voidweave', name:'Voidweave', type:'outfit', slot:'outfit', price:5.0, fxTier:3, skinTint:'#6a24b0',
    effect:{}, sprite:'/sprites/marketplace/voidweave.png',
    desc:'A hooded violet weave that drinks the dark around you.' },
  { id:'hazard_warden', name:'Hazard Warden', type:'outfit', slot:'outfit', price:2.0, fxTier:3, skinTint:'#b6ff3d',
    effect:{}, sprite:'/sprites/marketplace/hazard_warden.png',
    desc:'Acid-green hazard gear, still humming from whatever it was built to survive.' },
  { id:'nullsteel', name:'Nullsteel', type:'outfit', slot:'outfit', price:2.0, fxTier:3, skinTint:'#2f6f8f',
    effect:{}, sprite:'/sprites/marketplace/nullsteel.png',
    desc:'Cold hooded plate, lit from within by a dead reactor.' },
  { id:'ashfall_scav', name:'Ashfall Scavenger', type:'outfit', slot:'outfit', price:2.0, fxTier:2, skinTint:'#7a6a4a',
    effect:{}, sprite:'/sprites/marketplace/ashfall_scav.png',
    desc:'Hooded cloth and worn leather. What you wear when there is no armoury left.' },
  // TASK #7 — EXCLUSIVE Season-Pass skin. NOT sold: hidden:true keeps it out of
  // the shop, passOnly:true means the engine only grants it (injects into
  // `owned`) to wallets holding an active pass. Pure cosmetic (OutfitItem =
  // zero stats). price:0 documents that it's free-with-pass, never charged.
  { id:'pass_warden', name:'NullState Warden', type:'outfit', slot:'outfit', price:0, hidden:true, passOnly:true, fxTier:3, skinTint:'#00ff88',
    effect:{}, sprite:'/sprites/marketplace/pass_warden.png',
    desc:'Acid-green warden regalia — the mark of a Season Pass holder.' },
]

// Attach the Phase 4 evolution ladder to every weapon (armor stays as-is).
// Keep this the single source of truth the upgrade route reads; the engine
// copy (public/game-engine/marketplace-items.js) mirrors the same rules.
export const MARKETPLACE_ITEMS: MarketplaceItem[] = BASE_MARKETPLACE_ITEMS.map(item =>
  item.type === 'weapon' ? { ...item, evolutionTiers: buildWeaponEvolution(item) } : item,
)

// Pre-v76 ids for weapons re-skinned in Task #7. Read-side alias so a wallet
// that bought the old item still resolves to its replacement; nothing writes
// these ids back. Items deleted outright (void_reaper, hunters_bow,
// ancient_aegis, warden_plate) have no replacement and are intentionally absent.
export const LEGACY_ITEM_IDS: Record<string, string> = {
  // Retired 2026-07 (owner: wrong vibe for the game). Mapped to the skin that
  // took its place at the same price, so a wallet that bought it keeps a skin
  // rather than an id that resolves to nothing.
  ashen_warden: 'ashfall_scav',
  voidcaller_scythe: 'sunfire_bow',
  ancient_warblade: 'void_katana',
  war_axe: 'argent_waraxe',
  twin_daggers: 'emberwood_maul',
}

export function resolveItemId(id: string): string {
  return LEGACY_ITEM_IDS[id] || id
}

export function getMarketplaceItem(id: string): MarketplaceItem | undefined {
  const rid = resolveItemId(id)
  return MARKETPLACE_ITEMS.find(i => i.id === rid)
}

export const ACCEPTED_TOKENS = Object.keys(MARKETPLACE_TOKENS) as MarketplaceTokenSymbol[]
export { MARKETPLACE_TOKENS, TREASURY_WALLET, tokenLabel, TOKEN_LOGOS }
export type { MarketplaceTokenSymbol }
