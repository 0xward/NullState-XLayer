/* ============================================================
   NULL_STATE :: PROPS  (breakable ancient decorations + loot)
   Drawn as vector pixel-art (no external sprites needed).
   (x,y) = base/feet position on the floor.
   Everything here is era-appropriate for a forgotten ancient
   ruin: clay vessels, burial urns, cracked columns, braziers,
   bone piles, cave crystals, engraved tablets, weathered idols.
   Smashing the right pieces can drop a rare 'relic' (handled by
   applyLoot in game.js and stored in the player's inventory).
   Decorations hug the nearest wall and FACE INTO THE ROOM:
     facing 'down'  = against the top wall    (6 o'clock, front view)
     facing 'up'    = against the bottom wall (12 o'clock, seen from behind)
     facing 'right' = against the left wall   (3 o'clock, side profile)
     facing 'left'  = against the right wall  (9 o'clock, side profile)
   ============================================================ */
const DECOR_TYPES = {
  // ---- what a loot entry means -------------------------------------------
  //   ['hp',   n, w]  heal n
  //   ['xp',   n, w]  n experience
  //   ['item', t, w]  one item from the library, rolled at TIER t (1-3)
  //   ['food', t, w]  one EDIBLE item (NS_MARKET.FOOD_RANGES). t is unused for
  //                   now — food has no rarity bias, see rollFoodDrop()
  //   ['relic'|'gshard'|'goldkey'|'paper', n, w]
  //   ['none',  0, w]  nothing
  //
  // OWNER: *"Lootingan food ko skrg kaya gaada ya?"* Two separate reasons, and
  // only one of them was a tuning problem:
  //
  //   1. applyLoot() in game.js had no `item` branch at all, so every item roll
  //      from a SMASHED prop (nine types) played the sound, logged "— loot!"
  //      and gave nothing. Food is the edible ~16% of the same item library, so
  //      a broken item path took food with it. Fixed there.
  //   2. Even working, food arrived only as a sixth of an item roll, and the
  //      props a player smashes most had no item roll at all. So the props that
  //      hold PROVISIONS — pails, barrels, crates, shelves, bedding, the herb
  //      pot — now drop food directly, at ~20-26%.
  //
  // Weight is taken from `none` first and `xp` second. The hp/relic/gshard
  // economies are deliberately untouched: this was meant to add food, not to
  // quietly make every prop richer.
  // ---- breakable decorations: smash them for loot ----
  vase:     { hp:1, w:24, h:38, label:'Glazed Vase',     loot:[['hp',6,50],['xp',12,32],['relic',1,4],['none',0,14]] },
  pot:      { hp:1, w:30, h:30, label:'Herb Pot',        loot:[['hp',8,50],['xp',10,22],['food',1,22],['none',0,6]] },
  barrel:   { hp:2, w:30, h:40, label:'Old Barrel',      loot:[['xp',18,45],['hp',10,35],['none',0,20]] },
  // Owner, again, and about the LOOTABLE crate this time (the earlier pass at
  // the same complaint only resized the ambient crate stacks at the bottom of
  // this table): the Supply Crate read as a shoebox next to 42x54 stacked
  // crates and a 46x56 barrel stack. Its art is procedural, not a sprite, so
  // its old 34x34 box was a hitbox that the drawing never followed — see
  // drawScale in Decor.draw(). 1.3x brings the drawn crate to ~44px, in line
  // with the scenery around it, and w/h below are the matching footprint so
  // the collision circle and contact shadow still fit what is on screen.
  crate:    { hp:2, w:44, h:44, drawScale:1.3, label:'Supply Crate', loot:[['xp',22,36],['hp',8,20],['item',1,20],['food',1,24]] },
  cabinet_s:{ hp:2, w:34, h:46, label:'Forgotten Archive', loot:[['hp',14,26],['xp',24,24],['item',2,30],['relic',1,10]], interactive:true, containerMaterial:'wood', northOnly:true }, // owner: cabinets/safes hug the NORTH wall only
  wardrobe: { hp:3, w:48, h:64, label:'Rotten Armoire',  loot:[['hp',32,24],['xp',55,24],['item',2,32]], interactive:true, containerMaterial:'wood_rotten', northOnly:true },
  // ---- ancient ornaments: break them for XP, CELO, or rare relics ----
  urn:      { hp:1, w:30, h:44, label:'Burial Urn',      loot:[['xp',20,40],['hp',10,28],['relic',1,12],['gshard',1,6],['none',0,20]] },
  column:   { hp:3, w:34, h:60, label:'Cracked Column',  loot:[['xp',26,50],['hp',12,26],['relic',1,8],['none',0,16]] },
  brazier:  { hp:2, w:30, h:40, label:'Bronze Brazier',  loot:[['xp',24,48],['hp',10,30],['none',0,12]] },
  bones:    { hp:1, w:36, h:18, label:'Bone Pile',       loot:[['xp',10,45],['hp',6,25],['relic',1,5],['none',0,25]] },
  rubble:   { hp:1, w:36, h:20, label:'Fallen Stones',   loot:[['xp',10,45],['hp',6,20],['none',0,35]] },
  crystal:  { hp:2, w:26, h:40, label:'Cave Crystal',    loot:[['relic',1,20],['item',2,20],['xp',30,20],['gshard',1,18],['none',0,15]] },
  tablet:   { hp:2, w:36, h:48, label:'Engraved Tablet', loot:[['relic',1,30],['item',3,25],['xp',40,25],['gshard',1,14]] },
  statue:   { hp:3, w:36, h:62, label:'Weathered Idol',  loot:[['relic',1,30],['item',3,30],['xp',50,20],['gshard',1,12]] },
  // ---- interactive containers: opened via interact/OPEN button, not combat ----
  chest:    { hp:2, w:42, h:34, label:'Lost Cache',      loot:[['relic',1,15],['item',3,35],['xp',60,15],['hp',30,10]], interactive:true, containerMaterial:'iron', northOnly:true },
  // ---- v75 sprite decor (user-supplied 4-direction art, /sprites/decor2) ----
  safe:     { hp:2, w:40, h:44, label:'Rusted Strongbox', loot:[['relic',1,18],['item',3,32],['xp',55,18],['hp',26,12]], interactive:true, containerMaterial:'iron', northOnly:true },
  table_w:  { hp:1, w:36, h:30, label:'Wooden Table',     loot:[['xp',14,40],['hp',8,22],['food',1,20],['none',0,18]] },
  bench:    { hp:2, w:52, h:26, label:'Waiting Bench',    loot:[['xp',16,45],['hp',8,25],['none',0,30]], northOnly:true },
  // ---- v80 LPC sprite props (18 new PNGs in /sprites/decor2, cut from the
  // Liberated Pixel Cup contest tilesets — Sharm, Janna, Skyler R. Collady,
  // Lanea Zimmerman et al., CC-BY-SA 3.0 / GPL 3.0, see decor2/CREDITS.md).
  // Owner request: maps felt empty — more breakable & lootable dressing.
  // ---- breakables ----
  oak_barrel:   { hp:2, w:30, h:40, label:'Oak Barrel',      loot:[['xp',16,34],['hp',10,28],['item',1,8],['food',1,24],['none',0,6]] },
  barrel_stack: { hp:3, w:46, h:56, label:'Barrel Stack',    loot:[['xp',26,34],['hp',14,24],['item',1,14],['food',2,24],['none',0,4]] },
  bucket:       { hp:1, w:22, h:24, label:'Wooden Pail',     loot:[['hp',6,44],['xp',8,22],['food',1,20],['none',0,14]] },
  bucket_water: { hp:1, w:22, h:24, label:'Water Pail',      loot:[['hp',12,52],['xp',6,14],['food',1,26],['none',0,8]] },
  boulder:      { hp:2, w:32, h:30, label:'Fallen Boulder',  loot:[['xp',14,45],['hp',6,20],['relic',1,4],['gshard',1,7],['none',0,31]] },
  hay_pile:     { hp:1, w:44, h:50, label:'Straw Bedding',   loot:[['hp',8,36],['xp',10,22],['item',1,8],['food',1,26],['none',0,8]] },
  chalice:      { hp:1, w:26, h:40, label:'Ritual Chalice',  loot:[['relic',1,16],['xp',24,38],['hp',10,22],['gshard',1,10],['none',0,24]] },
  basin:        { hp:1, w:30, h:26, label:'Wash Basin',      loot:[['hp',10,46],['xp',10,20],['food',1,20],['none',0,14]] },
  // Owner: this one read as a framed photograph on the wall — "delete it,
  // put another lootable thing there instead". Same call they made about
  // plaque_coin, and for the same reason: a picture frame is not something a
  // player expects to smash for XP, and two of them hanging in a bunker made
  // the place look like somebody's hallway.
  //
  // It is a spilled heap of coins on the floor now — cut from the same
  // top-down sheet the ambient props came from, so it is art the repo
  // already owned. Nothing else in the pool is loose gold, so it reads as
  // "loot" at a glance without a label, which is the whole job.
  //
  // The key stays `plaque_sword` on purpose: a floor saved before this
  // change still names it, and renaming would break loading that floor.
  // northOnly is gone with the plaque — this art is flat and top-down, so
  // unlike the wall-hung frame it looks right against any wall.
  // Sized to the flat-pile family it now belongs to (bones 36x18, skull_heap
  // 32x16) rather than to its own 22x17 source pixels — drawn at source size
  // it was the smallest thing on the floor and read as a scuff mark.
  plaque_sword: { hp:1, w:32, h:25, label:'Spilled Coins',   loot:[['xp',24,40],['gshard',1,18],['item',1,16],['hp',8,10],['none',0,16]] },
  // Owner: this one read as a framed photograph hanging on the wall, which
  // is a strange thing to smash for XP. It is now the open gold chest cut
  // from the same sheet as the ambient props — an actual container, opened
  // with the OPEN button rather than hit, so what it looks like and what it
  // does finally agree. Renamed to match; the key stays `plaque_coin` so no
  // saved floor built before this change breaks on load.
  plaque_coin:  { hp:2, w:29, h:22, label:'Gold Chest', loot:[['relic',1,16],['item',3,34],['xp',55,20],['hp',24,14],['gshard',1,16]], interactive:true, containerMaterial:'iron', northOnly:true },
  skull_heap:   { hp:1, w:32, h:16, label:'Skull Heap',      loot:[['xp',12,44],['relic',1,7],['hp',6,20],['gshard',1,8],['none',0,29]] },
  cot:          { hp:2, w:26, h:56, label:'Rotten Cot',      loot:[['hp',12,32],['xp',14,26],['item',1,12],['food',1,18],['none',0,12]], northOnly:true },
  // ---- interactive containers (opened via OPEN button, like cabinet_s) ----
  footlocker:     { hp:2, w:34, h:30, label:'Iron Footlocker', loot:[['item',2,32],['xp',30,26],['hp',16,20],['relic',1,10]], interactive:true, containerMaterial:'iron', northOnly:true }, // boxy, front-view-only art: keep on the top wall so it never faces the wrong way on a side wall (owner: "lemari di W/E menghadap S/N")
  shelf_stocked:  { hp:2, w:52, h:52, label:'Stocked Shelf',   loot:[['item',1,30],['food',2,24],['hp',14,20],['xp',22,20],['relic',1,6]], interactive:true, containerMaterial:'wood', northOnly:true },
  dresser:        { hp:2, w:48, h:40, label:'Old Dresser',     loot:[['item',1,30],['xp',20,28],['hp',12,26],['relic',1,6]], interactive:true, containerMaterial:'wood', northOnly:true },
  cabinet_ornate: { hp:2, w:46, h:52, label:'Ornate Cabinet',  loot:[['item',2,30],['xp',26,26],['hp',14,22],['relic',1,10]], interactive:true, containerMaterial:'wood', northOnly:true },
  // ---- Bunker 5 "THE LAST LIGHT" weekly Vault door (Phase 5.5 #9C/#10) ----
  // Not a loot container — loot:[] means open() always yields zero slots.
  // isVaultDoor flags it for game.js's onOpenButtonTap()/updateActionButton()
  // to route into the code-submit overlay instead of the normal dual-panel
  // loot window. Spawns once, only in campaignActIndex===4, placed when
  // that floor loads (ensureFloor() in game.js, v65 T6) — but only actually
  // OPENABLE once the act's boss (floor 5) is defeated, via the normal
  // isRoomClear() gate in updateActionButton(). See placeVaultDoorSpot()
  // in game.js for the wall-snap placement logic.
  // containerMaterial is set anyway for consistency even though the vault
  // door never actually opens #containerWindow (see isVaultDoor routing).
  vault_door: { hp:1, w:50, h:74, label:'Sealed Vault Door', loot:[], interactive:true, isVaultDoor:true, containerMaterial:'vault' },

  // ---- AMBIENT DRESSING (owner request) ---------------------------------
  // Pure decoration. Cannot be broken, cannot be opened, drops nothing, and
  // never shows an OPEN prompt — a room's furniture, not its contents.
  //
  // Everything else in this file is loot wearing a costume, which is why the
  // bunkers read as a shop rather than a place: every object in frame is a
  // thing the player is meant to consume. These are the objects that are just
  // there. That is the entire point of them, so `ambient:true` is checked in
  // Decor.hit(), in the melee sweep and in the interact scan — three places,
  // because one missed guard turns a wall of scenery into a free XP farm.
  //
  // Art cut (crop + alpha-trim only, no repainting) from the top-down object
  // sheet already in the repo at /sprites/tiles2/topdown_objects.png, which
  // until now nothing ever loaded. Owner picked the pieces; stairs, ladders,
  // keys, the window frame and the weapon rack were rejected.
  //
  // northOnly on every one of them: this art has a single front view, so it
  // only reads correctly against the top wall. There is no S/E/W variant to
  // fall back to, unlike the tables and benches.
  // Owner: "the crates are too small". They were drawn at their source pixel
  // size (28x36 / 25x30) while every hand-sized prop around them — the barrel
  // stack at 46x56, the wardrobe at 48x64 — was scaled up to read as
  // furniture. Sized to the barrel stack now. Heights drive the draw (see
  // Decor.draw: dh = def.h, dw follows the sprite's own aspect), and the
  // widths below are that aspect worked back out, so the collision footprint
  // still matches what is on screen.
  amb_crate_stack_a: { hp:0, w:42, h:54, label:'Stacked Crates', loot:[], ambient:true, northOnly:true, corner:true },
  amb_crate_stack_b: { hp:0, w:38, h:46, label:'Stacked Crates', loot:[], ambient:true, northOnly:true, corner:true },
  amb_barrel_a:      { hp:0, w:29, h:32, label:'Sealed Barrels', loot:[], ambient:true, northOnly:true },
  amb_barrel_b:      { hp:0, w:27, h:30, label:'Sealed Barrels', loot:[], ambient:true, northOnly:true },
  amb_barrel_c:      { hp:0, w:22, h:29, label:'Sealed Barrel',  loot:[], ambient:true, northOnly:true },
  amb_urn_a:         { hp:0, w:16, h:24, label:'Clay Urns',      loot:[], ambient:true, northOnly:true },
  amb_urn_b:         { hp:0, w:14, h:19, label:'Clay Urn',       loot:[], ambient:true, northOnly:true },
  amb_urn_c:         { hp:0, w:21, h:24, label:'Clay Urns',      loot:[], ambient:true, northOnly:true },
  amb_urn_d:         { hp:0, w:14, h:19, label:'Clay Urn',       loot:[], ambient:true, northOnly:true },
  amb_urn_e:         { hp:0, w:14, h:19, label:'Clay Urn',       loot:[], ambient:true, northOnly:true },
  amb_urn_f:         { hp:0, w:11, h:16, label:'Small Urn',      loot:[], ambient:true, northOnly:true },
  amb_urn_g:         { hp:0, w:11, h:16, label:'Small Urn',      loot:[], ambient:true, northOnly:true },
  amb_urn_h:         { hp:0, w:9,  h:12, label:'Small Urn',      loot:[], ambient:true, northOnly:true },
  amb_urn_i:         { hp:0, w:9,  h:12, label:'Small Urn',      loot:[], ambient:true, northOnly:true },

  // ---- Phase 8: sealed caches gated by a weapon-evolution traversal utility.
  // interactive (immune to combat swings) + loot:[] so open() rolls no window
  // slots — game.js grants a direct Glitch-Shard haul instead, and only when
  // the player's equipped weapon has unlocked the matching utility. Art is
  // reused from existing sprite sets (see DECOR_TYPE_TO_SET) so no new PNGs. ----
  cache_grapple: { hp:1, w:40, h:44, label:'Chasm Cache', loot:[], interactive:true, isSealedCache:true, sealedUtility:'grapple', containerMaterial:'iron' },
  cache_melt:    { hp:1, w:34, h:36, label:'Frozen Cache', loot:[], interactive:true, isSealedCache:true, sealedUtility:'melt_wall', containerMaterial:'iron' },
  // ---- Phase 8: Premium Sector reward cache — guaranteed once per owned act
  // run (Firebase blueprint ownership), needs NO utility (you paid for it),
  // loot is a rich Glitch-Shard haul. Same direct-grant path as sealed caches. ----
  premium_cache: { hp:1, w:46, h:52, label:'Premium Sector Cache', loot:[], interactive:true, isPremiumCache:true, containerMaterial:'iron' },
};

/* ---- v75: PNG sprite decor (extracted from user-supplied sheets) ----
   Each set maps game `facing` to a direction image:
     facing 'down'  (against N wall, front view)  -> *_n.png
     facing 'up'    (against S wall, back view)   -> *_s.png (pre-cut: only
                    the top edge of the object peeks past the bottom wall)
     facing 'left'  (against E wall)              -> *_e.png
     facing 'right' (against W wall)              -> *_w.png
   cabinet set is shared by cabinet_s + wardrobe (same art, different draw
   size); cabinet_broken.png is the universal opened/looted state for both.
   bench only has a front view (source art: other directions rejected by
   user) — spawn code only ever places it against the top wall. */
const DECOR_SPRITE_SETS = {
  cabinet: { n:'cabinet_n', e:'cabinet_e', s:'cabinet_s', w:'cabinet_w', broken:'cabinet_broken' },
  safe:    { n:'safe_n',    e:'safe_e',    s:'safe_s',    w:'safe_w' },
  table_w: { n:'table_n',   e:'table_e',   s:'table_s',   w:'table_w' },
  bench:   { n:'bench_n' },
  // v80 LPC props — single front view each (the draw path falls back to `n`
  // for any missing direction, and the cylindrical ones read fine from every
  // wall; boxy front-view-only types carry northOnly in DECOR_TYPES so the
  // spawner keeps them on the top wall). footlocker/shelf get a real
  // opened/looted state image via `broken`, same mechanism as the cabinet.
  oak_barrel:     { n:'oak_barrel' },
  barrel_stack:   { n:'barrel_stack' },
  bucket:         { n:'bucket' },
  bucket_water:   { n:'bucket_water' },
  boulder:        { n:'boulder' },
  hay_pile:       { n:'hay_pile' },
  chalice:        { n:'chalice' },
  basin:          { n:'basin' },
  plaque_sword:   { n:'coin_pile' },   // see DECOR_TYPES: the frame became a coin heap
  plaque_coin:    { n:'amb_chest_gold' },
  skull_heap:     { n:'skull_heap' },
  cot:            { n:'cot' },
  footlocker:     { n:'footlocker', broken:'footlocker_open' },
  shelf_stocked:  { n:'shelf_stocked', broken:'shelf_empty' },
  dresser:        { n:'dresser' },
  cabinet_ornate: { n:'cabinet_ornate' },
  // Ambient dressing — one front view each, hence northOnly in DECOR_TYPES.
  amb_crate_stack_a: { n:'amb_crate_stack_a' },
  amb_crate_stack_b: { n:'amb_crate_stack_b' },
  amb_barrel_a:      { n:'amb_barrel_a' },
  amb_barrel_b:      { n:'amb_barrel_b' },
  amb_barrel_c:      { n:'amb_barrel_c' },
  amb_urn_a:         { n:'amb_urn_a' },
  amb_urn_b:         { n:'amb_urn_b' },
  amb_urn_c:         { n:'amb_urn_c' },
  amb_urn_d:         { n:'amb_urn_d' },
  amb_urn_e:         { n:'amb_urn_e' },
  amb_urn_f:         { n:'amb_urn_f' },
  amb_urn_g:         { n:'amb_urn_g' },
  amb_urn_h:         { n:'amb_urn_h' },
  amb_urn_i:         { n:'amb_urn_i' },
};
const DECOR_TYPE_TO_SET = { cabinet_s:'cabinet', wardrobe:'cabinet', safe:'safe', table_w:'table_w', bench:'bench',
  oak_barrel:'oak_barrel', barrel_stack:'barrel_stack', bucket:'bucket', bucket_water:'bucket_water',
  boulder:'boulder', hay_pile:'hay_pile', chalice:'chalice', basin:'basin',
  plaque_sword:'plaque_sword', plaque_coin:'plaque_coin', skull_heap:'skull_heap', cot:'cot',
  footlocker:'footlocker', shelf_stocked:'shelf_stocked', dresser:'dresser', cabinet_ornate:'cabinet_ornate',
  amb_crate_stack_a:'amb_crate_stack_a', amb_crate_stack_b:'amb_crate_stack_b', amb_barrel_a:'amb_barrel_a', amb_barrel_b:'amb_barrel_b', amb_barrel_c:'amb_barrel_c', amb_urn_a:'amb_urn_a', amb_urn_b:'amb_urn_b', amb_urn_c:'amb_urn_c', amb_urn_d:'amb_urn_d', amb_urn_e:'amb_urn_e', amb_urn_f:'amb_urn_f', amb_urn_g:'amb_urn_g', amb_urn_h:'amb_urn_h', amb_urn_i:'amb_urn_i',
  // Phase 8 caches reuse existing container art (no new PNGs needed).
  cache_grapple:'safe', cache_melt:'footlocker', premium_cache:'cabinet' };
const _decorImgs = {};
function _decorImg(name){
  if(!name) return null;
  let rec=_decorImgs[name];
  if(!rec){
    const img=new Image();
    img.src='/sprites/decor2/'+name+'.png';
    rec=_decorImgs[name]={img, ok:false};
    img.onload=()=>{ rec.ok=true; };
  }
  return rec.ok ? rec.img : null;
}
const FACING_TO_DIR = { down:'n', up:'s', left:'e', right:'w' };
// alpha-masked overlay cache: silhouette of the sprite filled with a flat
// color (white for hit flash, dark tints for facing light). Keyed by
// name+color so each variant is built once.
const _maskCache = {};
function _maskSprite(name,color){
  const img=_decorImg(name); if(!img) return null;
  const key=name+'|'+color;
  let c=_maskCache[key];
  if(!c){
    c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
    const cx=c.getContext('2d');
    cx.drawImage(img,0,0);
    cx.globalCompositeOperation='source-in';
    cx.fillStyle=color; cx.fillRect(0,0,c.width,c.height);
    _maskCache[key]=c;
  }
  return c;
}

function rollLoot(table){
  const total=table.reduce((s,t)=>s+t[2],0);
  let r=Math.random()*total;
  for(const t of table){ r-=t[2]; if(r<=0) return {kind:t[0],amt:t[1]}; }
  return {kind:'none',amt:0};
}

class Decor {
  constructor(type, x, y, facing='down'){
    const def=DECOR_TYPES[type];
    this.type=type; this.def=def; this.x=x; this.y=y;
    this.facing=facing;                 // 'down' | 'up' | 'left' | 'right'
    this.maxHp=def.hp; this.hp=def.hp;
    this.r=def.w*0.55; this.h=def.h;
    this.broken=false; this.brokenT=0; this.hitFlash=0; this.shake=0;
    this.bob=Math.random()*Math.PI*2;
    // Interactive containers (chests): opened via interact key, not combat.
    this.interactive=!!def.interactive;
    // Ambient dressing: scenery. Not breakable, not openable, drops nothing.
    this.ambient=!!def.ambient;
    this.opened=false; this.openT=0;
  }
  hit(dmg){
    if(this.broken) return false;
    // Scenery absorbs nothing and yields nothing — a swing passes through it
    // as if it were part of the wall, which is what it is.
    if(this.ambient) return false;
    // Interactive containers cannot be damaged by combat swings.
    if(this.interactive) return false;
    this.hp-=1; this.hitFlash=0.16; this.shake=4;
    if(this.hp<=0){ this.broken=true; this.brokenT=0.45; return true; }
    return false;
  }
  // Open an interactive container (called from tryInteract / OPEN button).
  // Returns true if this interaction consumed the container (first open).
  open(){
    if(!this.interactive || this.opened) return false;
    this.opened=true; this.openT=0.6;
    this.rollLootSlots();
    return true;
  }
  // Generate (once) 2-4 loot slots for the dual-panel container window.
  // Each slot resolves 'item' draws into a concrete NS_ITEMS entry so the
  // window can show a real name/icon/rarity/burn-value preview immediately,
  // while non-item draws (hp/xp/celo/relic) stay as simple amount pickups.
  //
  // Golden Key: previously its own standalone floor pickup (one per match,
  // drawn/walked-over directly on the tile grid) — that code path lived
  // outside the render loop's per-entity try/catch and could silently
  // abort the whole frame's draw call if it ever threw, which is why the
  // player sprite could vanish while standing in the key's room. It's now
  // just another rare loot slot found INSIDE a container, exactly like any
  // other item, capped at 1 per wallet per week (Phase 5.5 #9A — server-
  // enforced, see window.NS_GOLDKEY.remaining()/take() in game.js) rather
  // than a flat per-run count, via window.NS_GOLDKEY (bridged from game.js
  // since Decor has no direct access to G). Only the two "vault-like"
  // interactive containers (Rotten Armoire / Lost Cache) can roll one —
  // never the common crates/cabinets. If the weekly allowance is already
  // used up, remaining() just returns 0 and this container simply keeps
  // its normal 2-4 base loot slots — no placeholder, no replacement slot
  // needed.
  rollLootSlots(){
    if(this.lootSlots) return this.lootSlots;
    const table=this.def.loot||[];
    const n=2+Math.floor(Math.random()*3); // 2-4 slots
    const slots=[];
    for(let i=0;i<n;i++){
      const draw=rollLoot(table);
      if(draw.kind==='none') continue;
      if(draw.kind==='item'){
        const tier=draw.amt||1;
        const it=(window.NS_ITEMS && window.NS_ITEMS.rollItemDrop(tier))||null;
        if(!it) continue;
        const qty=(it.rarity==='common'||it.rarity==='uncommon')?(1+Math.floor(Math.random()*3)):1;
        slots.push({slotId:'s'+i, kind:'item', item:it, qty, taken:false});
      } else {
        slots.push({slotId:'s'+i, kind:draw.kind, amt:draw.amt, taken:false});
      }
    }
    // Vault-like containers that can roll a Golden Key / Paper. This must
    // track the full "rare" interactive-container pool in game.js
    // spawnDecorInto — when that pool was widened (v80) from
    // [wardrobe, chest, safe] to 7 types but this stayed at just
    // wardrobe/chest, effective discovery of Paper/Golden Key fell ~3.5x
    // and owners reported Paper had "gone missing". The weekly server gate
    // (NS_PAPER/NS_GOLDKEY, 1 per wallet per week) still hard-caps the
    // actual grant, so widening eligibility only helps the player FIND
    // that one drop sooner — it can never over-grant.
    const VAULT_CONTAINERS = ['wardrobe','chest','safe','footlocker','dresser','cabinet_ornate','shelf_stocked'];
    // Owner (hard rule): Old Paper / Golden Key must NEVER land inside an
    // evolution-locked container ("jangan sampe ada di Berangkas yg di kunci
    // dan butuh evolution weapon"). Sealed/premium caches (cache_grapple,
    // cache_melt, premium_cache) already live under their own decor types and
    // route through grantCacheLoot() — they never even call rollLootSlots for
    // a container window — but guard explicitly so a future edit that adds a
    // cache type to VAULT_CONTAINERS can't silently strand the weekly Paper
    // behind a Grapple/Wall-Melt gate.
    const isVaultContainer = VAULT_CONTAINERS.includes(this.type)
      && !this.def.isSealedCache && !this.def.isPremiumCache && !this.def.isVaultDoor;
    if(isVaultContainer && window.NS_GOLDKEY && window.NS_GOLDKEY.remaining()>0 && Math.random()<0.16){
      if(window.NS_GOLDKEY.take()){
        slots.push({slotId:'s'+n, kind:'goldkey', amt:1, taken:false});
      }
    }
    // Paper (Phase 5.5 #9B) — same containers/pattern as Golden Key above,
    // an independent roll (a single container could in theory yield both
    // in the same visit). Drop rate 16%, matching Golden Key — CONFIRMED
    // final by user in v25, locked in.
    if(isVaultContainer && window.NS_PAPER && window.NS_PAPER.remaining()>0 && Math.random()<0.16){
      if(window.NS_PAPER.take()){
        slots.push({slotId:'s'+(n+1), kind:'paper', amt:1, taken:false});
      }
    }
    this.lootSlots=slots;
    return slots;
  }
  update(dt){
    if(this.hitFlash>0) this.hitFlash-=dt;
    if(this.shake>0) this.shake=Math.max(0,this.shake-dt*22);
    if(this.broken) this.brokenT-=dt;
    if(this.openT>0) this.openT-=dt;
    this.bob+=dt;
  }
  rect(ctx,x,y,w,h,col){ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  draw(ctx){
    if(this.broken && this.brokenT<=0) return;
    // Opened interactive containers fade to a dim "opened" look, then persist.
    const isOpened = this.interactive && this.opened;
    const a = this.broken ? Math.max(0,this.brokenT/0.45)
            : isOpened ? Math.max(0.5, 1 - (1 - Math.max(0, this.openT/0.6)) * 0.5)
            : 1;
    const sx=this.shake>0?(Math.random()*2-1)*this.shake:0;
    const f=this.facing||'down';
    const side = (f==='left'||f==='right');

    // ---- v75: sprite path — if this type has PNG art and it's decoded,
    // draw the direction image instead of the procedural shape. Falls back
    // to the vector art until the image loads (or if it 404s), so nothing
    // ever renders blank. ----
    const setKey=DECOR_TYPE_TO_SET[this.type];
    if(setKey){
      const set=DECOR_SPRITE_SETS[setKey];
      const isOpenedS=this.interactive&&this.opened;
      let name=set[FACING_TO_DIR[f]]||set.n;
      if((this.broken||isOpenedS)&&set.broken) name=set.broken;
      const img=_decorImg(name);
      if(img){
        const cut=(f==='up'&&!((this.broken||isOpenedS)&&set.broken));
        // scale by def height; the pre-cut back view is drawn shorter on
        // purpose (only the top edge shows past the bottom wall)
        const dh=cut? this.h*0.55 : this.h;
        const dw=dh*(img.width/img.height);
        // contact shadow (skip for the cut back view — it sits IN the wall)
        if(!cut){
          ctx.save();
          // Owner: "the props look like they're hovering — the shadow is too
          // far away to read as touching the floor."
          //
          // It was: centre y+2, half-height 5.5, half-width dw*0.52. The
          // sprite's own bottom edge is at exactly this.y, so that ellipse ran
          // from 3px above the base to 7px BELOW it and stuck out past both
          // sides — a puddle sitting on the floor with the object above it,
          // not a contact shadow. Most of these sprites also carry their own
          // painted shading, so it read as two shadows.
          //
          // Now it sits under the base and barely clears it: centre y-2,
          // half-height 2.8, half-width dw*0.38, and a touch lighter. What the
          // player sees is a thin dark sliver either side of where the object
          // meets the ground, which is what "standing on it" looks like.
          ctx.globalAlpha=0.30*a; ctx.fillStyle='#000';
          ctx.beginPath(); ctx.ellipse(this.x, this.y-2, dw*0.38, 2.8, 0, 0, 7); ctx.fill();
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha=a;
        ctx.imageSmoothingEnabled=false;
        const dx=this.x-dw/2+sx, dy=this.y-dh;
        ctx.drawImage(img,dx,dy,dw,dh);
        // facing-aware light blend: draw a dark silhouette of the sprite
        // (alpha-masked, cached) over it — never touches the floor pixels
        // around the prop, unlike a naive multiply fillRect would.
        let tint=null;
        if(f==='up') tint=['#22302e',0.30];
        else if(side) tint=['#2a3733',0.20];
        else tint=['#33403b',0.10];
        const tn=_maskSprite(name,tint[0]);
        if(tn){ ctx.globalAlpha=tint[1]*a; ctx.drawImage(tn,dx,dy,dw,dh); ctx.globalAlpha=a; }
        if(this.hitFlash>0){
          const fl=_maskSprite(name,'#ffffff');
          if(fl){ ctx.globalAlpha=this.hitFlash*2.2; ctx.drawImage(fl,dx,dy,dw,dh); }
        }
        ctx.restore();
        return;
      }
    }

    // ---- contact shadow: anchors the prop to the floor/wall so it doesn't float ----
    ctx.save();
    ctx.globalAlpha=0.30*a; ctx.fillStyle='#000';
    // Same correction as the sprite path above: the ellipse used to sit BELOW
    // the base (y+1..y+3, half-height 5.5) and reach out to r*1.12, wider than
    // the prop itself. Tucked under the base and tightened. The small
    // directional nudge stays — it leans away from the wall the prop hugs,
    // which is where the light in these rooms comes from — but at 2px it no
    // longer detaches the shadow from the object.
    let shx=this.x, shy=this.y-2;
    if(f==='down') shy=this.y-2;
    else if(f==='up') shy=this.y-1;
    else if(f==='right') shx=this.x+2;
    else if(f==='left')  shx=this.x-2;
    ctx.beginPath(); ctx.ellipse(shx, shy, this.r*0.78, 2.8, 0, 0, 7); ctx.fill();
    ctx.restore();

    // ---- body ----
    ctx.save();
    ctx.globalAlpha=a;
    ctx.translate(this.x+sx, this.y);
    ctx.imageSmoothingEnabled=false;

    // Orientation (v67 T13, Q2=A): side walls no longer squish the front
    // view to 0.82 — that read as a flattened/pancaked prop. Cylindrical
    // props keep their full silhouette from every angle (correct for
    // rotationally-symmetric objects) and boxy props now draw a REAL side
    // profile in shape() below. The mirror flip stays so one drawn side
    // profile serves both walls.
    if(side){
      const dir = (f==='right') ? 1 : -1;   // left wall faces right(+), right wall faces left(-)
      ctx.scale(dir, 1);
    }

    // Optional per-type art scale. The sprite path above sizes itself from
    // def.h, but the procedural props below are drawn at hardcoded pixel
    // coordinates, so changing def.w/def.h alone only moves the HITBOX — the
    // shape on screen stays exactly as large as it was written. This is why
    // the Supply Crate stayed visibly smaller than the scenery crates beside
    // it (see the note on `crate` in DECOR_TYPES). Scaling here covers
    // shape(), the tint mask and the hit flash in one go, since all three
    // draw inside this same transform.
    const ds = this.def && this.def.drawScale;
    if(ds && ds !== 1) ctx.scale(ds, ds);

    // Blend with the dark dungeon + convey facing through lighting.
    // A 'multiply' tint overlay gets a visually close darken/desaturate
    // look at a fraction of the render cost of ctx.filter.
    let tint = null; // [color, alpha] or null for no tint
    if(f==='up')        tint = ['#3a4a48', 0.42];   // back, in wall shadow
    else if(side)       tint = ['#4a5a55', 0.26];   // turned, partly shaded
    else                tint = ['#5a6a62', 0.12];   // facing camera, slight blend
    this.shape(ctx, f);
    if(tint){
      ctx.save();
      ctx.globalCompositeOperation='multiply';
      ctx.globalAlpha=tint[1]*a;
      ctx.fillStyle=tint[0];
      this.shapeMask(ctx);
      ctx.restore();
    }

    // hit flash overlay (silhouette)
    if(this.hitFlash>0){
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=this.hitFlash*2.2;
      ctx.fillStyle='#fff';
      this.shapeMask(ctx);
      ctx.globalCompositeOperation='source-over';
    }
    ctx.restore();
  }
  // colored body. `facing` controls whether front-only details are shown:
  // when seen from behind (facing 'up') the handles / engravings / highlights are hidden.
  shape(ctx, facing='down'){
    const t=this.type, R=this.rect.bind(this,ctx);
    // v67 T13 (Q2=A): 4 arah proper. `front` = benar-benar menghadap kamera
    // (dulu: semua kecuali 'up', jadi side view ikut menampilkan detail
    // depan — salah). `side` memicu profil samping khusus untuk prop kotak
    // di bawah; prop silindris cukup silhouette penuh + tint lighting.
    const side  = facing==='left' || facing==='right';
    const front = facing==='down';
    // ---- REAL SIDE PROFILES for boxy props (drawn facing +x, the mirror
    // flip in draw() handles the left wall). Loot/hp/hitbox untouched. ----
    if(side){
      if(t==='crate'){
        R(-11,-34,22,34,'#6e4c2a');                              // narrow depth face
        ctx.strokeStyle='#4d3318'; ctx.lineWidth=2; ctx.strokeRect(-10,-33,20,32);
        R(-10,-19,20,3,'#4d3318');                               // mid plank seam
        R(7,-33,3,32,'#835c34');                                 // room-lit edge
        return;
      }
      if(t==='cabinet_s'){
        R(-9,-46,18,46,'#523522'); R(-9,-46,18,3,'#6a462a');     // slim depth panel
        R(-7,-43,14,40,'#61402a');
        R(-7,-24,14,2,'#3a2514');                                // shelf line
        R(5,-43,2,40,'#7a5232');                                 // lit front edge
        return;
      }
      if(t==='wardrobe'){
        R(-13,-64,26,64,'#42291a'); R(-13,-64,26,4,'#5e3d26');   // deep side panel
        R(-11,-60,22,56,'#523421');
        ctx.strokeStyle='#2e1d10'; ctx.lineWidth=2; ctx.strokeRect(-11,-60,22,56);
        R(-11,-34,22,2,'#2e1d10');                               // panel seam
        R(9,-60,2,56,'#6a462a');                                 // lit front edge
        R(-11,-6,22,6,'#31200f');                                // base
        return;
      }
      if(t==='chest'){
        if(this.opened){
          R(-11,-18,22,18,'#61402a'); R(-9,-16,18,14,'#3a2514'); // side of open base
          R(-11,-20,22,4,'#caa15a');                             // trim band
        } else {
          R(-11,-18,22,18,'#61402a');                            // narrow base
          ctx.beginPath(); ctx.fillStyle='#75512e';              // curved lid, side arc
          ctx.moveTo(-11,-18); ctx.quadraticCurveTo(0,-32,11,-18);
          ctx.lineTo(11,-18); ctx.lineTo(-11,-18); ctx.fill();
          R(-11,-20,22,4,'#caa15a');                             // trim band
          R(7,-18,4,18,'#caa15a');                               // strap on room side
        }
        return;
      }
      if(t==='tablet'){
        R(-9,-6,18,6,'#57523f');                                 // plinth (narrow)
        R(-4,-44,8,38,'#736d5e'); R(-4,-44,8,4,'#8f897a');       // thin slab EDGE
        R(2,-40,2,34,'#8a8474');                                 // lit edge facing room
        return;
      }
      // cylindrical / scatter props: fall through to the normal drawing —
      // full silhouette is already correct from the side, tint does the rest.
    }
    if(t==='vase'){
      R(-12,-30,24,8,'#1f6f63'); R(-9,-32,18,4,'#2a8f7e');     // neck
      R(-14,-24,28,20,'#1b5f56'); R(-10,-24,20,20,'#247a6d');  // body
      R(-10,-6,20,6,'#143f3a');
      if(front) R(-4,-22,4,16,'#39a892');                      // front highlight
    } else if(t==='pot'){
      R(-15,-12,30,12,'#7a4a2a'); R(-15,-12,30,3,'#945e3a');
      R(-3,-30,6,18,'#2f7d3a'); R(-12,-24,12,5,'#3c9a49');     // leaves (visible all sides)
      R(2,-26,12,5,'#3c9a49'); R(-10,-20,9,4,'#48b557');
    } else if(t==='barrel'){
      R(-15,-40,30,40,'#6b4326');
      R(-15,-34,30,4,'#3f2916'); R(-15,-16,30,4,'#3f2916');    // hoops (symmetric)
      R(-15,-40,4,40,'#7d5230'); R(11,-40,4,40,'#52341d');     // shading
    } else if(t==='crate'){
      R(-17,-34,34,34,'#7a5630');
      ctx.strokeStyle='#4d3318'; ctx.lineWidth=2; ctx.strokeRect(-16,-33,32,32);
      if(front){ ctx.beginPath(); ctx.moveTo(-16,-33); ctx.lineTo(16,-1); ctx.moveTo(16,-33); ctx.lineTo(-16,-1); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(-16,-17); ctx.lineTo(16,-17); ctx.stroke(); } // plain back plank
    } else if(t==='cabinet_s'){
      R(-17,-46,34,46,'#5a3a22'); R(-17,-46,34,3,'#744c2c');
      R(-15,-43,28,40,'#6e472a');
      if(front){
        ctx.strokeStyle='#3a2514'; ctx.lineWidth=1.5;
        ctx.strokeRect(-15,-43,14,40); ctx.strokeRect(1,-43,14,40);  // doors
        R(-3,-26,2,5,'#caa15a'); R(3,-26,2,5,'#caa15a');             // knobs
        R(-13,-40,10,3,'#d9cba8'); R(3,-38,9,3,'#d9cba8');           // rolled scrolls peeking out
      } else {
        ctx.strokeStyle='#3a2514'; ctx.lineWidth=1.5; ctx.strokeRect(-15,-43,30,40); // plain back
      }
    } else if(t==='wardrobe'){
      R(-24,-64,48,64,'#4a2f1c'); R(-24,-64,48,4,'#6b452a');
      R(-21,-60,42,56,'#5d3b23');
      if(front){
        ctx.strokeStyle='#2e1d10'; ctx.lineWidth=2;
        ctx.strokeRect(-21,-60,21,56); ctx.strokeRect(0,-60,21,56);  // doors
        R(-4,-36,3,8,'#caa15a'); R(2,-36,3,8,'#caa15a');             // handles
      } else {
        ctx.strokeStyle='#2e1d10'; ctx.lineWidth=2; ctx.strokeRect(-21,-60,42,56); // plain back
      }
      R(-21,-6,42,6,'#3a2514');                                       // base
    } else if(t==='chest'){
      if(this.opened){
        // Opened chest: lid hinged back, empty interior visible
        R(-21,-18,42,18,'#6b4326');                               // base
        R(-21,-20,42,4,'#caa15a');                                // trim band
        R(-19,-16,38,14,'#3a2514');                               // dark interior
        if(front){
          // Lid tilted back behind the chest
          ctx.beginPath(); ctx.fillStyle='#7d5230';
          ctx.moveTo(-21,-18); ctx.quadraticCurveTo(-24,-30,-18,-34);
          ctx.lineTo(-21,-18); ctx.fill();
          R(-21,-18,4,18,'#caa15a'); R(17,-18,4,18,'#caa15a');    // corner straps
        }
      } else {
        R(-21,-18,42,18,'#6b4326');                               // base
        ctx.beginPath(); ctx.fillStyle='#7d5230';
        ctx.moveTo(-21,-18); ctx.quadraticCurveTo(0,-34,21,-18); ctx.lineTo(21,-18); ctx.lineTo(-21,-18); ctx.fill();
        R(-21,-20,42,4,'#caa15a');                                // trim band (visible all sides)
        if(front){
          R(-3,-22,6,10,'#e0c074');                               // front lock
          R(-21,-18,4,18,'#caa15a'); R(17,-18,4,18,'#caa15a');    // corner straps
        }
      }
    } else if(t==='vault_door'){
      // Heavy steel bank-vault door ("brankas") — deliberately NOT a
      // cabinet. Owner report: the old flat slab-with-a-seam read as just
      // another loot cabinet. This is now a monumental riveted steel frame
      // with a central SPOKED WHEEL-LOCK, sealed by a glowing violet
      // rune-ring (Act 5 story). It can face left/right/down from the wall
      // snap (placeVaultDoorSpot); only the pure back ('up') hides the
      // mechanism. The mirror flip in draw() keeps the wheel centred on the
      // side walls (it's rotationally symmetric).
      const vfront = facing!=='up';
      const pulse  = 0.55+0.45*Math.sin(this.bob*2.2);
      R(-30,-4,60,4,'#0e0b12');                                 // floor sill shadow
      // ---- outer steel frame (thick, beveled, lit from the left) ----
      R(-30,-78,60,76,'#221d2e');                               // frame recess/back
      R(-30,-78,60,6,'#453e5c');                                // top lintel (lit)
      R(-30,-78,6,76,'#4d4666');                                // left jamb (lit)
      R(24,-78,6,76,'#171320');                                 // right jamb (shade)
      R(-30,-8,60,6,'#171320');                                 // bottom threshold
      if(this.opened){
        // Wheel disengaged, the two leaves parted, warm light spilling out.
        ctx.fillStyle='rgba(210,180,255,.20)';
        ctx.beginPath(); ctx.ellipse(0,-40,24,42,0,0,7); ctx.fill();
        R(-24,-72,20,64,'#2c2640'); R(4,-72,20,64,'#2c2640');   // leaves pushed apart
        R(-24,-72,4,64,'#4d4666');  R(20,-72,4,64,'#4d4666');   // lit inner edges
        if(vfront){ R(-6,-70,2,60,'#c79bff'); R(4,-70,2,60,'#c79bff'); } // light gap
      } else {
        // Sealed slab carrying the wheel-lock.
        R(-23,-72,46,64,'#1b1626');                             // door slab
        ctx.strokeStyle='#3d3550'; ctx.lineWidth=2; ctx.strokeRect(-23,-72,46,64);
        if(vfront){
          ctx.fillStyle='#5b5478';                              // corner + edge rivets
          for(const rx of [-19,19]) for(const ry of [-68,-40,-12]){ ctx.beginPath(); ctx.arc(rx,ry,1.6,0,7); ctx.fill(); }
          ctx.fillStyle='#120e1a';                              // recessed central disc
          ctx.beginPath(); ctx.arc(0,-40,17,0,7); ctx.fill();
          ctx.strokeStyle='#4d4666'; ctx.lineWidth=3;
          ctx.beginPath(); ctx.arc(0,-40,17,0,7); ctx.stroke(); // disc rim
          ctx.strokeStyle='#6b6488'; ctx.lineWidth=3; ctx.lineCap='round';  // spoked wheel
          for(let k=0;k<4;k++){ const wa=k*Math.PI/4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(wa)*13,-40+Math.sin(wa)*13);
            ctx.lineTo(-Math.cos(wa)*13,-40-Math.sin(wa)*13);
            ctx.stroke();
          }
          ctx.lineCap='butt';
          ctx.fillStyle='#7d76a0'; ctx.beginPath(); ctx.arc(0,-40,4,0,7); ctx.fill(); // hub
          ctx.strokeStyle='rgba(180,107,255,'+pulse.toFixed(3)+')'; ctx.lineWidth=2.5; // violet seal ring
          ctx.beginPath(); ctx.arc(0,-40,20,0,7); ctx.stroke();
          ctx.fillStyle='rgba(180,107,255,'+(pulse*0.5).toFixed(3)+')';
          ctx.beginPath(); ctx.arc(0,-40,3,0,7); ctx.fill();    // lit hub core
        } else {
          R(-19,-66,38,54,'#141019');                           // plain back slab
        }
      }
    } else if(t==='urn'){
      // tall clay burial urn with banded engravings
      R(-9,-44,18,6,'#8a6a42');                                  // rim
      R(-6,-40,12,4,'#6d5334');                                  // neck
      R(-15,-36,30,26,'#7a5a36'); R(-11,-36,22,26,'#8a6a42');    // body
      R(-13,-10,26,4,'#5a4228');                                 // foot
      if(front){
        R(-3,-33,4,18,'#a08050');                                // highlight
        R(-9,-26,18,2,'#5a4228'); R(-9,-20,18,2,'#5a4228');      // engraved bands
      }
    } else if(t==='column'){
      // cracked pillar snapped off partway up
      R(-15,-8,30,8,'#6b6557');                                  // base plinth
      R(-11,-52,22,44,'#7d7768');                                // shaft
      R(-11,-52,4,44,'#8f897a'); R(5,-52,6,44,'#645e50');        // fluting shade
      ctx.fillStyle='#7d7768';                                   // jagged broken top
      ctx.beginPath(); ctx.moveTo(-11,-52); ctx.lineTo(-5,-60); ctx.lineTo(1,-54); ctx.lineTo(7,-59); ctx.lineTo(11,-52); ctx.closePath(); ctx.fill();
      if(front){ R(-8,-30,3,10,'#57523f'); R(3,-42,3,8,'#57523f'); }  // cracks
    } else if(t==='brazier'){
      // bronze bowl on a stem, coals still burning (pulses via this.bob)
      R(-11,-6,22,6,'#3d2f1e');                                  // feet base
      R(-3,-16,6,10,'#4d3b26');                                  // stem
      R(-15,-26,30,10,'#6d5334'); R(-13,-24,26,6,'#7d6340');     // bowl
      const fl=0.7+0.3*Math.sin(this.bob*5);
      ctx.fillStyle='rgba(255,120,30,'+(0.8*fl).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(0,-30,8,6+4*fl,0,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,210,110,'+(0.85*fl).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(0,-29,4,3+2*fl,0,0,7); ctx.fill();
    } else if(t==='bones'){
      // scattered remains — a skull and loose bones
      R(-16,-8,10,3,'#cfc4a6'); R(-2,-12,12,3,'#c2b696');
      R(8,-6,8,3,'#cfc4a6'); R(-8,-5,7,3,'#b8ab8b');
      ctx.fillStyle='#e0d6ba';
      ctx.beginPath(); ctx.arc(4,-14,4,0,7); ctx.fill();          // skull
      if(front){ ctx.fillStyle='#3a3226'; ctx.fillRect(2,-15,2,2); ctx.fillRect(6,-15,2,2); } // eye sockets
    } else if(t==='rubble'){
      // collapsed masonry chunks — plain ancient stone, nothing modern
      R(-18,-10,14,10,'#6b6557'); R(-6,-14,16,14,'#7d7768');
      R(6,-8,12,8,'#57523f'); R(-10,-18,9,6,'#8f897a');
      if(front){ R(-3,-8,4,3,'#494437'); }
    } else if(t==='crystal'){
      // glowing cave crystal cluster (grotto-only rare salvage)
      const glow=0.6+0.4*Math.sin(this.bob*3);
      ctx.fillStyle='rgba(120,220,255,'+(0.18*glow).toFixed(3)+')';
      ctx.beginPath(); ctx.ellipse(0,-16,16,20,0,0,7); ctx.fill();
      ctx.fillStyle='#57c8e8';
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(-13,-20); ctx.lineTo(-6,-28); ctx.lineTo(-3,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#7fdcf4';
      ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(0,-34); ctx.lineTo(8,-24); ctx.lineTo(8,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#b8ecfa';
      ctx.beginPath(); ctx.moveTo(1,-6); ctx.lineTo(2,-28); ctx.lineTo(5,-22); ctx.closePath(); ctx.fill();
      R(-12,-2,24,4,'#3f5a63');                                  // rocky base
    } else if(t==='tablet'){
      // engraved stone tablet on a plinth
      R(-18,-6,36,6,'#57523f');                                  // plinth
      R(-14,-44,28,38,'#7d7768'); R(-14,-44,28,4,'#8f897a');     // slab
      if(front){
        ctx.fillStyle='#4a4536';
        for(let ry=-36; ry<-12; ry+=6) ctx.fillRect(-10,ry,20,2); // engraved script rows
        R(-10,-40,8,2,'#c9a63a');                                 // gilded top glyph
      } else { R(-12,-42,24,34,'#6b6557'); }
    } else if(t==='statue'){
      // weathered idol on a pedestal
      R(-16,-8,32,8,'#57523f');                                  // pedestal
      R(-12,-14,24,6,'#6b6557');
      R(-8,-44,16,30,'#7d7768');                                 // robed body
      ctx.fillStyle='#8f897a';
      ctx.beginPath(); ctx.arc(0,-49,7,0,7); ctx.fill();          // head
      R(-12,-40,4,18,'#6b6557'); R(8,-40,4,18,'#6b6557');        // arms
      if(front){
        R(-3,-51,2,2,'#3a3226'); R(2,-51,2,2,'#3a3226');         // hollow eyes
        R(-4,-34,8,2,'#c9a63a');                                  // gold necklace remnant
        R(4,-28,3,8,'#4a4536');                                   // crack
      }
    }
  }
  // solid silhouette for hit-flash overlay
  shapeMask(ctx){
    const h=this.def.h, w=this.def.w;
    ctx.fillRect(-w/2, -h, w, h);
  }
}
window.NS_PROPS={Decor,DECOR_TYPES,rollLoot};
