/* ============================================================
   NULL_STATE :: ASSETS  (sprite sheets + loader + archetypes)
   Frame layouts verified from source sheets (Pixel Crawler -
   Free Pack: Npc's for player classes, Mobs for enemies).
   ------------------------------------------------------------
   All player classes and all monster variants share the same
   idle (4f@32px) and run (6f@64px) sheet geometry — only death
   geometry varies per-entity (frame count/width differ), so it's
   specified individually below. None of these entities have a
   dedicated "attack" sheet (the source pack only ships
   Idle/Run/Death for Npc's and Mobs) — attacking is conveyed by
   holding the idle pose with a flash + particle burst instead
   (see Player/Enemy attack handling in entities.js).
   `scale` is calibrated so on-screen height is ~56px regardless
   of each sprite's native content size; `foot` is the fraction
   of frame height where the character's feet sit (used to anchor
   shadows/ground position).
   ============================================================ */
const HERO = {
  // v80 (owner request): KNIGHT is the one and only playable character — the
  // rogue/wizzard entries are gone so nothing can ever flash a different
  // character into a preview or fallback path again. This entry survives
  // purely as the in-dungeon decode-race fallback sprite set.
  knight: {
    idle:  { src:'/sprites/player/knight_idle.png',  fw:32, fh:32, frames:4, fps:6 },
    walk:  { src:'/sprites/player/knight_run.png',   fw:64, fh:64, frames:6, fps:12 },
    death: { src:'/sprites/player/knight_death.png', fw:48, fh:32, frames:6, fps:10 },
    scale:1.93, foot:1.0,
  },
};

// ============================================================
// LPC hero (Phase 5.3 Task 5). Single body, gear-layered.
// Direction row order confirmed by visual inspection this session
// (base/walkcycle/BODY_male.png, frame 0 of each row):
//   row 0 = up (facing away)   row 1 = left
//   row 2 = down (facing cam)  row 3 = right
// Armor pieces (TORSO/LEGS/FEET/HEAD) are pre-aligned to the SAME grid
// as the body in every animation folder — confirmed this session via a
// direct-stack composite test (zero anchor math needed, see
// README_LPC_INTEGRATION.md). Weapons work the same way: the `slash`
// animation folder already has the swing PRE-BAKED per direction, so a
// weapon overlay is just another direct-stack layer during the attack
// window — NOT continuous anchor+rotation as originally planned (that
// assumption is now corrected).
// ------------------------------------------------------------
const LPC_DIRS = ['up','left','down','right'];
const LPC_BASE = '/sprites/lpc_source/base';
// Idle/walk weapon-carry overlays live at sprites/lpc_source/weapon_walk/
// (NOT under base/). assets.js previously built these paths under LPC_BASE,
// i.e. `.../base/weapon_walk/...`, which does not
// Body + per-animation frame geometry. `rows` = LPC_DIRS.length unless
// noted (hurt has no per-direction rows in this pack — single strip).
const LPC_HERO = {
  walk:   { src:`${LPC_BASE}/walkcycle/BODY_male.png`, fw:64, fh:64, frames:9, rows:4, fps:12 },
  idle:   { src:`${LPC_BASE}/walkcycle/BODY_male.png`, fw:64, fh:64, frames:1, rows:4, fps:1 },
  hurt:   { src:`${LPC_BASE}/hurt/BODY_male.png`,      fw:64, fh:64, frames:6, rows:1, fps:10, loop:false },
  slash:  { src:`${LPC_BASE}/slash/BODY_human.png`,    fw:64, fh:64, frames:6, rows:4, fps:22, loop:false },
  thrust: { src:`${LPC_BASE}/thrust/BODY_animation.png`,fw:64, fh:64, frames:8, rows:4, fps:24, loop:false },
  // shoot (bow-draw pose) — wired this session per user decision (Option A:
  // dedicated archer pose, not particle-only FX). The `bow` folder in the
  // LPC source tree already ships a full BODY_animation.png (13 frames x 4
  // dirs, same 64x64 grid as the other anims) plus matching armor pieces
  // for all 3 tiers and its own WEAPON_bow.png — nothing needed sourcing,
  // it was already in the shipped asset tree, just not referenced yet.
  shoot:  { src:`${LPC_BASE}/bow/BODY_animation.png`,   fw:64, fh:64, frames:13, rows:4, fps:20, loop:false },
  // v80: spellcast pose — used by the LPC caster MONSTERS (orc_shaman /
  // skel_mage / troll_shaman play it as their attack anim). Geometry is the
  // standard LPC 7x4 spellcast block; the hero never plays it (yet).
  spellcast:{ src:`${LPC_BASE}/spellcast/BODY_male.png`, fw:64, fh:64, frames:7, rows:4, fps:12, loop:false },
  // on-screen scale/foot anchor — CALIBRATED this session via a Playwright
  // harness + pixel measurement (PIL bbox on actual alpha content, not just
  // frame size): old knight_idle frame0 has a 29px-tall opaque region inside
  // its 32px frame, and at the old scale (1.93) that renders at 55.97px on
  // screen -- confirming the "~56px" target in the HERO comment above.
  // LPC's BODY_male frame (down-facing, walkcycle row2) has a 47px-tall
  // opaque region inside its 64px frame. So the matching scale is
  // 56/47 ≈ 1.19 (rounded to 1.2), NOT the placeholder 2.2 this was set to
  // earlier this session (2.2 rendered ~140px tall — confirmed via
  // screenshot bbox measurement, nearly 2.5x too big). foot:1.0 confirmed
  // correct as-is: both the old sprite (0px gap) and the LPC sprite (2px
  // gap) have feet essentially flush with the frame's bottom edge.
  scale: 1.2, foot: 1.0,
};

// Armor tier -> LPC part filenames, per animation folder (same filename
// works across walk/idle/slash/thrust/hurt since LPC keeps part names
// consistent per folder). rune_armor -> plate_armor per user decision
// this session (heavy ornate metal reading, not robe/cloth).
const LPC_ARMOR = {
  // v77: equipped armor colours now match the marketplace icons (owner report:
  // "armor preview di inventory tidak sama dengan yg di-equip dari warna/glow").
  // Measured dominant icon colours: leather = warm brown, iron = neutral steel,
  // rune = deep violet with a warding glow. `tint`/`glow` are applied over the
  // LPC layer in drawLPCComposite so the on-body colour reads like the shop art.
  //
  // v81 — the COLOUR matched but the ARMOUR did not. Owner report: the two
  // dearer pieces read as "jubah jaman kuno", an ancient robe, while the shop
  // sold them a plate cuirass. Rendered side by side against their icons that
  // was plainly true:
  //   iron_plate  — icon: a steel plate cuirass. Worn: TORSO_chain_armor_torso,
  //                 a flat chainmail shirt. The player paid for plate and got
  //                 mail.
  //   rune_armor  — icon: a runed cuirass. Worn: a purple chain JACKET under a
  //                 full closed HELMET. The helmet is what made it read as a
  //                 medieval knight rather than as gear; nothing in the icon
  //                 has a helmet in it at all.
  // Both now wear TORSO_plate_armor_torso + the matching pauldrons, which is
  // the piece their icons actually depict, and rune_armor's helmet is gone.
  // Regenerate the portraits after any change here: node scripts/build-hero-portrait.js
  leather_guard: { torso:'TORSO_leather_armor_torso.png', legs:'LEGS_pants_greenish.png', feet:'FEET_shoes_brown.png', tint:'#7a3c18', tintA:0.22 },
  iron_plate:    { torso:'TORSO_plate_armor_torso.png', arms:'TORSO_plate_armor_arms_shoulders.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png' },
  // rune: purple chain jacket base + violet tint + a soft warding glow so it
  // shimmers like the icon (icon desc: "shimmer on hit").
  rune_armor:    { torso:'TORSO_plate_armor_torso.png', arms:'TORSO_plate_armor_arms_shoulders.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', tint:'#5a2fb0', tintA:0.34, glow:'#8a3dff' },
  // Punch list #9 (MiniPay compliance) — the bare LPC BODY_male sheet is the
  // stock LPC "skin" layer with no clothing baked in (underwear only), so
  // any player with no marketplace armor equipped — which is every player
  // at run start, and anyone who hasn't bought armor yet — rendered
  // effectively undressed both in the char-select preview AND in the
  // dungeon. This is NOT a purchasable marketplace item (not in
  // marketplace-items.js, never shown in the shop) — it's a rendering-only
  // fallback outfit. drawLPCComposite() below falls back to this whenever
  // opts.armorId is unset, so bare skin can no longer appear anywhere.
  // Picked plain shirt/pants/shoes (not a repurposed tier) so it visually
  // reads as "default clothes", not "free copy of leather armor".
  base: { torso:'TORSO_leather_armor_shirt_white.png', legs:'LEGS_pants_greenish.png', feet:'FEET_shoes_brown.png' },
  // (v76 Task #7: warden_plate / ancient_aegis were removed from the shop on
  // owner request; their LPC_ARMOR entries went with them.)
  // Phase 3a — render-only full-plate set worn by the Corrupted Knight ENEMY
  // (not a marketplace item, never sold; same status as `base`). Full plate
  // torso/legs/feet + closed plate helm reads as a heavy armoured knight; the
  // enemy applies a dark "corrupted" tint over the whole composite at draw time
  // (see ARCHETYPES.corrupted_knight.lpc.tint). Parts exist across every anim
  // folder, so preloadAll()'s LPC_ARMOR sweep covers it automatically.
  knight_corrupt: { torso:'TORSO_plate_armor_torso.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_plate_armor_helmet.png', arms:'TORSO_plate_armor_arms_shoulders.png' }, // arms = POLISH 3a (menutup lengan telanjang)
};

// ── LPC_OUTFIT — Phase 9 (Cosmetic Skins) ───────────────────────────────────
// Each cosmetic skin is a real LPC clothing/armour LAYER SET, EXACTLY the same
// shape as an LPC_ARMOR entry (torso/legs/feet[/arms/head] PNG per anim folder
// + optional tint/glow). drawLPCComposite() feeds it into the SAME armor-stack
// loop that renders LPC_ARMOR, so a skin needs no new render pipeline — it's
// just another layer set. Keys mirror the type:'outfit' item ids in
// marketplace-items.js / lib/constants/marketplace.ts.
//
// PURE COSMETIC: an outfit changes ONLY the look. Stats live in applyEquipment
// (which never reads outfits), so equipping a skin can't touch HP/ATK. When an
// outfit IS equipped it VISUALLY OVERRIDES the body-clothing layer (over armor
// or the base outfit) so the $-skin is always visible as a flex; the armor's HP
// bonus still applies (stat and render are independent). With NO outfit the
// render path is byte-identical to before. Every layer below already ships in
// public/sprites/lpc_source/base/<anim>/ (reused, no new art) and is present in
// all six anim folders, so the composite aligns on the 64x64 LPC grid.
const LPC_OUTFIT = {
  // TASK B — FREE DEFAULT SKIN. Render-only (NOT a marketplace item, never sold),
  // exactly like LPC_ARMOR.base: it is the fallback body layer drawn whenever the
  // player has no paid skin AND no armor equipped, so a fresh player/guest is
  // never "naked". Owner spec: reads as light armour ("baju jirah") but PLAINER
  // than the paid skins and with NO helmet (bare head), and visually different
  // from both the LPC_ARMOR sets and the 4 paid skins. Composed of a leather
  // cuirass + shoulder guards over steel greaves/boots with a modest cool-steel
  // tint (no glow) — distinct from leather_guard (no arms, cloth legs, brown
  // tint) and from every paid skin (which are full plate/robe WITH a helmet/hood
  // and a glow). drawLPCComposite() feeds it through the same armor-stack loop.
  default_skin: { torso:'TORSO_leather_armor_torso.png', arms:'TORSO_leather_armor_shoulders.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', tint:'#6f8f9c', tintA:0.20 },
  // ── Owner call (2026-07): ashen_warden RETIRED. It was generic grey fantasy
  // plate and read as a different game — NullState is a dark post-collapse
  // bunker crawl, not high fantasy. Replaced by ashfall_scav at the same cheap
  // price point (see LEGACY_ITEM_IDS in lib/constants/marketplace.ts, which
  // keeps anyone who already bought it whole).
  //
  // The three below are built from the LPC layers that were sitting unused —
  // HEAD_chain_armor_hood especially, which gives a hooded silhouette that no
  // other skin has and instantly reads as "not a knight".
  //
  // $1.50 — the cheap entry skin. A wasteland scavenger: cloth, worn leather
  // and a hood, no plate anywhere.
  ashfall_scav: { torso:'TORSO_robe_shirt_brown.png', arms:'TORSO_leather_armor_shoulders.png', legs:'LEGS_pants_greenish.png', feet:'FEET_shoes_brown.png', head:'HEAD_chain_armor_hood.png', tint:'#7a6a4a', tintA:0.30 },
  // $5 — acid-green hazard gear. The game's own signature colour worn as a
  // suit, so it reads as NullState at a glance.
  hazard_warden: { torso:'TORSO_leather_armor_torso.png', arms:'TORSO_leather_armor_bracers.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_chain_armor_hood.png', tint:'#b6ff3d', tintA:0.40, glow:'#d4ff5a' },
  // $4 — cold steel-blue, hooded. The heavy silhouette ashen_warden had, but
  // in the game's palette and with a hood instead of a fantasy great-helm.
  nullsteel: { torso:'TORSO_plate_armor_torso.png', arms:'TORSO_plate_armor_arms_shoulders.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_chain_armor_hood.png', tint:'#2f6f8f', tintA:0.42, glow:'#4fd0ff' },
  // $7 — ember-forged leathers with a warm coal glow.
  emberguard:   { torso:'TORSO_leather_armor_torso.png', arms:'TORSO_leather_armor_shoulders.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_shoes_brown.png', head:'HEAD_leather_armor_hat.png', tint:'#c85a1e', tintA:0.34, glow:'#ff7a2a' },
  // $9 — hooded violet weave (robe silhouette).
  voidweave:    { torso:'TORSO_chain_armor_jacket_purple.png', legs:'LEGS_robe_skirt.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_robe_hood.png', tint:'#6a24b0', tintA:0.36, glow:'#9d4bff' },
  // $10 — gilded champion regalia.
  sungild:      { torso:'TORSO_chain_armor_torso.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', head:'HEAD_chain_armor_helmet.png', tint:'#e0b23a', tintA:0.34, glow:'#ffd24a' },
  // TASK #7 — EXCLUSIVE Season-Pass holder skin (cosmetic, ZERO stats). Only
  // granted to wallets holding an active pass (never sold — hidden:true in the
  // marketplace defs, injected into `owned` by the engine when pass-holder).
  // Washed in the game's signature acid-green with a bright glow and NO helmet,
  // so it reads as the flagship "NullState Warden" flex and is clearly distinct
  // from the grey/ember/void/gold paid skins and the neutral default skin.
  pass_warden:  { torso:'TORSO_chain_armor_torso.png', arms:'TORSO_leather_armor_shoulders.png', legs:'LEGS_plate_armor_pants.png', feet:'FEET_plate_armor_shoes.png', tint:'#00c46a', tintA:0.32, glow:'#00ff88' },
};

// Weapon id -> which body-relative animation folder its overlay sheet
// lives in ('slash' or 'thrust') + the overlay file itself. Confirmed
// this session (direct-stack, verified via composite test):
//   war_axe, void_reaper — found in LPC generator GitHub repo this
//   session (was "missing asset" in prior sessions' plan), downscaled
//   from their 192px oversize cells to 64px same as longsword/rapier.
// ---------------------------------------------------------------------------
// NS_WEAPON — v76 Task #7. Weapons are no longer pre-baked LPC overlay sheets.
// ---------------------------------------------------------------------------
// WHY THE REWRITE: the old approach stacked a 4-row x N-col overlay sheet onto
// the body grid. Re-measured this session (PIL, per row/col alpha scan) the
// shipped sheets are full of holes and NOTHING could be layered on top to fix
// it:
//   longsword_walk / spear_walk / waraxe_walk .. ONLY the down row has art
//   dagger_walk ............................... up row empty; left/right only cols 0,4,5
//   scythe_walk ............................... col 0 empty on up/left/right -> the
//                                               weapon vanished exactly on IDLE
//   scythe_slash / waraxe_slash ............... up row empty for all 6 frames
// That is the root cause of "weapon hilang saat idle" and "senjata pindah
// tangan": each direction fell back to a different art source. It also made
// the owner's own weapon art impossible to show, so the $15 marketplace icon
// and the thing in your hand were different objects entirely.
//
// NEW MODEL: one canonical sprite per weapon (tip UP, grip at the bottom, see
// /sprites/weapons/) drawn by drawWeaponLayer() in entities.js, rotated around
// its grip and pinned to the hero's RIGHT hand. Consequences:
//   * no rows to be missing -> a weapon can never vanish in any direction/frame
//   * one explicit hand anchor -> it can never swap hands
//   * the sprite IS the marketplace icon art -> equipped always matches the shop
//   * attack motion is code, so every weapon gets its own swing (WEAPON_MOTION)
//
// Fields:
//   src    canonical sprite (64px tall box, tip up, grip bottom)
//   anim   BODY pose to play during the attack window ('slash'|'thrust'|'shoot')
//   motion procedural weapon animation, see WEAPON_MOTION in entities.js
//   gy     grip position as a fraction of sprite height from the TOP (1 = bottom)
//   ln     on-screen length in body-frame units (the LPC body frame is 64)
//   sfx    per-weapon attack sound, see Audio.attackFor() in audio.js
//   carry  'hand' (default) or 'back' — 'back' slings the weapon over the
//          shoulder during idle/walk and only brings it to the hands for the
//          attack (owner spec: bow rides on the back while walking)
//   glow   optional hex — premium weapons get a soft pulsing aura + a brighter
//          attack (drawWeaponLayer / swing FX read this). Matches the marketplace
//          icon's glow so equipped == shop.
//   htk    hits-to-kill a NORMAL enemy (owner spec v77): cheap weapons 4, mid 3,
//          the priciest 2. Damage per swing = ceil(enemy.maxHp / htk), so it
//          holds regardless of the enemy's raw HP. Bosses/elites take more (see
//          HTK_BOSS_MUL in game.js). Unarmed falls back to flat atkDmg.
//   ovlTint/ovlTintA — a masked colour wash over the ULPC overlay sheets, so
//          the thing in your hand matched the marketplace icon's palette.
//          GONE from every weapon that is sold, as of the re-skin: the sheets
//          themselves now carry their icon's palette (scripts/build-weapon-
//          skins.js), so washing them again would tint an already-correct
//          sprite a second time. A wash was always the weaker tool anyway —
//          one translucent colour over everything shifts the hue but flattens
//          the shading, because it cannot know that a blade's edge and its
//          shadow belong at different colours. The luminance transfer in that
//          script does know, because it reads the answer off the icon.
//          Only the ENEMY weapons below still carry a wash: they have no shop
//          icon to inherit from, and their dull tint is deliberate.
//          An explicit tintCol at the call site (the frost slow-tell) still
//          overrides everything — that is a gameplay signal, not decoration.
const NS_WPN = '/sprites/weapons';
const NS_WEAPON = {
  rusty_blade:       { src:`${NS_WPN}/rusty_blade.png`,       anim:'slash',  motion:'slash',    gy:0.90, ln:30, sfx:'blade',     htk:4 },
  emberwood_maul:    { src:`${NS_WPN}/emberwood_maul.png`,    anim:'slash',  motion:'chop',     gy:0.94, ln:32, sfx:'wood',      htk:4 },
  // v79: anim shoot->thrust — the ULPC crossbow overlay sheets are drawn
  // against the 8-frame thrust body pose (braced punch-forward shot), there is
  // no crossbow art for the 13-frame bow-draw pose. Projectile timing is
  // progress-based (hitZone p, not frame index) so nothing else moves.
  ironbolt_crossbow: { src:`${NS_WPN}/ironbolt_crossbow.png`, anim:'thrust', motion:'crossbow', gy:0.74, ln:27, sfx:'crossbow', htk:4, carry:'back' },
  argent_waraxe:     { src:`${NS_WPN}/argent_waraxe.png`,     anim:'slash',  motion:'chop',     gy:0.93, ln:32, sfx:'axe',       htk:3 },
  // ancient_blade: sfx 'blade'->'ancient' (v80) — owner wants every weapon to
  // sound distinct; rusty and ancient shared the generic steel sing before.
  ancient_blade:     { src:`${NS_WPN}/ancient_blade.png`,     anim:'slash',  motion:'slash',    gy:0.88, ln:33, sfx:'ancient',   htk:3, glow:'#ffd24a' },
  frost_spear:       { src:`${NS_WPN}/frost_spear.png`,       anim:'thrust', motion:'thrust',   gy:0.72, ln:40, sfx:'spear',     htk:3, glow:'#bdeeff' },
  verdant_reaper:    { src:`${NS_WPN}/verdant_reaper.png`,    anim:'slash',  motion:'reap',     gy:0.96, ln:38, sfx:'scythe',    htk:3, glow:'#57e389' },
  void_katana:       { src:`${NS_WPN}/void_katana.png`,       anim:'slash',  motion:'iai',      gy:0.90, ln:36, sfx:'katana',    htk:2, glow:'#b46bff' },
  sunfire_bow:       { src:`${NS_WPN}/sunfire_bow.png`,       anim:'shoot',  motion:'bow',      gy:0.50, ln:30, sfx:'bow',       htk:2, carry:'back', glow:'#ffcf3d' },
  // ENEMY-ONLY weapons (owner: monsters must NOT wield the player's premium /
  // marketplace weapons — they get their own crude bone/rusted gear). New
  // pixel-art sprites, no `glow` (never premium), a dull tint so they read as
  // grubby enemy kit. These are render defs only; they are NOT sold in the
  // marketplace (see marketplace-items.js).
  bone_blade:  { src:`${NS_WPN}/bone_blade.png`,  anim:'slash',  motion:'slash',  gy:0.90, ln:29, sfx:'blade', htk:4, ovlTint:'#6a6350', ovlTintA:0.16 },
  rusted_shiv: { src:`${NS_WPN}/rusted_shiv.png`, anim:'slash',  motion:'slash',  gy:0.86, ln:24, sfx:'blade', htk:4, ovlTint:'#5a4a3a', ovlTintA:0.18 },
  orc_hacker:  { src:`${NS_WPN}/orc_hacker.png`,  anim:'slash',  motion:'chop',   gy:0.92, ln:29, sfx:'axe',   htk:4, ovlTint:'#4a4038', ovlTintA:0.16 },
  bone_spear:  { src:`${NS_WPN}/bone_spear.png`,  anim:'thrust', motion:'thrust', gy:0.90, ln:34, sfx:'spear', htk:4, ovlTint:'#6a6350', ovlTintA:0.14 },
};

// ---------------------------------------------------------------------------
// LPC_WPN_OVL — v79 (owner decision, option A): artist-drawn weapon ANIMATION
// overlays from the Universal LPC Spritesheet Character Generator
// (github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator,
// attribution in weapon_ulpc/CREDITS.md). These replace the pinned-icon model
// for the on-body render: every weapon has frame-by-frame art that sits IN the
// hero's grip for both the walk/idle carry and the attack swing, because the
// LPC artists drew each frame against the same body rig the game already uses.
//
// WHY THE OLD "holes in the sheets" problem is gone: ULPC weapons ship as TWO
// layers per animation — a foreground sheet (the part of the weapon in front
// of the body) and a background/behind sheet (the part occluded by the body).
// A direction row that is empty in one layer lives in the other; the union is
// complete for every frame of every direction (verified per-frame via PIL this
// session for all 9 weapons). The prior
// sessions stacked only ONE layer, which is exactly why rows looked blank.
//
// Sheets are copied unmodified from ULPC (renamed to <id>_<phase>_<layer>.png).
// Frame geometry is discovered at draw time: every sheet is 4 rows in LPC
// direction order, cell size = height/4 (64 regular, 128/192 oversize with the
// 64px body cell centered inside), columns = frames of the matching body anim
// (atk -> NS_WEAPON.anim's frame count, walk -> 9-frame walkcycle, idle -> col 0).
// ONLY the weapons that actually HAVE sheets. This used to be built for every
// key in NS_WEAPON, which included the four enemy-only weapons — and those have
// no ULPC art, so every load fired 16 requests that were always going to 404,
// and gearReady in game.js could never turn true for one of them (it waits for
// walkFg or walkBg to decode, and neither ever would). Harmless-looking, but it
// is sixteen round trips on a connection this game is meant to be cheap on.
//
// Keep this list in step with assets-src/weapon_ulpc/: a weapon listed here
// without sheets goes back to 404s, and one with sheets but not listed silently
// falls back to the pinned-icon render instead of the animated one.
const ULPC_WEAPONS = [
  'rusty_blade', 'emberwood_maul', 'ironbolt_crossbow', 'argent_waraxe',
  'ancient_blade', 'frost_spear', 'verdant_reaper', 'void_katana', 'sunfire_bow',
];
const LPC_WPN_OVL = {};
ULPC_WEAPONS.forEach(id=>{
  const B = `/sprites/lpc_source/weapon_ulpc/${id}`;
  LPC_WPN_OVL[id] = { atkFg:`${B}_atk_fg.png`, atkBg:`${B}_atk_bg.png`,
                      walkFg:`${B}_walk_fg.png`, walkBg:`${B}_walk_bg.png` };
});

// Hero hand/grip anchor per facing, in 64px body-frame coords. RE-MEASURED
// v77 off base/walkcycle BODY_male: unlike a real over-the-shoulder carry, the
// LPC idle/walk pose holds BOTH hands together low in front of the navel, so
// the grip anchor is the CENTRE of that clasped-hands blob — not out to one
// side. Measured hand-blob centroid per facing (idle col0, both walk halves):
//   up (31.5,36) | left (32.5,45) | down (31.5,45) | right (30.5,45)
// The old x=43/23 values were the bow-overlay centroid (a bow's mass sits at
// its belly, far from the grip) and put the weapon floating beside the hip —
// the root of "senjata tidak dipegang tangan". `front:false` = the weapon is
// occluded by the torso for that facing (drawn before the body).
//   up   : hero faces away  -> weapon in front of the hands = toward camera = ON TOP
//   down : hero faces us     -> weapon crosses in front of the belt = ON TOP
//   left/right (profile)     -> the held weapon reads on top of the near arm
const LPC_HAND = [
  // Attack grip per facing — the hand reaches OUT toward the strike, not the
  // clasped-idle center, so the swing starts from the shoulder on the aim side
  // rather than the middle of the chest.
  { x:34, y:34, front:true  }, // 0 up    — reaching up/away
  { x:26, y:40, front:true  }, // 1 left  — reaching screen-left
  { x:34, y:42, front:true  }, // 2 down  — reaching down/toward camera
  { x:38, y:40, front:true  }, // 3 right — reaching screen-right
];
// Back-carry anchor per facing. v78: EVERY weapon now rides on the hero's back
// while idle/walking (owner spec — the in-hand carry read as "melayang" no
// matter how the hand anchor was tuned, so we sling everything and only bring
// it to the hands for the attack, exactly like the LPC quiver layer does).
// These numbers are LIFTED DIRECTLY from base/walkcycle/BEHIND_quiver.png — the
// point LPC's own artist chose for a slung item — so they are correct by
// construction, not guessed:
//   up (22,47) | left (23,47) | down (42,49) | right (40,47), sling ~135deg.
// front:false everywhere EXCEPT up — a BEHIND_ layer is occluded by the torso
// in every facing except when the hero faces away (up), where the back (and
// thus the slung weapon) is what we see.
const LPC_BACK = [
  { x:22.0, y:44, front:true,  ang:-0.62 }, // 0 up    — back to camera, weapon fully visible
  { x:23.2, y:45, front:false, ang:-0.62 }, // 1 left  — behind torso
  { x:41.6, y:46, front:false, ang: 0.62 }, // 2 down  — behind torso (only pommel/tip peeks)
  { x:39.6, y:45, front:false, ang: 0.62 }, // 3 right — behind torso
];
// Walk-cycle vertical bob (y per frame 0..8), measured off the body sheet.
const LPC_HAND_BOB = [0, 0, -1, -1, -1, 0, 1, 1, 1];
// Resting pose is no longer used for a hand-carry (everything slings on the
// back now); kept only as the attack-idle fallback lean. Values are the slung
// diagonal so a weapon that momentarily has no back anchor still reads sane.
const LPC_REST_ANG = [-0.62, -0.62, 0.62, 0.62];

// monster sprite sheets.
// v80: the whole Pixel Crawler crew (orc_*/skel_*, monsters2 vampire/reaper)
// and the Cave Golem were RETIRED from this table — none of them had a
// 4-direction walk, and most had no attack anim at all. Their archetypes now
// render through the LPC monster pipeline above (lpc_monsters/ composites).
// Their PNG files stay on disk (unreferenced) in case a future enemy wants
// them back. Only the Giant Spider survives: its sheet already carries a
// real row per direction plus a true attack anim.
const MON = {
  // Phase 3b "beast" — DIRECTIONAL monster (LPC-format, OGA CC-BY, see
  // monsters3/CREDITS.md): a real row PER direction (0=up 1=left 2=down
  // 3=right), drawn by the directional path in entities.js (Enemy.dirMon) —
  // NO horizontal flip. Each anim block:
  //   cols  = column stride of the sheet (frames-per-row on disk)
  //   col0  = first column of THIS animation within that row
  //   frames= how many columns this animation spans
  //   oneDir+row = animation lives on a single fixed row (death), not per-dir
  giant_spider: { dir:true, scale:1.7, foot:0.83,
    idle:  {src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:0, frames:1, fps:1},
    walk:  {src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:4, frames:6, fps:10},
    attack:{src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:0, frames:4, fps:14},
    death: {src:'/sprites/monsters3/spider.png', fw:64,fh:64, cols:10, col0:0, frames:4, fps:10, oneDir:true, row:4} },
};

// enemy archetypes (stats are base @ floor 1, scaled by floor).
// Phase 3c (aggressive, user decision): every archetype's `spd` was reduced
// ~33% from its prior value so monsters read as slower/heavier vs the player
// (player spd=141, v65 T1 — was 188). Only `spd` changed — HP/DMG/XP balance is untouched.
// Reference (old -> new): orc_base 42->28, orc_rogue 54->36, orc_warrior 36->24,
// skel_base 44->29, giant_spider 56->38, skel_rogue 58->39, skel_reaper 46->31,
// cave_golem 30->20, vampire 50->34, corrupted_knight 40->27, orc_shaman 40->27,
// skel_mage 40->27, skel_warrior 34->23, THE WARLORD 38->25.
// 'mummy'/'boss' keys are gone — replaced by the Orc/Skeleton crews. Any
// code that gated logic on `arch.key==='mummy'` (e.g. the lift's floor-clear
// check) now keys off `isUndead` (skeleton crew) instead — see game.js.
// ---------------------------------------------------------------------------
// v80 — LPC monster roster (owner request: replace every monster/boss that
// lacked an attack anim or 4-direction walk; 20+ distinct looks for variety).
// Each monster is a pre-baked composite (ULPC body + monster head, tinted,
// see /sprites/lpc_monsters/<id>/{walk,hurt,slash|thrust|spellcast}.png and
// lpc_monsters/CREDITS.md) rendered through the SAME LPC pipeline as the hero
// and Corrupted Knight — so every one of them has a real 9-frame 4-direction
// walk, a real 4-direction attack (slash 6f / thrust 8f / spellcast 7f), and
// a 6-frame death collapse (the LPC hurt anim). Weapons ride on top at
// runtime via the ULPC weapon overlays (incl. glow), exactly like the hero.
const LPC_MON_DIR = '/sprites/lpc_monsters';
// weaponTint (optional): a masked colour wash applied to the carried weapon
// overlay (source-atop, ~0.55 alpha — see _drawWpnOvlLayer). Used by BOSSES so
// their weapon reads as their OWN dark/corrupted blade instead of the bright,
// glowing PREMIUM marketplace weapon the sprite is shared with. Bosses also
// never pass weaponGlow, so no premium aura pulses on them.
function _lpcMon(id, atk, weaponId, scale, weaponTint){
  return { monBase:`${LPC_MON_DIR}/${id}`, atk:atk||'slash', weaponId:weaponId||undefined, scale:scale||1.25, weaponTint:weaponTint||undefined };
}
const ARCHETYPES = [
  { key:'orc_base',    name:'Orc Raider',       hp:92, dmg:9,  spd:28, xp:38, color:'#7fae5a', r:15,
    useLPC:true, lpc:_lpcMon('orc_raider','slash','bone_blade',1.24) },
  { key:'orc_rogue',   name:'Orc Skulker',      hp:80, dmg:11, spd:36, xp:44, color:'#6a9650', r:14,
    useLPC:true, lpc:_lpcMon('orc_skulker','slash',null,1.14) },
  { key:'orc_warrior', name:'Orc Warrior',      hp:126, dmg:13, spd:24, xp:52, color:'#5c8a46', r:17, isUndead:false,
    useLPC:true, lpc:_lpcMon('orc_warrior','slash','orc_hacker',1.34) },
  { key:'skel_base',   name:'Restless Bones',   hp:76, dmg:8,  spd:29, xp:36, color:'#cbb98e', r:14, isUndead:true,
    useLPC:true, lpc:_lpcMon('skel_base','slash',null,1.22) },
  // Phase 3b beast — Giant Spider: KEPT as-is, its sheet already has a real
  // 4-direction walk + attack (the only old monster that met the v80 bar).
  { key:'giant_spider', mon:'giant_spider', name:'Giant Spider',     hp:88, dmg:12, spd:38, xp:52, color:'#5a3a2a', r:15, isUndead:false },
  { key:'skel_rogue',  name:'Bone Skulker',     hp:68, dmg:10, spd:39, xp:42, color:'#b3a378', r:14, isUndead:true,
    useLPC:true, lpc:_lpcMon('skel_rogue','slash','rusted_shiv',1.16) },
  { key:'skel_reaper', name:'Reaper Skeleton',  hp:100, dmg:12, spd:31, xp:50, color:'#cfd6e6', r:15, isUndead:true,
    useLPC:true, lpc:_lpcMon('skel_reaper','slash','bone_blade',1.26) },
  // v80: the old Cave Golem sheet had no attack anim — recast as a Cave Troll
  // (same key so depth-gating/spawn logic is untouched, stats identical).
  { key:'cave_golem',  name:'Cave Troll',       hp:210, dmg:19, spd:20, xp:88, color:'#8a8f9a', r:18, isUndead:false,
    useLPC:true, lpc:_lpcMon('cave_troll','slash',null,1.52) },
  { key:'vampire',     name:'Crypt Vampire',    hp:116, dmg:14, spd:34, xp:55, color:'#8a2f4a', r:15, isUndead:true,
    useLPC:true, lpc:_lpcMon('vampire_lord','slash',null,1.28) },
  { key:'corrupted_knight', name:'Corrupted Knight', hp:150, dmg:16, spd:27, xp:72, color:'#6a3a8a', r:16, isUndead:true,
    useLPC:true, lpc:{ armorId:'knight_corrupt', weaponId:'ancient_blade', tint:'#3a1350', tintAlpha:0.34, scale:1.34 } },
  // ---- v80 new crews (appended; the act-sliding spawn window in game.js
  // brings a different slice of this list into each bunker) ----
  { key:'goblin_stalker', name:'Goblin Stalker',   hp:72, dmg:9,  spd:40, xp:40, color:'#79a352', r:13,
    useLPC:true, lpc:_lpcMon('goblin_stalker','slash','rusted_shiv',1.10) },
  { key:'lizard_raider',  name:'Lizard Raider',    hp:98, dmg:12, spd:30, xp:48, color:'#5a9a5a', r:15,
    useLPC:true, lpc:_lpcMon('lizard_raider','thrust','bone_spear',1.26) },
  { key:'wolf_prowler',   name:'Wolfkin Prowler',  hp:90, dmg:12, spd:38, xp:50, color:'#7d7768', r:15,
    useLPC:true, lpc:_lpcMon('wolf_prowler','slash',null,1.26) },
  { key:'rat_scavenger',  name:'Rat Scavenger',    hp:64, dmg:8,  spd:41, xp:34, color:'#8a8478', r:13,
    useLPC:true, lpc:_lpcMon('rat_scavenger','slash',null,1.10) },
  { key:'zombie_shambler',name:'Shambling Corpse', hp:132, dmg:11, spd:18, xp:50, color:'#9aa77a', r:15, isUndead:true,
    useLPC:true, lpc:_lpcMon('zombie_shambler','slash',null,1.26) },
  { key:'mouse_skulker',  name:'Vermin Skulker',   hp:60, dmg:8,  spd:42, xp:32, color:'#857f72', r:12,
    useLPC:true, lpc:_lpcMon('mouse_skulker','slash','rusted_shiv',1.06) },
  { key:'boar_charger',   name:'Boarman Charger',  hp:140, dmg:15, spd:30, xp:62, color:'#a5705c', r:17,
    useLPC:true, lpc:_lpcMon('boar_charger','slash','orc_hacker',1.36) },
  { key:'alien_husk',     name:'Pale Husk',        hp:86, dmg:11, spd:31, xp:46, color:'#9aa7b0', r:14,
    useLPC:true, lpc:_lpcMon('alien_husk','slash',null,1.22) },
  { key:'troll_shaman',   name:'Troll Shaman',     hp:110, dmg:14, spd:26, xp:60, color:'#6f8f7a', r:16,
    useLPC:true, lpc:_lpcMon('troll_shaman','spellcast',null,1.30) },
  { key:'pig_butcher',    name:'Sty Butcher',      hp:150, dmg:15, spd:26, xp:64, color:'#c58a7a', r:17,
    useLPC:true, lpc:_lpcMon('pig_butcher','slash','orc_hacker',1.36) },
  { key:'jack_reaper',    name:'Hollow Jack',      hp:118, dmg:14, spd:29, xp:62, color:'#e07b28', r:15, isUndead:true,
    useLPC:true, lpc:_lpcMon('jack_reaper','slash','bone_blade',1.28) },
  { key:'wartotaur',      name:'Wartotaur Guard',  hp:160, dmg:16, spd:24, xp:70, color:'#8a6f4a', r:17,
    useLPC:true, lpc:_lpcMon('wartotaur','thrust','bone_spear',1.40) },
  { key:'minotaur_brute', name:'Minotaur Brute',   hp:185, dmg:18, spd:23, xp:80, color:'#7d5a3a', r:18,
    useLPC:true, lpc:_lpcMon('minotaur_brute','slash','orc_hacker',1.46) },
  { key:'frank_hulk',     name:'Sutured Hulk',     hp:220, dmg:19, spd:19, xp:92, color:'#7fae7a', r:18, isUndead:true,
    useLPC:true, lpc:_lpcMon('frank_hulk','slash',null,1.50) },
];
// Casters attack from RANGE (hard to avoid), so their per-hit was the worst
// offender for the "HP bursts away" feel — dmg pulled down (14->9 / 15->9) so
// their ranged pokes chip your health instead of gutting it (owner: caster
// bone + strong monsters should drain slowly, leaving time to flee/heal).
const ORC_SHAMAN_ARCH = { key:'orc_shaman', name:'Orc Shaman', hp:104, dmg:9, spd:27, xp:60, color:'#4a7a3a', r:16,
  useLPC:true, lpc:_lpcMon('orc_shaman','spellcast',null,1.26) };
const SKEL_MAGE_ARCH   = { key:'skel_mage', name:'Bone Caster', hp:88, dmg:9, spd:27, xp:58, color:'#8f9bb8', r:15, isUndead:true,
  useLPC:true, lpc:_lpcMon('skel_mage','spellcast',null,1.26) };
const SKEL_WARRIOR_ARCH= { key:'skel_warrior', name:'Bone Warrior', hp:138, dmg:14, spd:23, xp:56, color:'#9c8f6e', r:17, isUndead:true,
  useLPC:true, lpc:_lpcMon('skel_warrior','slash','orc_hacker',1.34) };
// Boss weapons: reuse an existing weapon overlay SHAPE but wash it in a dark
// "corrupted" tint (5th _lpcMon arg) so a boss never appears to wield the
// bright, glowing PREMIUM marketplace weapon its sprite is shared with (owner:
// "kenapa dia memakai senjata premium … bukan senjata glowing"). Scales were
// also pulled in (1.6–1.7 → 1.4–1.5) — bosses read as bigger than a normal
// enemy without dominating the whole room (owner: "ukurannya terlalu Besar").
const BOSS_ARCH = { key:'orc_warrior', name:'THE WARLORD', hp:1100, dmg:20, spd:25, xp:600, color:'#ff3b5c', r:30, isBossScale:true,
  useLPC:true, lpc:_lpcMon('warlord','slash','orc_hacker',1.4,'#2f2a33') };
// v80: one distinct boss look per campaign act (all with real attack anims).
// game.js picks ACT_BOSSES[campaignActIndex % length], falling back to
// BOSS_ARCH. Stats mirror THE WARLORD so act difficulty tuning is unchanged.
const ACT_BOSSES = [
  BOSS_ARCH,
  { key:'orc_warrior', name:'GRAVE MONARCH',  hp:1100, dmg:20, spd:25, xp:600, color:'#8a2f4a', r:30, isBossScale:true,
    useLPC:true, lpc:_lpcMon('vampire_lord','slash','bone_blade',1.4,'#3a0f1e') },
  { key:'orc_warrior', name:'THE SUTURED ONE',hp:1100, dmg:20, spd:25, xp:600, color:'#7fae7a', r:30, isBossScale:true,
    useLPC:true, lpc:_lpcMon('frank_hulk','slash',null,1.5) },
  { key:'orc_warrior', name:'HORNED TYRANT',  hp:1100, dmg:20, spd:25, xp:600, color:'#8a6f4a', r:30, isBossScale:true,
    useLPC:true, lpc:_lpcMon('wartotaur','thrust','bone_spear',1.45,'#26333f') },
  { key:'orc_warrior', name:'THE PUMPKIN KING',hp:1100, dmg:20, spd:25, xp:600, color:'#e07b28', r:30, isBossScale:true,
    useLPC:true, lpc:_lpcMon('jack_reaper','slash','bone_blade',1.45,'#341a10') },
];

const backgrounds = ['/backgrounds/forest.webp','/backgrounds/desert.webp',
  '/backgrounds/snow.webp','/backgrounds/field.webp','/backgrounds/back.webp'];
const BG_BY_KEY = {
  forest:'/backgrounds/forest.webp', desert:'/backgrounds/desert.webp',
  snow:'/backgrounds/snow.webp', field:'/backgrounds/field.webp', back:'/backgrounds/back.webp',
};

// ---- decoration / world-object sprites ----
const DECOR_SPRITES = {
  // (removed) `door` pointed at /sprites/decor/door_a_frames, which does not
  // exist and has not for some time — the front-facing Mystic Woods door was
  // replaced by the top-down sets below. No DUNGEON_THEME referenced it (they
  // all name doorIron/doorWood/doorIron2/doorWood2), so its only effect was two
  // guaranteed 404s in every preload.
  chest: { src:'/sprites/decor/chest_a_frames', frames:4 },          // 0=closed..3=open, 16x16 each
  // New top-down door/chest sprites — verified true top-down perspective
  // (unlike the Mystic Woods door used above, which is front-facing and
  // only ever looked correct on one wall orientation). 32x32 per frame, 5
  // frames closed->open.
  doorWood:  { src:'/sprites/tiles2/door_wood',  frames:5 },
  doorIron:  { src:'/sprites/tiles2/door_iron',  frames:5 },
  doorWood2: { src:'/sprites/tiles2/door_wood2', frames:5 },
  doorIron2: { src:'/sprites/tiles2/door_iron2', frames:5 },
  chestBig:   { src:'/sprites/tiles2/chest_big',   frames:5 },
  chestSmall: { src:'/sprites/tiles2/chest_small', frames:5 },
  lever:      { src:'/sprites/tiles2/lever',       frames:3 },
};
const GOLDEN_KEY_SRC = '/sprites/items/golden_key.png';

// ---- image cache + loader ----
const _img = {};
function loadImg(src){
  return new Promise(res=>{
    if(_img[src]) return res(_img[src]);
    const im=new Image(); im.onload=()=>{_img[src]=im;res(im);};
    im.onerror=()=>{ console.warn('img fail',src); res(null);}; im.src=src;
  });
}
function img(src){ return _img[src]||null; }

// Small, fast preload used by the title screen. v80: the preview is now the
// LPC knight composite ONLY (no more pixel-crawler stand-in flashing a
// different-looking character), so this set is exactly what drawLPCPreview()
// needs for its first paint: the walkcycle body + the base outfit layers.
// Four small files — the box fills within the first second even on mobile.
async function preloadHeroPreviews(){
  const srcs = [
    LPC_HERO.walk.src,
    `${LPC_BASE}/walkcycle/${LPC_ARMOR.base.torso}`,
    `${LPC_BASE}/walkcycle/${LPC_ARMOR.base.legs}`,
    `${LPC_BASE}/walkcycle/${LPC_ARMOR.base.feet}`,
  ];
  await Promise.all(srcs.map(loadImg));
}

async function preloadLPCHero(){
  const srcs=new Set();
  const animFolders={walk:'walkcycle',idle:'walkcycle',hurt:'hurt',slash:'slash',thrust:'thrust',shoot:'bow'};
  ['walk','idle','hurt','slash','thrust','shoot'].forEach(k=>LPC_HERO[k]&&srcs.add(LPC_HERO[k].src));
  [LPC_ARMOR, LPC_OUTFIT].forEach(set=>Object.values(set).forEach(a=>{
    Object.keys(animFolders).forEach(k=>{
      // Only the LAYER FILENAMES. A set also carries tint/tintA/glow, and
      // Object.values() hands those over just as happily — which is how
      // the preload came to request `.../walkcycle/0.22` (a tint alpha)
      // and `.../walkcycle/#7a3c18` (a colour, which the browser reads
      // as the folder plus a fragment). About 45 doomed requests every
      // time the game loaded.
      Object.values(a).forEach(fn=>{
        if(typeof fn === 'string' && fn.endsWith('.png')) srcs.add(`${LPC_BASE}/${animFolders[k]}/${fn}`);
      });
    });
  }));
  Object.values(NS_WEAPON).forEach(w=>srcs.add(w.src));
  Object.values(LPC_WPN_OVL).forEach(o=>{srcs.add(o.atkFg);srcs.add(o.atkBg);srcs.add(o.walkFg);srcs.add(o.walkBg);});
  await Promise.all([...srcs].map(loadImg));
}

async function preloadAll(){
  const srcs=new Set();
  Object.values(HERO).forEach(h=>['idle','walk','death'].forEach(k=>h[k]&&srcs.add(h[k].src)));
  Object.values(MON).forEach(m=>['idle','walk','attack','death'].forEach(k=>m[k]&&srcs.add(m[k].src)));
  // LPC hero (Phase 5.3 Task 5) — folded into the main preload so both the
  // fresh-start title-screen path AND the "Continue" saved-session path
  // (which skips preloadHeroPreviews entirely, see boot() in game.js)
  // have gear-visual assets ready before the dungeon renders.
  { const animFolders={walk:'walkcycle',idle:'walkcycle',hurt:'hurt',slash:'slash',thrust:'thrust',shoot:'bow'};
    ['walk','idle','hurt','slash','thrust','shoot'].forEach(k=>LPC_HERO[k]&&srcs.add(LPC_HERO[k].src));
    [LPC_ARMOR, LPC_OUTFIT].forEach(set=>Object.values(set).forEach(a=>{
      Object.keys(animFolders).forEach(k=>{
        // Only the LAYER FILENAMES. A set also carries tint/tintA/glow, and
        // Object.values() hands those over just as happily — which is how
        // the preload came to request `.../walkcycle/0.22` (a tint alpha)
        // and `.../walkcycle/#7a3c18` (a colour, which the browser reads
        // as the folder plus a fragment). About 45 doomed requests every
        // time the game loaded.
        Object.values(a).forEach(fn=>{
          if(typeof fn === 'string' && fn.endsWith('.png')) srcs.add(`${LPC_BASE}/${animFolders[k]}/${fn}`);
        });
      });
    }));
    Object.values(NS_WEAPON).forEach(w=>srcs.add(w.src));
    Object.values(LPC_WPN_OVL).forEach(o=>{srcs.add(o.atkFg);srcs.add(o.atkBg);srcs.add(o.walkFg);srcs.add(o.walkBg);});
  }
  // v80: LPC monster sheets — every archetype (incl. elites and the per-act
  // bosses) that renders through the LPC monster pipeline preloads its walk,
  // hurt (death collapse) and attack sheets, so an enemy can never pop in as
  // the fallback silhouette on first aggro.
  [...ARCHETYPES, ORC_SHAMAN_ARCH, SKEL_MAGE_ARCH, SKEL_WARRIOR_ARCH, BOSS_ARCH, ...ACT_BOSSES].forEach(a=>{
    const m=a.mon && MON[a.mon];
    if(m) ['idle','walk','attack','death'].forEach(k=>m[k]&&srcs.add(m[k].src));
    const L=a.lpc;
    if(L && L.monBase){
      srcs.add(`${L.monBase}/walk.png`);
      srcs.add(`${L.monBase}/hurt.png`);
      srcs.add(`${L.monBase}/${L.atk||'slash'}.png`);
    }
  });
  backgrounds.forEach(b=>srcs.add(b));
  srcs.add(GOLDEN_KEY_SRC);
  Object.values(DECOR_SPRITES).forEach(d=>{
    for(let i=0;i<d.frames;i++) srcs.add(`${d.src}/frame_${i}.png`);
  });
  await Promise.all([...srcs].map(loadImg));
}

// ---- per-act dungeon color themes (ancient-ruin palettes) ----
// Base colors sampled from the reference tilesets, extended with the
// earth/dirt, moss, crack and torch tones the procedural tile-texture
// renderer in game.js uses to give floors and walls their aged gradation
// (worn flagstones, packed-earth patches, mossy corners, rough masonry).
// `torch` is stored as bare 'r,g,b' so the renderer can append any alpha.
const DUNGEON_THEMES = {
  bluestone: {
    key:'bluestone',
    wallFill:'#232231', wallEdge:'rgba(128,138,163,.4)',
    floorA:'#343446', floorB:'#3f3f53', floorSpeckle:'rgba(128,138,163,.12)',
    dirtA:'#3b2f22', dirtB:'#2f2519', moss:'rgba(96,124,72,.30)',
    crack:'rgba(10,8,16,.55)', torch:'255,166,66',
    roomGlow:'rgba(146,153,192,0.16)', corridorGlow:'rgba(105,101,132,0.06)',
    door:'doorIron', chest:'chestBig',
  },
  catacombs: {
    key:'catacombs',
    wallFill:'#191010', wallEdge:'rgba(69,65,53,.4)',
    floorA:'#2e2a25', floorB:'#312220', floorSpeckle:'rgba(69,65,53,.14)',
    dirtA:'#33261a', dirtB:'#271d13', moss:'rgba(104,112,60,.28)',
    crack:'rgba(8,5,4,.6)', torch:'255,150,60',
    roomGlow:'rgba(180,140,90,0.14)', corridorGlow:'rgba(120,90,60,0.06)',
    door:'doorWood', chest:'chestSmall',
  },
  icestone: {
    key:'icestone',
    wallFill:'#132430', wallEdge:'rgba(150,200,220,.35)',
    floorA:'#1d3a4a', floorB:'#234458', floorSpeckle:'rgba(180,225,240,.14)',
    dirtA:'#2c3038', dirtB:'#22262d', moss:'rgba(110,150,140,.25)',
    crack:'rgba(4,10,16,.55)', torch:'190,220,255',
    roomGlow:'rgba(170,220,235,0.17)', corridorGlow:'rgba(110,170,190,0.07)',
    door:'doorIron2', chest:'chestBig',
  },
  voidstone: {
    key:'voidstone',
    wallFill:'#1f1229', wallEdge:'rgba(180,120,220,.35)',
    floorA:'#2c1838', floorB:'#341d42', floorSpeckle:'rgba(200,140,230,.13)',
    dirtA:'#31213a', dirtB:'#261830', moss:'rgba(140,100,170,.22)',
    crack:'rgba(12,4,18,.6)', torch:'220,150,255',
    roomGlow:'rgba(190,130,225,0.16)', corridorGlow:'rgba(130,80,160,0.07)',
    door:'doorWood2', chest:'chestSmall',
  },
};

window.NS_ASSETS={HERO,MON,ARCHETYPES,BOSS_ARCH,ACT_BOSSES,ORC_SHAMAN_ARCH,SKEL_MAGE_ARCH,SKEL_WARRIOR_ARCH,
  DUNGEON_THEMES,
  LPC_DIRS,LPC_BASE,LPC_HERO,LPC_ARMOR,LPC_OUTFIT,NS_WEAPON,LPC_WPN_OVL,LPC_HAND,LPC_BACK,LPC_HAND_BOB,LPC_REST_ANG,preloadLPCHero,
  DECOR_SPRITES,GOLDEN_KEY_SRC,backgrounds,BG_BY_KEY,loadImg,img,preloadAll,preloadHeroPreviews};
